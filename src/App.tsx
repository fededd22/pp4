import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.tsx';
import { PhoneLoginForm } from './components/PhoneLoginForm.tsx';
import { OtpVerificationModal } from './components/OtpVerificationModal.tsx';
import { ActiveSessionDashboard } from './components/ActiveSessionDashboard.tsx';
import { SavedNumbersList } from './components/SavedNumbersList.tsx';
import { ActivationsHistory } from './components/ActivationsHistory.tsx';
import { TelegramBotPanel } from './components/TelegramBotPanel.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { SavedAccount, ActivationItem, ServerStatus } from './types.ts';
import { Zap, Smartphone, History, Layers, Bot } from 'lucide-react';

export const App: React.FC = () => {
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [activations, setActivations] = useState<ActivationItem[]>([]);
  const [activeAccount, setActiveAccount] = useState<SavedAccount | null>(null);
  
  // Navigation tabs: 'dashboard' | 'add_number' | 'telegram' | 'accounts' | 'history'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add_number' | 'telegram' | 'accounts' | 'history'>('dashboard');

  // OTP Modal state
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  const [pendingMaskedPhone, setPendingMaskedPhone] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Cooldown timer state
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Settings modal
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Cooldown countdown tick
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const interval = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const [statusRes, accountsRes, activationsRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/accounts'),
        fetch('/api/activations')
      ]);

      if (statusRes.ok) {
        setServerStatus(await statusRes.json());
      }
      if (accountsRes.ok) {
        const accData = await accountsRes.json();
        setAccounts(accData.accounts || []);
        setActiveAccount(current => {
          if (current) {
            const found = accData.accounts.find((a: SavedAccount) => a.msisdn === current.msisdn);
            return found || (accData.accounts[0] || null);
          }
          return accData.accounts[0] || null;
        });
      }
      if (activationsRes.ok) {
        const actData = await activationsRes.json();
        setActivations(actData.activations || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 1. Send OTP flow
  const handleSendOtp = async (phone: string): Promise<boolean> => {
    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.cooldownRemaining) {
          setCooldownRemaining(data.cooldownRemaining);
        }
        showToast(data.error || 'تعذر إرسال رمز التحقق');
        return false;
      }

      setPendingPhone(data.msisdn);
      setPendingMaskedPhone(data.maskedMsisdn);
      setCooldownRemaining(data.cooldown || 40);
      setOtpModalOpen(true);
      return true;
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء إرسال الرمز');
      return false;
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 2. Verify OTP flow
  const handleVerifyOtp = async (otp: string): Promise<boolean> => {
    setIsVerifyingOtp(true);
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: pendingPhone, otp })
      });
      const data = await res.json();

      if (!res.ok) {
        return false;
      }

      setOtpModalOpen(false);
      showToast(data.message || 'تم تسجيل الدخول بنجاح!');
      await fetchData();
      if (data.user) {
        setActiveAccount(data.user);
      }
      setActiveTab('dashboard');
      return true;
    } catch (err) {
      return false;
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 3. Auto Activate flow
  const handleAutoActivate = async (phone: string) => {
    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message || 'تم التفعيل بنجاح!');
        await fetchData();
        const found = accounts.find(a => a.msisdn === data.msisdn);
        if (found) {
          setActiveAccount(found);
        }
        setActiveTab('dashboard');
      } else {
        showToast(data.error || 'فشل التفعيل');
      }
    } catch (err: any) {
      showToast(err.message || 'خطأ في الاتصال');
    }
  };

  // 4. Activate current active session
  const handleDashboardActivate = async (msisdn: string) => {
    const res = await fetch('/api/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: msisdn })
    });
    const data = await res.json();
    await fetchData();
    return {
      success: res.ok,
      message: data.message || data.error || 'حدث خطأ',
      details: data.activation?.details
    };
  };

  // 5. Delete saved account
  const handleDeleteAccount = async (msisdn: string) => {
    try {
      const res = await fetch(`/api/accounts/${msisdn}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('تم حذف الرقم بنجاح');
        if (activeAccount?.msisdn === msisdn) {
          setActiveAccount(null);
        }
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-purple-500 selection:text-white">
      {/* App Header */}
      <Header
        status={serverStatus}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenTelegram={() => setActiveTab('telegram')}
      />

      {/* Toast banner */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-sm p-4 rounded-xl bg-purple-900/90 border border-purple-500 text-white text-xs font-semibold shadow-2xl backdrop-blur animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-2xl max-w-2xl mx-auto backdrop-blur overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>لوحة التفعيل</span>
          </button>

          <button
            onClick={() => setActiveTab('telegram')}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition shrink-0 ${
              activeTab === 'telegram'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Bot className="w-4 h-4 text-sky-400" />
            <span>بوت تلقرام 🤖</span>
          </button>

          <button
            onClick={() => setActiveTab('add_number')}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition shrink-0 ${
              activeTab === 'add_number'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>إضافة رقم 📱</span>
          </button>

          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition shrink-0 relative ${
              activeTab === 'accounts'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>الأرقام ({accounts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition shrink-0 ${
              activeTab === 'history'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>السجل</span>
          </button>
        </div>

        {/* Dynamic Views */}
        {activeTab === 'dashboard' && (
          <div>
            {activeAccount ? (
              <ActiveSessionDashboard
                currentAccount={activeAccount}
                onActivate={handleDashboardActivate}
                onAddNumber={() => setActiveTab('add_number')}
                onRelogin={() => {
                  setActiveAccount(null);
                  setActiveTab('add_number');
                }}
              />
            ) : (
              <div className="space-y-6">
                <PhoneLoginForm
                  onSendOtp={handleSendOtp}
                  onAutoActivate={handleAutoActivate}
                  isLoading={isSendingOtp}
                  cooldownRemaining={cooldownRemaining}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'telegram' && (
          <TelegramBotPanel onRefreshParent={fetchData} />
        )}

        {activeTab === 'add_number' && (
          <div className="max-w-xl mx-auto space-y-4">
            <PhoneLoginForm
              onSendOtp={handleSendOtp}
              onAutoActivate={handleAutoActivate}
              isLoading={isSendingOtp}
              cooldownRemaining={cooldownRemaining}
            />
          </div>
        )}

        {activeTab === 'accounts' && (
          <SavedNumbersList
            accounts={accounts}
            activeMsisdn={activeAccount?.msisdn || null}
            onSelectAccount={(acc) => {
              setActiveAccount(acc);
              setActiveTab('dashboard');
              showToast(`تم تعيين ${acc.maskedMsisdn} كحساب نشط`);
            }}
            onQuickActivate={async (msisdn) => {
              await handleAutoActivate(msisdn);
            }}
            onDeleteAccount={handleDeleteAccount}
            onAddNew={() => setActiveTab('add_number')}
          />
        )}

        {activeTab === 'history' && (
          <ActivationsHistory
            activations={activations}
            onRefresh={fetchData}
          />
        )}

        {/* Multi-number quick list in dashboard view if accounts > 1 */}
        {activeTab === 'dashboard' && accounts.length > 1 && (
          <div className="pt-4">
            <SavedNumbersList
              accounts={accounts}
              activeMsisdn={activeAccount?.msisdn || null}
              onSelectAccount={(acc) => {
                setActiveAccount(acc);
                showToast(`تم تعيين ${acc.maskedMsisdn} كحساب نشط`);
              }}
              onQuickActivate={async (msisdn) => {
                await handleAutoActivate(msisdn);
              }}
              onDeleteAccount={handleDeleteAccount}
              onAddNew={() => setActiveTab('add_number')}
            />
          </div>
        )}
      </main>

      {/* OTP Verification Modal */}
      <OtpVerificationModal
        isOpen={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        onVerify={handleVerifyOtp}
        maskedPhone={pendingMaskedPhone}
        isLoading={isVerifyingOtp}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        status={serverStatus}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <p>⚡ Power4 Ooredoo Bot • v1.5.22 Unlimited Mode • Telegram Bot Integrated</p>
      </footer>
    </div>
  );
};

export default App;
