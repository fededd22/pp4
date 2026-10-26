import React, { useState, useRef, useEffect } from 'react';
import { KeyRound, Loader2, AlertCircle, X } from 'lucide-react';

interface OtpVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (otp: string) => Promise<boolean>;
  maskedPhone: string;
  isLoading: boolean;
}

export const OtpVerificationModal: React.FC<OtpVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerify,
  maskedPhone,
  isLoading
}) => {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '', '', '']);
      setErrorMsg('');
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    const char = clean[clean.length - 1];
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (errorMsg) setErrorMsg('');

    // Advance to next input
    if (index < 5 && char) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const next = [...digits];
      for (let i = 0; i < 6; i++) {
        next[i] = pasted[i] || '';
      }
      setDigits(next);
      const focusIndex = Math.min(pasted.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const fullOtp = digits.join('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullOtp.length !== 6) {
      setErrorMsg('❌ الرمز يجب أن يكون 6 أرقام صحيحة.');
      return;
    }

    const success = await onVerify(fullOtp);
    if (!success) {
      setErrorMsg('❌ رمز التحقق خاطئ، يرجى المحاولة مرة أخرى.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 left-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            تأكيد رمز التحقق (OTP)
          </h3>
          <p className="text-xs text-slate-300">
            تم إرسال رمز التحقق في رسالة نصية SMS إلى رقمك:
            <span className="font-mono text-purple-400 font-bold mr-1.5" dir="ltr">
              {maskedPhone}
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 6 Digit Inputs */}
          <div>
            <div className="flex items-center justify-center gap-2" dir="ltr" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={isLoading}
                  className={`w-11 h-13 text-center text-xl font-bold font-mono rounded-xl border bg-slate-950 text-white focus:outline-none focus:ring-2 transition ${
                    errorMsg
                      ? 'border-red-500 focus:ring-red-500/30'
                      : digit
                      ? 'border-purple-500 focus:ring-purple-500/30'
                      : 'border-slate-700 focus:border-purple-400 focus:ring-purple-400/20'
                  }`}
                />
              ))}
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-2">
              أدخل الرمز المكون من 6 أرقام المستلم عبر رسالة SMS
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-2">
            <button
              type="submit"
              disabled={fullOtp.length !== 6 || isLoading}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
                fullOtp.length !== 6 || isLoading
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  : 'bg-gradient-to-r from-purple-600 to-red-600 hover:from-purple-500 hover:to-red-500 text-white shadow-lg shadow-purple-900/30'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>🔐 جاري التحقق من الرمز...</span>
                </>
              ) : (
                <span>تأكيد وتسجيل الدخول</span>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
            >
              إلغاء والعودة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
