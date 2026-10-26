import React, { useState } from 'react';
import {
  Zap,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Database,
  Radio,
  Clock,
  Sparkles
} from 'lucide-react';
import { SavedAccount } from '../types.ts';

interface ActiveSessionDashboardProps {
  currentAccount: SavedAccount;
  onActivate: (msisdn: string) => Promise<{ success: boolean; message: string; details?: any }>;
  onAddNumber: () => void;
  onRelogin: () => void;
}

export const ActiveSessionDashboard: React.FC<ActiveSessionDashboardProps> = ({
  currentAccount,
  onActivate,
  onAddNumber,
  onRelogin
}) => {
  const [isActivating, setIsActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
    timestamp: number;
  } | null>(null);

  const handleTriggerActivation = async () => {
    setIsActivating(true);
    try {
      const res = await onActivate(currentAccount.msisdn);
      setActivationResult({
        ...res,
        timestamp: Date.now()
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Account Banner */}
      <div className="bg-slate-900/90 border border-purple-800/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur">
        <div className="absolute top-0 right-0 h-1.5 w-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-purple-300 font-semibold bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded-md">
                  الحساب المرتبط حالياً
                </span>
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
                  نشط
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wider font-mono mt-1" dir="ltr">
                {currentAccount.maskedMsisdn}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onAddNumber}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              <UserPlus className="w-4 h-4 text-purple-400" />
              <span>➕ إضافة رقم آخر</span>
            </button>
            <button
              onClick={onRelogin}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/60 hover:bg-red-950/40 border border-slate-700 hover:border-red-800 text-xs font-semibold text-slate-300 hover:text-red-300 transition"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <span>🔄 تسجيل الدخول من جديد</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Activation Action Card */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-lg mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold mb-4">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>عرض التفعيل المجاني وغير المحدود</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            تفعيل حزمة الإنترنت 1 GB
          </h3>
          <p className="text-slate-300 text-sm mb-7 leading-relaxed">
            اضغط على الزر أدناه لتفعيل باقة الإنترنت تلقائياً أو استرداد جوائز باور سنيك
            (Power Snake) لحسابك النشط.
          </p>

          {/* Big Activation Button */}
          <button
            onClick={handleTriggerActivation}
            disabled={isActivating}
            className={`w-full py-4 sm:py-5 px-6 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.99] shadow-2xl ${
              isActivating
                ? 'bg-purple-900/50 text-purple-200 border border-purple-700/60 cursor-wait'
                : 'bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:from-purple-500 hover:via-pink-500 hover:to-red-500 text-white shadow-purple-600/30 hover:shadow-purple-600/50 ring-2 ring-purple-400/20'
            }`}
          >
            {isActivating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-purple-300" />
                <span>⏳ جاري تفعيل إنترنت... 🚀</span>
              </>
            ) : (
              <>
                <Zap className="w-6 h-6 fill-white" />
                <span>⚡ تفعيل إنترنت (1 GB مجاناً)</span>
              </>
            )}
          </button>

          {/* Quick Specifications */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800 text-center">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <Database className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <div className="text-[11px] text-slate-400">الحجم</div>
              <div className="text-xs sm:text-sm font-bold text-white">1 GB / бонус</div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <Calendar className="w-4 h-4 text-pink-400 mx-auto mb-1" />
              <div className="text-[11px] text-slate-400">الصلاحية</div>
              <div className="text-xs sm:text-sm font-bold text-white">3 أيام</div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <Clock className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <div className="text-[11px] text-slate-400">السرعة</div>
              <div className="text-xs sm:text-sm font-bold text-white">4G+ فائقة</div>
            </div>
          </div>
        </div>
      </div>

      {/* Activation Result Box */}
      {activationResult && (
        <div
          className={`p-5 sm:p-6 rounded-2xl border shadow-xl transition-all animate-fade-in ${
            activationResult.success
              ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
              : 'bg-red-950/40 border-red-700/60 text-red-200'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-2.5 rounded-xl ${
                activationResult.success
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {activationResult.success ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {activationResult.success ? '🎉 عملية تفعيل ناجحة' : 'خطأ في التفعيل'}
                </span>
                <span className="text-[11px] opacity-75 font-mono">
                  {new Date(activationResult.timestamp).toLocaleTimeString('ar-DZ')}
                </span>
              </div>
              <div className="text-sm sm:text-base font-bold whitespace-pre-line text-white">
                {activationResult.message}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
