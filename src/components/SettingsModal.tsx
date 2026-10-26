import React, { useState, useEffect } from 'react';
import { X, Shield, Server, Network, Save, Check, ExternalLink } from 'lucide-react';
import { ServerStatus } from '../types.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: ServerStatus | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  status
}) => {
  const [proxyList, setProxyList] = useState<string>('');
  const [savingProxies, setSavingProxies] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/proxies')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data.proxies)) {
            setProxyList(data.proxies.join('\n'));
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveProxies = async () => {
    setSavingProxies(true);
    setSavedSuccess(false);
    try {
      const proxies = proxyList.split('\n').map(p => p.trim()).filter(Boolean);
      const res = await fetch('/api/proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxies })
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingProxies(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Server className="w-5 h-5 text-purple-400" />
          <span>إعدادات النظام والاتصال المباشر</span>
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          معلومات النسخة، إعدادات البوت، وتكوين خوادم البروكسي السكنية (Residential Proxies)
        </p>

        <div className="space-y-4">
          {/* System Info */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">اسم النظام / الإصدار:</span>
              <span className="font-semibold text-purple-300 font-mono">v1.5.22 (Unlimited)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">إصدار Ooredoo BFF:</span>
              <span className="font-mono text-slate-300">v{status?.ooredooVersion || '1.5.17'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">قناة الإشعارات (Telegram):</span>
              <a
                href="https://t.me/ooredoodz6"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline flex items-center gap-1 font-mono"
              >
                {status?.telegramConfig.channel || '@ooredoodz6'}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">معرف المسؤول (Admin ID):</span>
              <span className="font-mono text-slate-300">
                {status?.telegramConfig.adminId || 7462133840}
              </span>
            </div>
          </div>

          {/* Proxy Configuration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Network className="w-4 h-4 text-purple-400" />
                <span>قائمة البروكسي (OOREDOO_PROXIES):</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                host:port:user:pass
              </span>
            </div>
            <textarea
              value={proxyList}
              onChange={(e) => setProxyList(e.target.value)}
              rows={4}
              placeholder="gate.busyip.com:18080:username:password"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              dir="ltr"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              يُستخدم البروكسي للالتفاف على قيود حظر عناوين IP خارج الجزائر.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              onClick={handleSaveProxies}
              disabled={savingProxies}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>تم الحفظ بنجاح</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ التغييرات</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
