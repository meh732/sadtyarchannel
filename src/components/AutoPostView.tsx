import React from 'react';
import { 
  Sliders, 
  Send, 
  Smile, 
  ShieldCheck, 
  Zap, 
  Newspaper, 
  Lightbulb, 
  Palette, 
  Sparkles, 
  Check, 
  RefreshCw 
} from 'lucide-react';
import { AutoPostSettings, SecondaryChannelSettings } from '../types';

interface AutoPostViewProps {
  autoPostForm: AutoPostSettings;
  setAutoPostForm: React.Dispatch<React.SetStateAction<AutoPostSettings>>;
  updateChannel2: (patch: Partial<SecondaryChannelSettings>) => void;
  activeAutoPostChannelTab: 'channel1' | 'channel2';
  setActiveAutoPostChannelTab: (tab: 'channel1' | 'channel2') => void;
  actionLoading: string | null;
  handleSaveAutoPostSettings: (e: React.FormEvent) => Promise<void>;
  handleTriggerAutoPost: (channelNum?: number) => Promise<void>;
  handleTriggerConfigsAutoPost: (channelNum?: number) => Promise<void>;
  handleTriggerTechNewsAutoPost: (channelNum?: number) => Promise<void>;
  handleTriggerTechTricksAutoPost: (channelNum?: number) => Promise<void>;
  handleTriggerAiPromptsAutoPost: (channelNum?: number) => Promise<void>;
  handleTriggerFunNewsAutoPost: (channelNum?: number) => Promise<void>;
}

export const AutoPostView: React.FC<AutoPostViewProps> = ({
  autoPostForm,
  setAutoPostForm,
  updateChannel2,
  activeAutoPostChannelTab,
  setActiveAutoPostChannelTab,
  actionLoading,
  handleSaveAutoPostSettings,
  handleTriggerAutoPost,
  handleTriggerConfigsAutoPost,
  handleTriggerTechNewsAutoPost,
  handleTriggerTechTricksAutoPost,
  handleTriggerAiPromptsAutoPost,
  handleTriggerFunNewsAutoPost,
}) => {
  const c2 = autoPostForm.channel2 || {
    enabled: false,
    targetChannel: '',
    adText: '',
    silentMode: false,
    antiFloodDelayMinutes: 3,
    funNewsEnabled: true,
    funNewsIntervalHours: 2,
    funNewsIntervalMinutes: 120,
    funNewsCount: 1,
    configsEnabled: false,
    configCount: 3,
    proxyCount: 1,
    configIntervalMinutes: 240,
    techNewsEnabled: false,
    techNewsCount: 2,
    techNewsIntervalMinutes: 240,
    techTricksEnabled: false,
    techTricksCount: 2,
    techTricksIntervalMinutes: 360,
    aiPromptsEnabled: false,
    aiPromptsCount: 1,
    aiPromptsIntervalMinutes: 360
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-2xl p-6 shadow-md border border-indigo-900/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center shrink-0">
            <Sliders className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-white text-base">سیستم زمان‌بندی و ارسال خودکار دو کاناله (Dual Auto-Post)</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                پشتیبانی کامل از ۲ کانال مجزا
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              می‌توانید برای هر دو کانال به طور کاملاً مستقل مشخص کنید چه دسته‌هایی (کانفیگ، اخبار تکنولوژی، ترفند، پرامپت هوش مصنوعی، فان و سرگرمی تلگرام) و در چه فواصل زمانی ارسال شوند.
            </p>
          </div>
        </div>
      </div>

      {/* Segmented Switcher between Channel 1 and Channel 2 */}
      <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-200/80 rounded-2xl border border-slate-300/60 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveAutoPostChannelTab('channel1')}
          className={`py-3 px-5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-3 cursor-pointer ${
            activeAutoPostChannelTab === 'channel1'
              ? 'bg-white text-indigo-900 shadow-md border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${activeAutoPostChannelTab === 'channel1' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-300/50 text-slate-600'}`}>
              <Send className="w-4 h-4" />
            </div>
            <div className="text-right">
              <div className="font-extrabold text-xs">کانال اول (اصلی)</div>
              <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                {autoPostForm.targetChannel || 'آیدی ثبت نشده'}
              </div>
            </div>
          </div>
          <span className={`w-2.5 h-2.5 rounded-full ${autoPostForm.enabled ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse' : 'bg-slate-300'}`} />
        </button>

        <button
          type="button"
          onClick={() => setActiveAutoPostChannelTab('channel2')}
          className={`py-3 px-5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-3 cursor-pointer ${
            activeAutoPostChannelTab === 'channel2'
              ? 'bg-white text-purple-900 shadow-md border border-purple-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${activeAutoPostChannelTab === 'channel2' ? 'bg-purple-50 text-purple-600' : 'bg-slate-300/50 text-slate-600'}`}>
              <Smile className="w-4 h-4" />
            </div>
            <div className="text-right">
              <div className="font-extrabold text-xs">کانال دوم (اختصاصی / فان و اخبار)</div>
              <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                {c2.targetChannel || 'آیدی ثبت نشده'}
              </div>
            </div>
          </div>
          <span className={`w-2.5 h-2.5 rounded-full ${c2.enabled ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse' : 'bg-slate-300'}`} />
        </button>
      </div>

      <form onSubmit={handleSaveAutoPostSettings} className="space-y-6">
        {/* ================= CHANNEL 1 CONFIGURATION ================= */}
        {activeAutoPostChannelTab === 'channel1' && (
          <div className="space-y-6">
            {/* Master Settings for Channel 1 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">فعال‌سازی ارسال خودکار در کانال اول</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">کنترل کلید اصلی ارسال پست‌های زمان‌بندی‌شده به کانال مقصد اول</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoPostForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-12 h-6 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                    autoPostForm.enabled ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>آیدی کانال مقصد اول</span>
                    <span className="text-[10px] text-slate-400">مثال: MyChannel@</span>
                  </label>
                  <input
                    type="text"
                    required={autoPostForm.enabled}
                    placeholder="@MyChannel"
                    value={autoPostForm.targetChannel}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, targetChannel: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-left font-mono focus:border-indigo-500 focus:outline-none"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>آیدی تبلیغ / اسپانسر کانال اول</span>
                    <span className="text-[10px] text-slate-400">امضای انتهای هر پست</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثلا: @MyBot یا لینک کانال شما"
                    value={autoPostForm.adText || ''}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, adText: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">ارسال بدون صدا (Silent Mode)</span>
                    <span className="text-[10px] text-slate-500">پست بدون بوق و نوتیفیکیشن صوتی</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoPostForm(prev => ({ ...prev, silentMode: !prev.silentMode }))}
                    className={`w-10 h-5 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                      autoPostForm.silentMode ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">ارسال فایل‌های پیکربندی (.npvt, .ovpn)</span>
                    <span className="text-[10px] text-slate-500">ارسال فایل به همراه متن پست</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoPostForm(prev => ({ ...prev, postFiles: !prev.postFiles }))}
                    className={`w-10 h-5 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                      autoPostForm.postFiles ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
              </div>
            </div>

            {/* Anti-Flood Delay */}
            <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-emerald-50">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span>محافظت ضد رگباری کانال اول (Anti-Flood)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      جلوگیری از اسپم
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-500">حداقل فاصله زمانی اجباری بین دو پست ارسالی در کانال اول</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">حداقل فاصله ایمن بین ارسال‌ها</label>
                  <select
                    value={autoPostForm.antiFloodDelayMinutes || 3}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, antiFloodDelayMinutes: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-none bg-emerald-50/20 cursor-pointer font-medium"
                  >
                    <option value="1">۱ دقیقه فاصله</option>
                    <option value="2">۲ دقیقه فاصله</option>
                    <option value="3">۳ دقیقه فاصله (پیشنهادی)</option>
                    <option value="5">۵ دقیقه فاصله</option>
                    <option value="10">۱۰ دقیقه فاصله</option>
                    <option value="15">۱۵ دقیقه فاصله</option>
                  </select>
                </div>
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  اگر چند زمان‌بندی همزمان برسند، بین هر ارسال حداقل <strong>{autoPostForm.antiFloodDelayMinutes || 3} دقیقه</strong> فاصله رعایت می‌شود.
                </div>
              </div>
            </div>

            {/* Category 1: Configs & Proxies */}
            <div className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span>۱. ارسال خودکار کانفیگ‌ها و پروکسی‌ها (Configs)</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${autoPostForm.configsEnabled !== false ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {autoPostForm.configsEnabled !== false ? 'روشن' : 'خاموش'}
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-400">بهترین کانفیگ‌های تست‌شده ویتوری و پروکسی‌های پرسرعت فعال</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoPostForm(prev => ({ ...prev, configsEnabled: prev.configsEnabled === false }))}
                  className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                    autoPostForm.configsEnabled !== false ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">فاصله زمانی ارسال</label>
                  <select
                    value={autoPostForm.configIntervalMinutes || 240}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, configIntervalMinutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="30">هر ۳۰ دقیقه</option>
                    <option value="60">هر ۱ ساعت</option>
                    <option value="120">هر ۲ ساعت</option>
                    <option value="240">هر ۴ ساعت</option>
                    <option value="360">هر ۶ ساعت</option>
                    <option value="720">هر ۱۲ ساعت</option>
                    <option value="1440">هر ۲۴ ساعت</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">تعداد کانفیگ در هر پست</label>
                  <select
                    value={autoPostForm.configCount || 5}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, configCount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="1">۱ عدد</option>
                    <option value="3">۳ عدد</option>
                    <option value="5">۵ عدد</option>
                    <option value="10">۱۰ عدد</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">تعداد پروکسی در هر پست</label>
                  <select
                    value={autoPostForm.proxyCount || 1}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, proxyCount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="0">بدون پروکسی</option>
                    <option value="1">۱ عدد</option>
                    <option value="2">۲ عدد</option>
                    <option value="3">۳ عدد</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-slate-400">
                  {autoPostForm.lastConfigsPostedAt ? `آخرین ارسال: ${new Date(autoPostForm.lastConfigsPostedAt).toLocaleString('fa-IR')}` : 'هنوز ارسالی ثبت نشده'}
                </div>
                <button
                  type="button"
                  onClick={() => handleTriggerConfigsAutoPost(1)}
                  disabled={actionLoading === 'trigger_configs_autopost_1' || !autoPostForm.targetChannel}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'trigger_configs_autopost_1' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>ارسال فوری تست کانفیگ به کانال ۱</span>
                </button>
              </div>
            </div>

            {/* Category 2: Tech News */}
            <div className="bg-white border border-sky-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-sky-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <Newspaper className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span>۲. ارسال خودکار اخبار تکنولوژی در کانال اول</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${autoPostForm.techNewsEnabled !== false ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                        {autoPostForm.techNewsEnabled !== false ? 'روشن' : 'خاموش'}
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-400">تازه‌ترین اخبار داغ فناوری، هوش مصنوعی و اینترنت</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoPostForm(prev => ({ ...prev, techNewsEnabled: prev.techNewsEnabled === false }))}
                  className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                    autoPostForm.techNewsEnabled !== false ? 'bg-sky-600 justify-end' : 'bg-slate-200 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">فاصله زمانی ارسال اخبار</label>
                  <select
                    value={autoPostForm.techNewsIntervalMinutes || 240}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, techNewsIntervalMinutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-sky-500 focus:outline-none cursor-pointer"
                  >
                    <option value="60">هر ۱ ساعت</option>
                    <option value="120">هر ۲ ساعت</option>
                    <option value="240">هر ۴ ساعت</option>
                    <option value="360">هر ۶ ساعت</option>
                    <option value="720">هر ۱۲ ساعت</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">تعداد اخبار در هر نوبت</label>
                  <select
                    value={autoPostForm.techNewsCount || 2}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, techNewsCount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-sky-500 focus:outline-none cursor-pointer"
                  >
                    <option value="1">۱ خبر</option>
                    <option value="2">۲ خبر</option>
                    <option value="3">۳ خبر</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-slate-400">
                  {autoPostForm.lastTechNewsPostedAt ? `آخرین ارسال: ${new Date(autoPostForm.lastTechNewsPostedAt).toLocaleString('fa-IR')}` : 'هنوز ارسالی ثبت نشده'}
                </div>
                <button
                  type="button"
                  onClick={() => handleTriggerTechNewsAutoPost(1)}
                  disabled={actionLoading === 'trigger_tech_news_autopost_1' || !autoPostForm.targetChannel}
                  className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'trigger_tech_news_autopost_1' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>ارسال فوری تست اخبار به کانال ۱</span>
                </button>
              </div>
            </div>

            {/* Category 3: Tech Tricks */}
            <div className="bg-white border border-amber-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-amber-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span>۳. ارسال خودکار ترفندها و رازهای تکنولوژی در کانال اول</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${autoPostForm.techTricksEnabled !== false ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                        {autoPostForm.techTricksEnabled !== false ? 'روشن' : 'خاموش'}
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-400">ترفندهای کاربردی گوشی، دور زدن محدودیت‌ها و کدهای مخفی</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoPostForm(prev => ({ ...prev, techTricksEnabled: prev.techTricksEnabled === false }))}
                  className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                    autoPostForm.techTricksEnabled !== false ? 'bg-amber-600 justify-end' : 'bg-slate-200 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">فاصله زمانی ارسال ترفندها</label>
                  <select
                    value={autoPostForm.techTricksIntervalMinutes || 360}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, techTricksIntervalMinutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="120">هر ۲ ساعت</option>
                    <option value="240">هر ۴ ساعت</option>
                    <option value="360">هر ۶ ساعت</option>
                    <option value="720">هر ۱۲ ساعت</option>
                    <option value="1440">هر ۲۴ ساعت</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">تعداد ترفند در هر نوبت</label>
                  <select
                    value={autoPostForm.techTricksCount || 2}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, techTricksCount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="1">۱ ترفند</option>
                    <option value="2">۲ ترفند</option>
                    <option value="3">۳ ترفند</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-slate-400">
                  {autoPostForm.lastTechTricksPostedAt ? `آخرین ارسال: ${new Date(autoPostForm.lastTechTricksPostedAt).toLocaleString('fa-IR')}` : 'هنوز ارسالی ثبت نشده'}
                </div>
                <button
                  type="button"
                  onClick={() => handleTriggerTechTricksAutoPost(1)}
                  disabled={actionLoading === 'trigger_tech_tricks_autopost_1' || !autoPostForm.targetChannel}
                  className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'trigger_tech_tricks_autopost_1' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>ارسال فوری تست ترفندها به کانال ۱</span>
                </button>
              </div>
            </div>

            {/* Category 4: AI Prompts */}
            <div className="bg-white border border-pink-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-pink-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span>۴. ارسال خودکار پرامپت‌های هوش مصنوعی در کانال اول</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${autoPostForm.aiPromptsEnabled ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-500'}`}>
                        {autoPostForm.aiPromptsEnabled ? 'روشن' : 'خاموش'}
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-400">پرامپت‌های ترند ساخت تصویر و ویدیو با عکس نمونه</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoPostForm(prev => ({ ...prev, aiPromptsEnabled: !prev.aiPromptsEnabled }))}
                  className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                    autoPostForm.aiPromptsEnabled ? 'bg-pink-600 justify-end' : 'bg-slate-200 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">فاصله زمانی ارسال پرامپت‌ها</label>
                  <select
                    value={autoPostForm.aiPromptsIntervalMinutes || 360}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, aiPromptsIntervalMinutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-pink-500 focus:outline-none cursor-pointer"
                  >
                    <option value="120">هر ۲ ساعت</option>
                    <option value="240">هر ۴ ساعت</option>
                    <option value="360">هر ۶ ساعت</option>
                    <option value="720">هر ۱۲ ساعت</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">تعداد پرامپت در هر نوبت</label>
                  <select
                    value={autoPostForm.aiPromptsCount || 1}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, aiPromptsCount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-pink-500 focus:outline-none cursor-pointer"
                  >
                    <option value="1">۱ پرامپت</option>
                    <option value="2">۲ پرامپت</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-slate-400">
                  {autoPostForm.lastAiPromptsPostedAt ? `آخرین ارسال: ${new Date(autoPostForm.lastAiPromptsPostedAt).toLocaleString('fa-IR')}` : 'هنوز ارسالی ثبت نشده'}
                </div>
                <button
                  type="button"
                  onClick={() => handleTriggerAiPromptsAutoPost(1)}
                  disabled={actionLoading === 'trigger_ai_prompts_autopost_1' || !autoPostForm.targetChannel}
                  className="px-3.5 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'trigger_ai_prompts_autopost_1' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>ارسال فوری تست پرامپت به کانال ۱</span>
                </button>
              </div>
            </div>

            {/* Category 5: Fun & General News in Channel 1 */}
            <div className="bg-white border border-yellow-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-yellow-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center">
                    <Smile className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span>۵. ارسال فان و اخبار عمومی در کانال اول</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${autoPostForm.funNewsEnabled ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                        {autoPostForm.funNewsEnabled ? 'روشن' : 'خاموش'}
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-400">ارسال جوک، سرگرمی و اخبار عمومی استخراج شده به کانال اول</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoPostForm(prev => ({ ...prev, funNewsEnabled: !prev.funNewsEnabled }))}
                  className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                    autoPostForm.funNewsEnabled ? 'bg-yellow-600 justify-end' : 'bg-slate-200 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">فاصله زمانی ارسال</label>
                  <select
                    value={autoPostForm.funNewsIntervalMinutes || 120}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, funNewsIntervalMinutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-yellow-500 focus:outline-none cursor-pointer"
                  >
                    <option value="60">هر ۱ ساعت</option>
                    <option value="120">هر ۲ ساعت</option>
                    <option value="240">هر ۴ ساعت</option>
                    <option value="360">هر ۶ ساعت</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">تعداد مطلب در هر نوبت</label>
                  <select
                    value={autoPostForm.funNewsCount || 1}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, funNewsCount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-yellow-500 focus:outline-none cursor-pointer"
                  >
                    <option value="1">۱ مطلب</option>
                    <option value="2">۲ مطلب</option>
                    <option value="3">۳ مطلب</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-slate-400">
                  {autoPostForm.lastFunNewsPostedAt ? `آخرین ارسال: ${new Date(autoPostForm.lastFunNewsPostedAt).toLocaleString('fa-IR')}` : 'هنوز ارسالی ثبت نشده'}
                </div>
                <button
                  type="button"
                  onClick={() => handleTriggerFunNewsAutoPost(1)}
                  disabled={actionLoading === 'trigger_fun_news_autopost_1' || !autoPostForm.targetChannel}
                  className="px-3.5 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'trigger_fun_news_autopost_1' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>ارسال فوری تست فان به کانال ۱</span>
                </button>
              </div>
            </div>

            {/* Presentation Settings */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs pb-2 border-b border-slate-100">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>تنظیمات قالب و پاکسازی آرشیو کانال اول</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">شیوه انتشار پست‌ها در کانال</label>
                  <select
                    value={autoPostForm.techPostMode || 'standalone'}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, techPostMode: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="standalone">پست‌های کاملاً مستقل و مجزا (پیشنهادی)</option>
                    <option value="combined">ادغام درون پست کانفیگ‌ها</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">حذف مطالب قدیمی‌تر از</label>
                  <select
                    value={autoPostForm.autoPurgeOldTechDays || 7}
                    onChange={(e) => setAutoPostForm(prev => ({ ...prev, autoPurgeOldTechDays: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="3">۳ روز</option>
                    <option value="7">۷ روز</option>
                    <option value="14">۱۴ روز</option>
                    <option value="30">۳۰ روز</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bottom Actions for Channel 1 */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="submit"
                disabled={actionLoading === 'save_autopost'}
                className="w-full sm:w-auto px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {actionLoading === 'save_autopost' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال ذخیره تنظیمات...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>ذخیره کلیه تنظیمات و زمان‌بندی‌ها</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTriggerAutoPost(1)}
                disabled={actionLoading === 'trigger_autopost_1' || !autoPostForm.targetChannel}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>ارسال تست جامع به کانال ۱</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= CHANNEL 2 CONFIGURATION ================= */}
        {activeAutoPostChannelTab === 'channel2' && (
          <div className="space-y-6">
            {/* Master Settings for Channel 2 */}
            <div className="bg-white border border-purple-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-purple-50">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span>فعال‌سازی ارسال خودکار در کانال دوم</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                      کانال تفکیک‌شده
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">کنترل سراسری ارسال پست‌های خودکار به مقصد کانال دوم (کانال طنز، سرگرمی، یا ثانویه)</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateChannel2({ enabled: !c2.enabled })}
                  className={`w-12 h-6 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                    c2.enabled ? 'bg-purple-600 justify-end' : 'bg-slate-200 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>آیدی کانال مقصد دوم</span>
                    <span className="text-[10px] text-slate-400">مثال: MySecondChannel@</span>
                  </label>
                  <input
                    type="text"
                    required={c2.enabled}
                    placeholder="@MySecondChannel"
                    value={c2.targetChannel || ''}
                    onChange={(e) => updateChannel2({ targetChannel: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-left font-mono focus:border-purple-500 focus:outline-none"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>آیدی تبلیغ / امضای کانال دوم</span>
                    <span className="text-[10px] text-slate-400">متن زیر هر پست کانال دوم</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثلا: @MySecondChannel یا عضویت در کانال"
                    value={c2.adText || ''}
                    onChange={(e) => updateChannel2({ adText: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">ارسال بدون صدا در کانال دوم (Silent Mode)</span>
                    <span className="text-[10px] text-slate-500">پست بدون بوق و نوتیفیکیشن صوتی</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateChannel2({ silentMode: !c2.silentMode })}
                    className={`w-10 h-5 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                      c2.silentMode ? 'bg-purple-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">فاصله ضد رگباری در کانال دوم</span>
                    <span className="text-[10px] text-slate-500">حداقل تاخیر بین دو ارسال متوالی</span>
                  </div>
                  <select
                    value={c2.antiFloodDelayMinutes || 3}
                    onChange={(e) => updateChannel2({ antiFloodDelayMinutes: Number(e.target.value) })}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white cursor-pointer"
                  >
                    <option value="1">۱ دقیقه</option>
                    <option value="2">۲ دقیقه</option>
                    <option value="3">۳ دقیقه</option>
                    <option value="5">۵ دقیقه</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Special Highlight Category: Fun & General News for Channel 2 */}
            <div className="bg-gradient-to-br from-yellow-50 via-white to-amber-50 border-2 border-yellow-300 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-yellow-200/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-400/20 text-yellow-700 flex items-center justify-center">
                    <Smile className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span>۱. ارسال فان، سرگرمی و اخبار عمومی تلگرام (پیشنهادی برای کانال ۲)</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c2.funNewsEnabled !== false ? 'bg-yellow-200 text-yellow-900' : 'bg-slate-200 text-slate-600'}`}>
                        {c2.funNewsEnabled !== false ? 'روشن' : 'خاموش'}
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-500">استخراج خودکار از کانال‌های طنز و اخبار و ارسال مستقیم به کانال دوم</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateChannel2({ funNewsEnabled: c2.funNewsEnabled === false })}
                  className={`w-12 h-6 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                    c2.funNewsEnabled !== false ? 'bg-yellow-500 justify-end' : 'bg-slate-200 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">فاصله زمانی ارسال فان و اخبار</label>
                  <select
                    value={c2.funNewsIntervalMinutes || 120}
                    onChange={(e) => updateChannel2({ funNewsIntervalMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-yellow-200 bg-white text-xs focus:border-yellow-500 focus:outline-none cursor-pointer font-medium"
                  >
                    <option value="30">هر ۳۰ دقیقه یکبار</option>
                    <option value="60">هر ۱ ساعت یکبار</option>
                    <option value="120">هر ۲ ساعت یکبار (پیش‌فرض)</option>
                    <option value="180">هر ۳ ساعت یکبار</option>
                    <option value="240">هر ۴ ساعت یکبار</option>
                    <option value="360">هر ۶ ساعت یکبار</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">تعداد مطلب در هر بار ارسال</label>
                  <select
                    value={c2.funNewsCount || 1}
                    onChange={(e) => updateChannel2({ funNewsCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-yellow-200 bg-white text-xs focus:border-yellow-500 focus:outline-none cursor-pointer font-medium"
                  >
                    <option value="1">۱ مطلب طنز یا خبر روز</option>
                    <option value="2">۲ مطلب طنز یا خبر روز</option>
                    <option value="3">۳ مطلب طنز یا خبر روز</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-yellow-200/50">
                <div className="text-[11px] text-slate-500">
                  {c2.lastFunNewsPostedAt ? `آخرین ارسال به کانال ۲: ${new Date(c2.lastFunNewsPostedAt).toLocaleString('fa-IR')}` : 'هنوز ارسالی به کانال ۲ انجام نشده'}
                </div>
                <button
                  type="button"
                  onClick={() => handleTriggerFunNewsAutoPost(2)}
                  disabled={actionLoading === 'trigger_fun_news_autopost_2' || !c2.targetChannel}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'trigger_fun_news_autopost_2' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>ارسال فوری تست فان به کانال ۲</span>
                </button>
              </div>
            </div>

            {/* Other categories for Channel 2 (User requested ability to choose whatever they want on channel 2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Configs on Channel 2 */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-xs text-slate-800">ارسال کانفیگ‌ها در کانال ۲</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateChannel2({ configsEnabled: !c2.configsEnabled })}
                    className={`w-9 h-5 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                      c2.configsEnabled ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">فاصله زمانی</label>
                    <select
                      value={c2.configIntervalMinutes || 240}
                      onChange={(e) => updateChannel2({ configIntervalMinutes: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option value="120">۲ ساعت</option>
                      <option value="240">۴ ساعت</option>
                      <option value="360">۶ ساعت</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">تعداد کانفیگ</label>
                    <select
                      value={c2.configCount || 3}
                      onChange={(e) => updateChannel2({ configCount: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option value="1">۱ عدد</option>
                      <option value="3">۳ عدد</option>
                      <option value="5">۵ عدد</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleTriggerConfigsAutoPost(2)}
                  disabled={actionLoading === 'trigger_configs_autopost_2' || !c2.targetChannel}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  <span>تست ارسال کانفیگ به کانال ۲</span>
                </button>
              </div>

              {/* Tech News on Channel 2 */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-sky-600" />
                    <span className="font-bold text-xs text-slate-800">ارسال اخبار تکنولوژی در کانال ۲</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateChannel2({ techNewsEnabled: !c2.techNewsEnabled })}
                    className={`w-9 h-5 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                      c2.techNewsEnabled ? 'bg-sky-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">فاصله زمانی</label>
                    <select
                      value={c2.techNewsIntervalMinutes || 240}
                      onChange={(e) => updateChannel2({ techNewsIntervalMinutes: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option value="120">۲ ساعت</option>
                      <option value="240">۴ ساعت</option>
                      <option value="360">۶ ساعت</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">تعداد خبر</label>
                    <select
                      value={c2.techNewsCount || 2}
                      onChange={(e) => updateChannel2({ techNewsCount: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option value="1">۱ خبر</option>
                      <option value="2">۲ خبر</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleTriggerTechNewsAutoPost(2)}
                  disabled={actionLoading === 'trigger_tech_news_autopost_2' || !c2.targetChannel}
                  className="w-full py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  <span>تست ارسال اخبار به کانال ۲</span>
                </button>
              </div>

              {/* Tech Tricks on Channel 2 */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-xs text-slate-800">ارسال ترفندها در کانال ۲</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateChannel2({ techTricksEnabled: !c2.techTricksEnabled })}
                    className={`w-9 h-5 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                      c2.techTricksEnabled ? 'bg-amber-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">فاصله زمانی</label>
                    <select
                      value={c2.techTricksIntervalMinutes || 360}
                      onChange={(e) => updateChannel2({ techTricksIntervalMinutes: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option value="120">۲ ساعت</option>
                      <option value="360">۶ ساعت</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">تعداد ترفند</label>
                    <select
                      value={c2.techTricksCount || 2}
                      onChange={(e) => updateChannel2({ techTricksCount: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option value="1">۱ ترفند</option>
                      <option value="2">۲ ترفند</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleTriggerTechTricksAutoPost(2)}
                  disabled={actionLoading === 'trigger_tech_tricks_autopost_2' || !c2.targetChannel}
                  className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  <span>تست ارسال ترفند به کانال ۲</span>
                </button>
              </div>

              {/* AI Prompts on Channel 2 */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-pink-600" />
                    <span className="font-bold text-xs text-slate-800">ارسال پرامپت‌ها در کانال ۲</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateChannel2({ aiPromptsEnabled: !c2.aiPromptsEnabled })}
                    className={`w-9 h-5 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                      c2.aiPromptsEnabled ? 'bg-pink-600 justify-end' : 'bg-slate-200 justify-start'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">فاصله زمانی</label>
                    <select
                      value={c2.aiPromptsIntervalMinutes || 360}
                      onChange={(e) => updateChannel2({ aiPromptsIntervalMinutes: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option value="120">۲ ساعت</option>
                      <option value="360">۶ ساعت</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">تعداد پرامپت</label>
                    <select
                      value={c2.aiPromptsCount || 1}
                      onChange={(e) => updateChannel2({ aiPromptsCount: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option value="1">۱ عدد</option>
                      <option value="2">۲ عدد</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleTriggerAiPromptsAutoPost(2)}
                  disabled={actionLoading === 'trigger_ai_prompts_autopost_2' || !c2.targetChannel}
                  className="w-full py-2 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  <span>تست ارسال پرامپت به کانال ۲</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions for Channel 2 */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                type="submit"
                disabled={actionLoading === 'save_autopost'}
                className="w-full sm:w-auto px-7 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {actionLoading === 'save_autopost' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال ذخیره تنظیمات...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>ذخیره تنظیمات کانال دوم</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleTriggerAutoPost(2)}
                disabled={actionLoading === 'trigger_autopost_2' || !c2.targetChannel}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>ارسال تست سراسری به کانال ۲</span>
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
