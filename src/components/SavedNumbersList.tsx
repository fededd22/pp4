import React from 'react';
import { Smartphone, Zap, Trash2, CheckCircle, ArrowRightLeft } from 'lucide-react';
import { SavedAccount } from '../types.ts';

interface SavedNumbersListProps {
  accounts: SavedAccount[];
  activeMsisdn: string | null;
  onSelectAccount: (account: SavedAccount) => void;
  onQuickActivate: (msisdn: string) => Promise<void>;
  onDeleteAccount: (msisdn: string) => Promise<void>;
  onAddNew: () => void;
}

export const SavedNumbersList: React.FC<SavedNumbersListProps> = ({
  accounts,
  activeMsisdn,
  onSelectAccount,
  onQuickActivate,
  onDeleteAccount,
  onAddNew
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur shadow-xl">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-purple-400" />
            <span>الأرقام المحفوظة (Multi-Number)</span>
          </h3>
          <p className="text-xs text-slate-400">
            يمكنك حفظ عدة أرقام والتبديل بينها أو تفعيل الإنترنت بنقرة واحدة
          </p>
        </div>
        <button
          onClick={onAddNew}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition shadow-sm"
        >
          ➕ إضافة رقم
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          لا توجد أرقام محفوظة حالياً. أضف رقم أوريدو لبدء التفعيل.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accounts.map((acc) => {
            const isActive = acc.msisdn === activeMsisdn;
            const addedDate = new Date((acc.linked_at || acc.created_at) * 1000).toLocaleDateString('ar-DZ');

            return (
              <div
                key={acc.msisdn}
                className={`p-3.5 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-purple-950/30 border-purple-600/60 shadow-md shadow-purple-900/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white" dir="ltr">
                      {acc.maskedMsisdn}
                    </span>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                        <CheckCircle className="w-3 h-3" /> النشط
                      </span>
                    ) : (
                      <button
                        onClick={() => onSelectAccount(acc)}
                        className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 py-0.5 rounded transition"
                      >
                        <ArrowRightLeft className="w-2.5 h-2.5 text-purple-400" />
                        <span>تعيين كنشط</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => onDeleteAccount(acc.msisdn)}
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition"
                    title="حذف الرقم"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                  <span className="text-slate-400">تاريخ الربط: {addedDate}</span>
                  <button
                    onClick={() => onQuickActivate(acc.msisdn)}
                    className="inline-flex items-center gap-1 font-bold text-xs text-purple-400 hover:text-purple-300 transition"
                  >
                    <Zap className="w-3.5 h-3.5 fill-purple-400" />
                    <span>تفعيل سريع ⚡</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
