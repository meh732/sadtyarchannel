import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  UserMinus,
  TrendingUp,
  BarChart3,
  Copy,
  Check,
  Download,
  RefreshCw,
  Send,
  Sparkles,
  AlertTriangle,
  Clock,
  HelpCircle,
  Layers,
  ChevronDown,
  ArrowUpRight,
  ShieldCheck,
  Flame
} from 'lucide-react';
import { ChannelGrowthAnalytics, PollResultItem, ChannelMemberEvent } from '../types';

interface AiChannelIntelligenceProps {
  onSettingsRefresh?: () => void;
}

export const AiChannelIntelligence: React.FC<AiChannelIntelligenceProps> = ({ onSettingsRefresh }) => {
  const [data, setData] = useState<ChannelGrowthAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);
  const [triggeringPoll, setTriggeringPoll] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<1 | 2>(1);
  const [activeSubTab, setActiveSubTab] = useState<'polls' | 'churn' | 'guide'>('polls');
  const [pollSuccessMsg, setPollSuccessMsg] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bot/channel-growth-analytics');
      const json = await res.json();
      if (json.success && json.analytics) {
        setData(json.analytics);
      }
    } catch (err) {
      console.error('Failed to fetch channel growth analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000); // 1 minute auto refresh
    return () => clearInterval(interval);
  }, []);

  const handleCopyPrompt = async () => {
    try {
      setPromptLoading(true);
      const res = await fetch('/api/bot/ai-telemetry-prompt');
      const json = await res.json();
      if (json.success && json.prompt) {
        await navigator.clipboard.writeText(json.prompt);
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 3000);
      }
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    } finally {
      setPromptLoading(false);
    }
  };

  const handleTriggerPoll = async () => {
    try {
      setTriggeringPoll(true);
      setPollSuccessMsg(null);
      const res = await fetch('/api/bot/trigger-smart-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelNum: selectedChannel })
      });
      const json = await res.json();
      if (json.success) {
        setPollSuccessMsg(json.message || 'نظرسنجی با موفقیت ارسال شد');
        fetchAnalytics();
        if (onSettingsRefresh) onSettingsRefresh();
        setTimeout(() => setPollSuccessMsg(null), 5000);
      } else {
        alert(json.message || 'خطا در ارسال نظرسنجی');
      }
    } catch (err: any) {
      alert('خطا در ارتباط با سرور: ' + (err.message || err));
    } finally {
      setTriggeringPoll(false);
    }
  };

  const handleDownloadReport = () => {
    window.location.href = '/api/bot/export-ai-report';
  };

  const summary = data?.summary || {
    totalMembersCh1: 0,
    totalMembersCh2: 0,
    totalJoins: 0,
    totalLeaves: 0,
    netGrowth: 0,
    churnWithin30Min: 0
  };

  const getCategoryLabel = (cat?: string) => {
    switch (cat) {
      case 'configs': return 'کانفیگ و پروکسی';
      case 'digital_tools': return 'جعبه‌ابزار دیجیتال و هوش مصنوعی';
      case 'tricks': return 'ترفندهای فناوری';
      case 'news': return 'اخبار تکنولوژی';
      case 'prompts': return 'پرامپت‌های AI';
      case 'fun': return 'سرگرمی و دانستنی';
      case 'polls': return 'نظرسنجی هوشمند';
      default: return cat || 'نامشخص';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-6 relative overflow-hidden">
      {/* Decorative top ambient glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Quick Action Hub */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                پایش هوشمند کانال و آماده‌سازی داده‌ها برای هوش مصنوعی
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  AI Intelligence & Telemetry
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ثبت دقیق آمار ورود، خروج، ریزش اعضا و پاسخ‌های نظرسنجی جهت تحلیل در مدل‌های زبانی (Gemini / ChatGPT / Claude) و بهینه‌سازی مداوم بات
              </p>
            </div>
          </div>
        </div>

        {/* Global Control Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyPrompt}
            disabled={promptLoading}
            className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md cursor-pointer ${
              copiedPrompt
                ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30'
            }`}
            title="تولید خودکار پرامپت استاندارد حاوی تمام لاگ‌ها، آمار ورود/خروج و نظرسنجی‌ها برای ارسال مستقیم به چت‌بات‌ها"
          >
            {copiedPrompt ? (
              <>
                <Check className="w-4 h-4" />
                <span>پرامپت تحلیل کپی شد!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>📋 کپی پرامپت آماده هوش مصنوعی</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadReport}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
            title="دانلود گزارش کامل متنی"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>دانلود لاگ (.txt)</span>
          </button>

          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700 cursor-pointer"
            title="بروزرسانی داده‌ها"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {pollSuccessMsg && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{pollSuccessMsg}</span>
        </div>
      )}

      {/* KPI Cards: Growth & Churn Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5 relative z-10">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>اعضای کانال ۱</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-white font-mono" dir="ltr">
              {summary.totalMembersCh1.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">عضو</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 truncate">
            کانال اصلی کانفیگ
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>کل ورودی‌ها (Joins)</span>
            <UserPlus className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-400 font-mono" dir="ltr">
              +{summary.totalJoins.toLocaleString()}
            </span>
            <span className="text-[11px] text-emerald-500/80">عضویت جدید</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            ثبت‌شده در دیتابیس لاگ
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>کل خروجی‌ها (Leaves)</span>
            <UserMinus className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-rose-400 font-mono" dir="ltr">
              -{summary.totalLeaves.toLocaleString()}
            </span>
            <span className="text-[11px] text-rose-500/80">لفت و ریزش</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            خروج از کانال‌ها
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>رشد خالص کانال</span>
            <TrendingUp className={`w-4 h-4 ${summary.netGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`text-xl font-black font-mono ${
                summary.netGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
              dir="ltr"
            >
              {summary.netGrowth > 0 ? `+${summary.netGrowth}` : summary.netGrowth}
            </span>
            <span className="text-[11px] text-slate-400">تراز کل</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            تفاضل ورود و خروج
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
            <span>ریزش زیر ۳۰ دقیقه بعد از پست</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-amber-400 font-mono" dir="ltr">
              {summary.churnWithin30Min}
            </span>
            <span className="text-[11px] text-amber-500/80">
              ({summary.totalLeaves > 0 ? Math.round((summary.churnWithin30Min / summary.totalLeaves) * 100) : 0}%)
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            شاخص حساسیت مخاطبان به نوتیفیکیشن
          </div>
        </div>
      </div>

      {/* Trigger Poll Bar */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">ارسال هدفمند نظرسنجی جدید به کانال:</div>
            <div className="text-[11px] text-slate-400">
              ربات به‌صورت هوشمند نظرسنجی بعدی از چرخه سوالات استراتژیک را انتخاب و به کانال می‌فرستد.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedChannel(1)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedChannel === 1 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              کانال ۱
            </button>
            <button
              type="button"
              onClick={() => setSelectedChannel(2)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedChannel === 2 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              کانال ۲
            </button>
          </div>

          <button
            type="button"
            onClick={handleTriggerPoll}
            disabled={triggeringPoll}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
          >
            <Send className={`w-3.5 h-3.5 ${triggeringPoll ? 'animate-spin' : ''}`} />
            <span>{triggeringPoll ? 'در حال ارسال...' : 'ارسال فوری نظرسنجی'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 relative z-10">
        <button
          type="button"
          onClick={() => setActiveSubTab('polls')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'polls'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>نتایج نظرسنجی‌های هوشمند ({data?.pollResults?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('churn')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'churn'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>تحلیل علل ریزش و رویدادها ({data?.memberEvents?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('guide')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'guide'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>چرخه تحلیل با هوش مصنوعی و تنظیم مجدد</span>
        </button>
      </div>

      {/* Tab 1: Poll Results */}
      {activeSubTab === 'polls' && (
        <div className="space-y-4 relative z-10">
          {(!data?.pollResults || data.pollResults.length === 0) ? (
            <div className="p-8 text-center bg-slate-800/40 rounded-2xl border border-dashed border-slate-700 text-slate-400 text-xs">
              <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <div>هنوز نظرسنجی‌ای در کانال ثبت نشده است.</div>
              <div className="text-[11px] text-slate-500 mt-1">
                برای شروع می‌توانید دکمه «ارسال فوری نظرسنجی» بالا را کلیک کنید یا ارسال زمان‌دار نظرسنجی‌ها را در بخش تنظیمات فعال بگذارید.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.pollResults.map((poll) => (
                <div
                  key={poll.pollId}
                  className="bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-white leading-relaxed">
                      {poll.question}
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        poll.isClosed
                          ? 'bg-slate-700 text-slate-300'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {poll.isClosed ? 'بسته شده' : 'در حال رای‌گیری'}
                    </span>
                  </div>

                  {poll.strategicInsight && (
                    <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-xl p-2.5 text-[11px] text-indigo-300 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{poll.strategicInsight}</span>
                    </div>
                  )}

                  {/* Options & Progress Bars */}
                  <div className="space-y-2 pt-1">
                    {poll.options.map((opt, oIdx) => {
                      const pct = poll.totalVoterCount > 0
                        ? Math.round((opt.voterCount / poll.totalVoterCount) * 100)
                        : 0;
                      return (
                        <div key={oIdx} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-200 font-medium truncate">{opt.text}</span>
                            <span className="font-mono text-slate-400 text-[11px] shrink-0" dir="ltr">
                              {opt.voterCount} رای ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer Stats */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800 font-mono" dir="ltr">
                    <span>Voters: {poll.totalVoterCount}</span>
                    <span>{poll.channelHandle}</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(poll.postedAt).toLocaleDateString('fa-IR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Churn & Post Correlation */}
      {activeSubTab === 'churn' && (
        <div className="space-y-5 relative z-10">
          {/* Churn Category Breakdown */}
          {data?.churnCorrelation && data.churnCorrelation.length > 0 && (
            <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-extrabold text-slate-200 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                <span>سهم دسته‌بندی‌های محتوا در ایجاد ریزش (خروج کاربران تا ۳۰ دقیقه پس از انتشار):</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {data.churnCorrelation.map((item, idx) => (
                  <div key={idx} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
                    <div className="text-xs text-slate-300 font-bold truncate">
                      {getCategoryLabel(item.category)}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-base font-black text-rose-400 font-mono" dir="ltr">
                        {item.count} لفت
                      </span>
                      <span className="text-xs font-mono text-slate-400" dir="ltr">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Member Events Timeline Log */}
          <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-extrabold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>آخرین رویدادهای زنده ورود و خروج اعضا (ورود / لفت)</span>
              </span>
              <span className="text-[11px] font-normal text-slate-400">
                همراه با ثبت هوشمند مشخصات پست قبلی
              </span>
            </h4>

            {(!data?.memberEvents || data.memberEvents.length === 0) ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                هنوز رویداد ورود و خروجی ثبت نشده است. (به‌محض اضافه شدن یا لفت دادن کاربر جدید، در اینجا لاگ می‌شود).
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {data.memberEvents.map((evt) => {
                  const isJoin = evt.eventType === 'join';
                  return (
                    <div
                      key={evt.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all ${
                        isJoin
                          ? 'bg-emerald-950/20 border-emerald-800/30 text-emerald-200'
                          : 'bg-rose-950/20 border-rose-800/30 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            isJoin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {isJoin ? <UserPlus className="w-3.5 h-3.5" /> : <UserMinus className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            <span>{evt.username || evt.firstName || 'کاربر تلگرام'}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                isJoin ? 'bg-emerald-500/30 text-emerald-200' : 'bg-rose-500/30 text-rose-200'
                              }`}
                            >
                              {isJoin ? 'ورود و عضویت' : 'خروج (لفت)'}
                            </span>
                            <span className="text-slate-400 text-[11px] font-mono" dir="ltr">
                              {evt.channelHandle}
                            </span>
                          </div>
                          {evt.precedingPost && !isJoin && (
                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                              <span className="text-amber-400 font-medium">
                                آخرین پست قبل از لفت:
                              </span>
                              <span>[{getCategoryLabel(evt.precedingPost.category)}]</span>
                              <span>(فاصله: {evt.precedingPost.elapsedMinutes} دقیقه)</span>
                              <span className="truncate max-w-xs text-slate-500">
                                - {evt.precedingPost.summary}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 font-mono shrink-0" dir="ltr">
                        {new Date(evt.timestamp).toLocaleTimeString('fa-IR')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Guide & AI Feedback Loop */}
      {activeSubTab === 'guide' && (
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 space-y-4 text-xs text-slate-300 leading-relaxed relative z-10">
          <div className="flex items-center gap-2.5 text-sm font-black text-white">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>نحوه تحلیل آمارها با هوش مصنوعی و تنظیم مجدد ربات</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 font-black flex items-center justify-center">
                ۱
              </div>
              <div className="font-extrabold text-white text-xs">کپی پرامپت آماده</div>
              <p className="text-[11px] text-slate-400">
                روی دکمه «📋 کپی پرامپت آماده هوش مصنوعی» در بالای این کادر کلیک کنید. یک پرامپت کارشناسی با تمام آمار دقیق ورود/خروج، نمودار ریزش و پاسخ‌های نظرسنجی کپی می‌شود.
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 font-black flex items-center justify-center">
                ۲
              </div>
              <div className="font-extrabold text-white text-xs">ارسال به مدل هوش مصنوعی</div>
              <p className="text-[11px] text-slate-400">
                متن کپی‌شده را در چت‌بات هوش مصنوعی (ChatGPT، Claude یا همین صفحه گفت‌وگو) قرار دهید. هوش مصنوعی دقیقاً دلیل ریزش‌ها، بهترین ساعات ارسال، و پروتکل‌های موردعلاقه اعضا را تحلیل می‌کند.
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 font-black flex items-center justify-center">
                ۳
              </div>
              <div className="font-extrabold text-white text-xs">تنظیم مجدد پارامترهای بات</div>
              <p className="text-[11px] text-slate-400">
                پاسخ تحلیل هوش مصنوعی شامل پارامترهای دقیق JSON خواهد بود. می‌توانید آن را مستقیماً به همین دستیار تحویل دهید تا تنظیمات زمان‌بندی و کانفیگ‌ها را فوراً بروز کند.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
