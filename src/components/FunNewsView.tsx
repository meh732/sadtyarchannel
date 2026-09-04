import React, { useState, useMemo } from 'react';
import { 
  Smile, 
  Newspaper, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Send, 
  Copy, 
  ExternalLink, 
  Search, 
  Check, 
  X, 
  Image as ImageIcon 
} from 'lucide-react';
import { FunNewsItem, FunNewsSource } from '../types';

interface FunNewsViewProps {
  funNewsItems: FunNewsItem[];
  funSources: FunNewsSource[];
  actionLoading: string | null;
  targetChannel1: string;
  targetChannel2: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefreshSources: () => Promise<void>;
  onAddSource: (source: { name: string; urlOrHandle: string; category?: 'fun' | 'news' }) => Promise<boolean | void>;
  onToggleSource: (id: string, enabled: boolean) => Promise<void>;
  onDeleteSource: (id: string) => Promise<void>;
  onSendItem: (id: string, channelNum: number) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export const FunNewsView: React.FC<FunNewsViewProps> = ({
  funNewsItems,
  funSources,
  actionLoading,
  targetChannel1,
  targetChannel2,
  showToast,
  onRefreshSources,
  onAddSource,
  onToggleSource,
  onDeleteSource,
  onSendItem,
  onDeleteItem,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'fun' | 'news'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceHandle, setNewSourceHandle] = useState('');
  const [newSourceCategory, setNewSourceCategory] = useState<'fun' | 'news'>('fun');
  const [submittingSource, setSubmittingSource] = useState(false);

  const handleCreateSourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const handle = newSourceHandle.trim();
    if (!handle) {
      showToast('لطفاً آیدی یا لینک کانال تلگرامی را وارد کنید', 'error');
      return;
    }
    setSubmittingSource(true);
    try {
      const result = await onAddSource({
        name: newSourceName.trim() || handle,
        urlOrHandle: handle,
        category: newSourceCategory
      });
      // If onAddSource returns false, do not close modal or clear input
      if (result !== false) {
        setNewSourceName('');
        setNewSourceHandle('');
        setShowAddModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingSource(false);
    }
  };

  const filteredItems = useMemo(() => {
    return funNewsItems.filter(item => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        item.title.toLowerCase().includes(q) || 
        item.text.toLowerCase().includes(q) || 
        item.sourceChannel.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [funNewsItems, activeCategory, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-600 text-white rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 border border-white/30 text-white flex items-center justify-center shrink-0">
              <Smile className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">استخراج هوشمند فان، سرگرمی و اخبار روز تلگرام</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white border border-white/30">
                  تفکیک‌شده از تکنولوژی
                </span>
              </div>
              <p className="text-xs text-amber-100 leading-relaxed">
                کانال‌های تلگرامی محبوب طنز یا اخبار را به لیست منابع اضافه کنید تا ربات مطالب جدید آن‌ها را به طور خودکار استخراج کرده و به کانال دوم یا اول ارسال کند.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-white hover:bg-amber-50 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-700" />
              <span>افزودن کانال تلگرامی جدید</span>
            </button>

            <button
              onClick={onRefreshSources}
              disabled={actionLoading === 'refresh_fun_news'}
              className="px-4 py-2.5 bg-amber-900/40 hover:bg-amber-900/60 text-white border border-white/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading === 'refresh_fun_news' ? 'animate-spin' : ''}`} />
              <span>استخراج فوری مطالب جدید</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sources Management Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>کانال‌های تلگرامی منبع جهت پایش و استخراج خودکار</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                {funSources.length} منبع تعریف شده
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              ربات در فواصل منظم پیام‌های جدید این کانال‌ها را بررسی، فیلتر و ذخیره می‌کند.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ثبت کانال جدید</span>
          </button>
        </div>

        {funSources.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
            هنوز کانال تلگرامی برای بخش فان و اخبار ثبت نشده است. روی دکمه «افزودن کانال تلگرامی جدید» کلیک کنید.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {funSources.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-amber-300 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Smile className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-800 truncate">{s.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1" dir="ltr">
                      <span className="truncate">{s.urlOrHandle}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleSource(s.id, !s.enabled)}
                    className={`w-9 h-5 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                      s.enabled ? 'bg-amber-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                    title={s.enabled ? 'فعال (کلیک برای غیرفعال‌سازی)' : 'غیرفعال (کلیک برای فعال‌سازی)'}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteSource(s.id)}
                    disabled={actionLoading === `delete_fun_source_${s.id}`}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="حذف کانال از منابع"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            همه مطالب ({funNewsItems.length})
          </button>
          <button
            onClick={() => setActiveCategory('fun')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'fun'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>🎭 طنز و سرگرمی</span>
            <span className="text-[10px] opacity-80">({funNewsItems.filter(i => i.category === 'fun').length})</span>
          </button>
          <button
            onClick={() => setActiveCategory('news')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'news'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>📰 اخبار روز و عمومی</span>
            <span className="text-[10px] opacity-80">({funNewsItems.filter(i => i.category === 'news').length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="جستجو در متن مطالب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-4 py-1.5 rounded-xl border border-slate-200 text-xs focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center text-slate-400 space-y-2">
          <Smile className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-600">هیچ مطلبی یافت نشد.</p>
          <p className="text-xs text-slate-400">روی «استخراج فوری مطالب جدید» کلیک کنید یا کانال تلگرامی جدیدی اضافه نمایید.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Image Preview if present */}
                {item.imageUrl && (
                  <div className="relative aspect-video w-full bg-slate-900 overflow-hidden border-b border-slate-100">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-5 space-y-3">
                  {/* Category & Source Badges */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`px-2.5 py-0.5 rounded-full font-bold ${
                      item.category === 'fun' ? 'bg-yellow-100 text-yellow-800' : 'bg-sky-100 text-sky-800'
                    }`}>
                      {item.category === 'fun' ? '🎭 طنز و سرگرمی' : '📰 اخبار روز'}
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]" dir="ltr">
                      {item.sourceChannel}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="font-extrabold text-sm text-slate-800 line-clamp-2 leading-snug">
                    {item.title}
                  </h4>

                  {/* Text Content */}
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                    {item.text}
                  </p>

                  {/* Status Badges: Posted to Channel 1 or 2 */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-[10px]">
                    {item.postedToChannel2 ? (
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> ارسال به کانال ۲
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        در انتظار ارسال کانال ۲
                      </span>
                    )}

                    {item.postedToChannel1 && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> ارسال به کانال ۱
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {/* Send to Channel 2 (Purple) */}
                  <button
                    type="button"
                    onClick={() => onSendItem(item.id, 2)}
                    disabled={actionLoading === `send_fun_${item.id}_2` || !targetChannel2}
                    className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-colors shadow-xs"
                    title={targetChannel2 ? `ارسال به کانال دوم (${targetChannel2})` : 'لطفاً ابتدا آیدی کانال ۲ را در بخش ارسال خودکار وارد کنید'}
                  >
                    <Send className="w-3 h-3" />
                    <span>ارسال کانال ۲</span>
                  </button>

                  {/* Send to Channel 1 (Indigo) */}
                  <button
                    type="button"
                    onClick={() => onSendItem(item.id, 1)}
                    disabled={actionLoading === `send_fun_${item.id}_1` || !targetChannel1}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-colors"
                    title={targetChannel1 ? `ارسال به کانال اول (${targetChannel1})` : 'لطفاً ابتدا آیدی کانال ۱ را وارد کنید'}
                  >
                    <Send className="w-3 h-3" />
                    <span>کانال ۱</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${item.title}\n\n${item.text}`);
                      showToast('متن مطلب با موفقیت کپی شد', 'success');
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title="کپی متن"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    disabled={actionLoading === `delete_fun_${item.id}`}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="حذف مطلب"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Fun Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Smile className="w-4 h-4 text-amber-600" />
                <span>افزودن کانال تلگرامی جدید برای استخراج</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSourceSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">آیدی یا لینک کانال تلگرام</label>
                <input
                  type="text"
                  required
                  placeholder="@khandeh_bazaar یا t.me/akharinkhabar"
                  value={newSourceHandle}
                  onChange={(e) => setNewSourceHandle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 text-slate-800 text-xs rounded-xl focus:border-amber-500 focus:outline-none font-mono"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">نام نمایشی کانال (اختیاری)</label>
                <input
                  type="text"
                  placeholder="مثلاً کانال خنده بازار"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 text-slate-800 text-xs rounded-xl focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">دسته‌بندی محتوای کانال</label>
                <select
                  value={newSourceCategory}
                  onChange={(e) => setNewSourceCategory(e.target.value as 'fun' | 'news')}
                  className="w-full px-4 py-2.5 border border-slate-200 text-slate-800 text-xs rounded-xl focus:border-amber-500 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="fun">🎭 طنز، سرگرمی، جوک و میم</option>
                  <option value="news">📰 اخبار روز و عمومی (سیاسی، اجتماعی، ورزشی)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submittingSource || actionLoading === 'add_fun_source'}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {(submittingSource || actionLoading === 'add_fun_source') ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{submittingSource ? 'در حال ثبت...' : 'ثبت و شروع پایش'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
