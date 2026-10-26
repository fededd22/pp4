import React from 'react';
import { Zap, Signal, Bot, Settings, ExternalLink } from 'lucide-react';
import { ServerStatus } from '../types.ts';

interface HeaderProps {
  status: ServerStatus | null;
  onOpenSettings: () => void;
  onOpenTelegram: () => void;
}

export const Header: React.FC<HeaderProps> = ({ status, onOpenSettings, onOpenTelegram }) => {
  return (
    <header className="border-b border-purple-900/40 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-red-500 p-[2px] shadow-lg shadow-purple-500/20">
              <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-400 fill-purple-400" />
              </div>
            </div>
            <span className="absolute -bottom-1 -left-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">
                OOREDOO BOT <span className="text-purple-400 font-normal text-xs sm:text-sm">v1.5.22</span>
              </h1>
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full">
                UNLIMITED MODE
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>تفعيل إنترنت أوريدو 1GB والجوائز</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <Signal className="w-3 h-3" /> متصل
              </span>
            </p>
          </div>
        </div>

        {/* Quick Links & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenTelegram}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-bold transition shadow-sm"
          >
            <Bot className="w-4 h-4 text-sky-400" />
            <span>بوت تلقرام</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>

          <a
            href="https://t.me/ooredoodz6"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
          >
            <span>القناة</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
            title="إعدادات البوت والبروكسي"
          >
            <Settings className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">إعدادات</span>
          </button>
        </div>
      </div>
    </header>
  );
};
