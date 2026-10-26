import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Power,
  RefreshCw,
  ExternalLink,
  Bot,
  MessageSquare,
  ShieldAlert,
  Radio,
  Clock,
  Terminal,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Copy,
  Zap,
  User
} from 'lucide-react';
import { TelegramBotStatus, TelegramLogEntry } from '../types.ts';

interface TelegramBotPanelProps {
  onRefreshParent: () => void;
}

export const TelegramBotPanel: React.FC<TelegramBotPanelProps> = ({ onRefreshParent }) => {
  const [status, setStatus] = useState<TelegramBotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  
  // Custom token & config edit
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [editToken, setEditToken] = useState('');
  const [editChannel, setEditChannel] = useState('');
  const [editAdminId, setEditAdminId] = useState('');

  // Simulator state
  const [simMessages, setSimMessages] = useState<Array<{
    id: string;
    sender: 'user' | 'bot';
    text: string;
    time: string;
    buttons?: Array<{ text: string; data: string }>;
  }>>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'مرحبًا بك! 💜\nبوت لتفعيل الإنترنت بسهولة وسرعة 🚀\nأرسل رقم هاتفك (10 أرقام) لبدء التفعيل 📱.',
      time: '12:00'
    }
  ]);
  const [simInput, setSimInput] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  // Broadcast test
  const [broadcastText, setBroadcastText] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  const [copiedToken, setCopiedToken] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/telegram/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (!isEditingConfig) {
          setEditToken(data.botToken || '');
          setEditChannel(data.channel || '');
          setEditAdminId(String(data.adminId || ''));
        }
      }
    } catch (e) {
      console.error('Error fetching telegram status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [simMessages]);

  const handleTogglePolling = async () => {
    if (!status) return;
    setToggling(true);
    try {
      const res = await fetch('/api/telegram/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: !status.isPolling })
      });
      if (res.ok) {
        await fetchStatus();
        onRefreshParent();
      }
    } finally {
      setToggling(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newToken: editToken,
          newChannel: editChannel,
          newAdminId: editAdminId
        })
      });
      if (res.ok) {
        setIsEditingConfig(false);
        await fetchStatus();
        onRefreshParent();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (status?.botToken) {
      navigator.clipboard.writeText(status.botToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  // Simulator actions
  const handleSimulateSend = async (customText?: string) => {
    const textToSend = customText || simInput.trim();
    if (!textToSend || isSimulating) return;

    const userMsgId = crypto.randomUUID();
    const timeNow = new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

    setSimMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: textToSend,
        time: timeNow
      }
    ]);
    if (!customText) setSimInput('');
    setIsSimulating(true);

    try {
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          text: textToSend,
          senderName: 'المحاكي'
        })
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        // Find latest outgoing message from bot
        const botReplies = data.logs.filter((l: TelegramLogEntry) => l.type === 'out_msg');
        if (botReplies.length > 0) {
          const latest = botReplies[0];
          setSimMessages(prev => [
            ...prev,
            {
              id: latest.id || crypto.randomUUID(),
              sender: 'bot',
              text: latest.text,
              time: new Date(latest.timestamp || Date.now()).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
              buttons: [
                { text: '⚡ تفعيل إنترنت', data: 'menu_activate_1gb' },
                { text: '➕ إضافة رقم آخر', data: 'menu_add_number' },
                { text: '🔄 تسجيل الدخول من جديد', data: 'menu_relogin' }
              ]
            }
          ]);
        }
      }
      await fetchStatus();
      onRefreshParent();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateCallback = async (callbackData: string, label: string) => {
    if (isSimulating) return;
    const timeNow = new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

    setSimMessages(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sender: 'user',
        text: `🔘 ضغط على زر: ${label}`,
        time: timeNow
      }
    ]);

    setIsSimulating(true);
    try {
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'callback',
          callbackData,
          senderName: 'المحاكي'
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        const botReplies = data.logs.filter((l: TelegramLogEntry) => l.type === 'out_msg');
        if (botReplies.length > 0) {
          const latest = botReplies[0];
          setSimMessages(prev => [
            ...prev,
            {
              id: latest.id || crypto.randomUUID(),
              sender: 'bot',
              text: latest.text,
              time: new Date(latest.timestamp || Date.now()).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
              buttons: [
                { text: '⚡ تفعيل إنترنت', data: 'menu_activate_1gb' },
                { text: '➕ إضافة رقم آخر', data: 'menu_add_number' },
                { text: '🔄 تسجيل الدخول من جديد', data: 'menu_relogin' }
              ]
            }
          ]);
        }
      }
      await fetchStatus();
      onRefreshParent();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    setSendingBroadcast(true);
    setBroadcastResult(null);
    try {
      const res = await fetch('/api/telegram/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: broadcastText,
          targetChat: status?.channel || '@ooredoodz6'
        })
      });
      const data = await res.json();
      if (data.result?.ok) {
        setBroadcastResult('✅ تم إرسال الرسالة إلى قناة تلقرام بنجاح!');
        setBroadcastText('');
      } else {
        setBroadcastResult(`⚠️ الرد من تلقرام: ${data.result?.description || 'فشل الإرسال'}`);
      }
      await fetchStatus();
    } catch (err: any) {
      setBroadcastResult(`❌ خطأ: ${err.message}`);
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Bot Header Card */}
      <div className="bg-slate-900/90 border border-purple-800/40 rounded-3xl p-6 shadow-2xl backdrop-blur relative overflow-hidden">
        <div className="absolute top-0 right-0 h-1.5 w-full bg-gradient-to-r from-sky-400 via-purple-500 to-pink-500" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 via-purple-600 to-indigo-600 p-[2px] shadow-lg shadow-sky-500/20">
                <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
                  <Bot className="w-7 h-7 text-sky-400" />
                </div>
              </div>
              <span className={`absolute -bottom-1 -left-1 flex h-4 w-4`}>
                {status?.isPolling && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-4 w-4 border-2 border-slate-900 ${
                    status?.isPolling ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                ></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {status?.botInfo?.first_name || 'Ooredoo Bot DZ'}
                </h2>
                {status?.botInfo?.username && (
                  <a
                    href={`https://t.me/${status.botInfo.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-sky-400 bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-lg hover:bg-sky-900/60 transition inline-flex items-center gap-1"
                  >
                    @{status.botInfo.username}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    status?.isPolling
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60'
                      : 'bg-red-950/60 text-red-400 border-red-700/60'
                  }`}
                >
                  {status?.isPolling ? '⚡ البوت متصل ونشط (Polling)' : '⏹ البوت متوقف'}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-400">توكن البوت المدمج:</span>
                <code className="text-xs font-mono text-purple-300 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 select-all" dir="ltr">
                  {status?.botToken ? `${status.botToken.slice(0, 15)}...${status.botToken.slice(-6)}` : 'غير محدد'}
                </code>
                <button
                  onClick={handleCopyToken}
                  className="p-1 rounded-md text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
                  title="نسخ التوكن بالكامل"
                >
                  {copiedToken ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={handleTogglePolling}
              disabled={toggling}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition shadow-lg ${
                status?.isPolling
                  ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
              }`}
            >
              {status?.isPolling ? (
                <>
                  <Square className="w-4 h-4 fill-amber-400" />
                  <span>إيقاف Polling مؤقتاً</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>تشغيل Polling البوت</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsEditingConfig(!isEditingConfig)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
            >
              {isEditingConfig ? 'إلغاء التعديل' : '⚙️ تعديل التوكن والقناة'}
            </button>

            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="تحديث الحالة"
            >
              <RefreshCw className={`w-4 h-4 text-sky-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Edit Configuration Drawer */}
        {isEditingConfig && (
          <form onSubmit={handleSaveConfig} className="mt-6 pt-6 border-t border-slate-800 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  توكن بوت تلقرام (Bot Token):
                </label>
                <input
                  type="text"
                  value={editToken}
                  onChange={(e) => setEditToken(e.target.value)}
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                  placeholder="7756358682:AAFk..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  معرف قناة الإشعارات (Notify Channel):
                </label>
                <input
                  type="text"
                  value={editChannel}
                  onChange={(e) => setEditChannel(e.target.value)}
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                  placeholder="@ooredoodz6"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  معرف المسؤول (Admin ID):
                </label>
                <input
                  type="text"
                  value={editAdminId}
                  onChange={(e) => setEditAdminId(e.target.value)}
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                  placeholder="7462133840"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingConfig(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md"
              >
                حفظ وإعادة تشغيل البوت
              </button>
            </div>
          </form>
        )}

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
            <span className="text-[11px] text-slate-400 block mb-0.5">الرسائل الواردة</span>
            <span className="text-lg font-black text-white font-mono">
              {status?.totalMessagesReceived || 0}
            </span>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
            <span className="text-[11px] text-slate-400 block mb-0.5">تفعيلات عبر تلقرام</span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              {status?.totalActivationsViaTelegram || 0}
            </span>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
            <span className="text-[11px] text-slate-400 block mb-0.5">قناة الإشعارات</span>
            <span className="text-xs font-bold text-sky-400 font-mono" dir="ltr">
              {status?.channel || '@ooredoodz6'}
            </span>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
            <span className="text-[11px] text-slate-400 block mb-0.5">آخر نشاط</span>
            <span className="text-xs font-mono text-purple-300" dir="ltr">
              {status?.lastActiveTime
                ? new Date(status.lastActiveTime).toLocaleTimeString('ar-DZ')
                : 'في الانتظار'}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Simulator & Event Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive In-Browser Telegram Simulator */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur flex flex-col h-[560px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">محاكي بوت تلقرام المباشر</h3>
                <p className="text-[11px] text-slate-400">
                  جرّب التفاعل المباشر مع البوت من داخل المتصفح
                </p>
              </div>
            </div>

            <button
              onClick={() => handleSimulateSend('/start')}
              disabled={isSimulating}
              className="text-[11px] bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-2.5 py-1 rounded-lg font-semibold transition"
            >
              /start
            </button>
          </div>

          {/* Chat Messages Body */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto space-y-3.5 pr-2 pl-1 py-2 text-xs scroll-smooth"
          >
            {simMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-start' : 'items-end'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                  {msg.sender === 'user' ? (
                    <>
                      <User className="w-3 h-3 text-purple-400" />
                      <span>أنت (المستخدم)</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3 h-3 text-sky-400" />
                      <span>{status?.botInfo?.first_name || 'Ooredoo Bot'}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{msg.time}</span>
                </div>

                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl whitespace-pre-line leading-relaxed shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-purple-600 text-white rounded-br-none'
                      : 'bg-slate-950 border border-slate-800 text-slate-100 rounded-bl-none'
                  }`}
                >
                  {msg.text}

                  {/* Inline Keyboards */}
                  {msg.buttons && msg.buttons.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5">
                      {msg.buttons.map((btn) => (
                        <button
                          key={btn.data}
                          onClick={() => handleSimulateCallback(btn.data, btn.text)}
                          disabled={isSimulating}
                          className="w-full py-2 px-3 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/50 text-purple-200 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
                        >
                          <Zap className="w-3 h-3 text-purple-400" />
                          <span>{btn.text}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isSimulating && (
              <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse">
                <Bot className="w-4 h-4 text-sky-400" />
                <span>جاري كتابة الرد ومعالجة الطلب...</span>
              </div>
            )}
          </div>

          {/* Quick input suggestions */}
          <div className="flex items-center gap-1.5 pt-2 pb-2 overflow-x-auto text-[11px]">
            <span className="text-slate-500 shrink-0">أوامر سريعة:</span>
            <button
              onClick={() => handleSimulateSend('/start')}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition"
            >
              /start
            </button>
            <button
              onClick={() => handleSimulateSend('0550123456')}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition"
            >
              0550123456
            </button>
            <button
              onClick={() => handleSimulateSend('/start')}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition"
            >
              /start
            </button>
          </div>

          {/* Simulator Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSimulateSend();
            }}
            className="flex items-center gap-2 pt-2 border-t border-slate-800"
          >
            <input
              type="text"
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              placeholder="اكتب رسالة (مثال: رقم الهاتف أو الرمز)..."
              disabled={isSimulating}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!simInput.trim() || isSimulating}
              className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:bg-slate-800 disabled:text-slate-600 transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Real-time Telegram Terminal & Event Log */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur flex flex-col h-[560px]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">سجل أحداث البوت المباشر (Live Logs)</h3>
                <p className="text-[11px] text-slate-400">
                  مراقبة طلبات getUpdates والرسائل الواردة والصادرة
                </p>
              </div>
            </div>

            <button
              onClick={fetchStatus}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              title="تحديث السجل"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Logs scroll area */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs font-mono">
            {(!status?.logs || status.logs.length === 0) ? (
              <div className="text-center py-16 text-slate-500 text-xs">
                في انتظار رسائل أو تحديثات من تلقرام...
              </div>
            ) : (
              status.logs.map((log) => {
                let badgeClass = 'bg-slate-800 text-slate-300';
                let label = 'SYSTEM';
                if (log.type === 'in_msg') {
                  badgeClass = 'bg-sky-950 text-sky-400 border border-sky-800/60';
                  label = 'IN MSG';
                } else if (log.type === 'out_msg') {
                  badgeClass = 'bg-purple-950 text-purple-400 border border-purple-800/60';
                  label = 'OUT MSG';
                } else if (log.type === 'callback') {
                  badgeClass = 'bg-emerald-950 text-emerald-400 border border-emerald-800/60';
                  label = 'CALLBACK';
                } else if (log.type === 'error') {
                  badgeClass = 'bg-red-950 text-red-400 border border-red-800/60';
                  label = 'ERROR';
                }

                return (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/70 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${badgeClass}`}>
                          {label}
                        </span>
                        <span className="text-slate-400 font-sans">
                          {log.from} (Chat: {log.chatId})
                        </span>
                      </div>
                      <span className="text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString('ar-DZ')}
                      </span>
                    </div>
                    <div className="text-slate-200 whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                      {log.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Test Broadcast Panel */}
          <form onSubmit={handleSendBroadcast} className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-semibold">إرسال تنبيه أو إشعار مباشر للقناة:</span>
              <span className="text-sky-400 font-mono" dir="ltr">{status?.channel || '@ooredoodz6'}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="اكتب نص الإشعار هنا..."
                disabled={sendingBroadcast}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={!broadcastText.trim() || sendingBroadcast}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition disabled:bg-slate-800"
              >
                {sendingBroadcast ? 'جاري الإرسال...' : 'إرسال للقناة'}
              </button>
            </div>
            {broadcastResult && (
              <p className="text-[11px] text-purple-300 font-sans">{broadcastResult}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
