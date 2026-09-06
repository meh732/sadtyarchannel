import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Palette, 
  Search, 
  Filter, 
  RefreshCw, 
  Plus, 
  Copy, 
  Check, 
  Edit, 
  Trash2, 
  Send, 
  Sparkles, 
  Image as ImageIcon,
  Video, 
  X, 
  ExternalLink,
  Tag
} from 'lucide-react';
import { AiPrompt, AiPromptCategory } from '../types';

interface PromptsViewProps {
  aiPrompts: AiPrompt[];
  token: string | null;
  actionLoading: string | null;
  targetChannel1?: string;
  targetChannel2?: string;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefreshPrompts: () => Promise<void>;
  onSavePrompt: (promptData: {
    id?: string;
    title: string;
    category: AiPromptCategory;
    description: string;
    promptText: string;
    imageUrl?: string;
    videoUrl?: string;
    mediaType?: 'photo' | 'video' | 'animation';
    tags?: string[];
  }) => Promise<boolean>;
  onDeletePrompt: (id: string) => Promise<void>;
  onTriggerSendPrompt?: (channelNum: number) => Promise<void>;
}

export const PromptsView: React.FC<PromptsViewProps> = ({
  aiPrompts = [],
  token,
  actionLoading,
  targetChannel1,
  targetChannel2,
  showToast,
  onRefreshPrompts,
  onSavePrompt,
  onDeletePrompt,
  onTriggerSendPrompt
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AiPromptCategory>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AiPrompt | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'image' as AiPromptCategory,
    description: '',
    promptText: '',
    imageUrl: '',
    tags: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Safe normalized prompts list
  const safePrompts = useMemo(() => {
    return Array.isArray(aiPrompts) ? aiPrompts : [];
  }, [aiPrompts]);

  // Filtered prompts
  const filteredPrompts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return safePrompts.filter((p) => {
      if (!p) return false;
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const title = (p.title || '').toLowerCase();
      const text = (p.promptText || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const tagsStr = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';
      
      const matchesSearch = !q || title.includes(q) || text.includes(q) || desc.includes(q) || tagsStr.includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [safePrompts, searchQuery, categoryFilter]);

  const handleCopyPrompt = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      showToast('متن انگلیسی پرامپت با موفقیت کپی شد!', 'success');
      setTimeout(() => setCopiedId(null), 2500);
    }).catch(() => {
      showToast('خطا در دسترسی به کلیپ‌بورد', 'error');
    });
  };

  const openAddModal = () => {
    setEditingPrompt(null);
    setFormData({
      title: '',
      category: 'image',
      description: '',
      promptText: '',
      imageUrl: '',
      videoUrl: '',
      tags: ''
    });
    setShowModal(true);
  };

  const openEditModal = (prompt: AiPrompt) => {
    setEditingPrompt(prompt);
    setFormData({
      title: prompt.title || '',
      category: prompt.category || 'image',
      description: prompt.description || '',
      promptText: prompt.promptText || '',
      imageUrl: prompt.imageUrl || '',
      videoUrl: prompt.videoUrl || '',
      tags: Array.isArray(prompt.tags) ? prompt.tags.join(', ') : ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.promptText.trim()) {
      showToast('لطفاً عنوان و متن انگلیسی پرامپت را وارد نمایید.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const parsedTags = formData.tags
        ? formData.tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean)
        : [];

      const success = await onSavePrompt({
        id: editingPrompt ? editingPrompt.id : undefined,
        title: formData.title.trim(),
        category: formData.category,
        description: formData.description.trim(),
        promptText: formData.promptText.trim(),
        imageUrl: formData.imageUrl.trim() || undefined,
        videoUrl: formData.videoUrl.trim() || undefined,
        tags: parsedTags
      });

      if (success) {
        setShowModal(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const categoryLabels: Record<AiPromptCategory, { label: string; bg: string; text: string }> = {
    image: { label: '🎨 ساخت تصویر', bg: 'bg-pink-500/10 border-pink-500/30 text-pink-700', text: 'text-pink-600' },
    video: { label: '🎥 ساخت ویدیو', bg: 'bg-purple-500/10 border-purple-500/30 text-purple-700', text: 'text-purple-600' },
    chat: { label: '✍️ متنی و چت‌بات', bg: 'bg-teal-500/10 border-teal-500/30 text-teal-700', text: 'text-teal-600' },
    other: { label: '⚙️ سایر موارد', bg: 'bg-slate-500/10 border-slate-500/30 text-slate-700', text: 'text-slate-600' }
  };

  return (
    <motion.div
      key="prompts"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6"
    >
      {/* Top Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-800">بانک پرامپت‌های طلایی و ترند هوش مصنوعی</h3>
          </div>
          <p className="text-xs text-slate-500 mr-10">
            مجموعاً <strong>{safePrompts.length}</strong> نمونه پرامپت حرفه‌ای و ترند در دیتابیس موجود است.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onTriggerSendPrompt && (
            <button
              onClick={() => onTriggerSendPrompt(1)}
              disabled={actionLoading === 'trigger_ai_prompts_autopost_1'}
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="ارسال دستی جدیدترین پرامپت به کانال تلگرام"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{actionLoading === 'trigger_ai_prompts_autopost_1' ? 'در حال ارسال...' : 'ارسال به کانال'}</span>
            </button>
          )}

          <button
            onClick={onRefreshPrompts}
            disabled={actionLoading === 'refresh_prompts'}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'refresh_prompts' ? 'animate-spin' : ''}`} />
            <span>{actionLoading === 'refresh_prompts' ? 'در حال بروزرسانی...' : 'بروزرسانی آنلاین'}</span>
          </button>

          {token && (
            <button
              onClick={openAddModal}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 cursor-pointer transition-all duration-150"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت پرامپت جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="جستجو در بین پرامپت‌ها، موضوع، تگ‌ها یا متن انگلیسی..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-11 py-2.5 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm"
          >
            <option value="all">همه دسته‌ها ({safePrompts.length})</option>
            <option value="image">🎨 ساخت تصویر ({safePrompts.filter((p) => p.category === 'image').length})</option>
            <option value="video">🎥 ساخت ویدیو ({safePrompts.filter((p) => p.category === 'video').length})</option>
            <option value="chat">✍️ متنی و چت‌بات ({safePrompts.filter((p) => p.category === 'chat').length})</option>
            <option value="other">⚙️ سایر موارد ({safePrompts.filter((p) => p.category === 'other').length})</option>
          </select>
        </div>
      </div>

      {/* Prompts Cards Grid */}
      {filteredPrompts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center flex flex-col items-center justify-center text-slate-400 gap-3">
          <Palette className="w-12 h-12 text-slate-300 animate-pulse" />
          <p className="text-sm font-bold text-slate-600">هیچ پرامپتی با این مشخصات یافت نشد.</p>
          <p className="text-xs text-slate-400">
            فیلترها را پاک کنید یا از دکمه «بروزرسانی آنلاین» جهت استخراج پرامپت‌های جدید استفاده نمایید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPrompts.map((p) => {
            const catInfo = categoryLabels[p.category] || categoryLabels.image;
            const isCopied = copiedId === p.id;

            return (
              <div
                key={p.id}
                className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-200 relative group"
              >
                {/* Preview Video / Image / Header banner */}
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden flex items-center justify-center">
                  {p.videoUrl ? (
                    <video
                      src={p.videoUrl}
                      poster={p.imageUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain relative z-10"
                    />
                  ) : p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        // Hide broken image and fallback to placeholder
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 relative z-10"
                    />
                  ) : null}

                  {/* Fallback graphic if image/video failed or missing */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-900 pointer-events-none -z-0">
                    <ImageIcon className="w-10 h-10 text-slate-700" />
                    <span className="text-[10px] text-slate-500 mt-1">پیش‌نمایش رسانه</span>
                  </div>

                  {/* Category Badge */}
                  <span className={`absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-sm backdrop-blur-md bg-white/90 ${catInfo.text} pointer-events-none z-20`}>
                    {catInfo.label}
                  </span>

                  {p.videoUrl && (
                    <span className="absolute bottom-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/75 text-purple-300 backdrop-blur-xs flex items-center gap-1 pointer-events-none z-20">
                      <Video className="w-3 h-3" /> ویدیو
                    </span>
                  )}

                  {p.importance === 'hot' && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-sm flex items-center gap-1 pointer-events-none z-20">
                      🔥 داغ و ترند
                    </span>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-extrabold text-slate-800 line-clamp-1" title={p.title}>
                      {p.title}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {p.description || 'توضیحات و راهنمای استفاده برای این پرامپت ثبت نشده است.'}
                    </p>
                  </div>

                  {/* Tags */}
                  {Array.isArray(p.tags) && p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                          <Tag className="w-2.5 h-2.5 text-slate-400" />
                          <span>#{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Copyable Prompt box */}
                  <div className="relative bg-slate-50 border border-slate-200 rounded-xl p-3 flex-1 flex flex-col justify-between min-h-[90px] group/box">
                    <pre
                      className="text-[11px] font-mono text-slate-700 whitespace-pre-wrap break-all select-all leading-relaxed max-h-[100px] overflow-y-auto"
                      dir="ltr"
                    >
                      {p.promptText}
                    </pre>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 mt-2">
                      <span className="text-[10px] text-slate-400">متن پرامپت انگلیسی</span>
                      <button
                        onClick={() => handleCopyPrompt(p.promptText, p.id)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                        }`}
                        title="کپی کردن متن پرامپت"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'کپی شد!' : 'کپی پرامپت'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Admin Edit/Delete Bar */}
                  {token && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400">
                        {p.postedToChannel ? '✅ ارسال شده به کانال' : 'در انتظار ارسال'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="ویرایش پرامپت"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeletePrompt(p.id)}
                          disabled={actionLoading === `delete_prompt_${p.id}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="حذف پرامپت"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Add / Edit */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col border border-slate-100 max-h-[90vh]"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-sm text-slate-800">
                    {editingPrompt ? 'ویرایش پرامپت هوش مصنوعی' : 'ثبت پرامپت طلایی جدید'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">عنوان نمونه پرامپت (فارسی)</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: پرتره سایبرپانک دختر فضانورد در مریخ با نورپردازی نئونی"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">دسته‌بندی</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as AiPromptCategory })}
                      className="w-full bg-white px-3 py-2.5 border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="image">🎨 ساخت تصویر</option>
                      <option value="video">🎥 ساخت ویدیو</option>
                      <option value="chat">✍️ متنی و چت‌بات</option>
                      <option value="other">⚙️ سایر موارد</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">آدرس تصویر (URL)</label>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 text-slate-800 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">آدرس ویدیو (URL)</label>
                    <input
                      type="url"
                      placeholder="https://.../video.mp4"
                      value={formData.videoUrl}
                      onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 text-slate-800 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">تگ‌ها و کلیدواژه‌ها (با کاما جدا کنید)</label>
                  <input
                    type="text"
                    placeholder="میدجرنی, فتورئال, پرتره, هوش مصنوعی"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">توضیحات و راهنمای فارسی</label>
                  <textarea
                    rows={2}
                    placeholder="توضیح دهید این پرامپت چه خروجی تولید می‌کند یا چه تنظیماتی برای آن بهتر است..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">متن انگلیسی پرامپت (جهت کپی کردن)</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="A cinematic photorealistic portrait of an astronaut on Mars, neon lighting, octane render, 8k..."
                    value={formData.promptText}
                    onChange={(e) => setFormData({ ...formData, promptText: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-800 text-xs font-mono rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    dir="ltr"
                  />
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || actionLoading === 'save_prompt'}
                    className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    {submitting || actionLoading === 'save_prompt' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>در حال ثبت...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{editingPrompt ? 'ذخیره تغییرات' : 'ثبت پرامپت'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
