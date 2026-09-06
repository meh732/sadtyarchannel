import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  AlertTriangle, 
  Moon, 
  Sun, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  Send,
  Zap
} from 'lucide-react';
import { DualChannelGrowthStatus } from '../types';

interface ChannelHealthDashboardProps {
  onTriggerPost?: (channelNum: 1 | 2) => void;
  actionLoading?: string | null;
}

export const ChannelHealthDashboard: React.FC<ChannelHealthDashboardProps> = ({
  onTriggerPost,
  actionLoading
}) => {
  const [data, setData] = useState<DualChannelGrowthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('adminToken') || '';
      const res = await fetch('/api/autopost/channel-health', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`خطا در ارتباط با سرور (${res.status})`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err: any) {
      setError(err.message || 'خطا در دریافت وضعیت سلامت کانال‌ها');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const timer = setInterval(fetchHealth, 45000); // 45s auto poll
    return () => clearInterval(timer);
  }, []);

  if (!data && loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-center gap-3 text-slate-500 text-xs">
        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
        <span>در حال بررسی زنده وضعیت کانال‌ها و سلامت ترافیک تلگرام...</span>
      </div>
    );
  }

  const tehran = data?.tehranTime;
  const ch1 = data?.channel1;
  const ch2 = data?.channel2;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden space-y-4">
      {/* Top Banner: Tehran Time & Time Window Status */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-4 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-indigo-300">
            {tehran?.isSleepHours ? (
              <Moon className="w-5 h-5 text-amber-300" />
            ) : tehran?.isGoldenHour ? (
              <Zap className="w-5 h-5 text-yellow-400" />
            ) : (
              <Sun className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">ساعت رسمی تهران:</span>
              <span className="font-mono text-sm font-extrabold text-white px-2 py-0.5 rounded-lg bg-white/10" dir="ltr">
                {tehran?.timeStr || '--:--'}
              </span>
              <span className="text-[11px] text-slate-300 font-mono" dir="ltr">
                ({tehran?.dateStr})
              </span>
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-2">
              {tehran?.isSleepHours ? (
                <span className="text-amber-300 font-semibold flex items-center gap-1">
                  <Moon className="w-3 h-3" />
                  ساعات سکوت شبانه (۰۰:۳۰ الی ۰۸:۳۰) - ارسال خودکار جهت محافظت از اعضا متوقف است
                </span>
              ) : tehran?.isGoldenHour ? (
                <span className="text-emerald-300 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  ساعت طلایی اوج بازدید و فوروارد در تلگرام
                </span>
              ) : (
                <span className="text-slate-300">
                  ساعات فعالیت عادی روزانه
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchHealth}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>بروزرسانی وضعیت کانال‌ها</span>
        </button>
      </div>

      {error && (
        <div className="mx-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dual Channel Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 pt-0">
        {/* Channel 1 Card */}
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <h4 className="font-extrabold text-slate-900 text-sm">کانال اول (کانفیگ و ترفند)</h4>
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5" dir="ltr">
                {ch1?.channelHandle || 'بدون آیدی'}
              </p>
            </div>
            {typeof ch1?.memberCount === 'number' && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>{ch1.memberCount.toLocaleString('fa-IR')} عضو</span>
              </span>
            )}
          </div>

          {/* Daily Post Cap Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">سقف پست‌های مجاز امروز:</span>
              <span className="font-bold text-slate-900">
                {ch1?.postsToday ?? 0} از {ch1?.maxDailyPosts ?? 4} پست
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  (ch1?.postsToday ?? 0) >= (ch1?.maxDailyPosts ?? 4)
                    ? 'bg-rose-500'
                    : (ch1?.postsToday ?? 0) > 0
                    ? 'bg-indigo-600'
                    : 'bg-slate-300'
                }`}
                style={{ 
                  width: `${Math.min(100, Math.round(((ch1?.postsToday ?? 0) / Math.max(1, ch1?.maxDailyPosts ?? 4)) * 100))}%` 
                }}
              />
            </div>
          </div>

          {/* Spacing & Cooldown Status */}
          <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>فاصله با پست قبلی:</span>
              </span>
              <span className="font-semibold text-slate-800">
                {ch1?.minutesSinceLastPost !== undefined && ch1.minutesSinceLastPost < 9000
                  ? `${ch1.minutesSinceLastPost} دقیقه پیش`
                  : 'پستی اخیراً ثبت نشده'}
              </span>
            </div>
            {ch1?.inCooldown ? (
              <div className="text-amber-700 font-medium text-[11px] flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>خنک‌سازی فعال: {ch1.cooldownRemainingMinutes} دقیقه تا پست بعدی</span>
              </div>
            ) : (
              <div className="text-emerald-700 font-medium text-[11px] flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>فاصله ایمن رعایت شده است (حداقل {ch1?.minSpacingMinutes ?? 180} دقیقه)</span>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="pt-1">
            <div className={`p-2.5 rounded-xl text-xs font-medium ${
              ch1?.statusLevel === 'optimal'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : ch1?.statusLevel === 'warning'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : ch1?.statusLevel === 'blocked'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              <div className="font-bold flex items-center gap-1.5 mb-0.5">
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {ch1?.statusLevel === 'optimal' && 'آماده ارسال پست'}
                  {ch1?.statusLevel === 'warning' && 'در حال رعایت فاصله ایمن'}
                  {ch1?.statusLevel === 'blocked' && 'تکمیل سقف پست‌های روزانه'}
                  {ch1?.statusLevel === 'paused' && 'متوقف (سکوت شبانه یا غیرفعال)'}
                </span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed">{ch1?.statusMessage}</p>
            </div>
          </div>
        </div>

        {/* Channel 2 Card (Fun & Memes) */}
        <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/20 space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-600" />
                <h4 className="font-extrabold text-slate-900 text-sm">کانال دوم (فان، میم و اخبار)</h4>
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5" dir="ltr">
                {ch2?.channelHandle || 'بدون آیدی'}
              </p>
            </div>
            {typeof ch2?.memberCount === 'number' && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>{ch2.memberCount.toLocaleString('fa-IR')} عضو</span>
              </span>
            )}
          </div>

          {/* Daily Post Cap Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">سقف پست‌های مجاز امروز:</span>
              <span className="font-bold text-slate-900">
                {ch2?.postsToday ?? 0} از {ch2?.maxDailyPosts ?? 6} پست
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  (ch2?.postsToday ?? 0) >= (ch2?.maxDailyPosts ?? 6)
                    ? 'bg-rose-500'
                    : (ch2?.postsToday ?? 0) > 0
                    ? 'bg-purple-600'
                    : 'bg-slate-300'
                }`}
                style={{ 
                  width: `${Math.min(100, Math.round(((ch2?.postsToday ?? 0) / Math.max(1, ch2?.maxDailyPosts ?? 6)) * 100))}%` 
                }}
              />
            </div>
          </div>

          {/* Spacing & Cooldown Status */}
          <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>فاصله با پست قبلی:</span>
              </span>
              <span className="font-semibold text-slate-800">
                {ch2?.minutesSinceLastPost !== undefined && ch2.minutesSinceLastPost < 9000
                  ? `${ch2.minutesSinceLastPost} دقیقه پیش`
                  : 'پستی اخیراً ثبت نشده'}
              </span>
            </div>
            {ch2?.inCooldown ? (
              <div className="text-amber-700 font-medium text-[11px] flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>خنک‌سازی فعال: {ch2.cooldownRemainingMinutes} دقیقه تا پست بعدی</span>
              </div>
            ) : (
              <div className="text-emerald-700 font-medium text-[11px] flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>فاصله ایمن رعایت شده است (حداقل {ch2?.minSpacingMinutes ?? 120} دقیقه)</span>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="pt-1">
            <div className={`p-2.5 rounded-xl text-xs font-medium ${
              ch2?.statusLevel === 'optimal'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : ch2?.statusLevel === 'warning'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : ch2?.statusLevel === 'blocked'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              <div className="font-bold flex items-center gap-1.5 mb-0.5">
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {ch2?.statusLevel === 'optimal' && 'آماده ارسال پست'}
                  {ch2?.statusLevel === 'warning' && 'در حال رعایت فاصله ایمن'}
                  {ch2?.statusLevel === 'blocked' && 'تکمیل سقف پست‌های روزانه'}
                  {ch2?.statusLevel === 'paused' && 'متوقف (سکوت شبانه یا غیرفعال)'}
                </span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed">{ch2?.statusMessage}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actionable Churn-Prevention Strategy Box */}
      <div className="mx-4 mb-4 p-4 rounded-xl bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-white border border-indigo-100/90 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-indigo-950">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          <span>استراتژی هوشمند ربات برای توقف ریزش ممبرها و افزایش ویو و فوروارد کانال‌ها:</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed text-[11px]">
          <li><strong>جلوگیری از بمباران نوتیفیکیشن:</strong> ارسال بی‌رویه کانال را اسپم نشان داده و باعث سایلنت کردن (Mute) یا لفت دادن کاربران می‌شود. بات با ایجاد فاصله ۲ تا ۳ ساعته بین پست‌ها، ویو واقعی ایجاد می‌کند.</li>
          <li><strong>سکوت شبانه (۰۰:۳۰ الی ۰۸:۳۰):</strong> هیچ پستی در نیمه‌شب ارسال نمی‌شود تا نوتیفیکیشن‌ها کاربران در حال استراحت را آزار ندهند.</li>
          <li><strong>حالت تک‌پستی مرتب:</strong> به جای ارسال چند فایل و پیام متوالی و شلوغ کردن کانال، همه کانفیگ‌ها در یک پست زیبا همراه دکمه‌های شیشه‌ای قرار می‌گیرند.</li>
        </ul>
      </div>
    </div>
  );
};
