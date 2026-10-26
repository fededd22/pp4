import React from 'react';
import { History, CheckCircle2, Clock, Zap, RefreshCw } from 'lucide-react';
import { ActivationItem } from '../types.ts';

interface ActivationsHistoryProps {
  activations: ActivationItem[];
  onRefresh: () => void;
}

export const ActivationsHistory: React.FC<ActivationsHistoryProps> = ({
  activations,
  onRefresh
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur shadow-xl">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            <span>سجل عمليات التفعيل الحديثة</span>
          </h3>
          <p className="text-xs text-slate-400">
            تحديث مباشر لعمليات تفعيل الإنترنت والجوائز
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          title="تحديث السجل"
        >
          <RefreshCw className="w-4 h-4 text-purple-400" />
        </button>
      </div>

      {activations.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          لا توجد عمليات تفعيل مسجلة بعد. عند تفعيل الإنترنت ستظهر تفاصيلها هنا.
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {activations.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start justify-between gap-3 text-xs transition hover:border-slate-700"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <Zap className="w-4 h-4 fill-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-white" dir="ltr">
                      {item.maskedMsisdn || item.msisdn}
                    </span>
                    <span className="text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                      1 GB / 3 أيام
                    </span>
                  </div>
                  <p className="text-slate-300 whitespace-pre-line text-[11px] leading-relaxed">
                    {item.message}
                  </p>
                </div>
              </div>

              <div className="text-left shrink-0">
                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono" dir="ltr">
                  <Clock className="w-3 h-3 text-slate-600" />
                  {new Date(item.timestamp).toLocaleTimeString('ar-DZ', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
