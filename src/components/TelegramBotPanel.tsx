import React, { useState } from 'react';
import { Bot, Send, Power, CheckCircle2, AlertCircle, Sparkles, MessageSquare, Radio } from 'lucide-react';
import { SystemSettings } from '../types';

interface TelegramBotPanelProps {
  settings: SystemSettings;
  onSaveSettings: (updated: SystemSettings) => void;
  onToggleBot: () => void;
  onPostNow: (type: string) => void;
  workingCount: number;
}

export const TelegramBotPanel: React.FC<TelegramBotPanelProps> = ({
  settings,
  onSaveSettings,
  onToggleBot,
  onPostNow,
  workingCount,
}) => {
  const [botToken, setBotToken] = useState(settings.botToken || '');
  const [adminId, setAdminId] = useState(settings.adminId || '');
  const [targetChannel, setTargetChannel] = useState(settings.autoPost?.targetChannel || '');
  const [branding, setBranding] = useState(settings.branding || '');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...settings,
      botToken,
      adminId,
      branding,
      autoPost: {
        ...settings.autoPost,
        targetChannel,
      },
    };
    onSaveSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* Bot Controls & Credentials */}
      <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Telegram Bot & Auto-Publisher</h2>
              <p className="text-xs text-slate-400">
                Delivers tested green configs to bot users & posts to your Telegram channel.
              </p>
            </div>
          </div>

          <button
            onClick={onToggleBot}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg ${
              settings.isBotRunning
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
            }`}
          >
            <Power className="w-4 h-4" />
            {settings.isBotRunning ? 'Bot Running (Click to Stop)' : 'Bot Stopped (Click to Start)'}
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Telegram Bot Token (from @BotFather)
              </label>
              <input
                type="text"
                placeholder="123456789:ABCdefGhIJKlmNoPQ..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Admin Telegram ID
              </label>
              <input
                type="text"
                placeholder="987654321"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Target Channel Username / ID
              </label>
              <input
                type="text"
                placeholder="@MyConfigChannel or -100123456789"
                value={targetChannel}
                onChange={(e) => setTargetChannel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Branding Footer / Tagline
              </label>
              <input
                type="text"
                placeholder="🌟 @MyConfigChannel"
                value={branding}
                onChange={(e) => setBranding(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-md"
            >
              Save Bot Credentials
            </button>
            {saved && (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Credentials Saved!
              </span>
            )}
          </div>
        </form>

        {/* Manual Immediate Post Triggers */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <h3 className="text-xs font-bold text-slate-200 mb-3 flex items-center gap-2">
            <Radio className="w-4 h-4 text-indigo-400" />
            Instant Manual Broadcast Triggers
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onPostNow('configs')}
              className="px-3.5 py-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800/60 text-indigo-300 text-xs font-medium rounded-lg transition-all flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              Post Tested Green Configs ({workingCount} Available)
            </button>

            <button
              onClick={() => onPostNow('tech')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-all flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Post Tech News & Tips
            </button>
          </div>
        </div>
      </div>

      {/* Bot Info & Features */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-sky-400" />
            Bot Commands & Features
          </h3>
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <code className="text-sky-400 font-bold shrink-0">/start</code>
              <span>Welcome menu & force-join channel verification.</span>
            </li>
            <li className="flex items-start gap-2 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <code className="text-sky-400 font-bold shrink-0">/getconfig</code>
              <span>Fetches random green, high-speed tested V2Ray config.</span>
            </li>
            <li className="flex items-start gap-2 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <code className="text-sky-400 font-bold shrink-0">/npv</code>
              <span>Provides NapsternetV (.npv / .npvt) file configs.</span>
            </li>
            <li className="flex items-start gap-2 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
              <code className="text-sky-400 font-bold shrink-0">/status</code>
              <span>Shows live stats of total, working, and NPV configs.</span>
            </li>
          </ul>
        </div>

        <div className="mt-6 p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg text-xs text-indigo-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Bot will only serve configs that passed full Iran-Proxy HTTP cURL testing!</span>
        </div>
      </div>
    </div>
  );
};
