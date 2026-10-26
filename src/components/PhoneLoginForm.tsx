import React, { useState } from 'react';
import { Smartphone, ArrowLeft, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface PhoneLoginFormProps {
  onSendOtp: (phone: string) => Promise<boolean>;
  onAutoActivate: (phone: string) => Promise<void>;
  isLoading: boolean;
  cooldownRemaining: number;
}

export const PhoneLoginForm: React.FC<PhoneLoginFormProps> = ({
  onSendOtp,
  onAutoActivate,
  isLoading,
  cooldownRemaining
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [checkingState, setCheckingState] = useState(false);

  const cleanDigits = phoneNumber.replace(/\D/g, '');
  const isValidFormat = /^05\d{8}$/.test(cleanDigits);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    // Allow digits and spaces
    val = val.replace(/[^\d\s]/g, '');
    if (val.length > 12) return;
    setPhoneNumber(val);
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidFormat) {
      setErrorMsg('❌ رقم غير صحيح. أرسل رقم أوريدو (05XXXXXXXX)');
      return;
    }

    setCheckingState(true);
    setErrorMsg('');

    try {
      // 1. Check if the number is already saved
      const res = await fetch('/api/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanDigits })
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'حدث خطأ في التحقق من الرقم');
        setCheckingState(false);
        return;
      }

      if (data.isSaved) {
        // Auto-activate saved number immediately
        await onAutoActivate(cleanDigits);
      } else {
        // New number: trigger OTP send
        const ok = await onSendOtp(cleanDigits);
        if (!ok) {
          setErrorMsg('تعذر إرسال رمز التحقق، يرجى المحاولة لاحقاً');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ في الاتصال بالخادم');
    } finally {
      setCheckingState(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md mx-auto">
        {/* Welcome Text */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-900/30 border border-purple-700/40 text-purple-400 mb-3 shadow-inner">
            <Smartphone className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            مرحبًا بك! 💜
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            بوت لتفعيل الإنترنت بسهولة وسرعة 🚀
            <br />
            أرسل رقم هاتفك (10 أرقام) لبدء التفعيل 📱
          </p>
        </div>

        {/* Feature Hint Box */}
        <div className="bg-slate-950/60 border border-purple-900/30 rounded-xl p-3.5 mb-6 text-xs text-slate-300 space-y-1.5">
          <div className="flex items-center gap-2 text-purple-300 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>نظام التعرف التلقائي الذكي:</span>
          </div>
          <div className="flex items-start gap-1.5 text-slate-400 pr-5">
            <span className="text-emerald-400">•</span>
            <span>إذا كان الرقم محفوظاً سابقاً → سيتم التفعيل تلقائياً ⚡</span>
          </div>
          <div className="flex items-start gap-1.5 text-slate-400 pr-5">
            <span className="text-amber-400">•</span>
            <span>إذا كان رقماً جديداً → سيتم إرسال رمز تحقق 📲</span>
          </div>
        </div>

        {/* Phone Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 text-right">
              رقم هاتف أوريدو (Ooredoo الجزائر)
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phoneNumber}
                onChange={handleInputChange}
                placeholder="05XXXXXXXX"
                dir="ltr"
                className={`w-full bg-slate-950 border text-center font-mono text-lg tracking-wider py-3.5 px-4 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition ${
                  errorMsg
                    ? 'border-red-500/80 focus:ring-red-500/30'
                    : isValidFormat
                    ? 'border-emerald-500/80 focus:ring-emerald-500/30'
                    : 'border-slate-700 focus:border-purple-500 focus:ring-purple-500/30'
                }`}
                disabled={isLoading || checkingState}
                autoFocus
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                DZ +213
              </span>
              {isValidFormat && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 text-right flex items-center justify-between">
              <span>مثال: 0550123456</span>
              <span>10 أرقام تبدأ بـ 05</span>
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {cooldownRemaining > 0 && (
            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>⚠️ يرجى الانتظار {cooldownRemaining} ثانية قبل طلب رمز تحقق جديد.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!isValidFormat || isLoading || checkingState || cooldownRemaining > 0}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition duration-200 shadow-lg ${
              !isValidFormat || isLoading || checkingState || cooldownRemaining > 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                : 'bg-gradient-to-r from-purple-600 via-purple-700 to-red-600 hover:from-purple-500 hover:to-red-500 text-white shadow-purple-900/30 hover:shadow-purple-700/50'
            }`}
          >
            {isLoading || checkingState ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري معالجة الطلب...</span>
              </>
            ) : (
              <>
                <span>متابعة وتفعيل الإنترنت</span>
                <ArrowLeft className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
