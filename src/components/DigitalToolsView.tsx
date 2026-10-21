import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wrench, 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  Send, 
  Sparkles, 
  ExternalLink,
  Bot,
  Globe,
  Smartphone,
  ShieldAlert,
  Layers,
  CheckCircle2,
  TrendingUp,
  X,
  Info
} from 'lucide-react';
import { DigitalToolItem, DigitalToolCategory } from '../types';

interface DigitalToolsViewProps {
  tools: DigitalToolItem[];
  token: string | null;
  actionLoading: string | null;
  targetChannel1?: string;
  targetChannel2?: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefreshTools: () => Promise<void>;
  onSaveTool: (toolData: Partial<DigitalToolItem>) => Promise<boolean>;
  onDeleteTool: (id: string) => Promise<void>;
  onTriggerSendTools: (channelNum: 1 | 2) => Promise<void>;
}

export const DigitalToolsView: React.FC<DigitalToolsViewProps> = ({
  tools = [],
  token,
  actionLoading,
  targetChannel1,
  targetChannel2,
  showToast,
  onRefreshTools,
  onSaveTool,
  onDeleteTool,
  onTriggerSendTools
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | DigitalToolCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unposted_ch1' | 'posted_ch1'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<DigitalToolItem | null>(null);

  const [formState, setFormState] = useState<{
    title: string;
    summary: string;
    category: DigitalToolCategory;
    importance: 'normal' | 'trending' | 'essential';
    linkUrl: string;
    buttonLabel: string;
    howToUse: string;
    tags: string;
  }>({
    title: '',
    summary: '',
    category: 'ai_tools',
    importance: 'trending',
    linkUrl: '',
    buttonLabel: '🌐 ورود به سایت / دریافت ابزار',
    howToUse: '',
    tags: 'کاربردی, هوش_مصنوعی, ابزار_رایگان'
  });

  const categoryMeta: Record<DigitalToolCategory, { title: string; color: string; bg: string; icon: any }> = {
    ai_tools: { title: 'هوش مصنوعی کاربردی', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Bot },
    cool_websites: { title: 'سایت‌های شگفت‌انگیز', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Globe },
    mobile_hacks: { title: 'ترفندهای موبایل', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Smartphone },
    cyber_security: { title: 'امنیت سایبری و ضد هک', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', icon: ShieldAlert },
    must_apps: { title: 'اپلیکیشن‌های ضروری', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: Layers }
  };

  const filteredTools = useMemo(() => {
    return tools.filter(tool => {
      const matchSearch = 
        tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tool.tags && tool.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchCategory = categoryFilter === 'all' || tool.category === categoryFilter;

      let matchStatus = true;
      if (statusFilter === 'unposted_ch1') matchStatus = !tool.postedToChannel1;
      if (statusFilter === 'posted_ch1') matchStatus = !!tool.postedToChannel1;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [tools, searchQuery, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = tools.length;
    const postedCh1 = tools.filter(t => t.postedToChannel1).length;
    const unpostedCh1 = total - postedCh1;
    const aiTools = tools.filter(t => t.category === 'ai_tools').length;
    const webTools = tools.filter(t => t.category === 'cool_websites').length;
    return { total, postedCh1, unpostedCh1, aiTools, webTools };
  }, [tools]);

  const handleOpenAddModal = (item?: DigitalToolItem) => {
    if (item) {
      setEditingItem(item);
      setFormState({
        title: item.title,
        summary: item.summary,
        category: item.category,
        importance: item.importance || 'normal',
        linkUrl: item.linkUrl || '',
        buttonLabel: item.buttonLabel || '🌐 ورود به سایت / دریافت ابزار',
        howToUse: item.howToUse || '',
        tags: (item.tags || []).join(', ')
      });
    } else {
      setEditingItem(null);
      setFormState({
        title: '',
        summary: '',
        category: 'ai_tools',
        importance: 'trending',
        linkUrl: '',
        buttonLabel: '🌐 ورود به سایت / دریافت ابزار',
        howToUse: '',
        tags: 'کاربردی, هوش_مصنوعی, ابزار_رایگان'
      });
    }
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title.trim() || !formState.summary.trim()) {
      showToast('عنوان و متن معرفی ابزار الزامی است.', 'error');
      return;
    }

    const payload: Partial<DigitalToolItem> = {
      id: editingItem ? editingItem.id : undefined,
      title: formState.title.trim(),
      summary: formState.summary.trim(),
      category: formState.category,
      importance: formState.importance,
      linkUrl: formState.linkUrl.trim() || undefined,
      buttonLabel: formState.buttonLabel.trim() || undefined,
      howToUse: formState.howToUse.trim() || undefined,
      tags: formState.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)
    };

    const ok = await onSaveTool(payload);
    if (ok) {
      setShowAddModal(false);
      setEditingItem(null);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Strategic Header & Anti-Churn Guidance */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold text-emerald-100 border border-white/20">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>استراتژی رشد پایدار و عدم وابستگی به فیلترینگ</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <Wrench className="w-7 h-7" />
              <span>جعبه‌ابزار دیجیتال و محتوای همیشه سبز (Evergreen)</span>
            </h2>
            <p className="text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
              این بخش باعث می‌شود کانال شما علاوه بر فیلترشکن و پروکسی، به مرجع ابزارهای رایگان هوش مصنوعی، ترفندهای نجات‌بخش موبایل، امنیت سایبری و سایت‌های نایاب اینترنت تبدیل شود تا حتی در صورت تغییر وضعیت اینترنت، اعضا هرگز لفت ندهند و کانال رشد تصاعدی داشته باشد.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onTriggerSendTools(1)}
              disabled={actionLoading === 'trigger_digital_tools_1' || !targetChannel1}
              className="px-4 py-2.5 rounded-xl bg-white text-emerald-800 font-bold text-xs shadow-md hover:bg-emerald-50 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className={`w-4 h-4 ${actionLoading === 'trigger_digital_tools_1' ? 'animate-spin' : ''}`} />
              <span>ارسال نوبتی به کانال ۱ ({targetChannel1 || 'تنظیم نشده'})</span>
            </button>
            <button
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-950/60 text-white font-bold text-xs border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن ابزار جدید</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">کل ابزارهای آماده</span>
          <p className="text-2xl font-black text-slate-800 mt-1">{stats.total}</p>
          <span className="text-[11px] text-slate-400">محتوای متنوع و تست‌شده</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">ارسال‌شده به کانال ۱</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.postedCh1}</p>
          <span className="text-[11px] text-emerald-700">با رعایت استراتژی نوبتی</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">منتشرنشده در کانال ۱</span>
          <p className="text-2xl font-black text-indigo-600 mt-1">{stats.unpostedCh1}</p>
          <span className="text-[11px] text-slate-400">آماده ارسال در نوبت‌های بعد</span>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">ابزارهای هوش مصنوعی</span>
          <p className="text-2xl font-black text-purple-600 mt-1">{stats.aiTools}</p>
          <span className="text-[11px] text-purple-700">ترندترین موضوع تلگرام</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در عنوان، متن معرفی یا هشتگ ابزارها..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-none bg-slate-50 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5" />
              <span>فیلتر وضعیت:</span>
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">همه</option>
                <option value="unposted_ch1">منتشرنشده در کانال ۱</option>
                <option value="posted_ch1">منتشرشده در کانال ۱</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            همه دسته‌ها ({tools.length})
          </button>
          {(Object.keys(categoryMeta) as DigitalToolCategory[]).map(catKey => {
            const meta = categoryMeta[catKey];
            const Icon = meta.icon;
            const count = tools.filter(t => t.category === catKey).length;
            const active = categoryFilter === catKey;
            return (
              <button
                key={catKey}
                onClick={() => setCategoryFilter(catKey)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{meta.title}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tools Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200">
            <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-600">ابزاری با معیارهای جستجو یافت نشد.</p>
            <p className="text-xs text-slate-400 mt-1">می‌توانید با دکمه بالا یک ابزار جدید به بانک محتوا اضافه کنید.</p>
          </div>
        ) : (
          filteredTools.map(item => {
            const meta = categoryMeta[item.category] || categoryMeta.ai_tools;
            const Icon = meta.icon;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 ${meta.bg} ${meta.color}`}>
                      <Icon className="w-3 h-3" />
                      <span>{meta.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.postedToChannel1 ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>کانال ۱</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">
                          نشرنشده
                        </span>
                      )}
                      {item.importance === 'essential' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700">
                          ضروری
                        </span>
                      )}
                      {item.importance === 'trending' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700">
                          ترند
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-1 group-hover:text-emerald-700 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 line-clamp-3 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  {item.howToUse && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-500 line-clamp-2">
                      <strong className="text-slate-700">ترفند: </strong>
                      {item.howToUse}
                    </div>
                  )}

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenAddModal(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="ویرایش"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteTool(item.id)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {item.linkUrl && (
                    <a
                      href={item.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>مشاهده لینک</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add / Edit Tool Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {editingItem ? 'ویرایش ابزار دیجیتال' : 'افزودن ابزار کاربردی به بانک محتوا'}
                    </h3>
                    <p className="text-[11px] text-slate-400">محتوای غنی جهت رشد پایدار کانال اول و دوم</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">عنوان و نام ابزار *</label>
                  <input
                    type="text"
                    required
                    value={formState.title}
                    onChange={(e) => setFormState(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="مثلاً: ابزار هوش مصنوعی حذف واترمارک ویدیو"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">دسته‌بندی محتوایی</label>
                    <select
                      value={formState.category}
                      onChange={(e: any) => setFormState(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-none bg-white cursor-pointer"
                    >
                      <option value="ai_tools">ابزار هوش مصنوعی کاربردی</option>
                      <option value="cool_websites">سایت‌های شگفت‌انگیز اینترنت</option>
                      <option value="mobile_hacks">ترفندهای موبایل و سیستم‌عامل</option>
                      <option value="cyber_security">امنیت سایبری و ضد هک</option>
                      <option value="must_apps">اپلیکیشن‌های ضروری</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">درجه جذابیت و اهمیت</label>
                    <select
                      value={formState.importance}
                      onChange={(e: any) => setFormState(prev => ({ ...prev, importance: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-none bg-white cursor-pointer"
                    >
                      <option value="essential">بسیار ضروری و حیاتی (اولویت ۱)</option>
                      <option value="trending">ترند و جذاب (اولویت ۲)</option>
                      <option value="normal">عادی و مفید</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">توضیحات و خلاصه کاربرد *</label>
                  <textarea
                    rows={3}
                    required
                    value={formState.summary}
                    onChange={(e) => setFormState(prev => ({ ...prev, summary: e.target.value }))}
                    placeholder="توضیح کوتاه و ترغیب‌کننده در مورد کارایی ابزار..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">لینک مستقیم سایت یا دانلود</label>
                    <input
                      type="url"
                      value={formState.linkUrl}
                      onChange={(e) => setFormState(prev => ({ ...prev, linkUrl: e.target.value }))}
                      placeholder="https://example.com"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-none text-left ltr"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">متن دکمه شیشه‌ای تلگرام</label>
                    <input
                      type="text"
                      value={formState.buttonLabel}
                      onChange={(e) => setFormState(prev => ({ ...prev, buttonLabel: e.target.value }))}
                      placeholder="🌐 ورود به سایت / دریافت ابزار"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">راهنما یا ترفند استفاده (اختیاری)</label>
                  <input
                    type="text"
                    value={formState.howToUse}
                    onChange={(e) => setFormState(prev => ({ ...prev, howToUse: e.target.value }))}
                    placeholder="مثال: فیلترشکن خاموش باشد و وارد تب Tools شوید"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">هشتگ‌ها (جداشده با کاما)</label>
                  <input
                    type="text"
                    value={formState.tags}
                    onChange={(e) => setFormState(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="کاربردی, هوش_مصنوعی, ابزار_رایگان"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors cursor-pointer"
                  >
                    {editingItem ? 'ذخیره تغییرات' : 'افزودن ابزار به لیست'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
