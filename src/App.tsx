import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Settings, 
  Share2, 
  Radio, 
  Users, 
  Database, 
  Link2, 
  FileText, 
  Send, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  Info,
  Copy,
  Layers,
  Power,
  Play,
  Github,
  Check,
  ChevronRight,
  TrendingUp,
  Sliders,
  HelpCircle
} from 'lucide-react';
import { Download, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ConfigItem, 
  ProxyItem,
  SourceItem, 
  ForceJoinChannel, 
  SystemSettings, 
  BotUser, 
  BotLog,
  DashboardStats,
  ProtocolType,
  AutoPostSettings
} from './types';

export default function App() {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sources' | 'configs' | 'proxies' | 'join' | 'settings' | 'autopost' | 'broadcast'>('dashboard');
  
  // Data States
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalConfigs: 0,
    workingConfigsCount: 0,
    failedConfigsCount: 0,
    totalProxies: 0,
    workingProxiesCount: 0,
    failedProxiesCount: 0,
    telegramChannelsCount: 0,
    subsCount: 0,
    extractedTodayCount: 0
  });
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [forceJoinChannels, setForceJoinChannels] = useState<ForceJoinChannel[]>([]);
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [users, setUsers] = useState<BotUser[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    adminId: '',
    botToken: '',
    botUsername: '',
    branding: '',
    isBotRunning: false,
    autoTest: true,
    autoExtractInterval: 30,
    autoPost: {
      enabled: false,
      targetChannel: '',
      postIntervalHours: 4,
      configCount: 1,
      proxyCount: 1,
      customText: '',
      adText: '',
      silentMode: false,
      lastPostedAt: null
    }
  });

  // UI States & Flags
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Search & Filter States
  const [configSearch, setConfigSearch] = useState('');
  const [configProtocolFilter, setConfigProtocolFilter] = useState<string>('all');
  const [configStatusFilter, setConfigStatusFilter] = useState<string>('all');

  // Proxy Search & Filter States
  const [proxySearch, setProxySearch] = useState('');
  const [proxyTypeFilter, setProxyTypeFilter] = useState<string>('all');
  const [proxyStatusFilter, setProxyStatusFilter] = useState<string>('all');

  // Form Input States
  const [newSource, setNewSource] = useState({
    name: '',
    type: 'telegram' as 'telegram' | 'github' | 'sub',
    urlOrHandle: ''
  });
  const [newChannel, setNewChannel] = useState({
    username: '',
    title: '',
    inviteLink: ''
  });
  
  // Auto-Post Form State
  const [autoPostForm, setAutoPostForm] = useState<AutoPostSettings>({
    enabled: false,
    targetChannel: '',
    postIntervalHours: 4,
    configCount: 1,
    proxyCount: 1,
    customText: '',
    adText: '',
    silentMode: false,
    lastPostedAt: null
  });

  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastProgress, setBroadcastProgress] = useState<{ total: number; done: boolean } | null>(null);

  // Refs for log scrolling
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to top/bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0; // Latest logs are unshifted to front
    }
  }, [logs]);

  // Toast helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // --- API Integrations ---

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statsRes, sourcesRes, fjRes, configsRes, proxiesRes, usersRes, logsRes, settingsRes] = await Promise.all([
        fetch('/api/stats').then(r => r.json()),
        fetch('/api/sources').then(r => r.json()),
        fetch('/api/force-join').then(r => r.json()),
        fetch('/api/configs').then(r => r.json()),
        fetch('/api/proxies').then(r => r.json()),
        fetch('/api/users').then(r => r.json()),
        fetch('/api/logs').then(r => r.json()),
        fetch('/api/settings').then(r => r.json())
      ]);

      setStats(statsRes);
      setSources(sourcesRes);
      setForceJoinChannels(fjRes);
      setConfigs(configsRes);
      setProxies(proxiesRes || []);
      setUsers(usersRes);
      setLogs(logsRes);
      setSettings(settingsRes);
      
      if (settingsRes && settingsRes.autoPost) {
        setAutoPostForm(settingsRes.autoPost);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      showToast('خطا در دریافت اطلاعات از سرور مخزن', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial and periodic data fetch (every 5 seconds)
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle Restore Backup
  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('آیا مطمئن هستید که می‌خواهید دیتابیس را از روی این فایل بکاپ بازگردانی (Restore) کنید؟ اطلاعات فعلی جایگزین خواهد شد.')) {
      e.target.value = '';
      return;
    }
    try {
      setActionLoading('restore_backup');
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ دیتابیس با موفقیت بازگردانی شد!');
        window.location.reload();
      } else {
        alert(`❌ خطا در بازگردانی بکاپ: ${data.message}`);
      }
    } catch (err: any) {
      alert(`❌ خطا در خواندن فایل یا ارتباط با سرور: ${err.message}`);
    } finally {
      setActionLoading(null);
      e.target.value = '';
    }
  };

  // Handle Test Bot Connection
  const handleTestBot = async () => {
    if (!settings.botToken) {
      alert('لطفاً ابتدا توکن ربات را وارد کنید.');
      return;
    }
    setActionLoading('test_bot');
    try {
      const res = await fetch('/api/settings/test-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: settings.botToken })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.message}`);
        setSettings(prev => ({ ...prev, isBotRunning: true, botUsername: data.username }));
      } else {
        alert(`❌ خطا در تست ربات: ${data.message}`);
      }
    } catch (err: any) {
      alert(`❌ خطا در ارتباط با سرور: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('save_settings');
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
        showToast('تنظیمات ربات و برندینگ با موفقیت ذخیره شد.', 'success');
      } else {
        showToast(data.message || 'خطا در ذخیره تنظیمات', 'error');
      }
    } catch (err) {
      showToast('خطا در ارتباط با سرور', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Bot Start/Stop Toggle
  const handleToggleBot = async () => {
    setActionLoading('toggle_bot');
    try {
      const res = await fetch('/api/bot/toggle', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, isBotRunning: data.isBotRunning }));
        showToast(data.isBotRunning ? 'ربات تلگرام با موفقیت روشن شد.' : 'ربات تلگرام متوقف شد.', 'success');
      } else {
        showToast(data.message || 'خطا در تغییر وضعیت ربات', 'error');
      }
    } catch (err: any) {
      showToast('خطا در ارتباط با سرور تلگرام', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // Add Extraction Source
  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource.name || !newSource.urlOrHandle) {
      showToast('لطفا تمامی فیلدهای منبع را پر کنید', 'error');
      return;
    }

    setActionLoading('add_source');
    try {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSource)
      });
      const data = await res.json();
      if (data.success) {
        setSources(prev => [...prev, data.source]);
        setNewSource({ name: '', type: 'telegram', urlOrHandle: '' });
        showToast('منبع جدید با موفقیت ثبت شد.', 'success');
      } else {
        showToast(data.message || 'خطا در اضافه کردن منبع', 'error');
      }
    } catch (err) {
      showToast('خطای سرور', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // Toggle Source Enabled/Disabled
  const handleToggleSource = async (id: string) => {
    try {
      const res = await fetch(`/api/sources/${id}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSources(prev => prev.map(s => s.id === id ? data.source : s));
        showToast('وضعیت منبع تغییر یافت.', 'success');
      }
    } catch (err) {
      showToast('خطای سرور', 'error');
    }
  };

  // Delete Source
  const handleDeleteSource = async (id: string) => {
    if (!confirm('آیا از حذف این منبع اطمینان دارید؟ تمامی فرآیندهای استخراج از این آدرس متوقف می‌شود.')) return;
    try {
      const res = await fetch(`/api/sources/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSources(prev => prev.filter(s => s.id !== id));
        showToast('منبع استخراج حذف گردید.', 'success');
      }
    } catch (err) {
      showToast('خطا در حذف منبع', 'error');
    }
  };

  // Scrape Single Source Now
  const handleScrapeSource = async (id: string) => {
    setActionLoading(`scrape_${id}`);
    try {
      const res = await fetch(`/api/sources/${id}/extract`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`پویش با موفقیت پایان یافت. تعداد ${data.extractedCount} کانفیگ جدید استخراج شد.`, 'success');
      }
    } catch (err) {
      showToast('خطا در استخراج منبع', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // Trigger Bulk Scrape All Sources
  const handleScrapeAll = async () => {
    setActionLoading('scrape_all');
    try {
      const res = await fetch('/api/sources/extract-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`پویش سراسری انجام شد. کل کانفیگ‌های جدید استخراج شده: ${data.extractedCount}`, 'success');
      }
    } catch (err) {
      showToast('خطا در اجرای پویش سراسری', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // Add Force Join Channel
  const handleAddForceJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannel.username || !newChannel.title) {
      showToast('لطفا شناسه و عنوان کانال اجباری را وارد کنید', 'error');
      return;
    }

    setActionLoading('add_join');
    try {
      const res = await fetch('/api/force-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChannel)
      });
      const data = await res.json();
      if (data.success) {
        setForceJoinChannels(prev => [...prev, data.channel]);
        setNewChannel({ username: '', title: '', inviteLink: '' });
        showToast('کانال عضویت اجباری با موفقیت تعریف شد.', 'success');
      } else {
        showToast(data.message || 'خطا در تعریف کانال اجباری', 'error');
      }
    } catch (err) {
      showToast('خطای شبکه', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // Toggle Force Join Channel Enabled/Disabled
  const handleToggleJoin = async (id: string) => {
    try {
      const res = await fetch(`/api/force-join/${id}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setForceJoinChannels(prev => prev.map(c => c.id === id ? data.channel : c));
        showToast('وضعیت عضویت اجباری تغییر یافت.', 'success');
      }
    } catch (err) {
      showToast('خطای شبکه', 'error');
    }
  };

  // Delete Force Join Channel
  const handleDeleteJoin = async (id: string) => {
    if (!confirm('آیا از حذف این کانال عضویت اجباری مطمئن هستید؟')) return;
    try {
      const res = await fetch(`/api/force-join/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setForceJoinChannels(prev => prev.filter(c => c.id !== id));
        showToast('کانال عضویت اجباری حذف شد.', 'success');
      }
    } catch (err) {
      showToast('خطا در حذف کانال', 'error');
    }
  };

  // Test All Ports
  const handleTestAllPorts = async () => {
    setActionLoading('test_all');
    try {
      const [res1, res2] = await Promise.all([
        fetch('/api/configs/test-all', { method: 'POST' }),
        fetch('/api/proxies/test-all', { method: 'POST' })
      ]);
      const data1 = await res1.json();
      const data2 = await res2.json();
      if (data1.success || data2.success) {
        showToast('بررسی اتصال پورت‌های کانفیگ‌ها و پروکسی‌ها در پس‌زمینه آغاز شد.', 'success');
      }
    } catch (err) {
      showToast('خطا در آغاز فرآیند تست اتصال', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // Clear Failed Configs
  const handleClearFailed = async () => {
    if (!confirm('آیا می‌خواهید تمامی کانفیگ‌هایی که پورت آن‌ها مسدود بوده و غیرفعال ارزیابی شده‌اند را از دیتابیس پاک کنید؟')) return;
    setActionLoading('clear_failed');
    try {
      const res = await fetch('/api/configs/failed', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(`پاکسازی با موفقیت انجام شد. تعداد ${data.removedCount} کانفیگ مسدود حذف شدند.`, 'success');
      }
    } catch (err) {
      showToast('خطا در پاکسازی کانفیگ‌های خراب', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // Clear All Configs Archive
  const handleClearAllConfigs = async () => {
    if (!confirm('هشدار جدی: آیا قصد دارید کل آرشیو کانفیگ‌های استخراج شده را حذف کنید؟ این عمل غیرقابل بازگشت است.')) return;
    setActionLoading('clear_all_configs');
    try {
      const res = await fetch('/api/configs/all', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('آرشیو کانفیگ‌ها کاملاً تخلیه شد.', 'success');
      }
    } catch (err) {
      showToast('خطا در تخلیه دیتابیس', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // --- Proxy Handlers ---
  const handleTestAllProxies = async () => {
    setActionLoading('test_proxies');
    try {
      const res = await fetch('/api/proxies/test-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('بررسی اتصال کل پروکسی‌ها در پس‌زمینه آغاز شد.', 'success');
      }
    } catch (err) {
      showToast('خطا در تست اتصال پروکسی‌ها', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  const handleClearFailedProxies = async () => {
    if (!confirm('آیا می‌خواهید تمامی پروکسی‌های نامناسب و غیرفعال را حذف کنید؟')) return;
    setActionLoading('clear_failed_proxies');
    try {
      const res = await fetch('/api/proxies/failed', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(`پاکسازی موفقیت‌آمیز بود. تعداد ${data.removedCount} پروکسی نامناسب حذف شدند.`, 'success');
      }
    } catch (err) {
      showToast('خطا در پاکسازی پروکسی‌های غیرفعال', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  const handleClearAllProxies = async () => {
    if (!confirm('آیا مطمئن هستید که می‌خواهید کل آرشیو پروکسی‌های استخراج شده را حذف کنید؟')) return;
    setActionLoading('clear_all_proxies');
    try {
      const res = await fetch('/api/proxies/all', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('کل آرشیو پروکسی‌ها با موفقیت پاکسازی شد.', 'success');
      }
    } catch (err) {
      showToast('خطا در تخلیه آرشیو پروکسی‌ها', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // --- Auto Post Handlers ---
  const handleSaveAutoPostSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('save_autopost');
    try {
      const res = await fetch('/api/settings/auto-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoPostForm)
      });
      const data = await res.json();
      if (data.success) {
        showToast('تنظیمات ارسال خودکار پست با موفقیت ذخیره شد.', 'success');
        setAutoPostForm(data.autoPost);
      } else {
        showToast(data.message || 'خطا در ثبت تنظیمات', 'error');
      }
    } catch (err) {
      showToast('خطای شبکه در ذخیره تنظیمات', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  const handleTriggerAutoPost = async () => {
    setActionLoading('trigger_autopost');
    try {
      const res = await fetch('/api/bot/auto-post/trigger', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('پست به صورت آزمایشی با موفقیت به کانال ارسال گردید.', 'success');
      } else {
        showToast(data.message || 'خطا در ارسال پست', 'error');
      }
    } catch (err) {
      showToast('خطا در ارسال پست به کانال', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // Clear System Logs
  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/logs', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setLogs([]);
        showToast('کل وقایع و گزارشات سیستم پاک شد.', 'success');
      }
    } catch (err) {
      showToast('خطا در پاکسازی گزارشات', 'error');
    }
  };

  // Send Broadcast Message
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) {
      showToast('لطفا متن پیام همگانی را وارد کنید.', 'error');
      return;
    }

    if (users.length === 0) {
      showToast('هیچ کاربری در ربات وجود ندارد تا پیام برایشان ارسال شود.', 'error');
      return;
    }

    if (!confirm(`آیا مطمئن هستید که می‌خواهید این پیام را به تمام ${users.length} کاربر ربات ارسال کنید؟`)) return;

    setActionLoading('broadcast');
    setBroadcastProgress({ total: users.length, done: false });
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMessage })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`فرآیند ارسال پیام همگانی آغاز شد. ارسال به ${data.totalUsersCount} کاربر در پس‌زمینه انجام خواهد گرفت.`, 'success');
        setBroadcastMessage('');
      } else {
        showToast(data.message || 'خطا در ارسال پیام', 'error');
      }
    } catch (err) {
      showToast('خطای سرور', 'error');
    } finally {
      setActionLoading(null);
      setBroadcastProgress(null);
      fetchData(true);
    }
  };

  // Copy to Clipboard Utility
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('کانفیگ در حافظه کپی شد', 'success');
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Quick preset loader to add high-quality channels
  const loadPresetSources = async () => {
    setActionLoading('load_presets');
    const presets = [
      { name: 'کانال بزرگ ویتوری فری', type: 'telegram' as const, urlOrHandle: '@v2ray_outline' },
      { name: 'کانال پروکسی‌های ویتوری', type: 'telegram' as const, urlOrHandle: '@v2ray_free_conf' },
      { name: 'مخزن رسمی کانفیگ میکس', type: 'github' as const, urlOrHandle: 'https://raw.githubusercontent.com/yebekhe/TVC/main/v2ray/mix' }
    ];

    try {
      for (const preset of presets) {
        // Skip if already in sources list
        if (sources.some(s => s.urlOrHandle === preset.urlOrHandle)) continue;
        await fetch('/api/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preset)
        });
      }
      showToast('منابع پیشنهادی با موفقیت اضافه شدند.', 'success');
    } catch (e) {
      showToast('خطا در بارگذاری منابع پیشنهادی', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // Filtered configurations calculation
  const filteredConfigs = configs.filter(config => {
    const matchesSearch = 
      config.remark.toLowerCase().includes(configSearch.toLowerCase()) ||
      config.server.toLowerCase().includes(configSearch.toLowerCase()) ||
      config.source.toLowerCase().includes(configSearch.toLowerCase());
    
    const matchesProtocol = configProtocolFilter === 'all' || config.protocol === configProtocolFilter;
    const matchesStatus = configStatusFilter === 'all' || config.status === configStatusFilter;

    return matchesSearch && matchesProtocol && matchesStatus;
  });

  // Filtered proxies calculation
  const filteredProxies = proxies.filter(proxy => {
    const matchesSearch = 
      proxy.server.toLowerCase().includes(proxySearch.toLowerCase()) ||
      proxy.source.toLowerCase().includes(proxySearch.toLowerCase());
    
    const matchesType = proxyTypeFilter === 'all' || proxy.type === proxyTypeFilter;
    const matchesStatus = proxyStatusFilter === 'all' || proxy.status === proxyStatusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc]/90 text-slate-800 font-sans flex flex-col md:flex-row relative overflow-hidden" dir="rtl">
      
      {/* Decorative Floating Colorful Glass Mesh Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[550px] h-[550px] rounded-full bg-indigo-300/25 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[650px] h-[650px] rounded-full bg-cyan-300/20 blur-[130px] pointer-events-none z-0" />
      <div className="absolute top-[30%] left-[20%] w-[450px] h-[450px] rounded-full bg-pink-300/15 blur-[110px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[15%] w-[400px] h-[400px] rounded-full bg-violet-300/20 blur-[100px] pointer-events-none z-0" />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 left-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl max-w-sm border ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : toast.type === 'error' 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
            <span className="text-sm font-medium leading-relaxed">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside className="w-full md:w-80 bg-slate-900/90 backdrop-blur-md text-slate-100 flex flex-col shrink-0 border-l border-slate-800/50 relative z-10">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-white">مدیریت کانفیگ یاب</h1>
            <span className="text-xs text-slate-400">پنل کنترل ربات و استخراج هوشمند</span>
          </div>
        </div>

        {/* Quick Bot Status Indicator */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${settings.isBotRunning ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {settings.isBotRunning ? `ربات فعال است` : 'ربات غیرفعال است'}
              </p>
              {settings.isBotRunning && settings.botUsername && (
                <p className="text-[10px] text-slate-400">@{settings.botUsername}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleToggleBot}
            disabled={actionLoading === 'toggle_bot' || !settings.botToken}
            title={!settings.botToken ? 'ابتدا توکن ربات را در تنظیمات وارد کنید' : 'روشن/خاموش کردن ربات'}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              settings.isBotRunning 
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400' 
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
            } disabled:opacity-50`}
          >
            <Power className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>داشبورد کل</span>
          </button>

          <button
            onClick={() => setActiveTab('sources')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'sources'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>منابع استخراج</span>
            <span className="mr-auto bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full">
              {sources.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('configs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'configs'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>آرشیو کانفیگ‌ها</span>
            <span className="mr-auto bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full">
              {stats.workingConfigsCount} فعال
            </span>
          </button>

          <button
            onClick={() => setActiveTab('proxies')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'proxies'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>آرشیو پروکسی‌ها</span>
            <span className="mr-auto bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full">
              {stats.workingProxiesCount} فعال
            </span>
          </button>

          <button
            onClick={() => setActiveTab('join')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'join'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>عضویت اجباری</span>
            <span className="mr-auto bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded-full">
              {forceJoinChannels.filter(c => c.enabled).length} فعال
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>تنظیمات ربات</span>
          </button>

          <button
            onClick={() => setActiveTab('autopost')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'autopost'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>ارسال خودکار پست</span>
            {settings.autoPost?.enabled && (
              <span className="mr-auto bg-emerald-500 w-2.5 h-2.5 rounded-full animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('broadcast')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'broadcast'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>ارسال پیام همگانی</span>
          </button>
        </nav>

        {/* Footer info */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/20 text-xs text-slate-500 space-y-1">
          <p>وضعیت سرور: کامپایل موفق 🟢</p>
          <p>سیستم تست پورت: فعال در ایران</p>
          <p className="pt-2 text-[10px] text-slate-600">طراحی شده با React 19 + Express</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        
        {/* Header Bar */}
        <header className="bg-white/65 backdrop-blur-md border-b border-slate-200/50 px-6 py-5 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeTab === 'dashboard' && 'داشبورد کنترل مرکزی'}
              {activeTab === 'sources' && 'مدیریت و پایش منابع'}
              {activeTab === 'configs' && 'بانک جامع کانفیگ‌های استخراج شده'}
              {activeTab === 'proxies' && 'بانک جامع پروکسی‌های استخراج شده'}
              {activeTab === 'join' && 'بررسی عضویت اجباری (Force Join)'}
              {activeTab === 'settings' && 'پیکربندی هوشمند ربات و پلتفرم'}
              {activeTab === 'autopost' && 'زمان‌بندی و ارسال خودکار پست'}
              {activeTab === 'broadcast' && 'سیستم نوتیفیکیشن و پیام همگانی'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === 'dashboard' && 'خلاصه‌ای از عملکرد ربات، منابع پایش شده و گزارشات زنده.'}
              {activeTab === 'sources' && 'تعریف کانال‌های تلگرامی، آدرس‌های ساب و گیت‌هاب جهت استخراج خودکار.'}
              {activeTab === 'configs' && 'بررسی، تست اتصال و برندسازی کانفیگ‌های ویتوری و NapsternetV.'}
              {activeTab === 'proxies' && 'بررسی و مدیریت پروکسی‌های تلگرامی Socks5 و MTProto جهت ارائه به کاربران یا پست کانال.'}
              {activeTab === 'join' && 'تنظیم کانال‌های حامی جهت ملزم کردن کاربران برای عضویت قبل از استفاده.'}
              {activeTab === 'settings' && 'تنظیم توکن API تلگرام، فواصل زمانی پویش خودکار و متن برندینگ شخصی.'}
              {activeTab === 'autopost' && 'پیکربندی هوشمند ربات برای ارسال اتوماتیک کانفیگ‌ها و پروکسی‌های برتر به کانال شما در فواصل مشخص.'}
              {activeTab === 'broadcast' && 'ارسال بیانیه‌ها، اخبار یا بنرهای تبلیغاتی به تمامی اعضای ذخیره شده در دیتابیس.'}
            </p>
          </div>

          {/* Quick Stats Summary on Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData(false)}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              title="بروزرسانی داده‌ها"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="hidden lg:flex items-center gap-3 border-r border-slate-200 pr-3">
              <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg border border-emerald-100">
                {stats.workingConfigsCount} کانفیگ فعال
              </span>
              <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg border border-indigo-100">
                {stats.totalUsers} کاربر ربات
              </span>
            </div>
          </div>
        </header>

        {/* Content Tabs Wrapper */}
        <div className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">

          {/* Loading Overlay */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-slate-500">در حال بارگذاری اطلاعات پنل...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              
              {/* --- TAB: DASHBOARD --- */}
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  {/* Informational Banner */}
                  {!settings.botToken && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-amber-900 text-sm">ربات تلگرام هنوز پیکربندی نشده است!</h4>
                          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                            جهت راه اندازی فرآیندها، باید ابتدا به تب **تنظیمات ربات** رفته و **توکن ربات تلگرام** خود را که از BotFather گرفته‌اید ثبت کنید.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('settings')}
                        className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors cursor-pointer shrink-0"
                      >
                        ورود به تنظیمات
                      </button>
                    </div>
                  )}

                  {/* Dashboard Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Stat Card 1 */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-slate-500">کل کاربران ربات</span>
                        <h3 className="text-3xl font-extrabold text-slate-900">{stats.totalUsers}</h3>
                        <p className="text-[10px] text-indigo-600 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>ثبت نام شده در دیتابیس</span>
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Users className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Stat Card 2 */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-slate-500">کانفیگ‌های فعال (v2ray)</span>
                        <h3 className="text-3xl font-extrabold text-emerald-600">{stats.workingConfigsCount}</h3>
                        <p className="text-[10px] text-emerald-600">
                          از کل <strong className="text-slate-700">{stats.totalConfigs}</strong> کانفیگ ذخیره شده
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Stat Card 3 */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-slate-500">پروکسی‌های فعال (تلگرام)</span>
                        <h3 className="text-3xl font-extrabold text-indigo-600">{stats.workingProxiesCount}</h3>
                        <p className="text-[10px] text-indigo-500">
                          از کل <strong className="text-slate-700">{stats.totalProxies}</strong> پروکسی استخراج شده
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Radio className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Stat Card 4 */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-slate-500">استخراج‌های امروز</span>
                        <h3 className="text-3xl font-extrabold text-slate-900">{stats.extractedTodayCount}</h3>
                        <p className="text-[10px] text-slate-500">
                          کانفیگ و پروکسی جدید در ۲۴ ساعت گذشته
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
                        <Database className="w-6 h-6" />
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions Panel */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-slate-600" />
                      <span>عملیات کنترل سریع سیستم</span>
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleScrapeAll}
                        disabled={actionLoading === 'scrape_all'}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${actionLoading === 'scrape_all' ? 'animate-spin' : ''}`} />
                        <span>اجرای پویش دستی و استخراج کانفیگ‌ها</span>
                      </button>

                      <button
                        onClick={handleTestAllPorts}
                        disabled={actionLoading === 'test_all'}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Play className="w-4 h-4" />
                        <span>تست اتصال پورت کل کانفیگ‌ها</span>
                      </button>

                      <button
                        onClick={handleClearFailed}
                        disabled={actionLoading === 'clear_failed'}
                        className="px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>حذف کانفیگ‌های خراب</span>
                      </button>

                      <button
                        onClick={loadPresetSources}
                        disabled={actionLoading === 'load_presets'}
                        className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-slate-500" />
                        <span>افزودن منابع پیشنهادی پیش‌فرض</span>
                      </button>
                    </div>
                  </div>

                  {/* Visual Colored Testing Progress Bar Card */}
                  {(() => {
                    const totalItems = (stats.totalConfigs || 0) + (stats.totalProxies || 0);
                    const totalWorking = (stats.workingConfigsCount || 0) + (stats.workingProxiesCount || 0);
                    const totalFailed = (stats.failedConfigsCount || 0) + (stats.failedProxiesCount || 0);
                    const totalChecking = (stats.checkingConfigsCount || 0) + (stats.checkingProxiesCount || 0);
                    const totalUntested = (stats.untestedConfigsCount || 0) + (stats.untestedProxiesCount || 0);

                    const workingPct = totalItems > 0 ? (totalWorking / totalItems) * 100 : 0;
                    const failedPct = totalItems > 0 ? (totalFailed / totalItems) * 100 : 0;
                    const checkingPct = totalItems > 0 ? (totalChecking / totalItems) * 100 : 0;
                    const untestedPct = totalItems > 0 ? (totalUntested / totalItems) * 100 : 0;

                    return (
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <Sliders className="w-4 h-4 text-indigo-600" />
                              <span>نوار پیشرفت وضعیت تست پورت و صف بررسی</span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              تعداد تست‌نشده‌ها و در صف بررسی به‌صورت پویا با انجام تست‌ها کاهش می‌یابد.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">
                              مجموع کل: {totalItems} مورد
                            </span>
                          </div>
                        </div>

                        {/* Multi-Segmented Colorful Progress Bar */}
                        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                          <div 
                            style={{ width: `${workingPct}%` }} 
                            className="bg-emerald-500 h-full transition-all duration-500" 
                            title={`فعال: ${totalWorking}`}
                          />
                          <div 
                            style={{ width: `${failedPct}%` }} 
                            className="bg-rose-500 h-full transition-all duration-500" 
                            title={`خراب: ${totalFailed}`}
                          />
                          <div 
                            style={{ width: `${checkingPct}%` }} 
                            className="bg-amber-500 h-full animate-pulse transition-all duration-500" 
                            title={`در حال تست: ${totalChecking}`}
                          />
                          <div 
                            style={{ width: `${untestedPct}%` }} 
                            className="bg-slate-300 h-full transition-all duration-500" 
                            title={`تست نشده: ${totalUntested}`}
                          />
                        </div>

                        {/* Legend / Stats Breakdown Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-medium text-emerald-600">فعال (Working)</p>
                              <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{totalWorking}</p>
                            </div>
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                          </div>

                          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-medium text-rose-600">خراب (Failed)</p>
                              <p className="text-lg font-extrabold text-rose-700 mt-0.5">{totalFailed}</p>
                            </div>
                            <div className="w-3 h-3 rounded-full bg-rose-500" />
                          </div>

                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-medium text-amber-600">در حال تست (Checking)</p>
                              <p className="text-lg font-extrabold text-amber-700 mt-0.5">{totalChecking}</p>
                            </div>
                            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                          </div>

                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-medium text-slate-500">تست نشده (Untested)</p>
                              <p className="text-lg font-extrabold text-slate-700 mt-0.5">{totalUntested}</p>
                            </div>
                            <div className="w-3 h-3 rounded-full bg-slate-300" />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Split Section: Real-time logs & Users list */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Live System Logs Box (Col span 2) */}
                    <div className="lg:col-span-2 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col h-[400px]">
                      <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-400">
                          <Terminal className="w-5 h-5" />
                          <span className="text-sm font-bold text-slate-200">کنسول وقایع و لاگ‌های زنده ربات</span>
                        </div>
                        <button
                          onClick={handleClearLogs}
                          className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          پاکسازی ترمینال
                        </button>
                      </div>
                      
                      <div 
                        ref={logContainerRef}
                        className="flex-1 p-5 overflow-y-auto font-mono text-xs space-y-2.5"
                      >
                        {logs.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-slate-500">
                            در حال انتظار برای ثبت رویداد جدید...
                          </div>
                        ) : (
                          logs.map((log) => (
                            <div key={log.id} className="flex items-start gap-2.5 border-b border-slate-900 pb-2 last:border-0">
                              <span className="text-slate-600 shrink-0 select-none">
                                {new Date(log.timestamp).toLocaleTimeString('fa-IR')}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 font-bold ${
                                log.level === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                                log.level === 'error' ? 'bg-rose-500/10 text-rose-400' :
                                log.level === 'warn' ? 'bg-amber-500/10 text-amber-400' :
                                'bg-indigo-500/10 text-indigo-400'
                              }`}>
                                {log.level.toUpperCase()}
                              </span>
                              <span className="text-slate-300 leading-relaxed break-all">{log.message}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Quick Active Users View (Col span 1) */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[400px]">
                      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-500" />
                          <span>کاربران فعال ربات</span>
                        </h3>
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {users.length} کاربر
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                        {users.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center gap-2">
                            <Info className="w-8 h-8 text-slate-300" />
                            <p className="text-xs">هنوز هیچ کاربری عضو ربات نشده است.</p>
                            <p className="text-[10px] text-slate-500">با استارت خوردن ربات توسط مخاطبان، لیست اینجا بروز می‌شود.</p>
                          </div>
                        ) : (
                          users.map((user) => (
                            <div key={user.chatId} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold text-slate-800">
                                  {user.firstName || 'کاربر بدون نام'}
                                </h4>
                                <p className="text-[10px] text-slate-500" dir="ltr">
                                  {user.username ? `@${user.username}` : `Chat ID: ${user.chatId}`}
                                </p>
                              </div>
                              <div className="text-left">
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold px-2 py-1 rounded-md">
                                  {user.configsFetched} کانفیگ
                                </span>
                                <p className="text-[9px] text-slate-400 mt-1">
                                  فعالیت: {new Date(user.lastActive).toLocaleDateString('fa-IR')}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- TAB: SOURCES --- */}
              {activeTab === 'sources' && (
                <motion.div
                  key="sources"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add Source Form Column */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit space-y-5">
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">افزودن منبع جدید</h3>
                        <p className="text-xs text-slate-500 mt-1">کانال‌های تلگرام یا ساب‌های ویتوری را ثبت کنید.</p>
                      </div>

                      <form onSubmit={handleAddSource} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700">نوع منبع</label>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => setNewSource(prev => ({ ...prev, type: 'telegram' }))}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                newSource.type === 'telegram'
                                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              کانال تلگرام
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewSource(prev => ({ ...prev, type: 'github' }))}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                newSource.type === 'github'
                                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              گیت‌هاب
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewSource(prev => ({ ...prev, type: 'sub' }))}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                newSource.type === 'sub'
                                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              لینک ساب
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700">عنوان دلخواه منبع</label>
                          <input
                            type="text"
                            required
                            placeholder="مثلا: کانال دور زدن فیلترینگ"
                            value={newSource.name}
                            onChange={(e) => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700">
                            {newSource.type === 'telegram' ? 'آیدی کانال (همراه با @)' : 'لینک کامل (Raw یا ساب)'}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder={newSource.type === 'telegram' ? '@v2ray_outline' : 'https://raw.githubusercontent.com/...'}
                            value={newSource.urlOrHandle}
                            onChange={(e) => setNewSource(prev => ({ ...prev, urlOrHandle: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-left focus:border-indigo-500 focus:outline-none"
                            dir="ltr"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={actionLoading === 'add_source'}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>افزودن و ذخیره منبع</span>
                        </button>
                      </form>

                      {/* Presets Button */}
                      <div className="pt-4 border-t border-slate-100">
                        <button
                          onClick={loadPresetSources}
                          className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <Github className="w-4 h-4 text-slate-500" />
                          <span>نصب خودکار ۳ منبع تست شده ایرانی</span>
                        </button>
                      </div>
                    </div>

                    {/* Sources List Column (Col span 2) */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-6 py-5 border-b border-slate-200 flex sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">لیست منابع استخراج</h3>
                          <p className="text-xs text-slate-500 mt-1">بر روی هر یک برای استخراج مجزا کلیک کنید.</p>
                        </div>
                        <button
                          onClick={handleScrapeAll}
                          disabled={actionLoading === 'scrape_all'}
                          className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'scrape_all' ? 'animate-spin' : ''}`} />
                          <span>پویش سراسری همگانی</span>
                        </button>
                      </div>

                      {sources.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                          <Link2 className="w-12 h-12 text-slate-300" />
                          <p className="text-sm">هیچ منبعی جهت پایش تعریف نشده است.</p>
                          <button
                            onClick={loadPresetSources}
                            className="text-xs text-indigo-600 font-bold underline cursor-pointer"
                          >
                            اضافه کردن چند کانال پرسرعت به عنوان نمونه
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {sources.map((source) => (
                            <div key={source.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-slate-900">{source.name}</h4>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    source.type === 'telegram' ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                                    source.type === 'github' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                                    'bg-purple-50 text-purple-700 border border-purple-100'
                                  }`}>
                                    {source.type === 'telegram' ? 'کانال تلگرام' : source.type === 'github' ? 'گیت‌هاب' : 'ساب و تانل'}
                                  </span>
                                  {!source.enabled && (
                                    <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-100">
                                      غیرفعال
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 font-mono break-all" dir="ltr">
                                  {source.urlOrHandle}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                                  <span>کانفیگ‌های استخراج شده: <strong className="text-slate-700">{source.extractedCount}</strong></span>
                                  {source.lastExtracted && (
                                    <span>آخرین پایش: <strong className="text-slate-700">{new Date(source.lastExtracted).toLocaleTimeString('fa-IR')}</strong></span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center">
                                <button
                                  onClick={() => handleToggleSource(source.id)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    source.enabled
                                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {source.enabled ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                                </button>

                                <button
                                  onClick={() => handleScrapeSource(source.id)}
                                  disabled={actionLoading === `scrape_${source.id}` || !source.enabled}
                                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                                >
                                  {actionLoading === `scrape_${source.id}` ? 'در حال استخراج...' : 'استخراج سریع'}
                                </button>

                                <button
                                  onClick={() => handleDeleteSource(source.id)}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="حذف منبع"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- TAB: CONFIGS --- */}
              {activeTab === 'configs' && (
                <motion.div
                  key="configs"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  {/* Filters Bar */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                      {/* Search Input */}
                      <div className="w-full md:flex-1 relative">
                        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                        <input
                          type="text"
                          placeholder="جستجو در نام، سرور، منبع یا آی‌پی..."
                          value={configSearch}
                          onChange={(e) => setConfigSearch(e.target.value)}
                          className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      {/* Protocol Filter */}
                      <div className="w-full md:w-48 flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                        <select
                          value={configProtocolFilter}
                          onChange={(e) => setConfigProtocolFilter(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="all">همه پروتکل‌ها</option>
                          <option value="vless">VLESS</option>
                          <option value="vmess">VMESS</option>
                          <option value="trojan">Trojan</option>
                          <option value="ss">ShadowSocks</option>
                          <option value="npv">NapsternetV (NPV)</option>
                        </select>
                      </div>

                      {/* Status Filter */}
                      <div className="w-full md:w-48">
                        <select
                          value={configStatusFilter}
                          onChange={(e) => setConfigStatusFilter(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="all">همه وضعیت‌ها</option>
                          <option value="working">فعال (پاسخ پورت موفق)</option>
                          <option value="failed">غیرفعال (خراب)</option>
                          <option value="untested">در انتظار بررسی</option>
                        </select>
                      </div>
                    </div>

                    {/* Bulk controls info */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
                      <div>
                        تعداد نتایج فیلتر شده: <strong className="text-slate-800">{filteredConfigs.length}</strong> از کل <strong className="text-slate-800">{configs.length}</strong> کانفیگ آرشیو شده.
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleTestAllPorts}
                          disabled={actionLoading === 'test_all'}
                          className="text-indigo-600 font-bold hover:underline cursor-pointer"
                        >
                          تست مجدد کل لیست
                        </button>
                        <span>•</span>
                        <button
                          onClick={handleClearFailed}
                          disabled={actionLoading === 'clear_failed'}
                          className="text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          پاکسازی سرورهای خراب
                        </button>
                        <span>•</span>
                        <button
                          onClick={handleClearAllConfigs}
                          disabled={actionLoading === 'clear_all_configs'}
                          className="text-slate-600 font-bold hover:underline cursor-pointer"
                        >
                          تخلیه کامل آرشیو
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Configs Table / List */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {filteredConfigs.length === 0 ? (
                      <div className="py-24 text-center flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Database className="w-12 h-12 text-slate-300" />
                        <p className="text-sm">هیچ کانفیگی مطابق با فیلتر شما یافت نشد.</p>
                        <p className="text-xs text-slate-500">منبع جدید اضافه کنید یا روی دکمه استخراج دستی کلیک کنید.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {filteredConfigs.slice(0, 150).map((config) => (
                          <div key={config.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                            
                            {/* Left Column info */}
                            <div className="flex-1 space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide uppercase ${
                                  config.protocol === 'vless' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                  config.protocol === 'vmess' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                  config.protocol === 'trojan' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                  config.protocol === 'ss' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                                  'bg-cyan-50 text-cyan-700 border border-cyan-100'
                                }`}>
                                  {config.protocol}
                                </span>
                                <h4 className="text-xs font-bold text-slate-800 truncate" title={config.remark}>
                                  {config.remark || 'بدون عنوان'}
                                </h4>
                                
                                {/* Status badge */}
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                  config.status === 'working' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                  config.status === 'failed' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                  config.status === 'checking' ? 'bg-blue-50 text-blue-700 border border-blue-100 animate-pulse' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {config.status === 'working' && `فعال ${config.latency ? `(${config.latency}ms)` : ''}`}
                                  {config.status === 'failed' && 'مسدود'}
                                  {config.status === 'checking' && 'در حال تست...'}
                                  {config.status === 'untested' && 'تست نشده'}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 font-mono" dir="ltr">
                                Server: <strong className="text-slate-700">{config.server}</strong> | Port: <strong className="text-slate-700">{config.port}</strong>
                              </p>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
                                <span>منبع: <strong className="text-slate-600">{config.source}</strong></span>
                                {config.lastChecked && (
                                  <span>بررسی اتصال: <strong>{new Date(config.lastChecked).toLocaleTimeString('fa-IR')}</strong></span>
                                )}
                              </div>
                            </div>

                            {/* Right actions: Copy link & delete */}
                            <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                              <button
                                onClick={() => copyToClipboard(config.raw, config.id)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                {copiedId === config.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>کپی لینک خام</span>
                              </button>

                              <div className="text-[10px] text-slate-400 hidden sm:block">
                                ID: <span className="font-mono">{config.id}</span>
                              </div>
                            </div>

                          </div>
                        ))}
                      </div>
                    )}
                    
                    {filteredConfigs.length > 150 && (
                      <div className="p-4 text-center bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                        نمایش ۱۵۰ کانفیگ اول جهت سرعت‌دهی به مرورگر. از فیلترهای جستجو برای یافتن موارد دیگر استفاده کنید.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* --- TAB: FORCE JOIN --- */}
              {activeTab === 'join' && (
                <motion.div
                  key="join"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-slate-900 text-base">سیستم عضویت اجباری کاربران (Force Join)</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          با فعال‌سازی این سیستم، قبل از ارائه هرگونه کانفیگ ویتوری یا NapsternetV به کاربر، ربات ابتدا عضویت فرد در کانال یا کانال‌های مشخص شده در زیر را بررسی می‌کند. اگر کاربر عضو نباشد، پیامی شامل لینک کانال‌ها به او داده می‌شود و تا زمان عضویت دسترسی او مسدود خواهد ماند.
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mt-5 space-y-1.5 text-xs text-slate-600 leading-relaxed">
                      <p className="font-bold text-slate-800">💡 راهنمای بسیار مهم برای فعال‌سازی عضویت اجباری:</p>
                      <p>۱. ربات شما حتماً باید در کانال‌های اضافه شده در زیر به عنوان **مدیر (Administrator)** عضو باشد.</p>
                      <p>۲. ربات نیاز به مجوز **دعوت کاربران از طریق لینک (Invite Users via Link)** دارد تا بتواند وضعیت عضویت را بسنجد.</p>
                      <p>۳. شناسه کانال‌ها را دقیقاً به همراه کاراکتر **@** وارد کنید (مثال: `MyChannel@`).</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add Force Join form */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit space-y-4">
                      <h4 className="font-bold text-slate-900 text-sm">افزودن کانال حامی</h4>
                      <form onSubmit={handleAddForceJoin} className="space-y-3.5">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700">شناسه عمومی کانال</label>
                          <input
                            type="text"
                            required
                            placeholder="مثلا: @MyChannel"
                            value={newChannel.username}
                            onChange={(e) => setNewChannel(prev => ({ ...prev, username: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none text-left font-mono"
                            dir="ltr"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700">عنوان نمایشی کانال</label>
                          <input
                            type="text"
                            required
                            placeholder="مثلا: اسپانسر ۱ - کانال اخبار"
                            value={newChannel.title}
                            onChange={(e) => setNewChannel(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700">لینک جوین اختصاصی (اختیاری)</label>
                          <input
                            type="text"
                            placeholder="https://t.me/joinchat/..."
                            value={newChannel.inviteLink}
                            onChange={(e) => setNewChannel(prev => ({ ...prev, inviteLink: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none text-left font-mono"
                            dir="ltr"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={actionLoading === 'add_join'}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>ثبت کانال عضویت اجباری</span>
                        </button>
                      </form>
                    </div>

                    {/* Channels list (Col span 2) */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-6 py-5 border-b border-slate-200">
                        <h4 className="font-bold text-slate-900 text-sm">کانال‌های اجباری ثبت شده</h4>
                      </div>

                      {forceJoinChannels.length === 0 ? (
                        <div className="py-20 text-center flex flex-col items-center justify-center text-slate-400 gap-2">
                          <Users className="w-12 h-12 text-slate-300" />
                          <p className="text-sm">هیچ کانالی در این بخش تعریف نشده است.</p>
                          <p className="text-xs text-slate-500">کاربران هم‌اکنون می‌توانند بدون محدودیت عضویت از خدمات ربات استفاده کنند.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {forceJoinChannels.map((ch) => (
                            <div key={ch.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-bold text-sm text-slate-900">{ch.title}</h5>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    ch.enabled 
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                      : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {ch.enabled ? 'فعال' : 'غیرفعال'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 font-mono" dir="ltr">
                                  Username: {ch.username}
                                </p>
                                {ch.inviteLink && (
                                  <p className="text-[10px] text-indigo-600 font-mono break-all" dir="ltr">
                                    Link: {ch.inviteLink}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center">
                                <button
                                  onClick={() => handleToggleJoin(ch.id)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    ch.enabled
                                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {ch.enabled ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                                </button>
                                <button
                                  onClick={() => handleDeleteJoin(ch.id)}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- TAB: PROXIES --- */}
              {activeTab === 'proxies' && (
                <motion.div
                  key="proxies"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  {/* Top Bar / Search & Filter */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Search */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500">جستجو در سرورها</label>
                        <div className="relative">
                          <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="جستجو بر اساس آی‌پی سرور یا منبع..."
                            value={proxySearch}
                            onChange={(e) => setProxySearch(e.target.value)}
                            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Filter Type */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500">نوع پروکسی</label>
                        <select
                          value={proxyTypeFilter}
                          onChange={(e) => setProxyTypeFilter(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none bg-white cursor-pointer"
                        >
                          <option value="all">همه پروتکل‌ها</option>
                          <option value="mtproto">MTProto Proxy</option>
                          <option value="socks5">Socks5 Proxy</option>
                        </select>
                      </div>

                      {/* Filter Status */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500">وضعیت اتصال در ایران</label>
                        <select
                          value={proxyStatusFilter}
                          onChange={(e) => setProxyStatusFilter(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none bg-white cursor-pointer"
                        >
                          <option value="all">همه وضعیت‌ها</option>
                          <option value="working">فعال (پینگ موفق)</option>
                          <option value="failed">غیرفعال (خراب)</option>
                          <option value="untested">در انتظار بررسی</option>
                        </select>
                      </div>
                    </div>

                    {/* Bulk controls info */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-500">
                      <div>
                        تعداد نتایج فیلتر شده: <strong className="text-slate-800">{filteredProxies.length}</strong> از کل <strong className="text-slate-800">{proxies.length}</strong> پروکسی استخراج شده.
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleTestAllProxies}
                          disabled={actionLoading === 'test_proxies'}
                          className="text-indigo-600 font-bold hover:underline cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading === 'test_proxies' ? 'در حال اجرای تست...' : 'تست مجدد پینگ کل پروکسی‌ها'}
                        </button>
                        <span>•</span>
                        <button
                          onClick={handleClearFailedProxies}
                          disabled={actionLoading === 'clear_failed_proxies'}
                          className="text-rose-600 font-bold hover:underline cursor-pointer disabled:opacity-50"
                        >
                          پاکسازی پروکسی‌های غیرفعال
                        </button>
                        <span>•</span>
                        <button
                          onClick={handleClearAllProxies}
                          disabled={actionLoading === 'clear_all_proxies'}
                          className="text-slate-600 font-bold hover:underline cursor-pointer disabled:opacity-50"
                        >
                          تخلیه کامل پروکسی‌ها
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Proxies List */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {filteredProxies.length === 0 ? (
                      <div className="py-24 text-center flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Radio className="w-12 h-12 text-slate-300" />
                        <p className="text-sm">هیچ پروکسی تلگرامی مطابق با فیلتر شما یافت نشد.</p>
                        <p className="text-xs text-slate-500">منبع جدید تلگرامی اضافه کنید یا منتظر اسکرپ اتوماتیک بمانید.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {filteredProxies.slice(0, 150).map((proxy) => (
                          <div key={proxy.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                            {/* Left details */}
                            <div className="flex-1 space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide uppercase ${
                                  proxy.type === 'mtproto' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}>
                                  {proxy.type}
                                </span>
                                <h4 className="text-xs font-bold text-slate-800 truncate" dir="ltr">
                                  tg://proxy?server={proxy.server}&port={proxy.port}
                                </h4>
                                
                                {/* Status */}
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                  proxy.status === 'working' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                  proxy.status === 'failed' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                  proxy.status === 'checking' ? 'bg-blue-50 text-blue-700 border border-blue-100 animate-pulse' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {proxy.status === 'working' && `فعال ${proxy.latency ? `(${proxy.latency}ms)` : ''}`}
                                  {proxy.status === 'failed' && 'مسدود / خاموش'}
                                  {proxy.status === 'checking' && 'در حال تست...'}
                                  {proxy.status === 'untested' && 'تست نشده'}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 font-mono" dir="ltr">
                                IP: <strong className="text-slate-700">{proxy.server}</strong> | Port: <strong className="text-slate-700">{proxy.port}</strong> {proxy.secret && `| Secret: ${proxy.secret.substring(0, 10)}...`}
                              </p>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
                                <span>منبع: <strong className="text-slate-600">{proxy.source}</strong></span>
                                {proxy.lastChecked && (
                                  <span>آخرین بررسی: <strong>{new Date(proxy.lastChecked).toLocaleTimeString('fa-IR')}</strong></span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                              <button
                                onClick={() => copyToClipboard(proxy.raw, proxy.id)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                {copiedId === proxy.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>کپی لینک پروکسی</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {filteredProxies.length > 150 && (
                      <div className="p-4 text-center bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                        نمایش ۱۵۰ پروکسی اول جهت بهینه‌سازی سرعت مرورگر.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* --- TAB: AUTOPOST (AUTO POST TO TELEGRAM CHANNEL) --- */}
              {activeTab === 'autopost' && (
                <motion.div
                  key="autopost"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="max-w-2xl mx-auto space-y-6"
                >
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Sliders className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-slate-900 text-base">سیستم هوشمند ارسال خودکار (Auto-Post)</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          این سیستم به شما به عنوان مدیر کانال اجازه می‌دهد بدون نیاز به کار دستی، روزانه بهترین کانفیگ‌های تست شده و پروکسی‌های پرسرعت فعال را به همراه لوکیشن، پینگ، برندسازی اختصاصی و متن‌های تبلیغاتی شخصی، به کانال یا گروه خود بفرستید.
                        </p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSaveAutoPostSettings} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">فعال‌سازی ارسال خودکار پست</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">ارسال منظم بر اساس بازه انتخابی شما در پس‌زمینه سرور</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAutoPostForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                        className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                          autoPostForm.enabled ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Target Channel */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>آیدی کانال مقصد ارسال پست</span>
                          <span className="text-[10px] text-slate-400">مثال: MyTelegramChannel@</span>
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
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          ⚠️ بسیار مهم: ربات شما باید حتماً به عنوان مدیر (Administrator) با اجازه **ارسال پست (Post Messages)** در این کانال عضو باشد تا بتواند پست را ارسال کند.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Interval Hours */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700">فاصله زمانی ارسال</label>
                          <select
                            value={autoPostForm.postIntervalHours}
                            onChange={(e) => setAutoPostForm(prev => ({ ...prev, postIntervalHours: Number(e.target.value) }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none bg-white cursor-pointer"
                          >
                            <option value="1">هر ۱ ساعت یکبار</option>
                            <option value="2">هر ۲ ساعت یکبار</option>
                            <option value="3">هر ۳ ساعت یکبار</option>
                            <option value="4">هر ۴ ساعت یکبار</option>
                            <option value="6">هر ۶ ساعت یکبار</option>
                            <option value="8">هر ۸ ساعت یکبار</option>
                            <option value="12">هر ۱۲ ساعت یکبار</option>
                            <option value="24">هر ۲۴ ساعت (یکبار در روز)</option>
                          </select>
                        </div>

                        {/* Config Count */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700">تعداد کانفیگ ویتوری</label>
                          <select
                            value={autoPostForm.configCount}
                            onChange={(e) => setAutoPostForm(prev => ({ ...prev, configCount: Number(e.target.value) }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none bg-white cursor-pointer"
                          >
                            <option value="0">هیچکدام (بدون کانفیگ)</option>
                            <option value="1">۱ کانفیگ برتر فعال</option>
                            <option value="2">۲ کانفیگ برتر فعال</option>
                          </select>
                        </div>

                        {/* Proxy Count */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700">تعداد پروکسی تلگرام</label>
                          <select
                            value={autoPostForm.proxyCount}
                            onChange={(e) => setAutoPostForm(prev => ({ ...prev, proxyCount: Number(e.target.value) }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none bg-white cursor-pointer"
                          >
                            <option value="0">هیچکدام (بدون پروکسی)</option>
                            <option value="1">۱ پروکسی برتر فعال</option>
                            <option value="2">۲ پروکسی برتر فعال</option>
                          </select>
                        </div>
                      </div>

                      {/* Custom Persian text */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700">توضیحات و متن دلخواه پست</label>
                        <textarea
                          rows={4}
                          placeholder="متنی که مایلید به انتهای پست اضافه شود. این متن به همراه لوکیشن و پینگ ارسال می‌شود."
                          value={autoPostForm.customText}
                          onChange={(e) => setAutoPostForm(prev => ({ ...prev, customText: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none leading-relaxed"
                        />
                      </div>

                      {/* Advertisement / Bot username */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700">آیدی جهت تبلیغ (اسپریالایزر)</label>
                        <input
                          type="text"
                          placeholder="مثلا: @MyConfigRobot یا لینک کانال شما"
                          value={autoPostForm.adText}
                          onChange={(e) => setAutoPostForm(prev => ({ ...prev, adText: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      {/* Silent Post */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">ارسال بدون صدا (Silent Mode)</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">پست بدون نوتیفیکیشن صوتی در کانال ارسال خواهد شد (کاربر آزار نمی‌بیند)</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAutoPostForm(prev => ({ ...prev, silentMode: !prev.silentMode }))}
                          className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                            autoPostForm.silentMode ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <button
                        type="submit"
                        disabled={actionLoading === 'save_autopost'}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {actionLoading === 'save_autopost' ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>در حال ذخیره...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>ذخیره تنظیمات ارسال خودکار</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleTriggerAutoPost}
                        disabled={actionLoading === 'trigger_autopost' || !autoPostForm.targetChannel}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                        title="ارسال دستی و فوری یک پست نمونه طبق تنظیمات بالا جهت تست صحت عملکرد"
                      >
                        <Send className="w-4 h-4" />
                        <span>ارسال فوری پست تست به کانال</span>
                      </button>
                    </div>

                    {autoPostForm.lastPostedAt && (
                      <p className="text-[10px] text-slate-400 text-center sm:text-right">
                        آخرین ارسال خودکار موفقیت‌آمیز: <strong>{new Date(autoPostForm.lastPostedAt).toLocaleString('fa-IR')}</strong>
                      </p>
                    )}
                  </form>
                </motion.div>
              )}

              {/* --- TAB: SETTINGS --- */}
              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="max-w-2xl mx-auto"
                >
                  <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">پیکربندی کلیدها و سیستم ربات</h3>
                      <p className="text-xs text-slate-500 mt-1">اطلاعات اتصال به پیام‌رسان تلگرام و زمان‌بندی پویش اتوماتیک.</p>
                    </div>

                    <div className="space-y-4">
                      {/* Token Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>توکن بات تلگرام (Telegram Bot Token)</span>
                          <span className="text-[10px] text-slate-400">دریافت شده از BotFather@</span>
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                          value={settings.botToken}
                          onChange={(e) => setSettings(prev => ({ ...prev, botToken: e.target.value }))}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono text-left focus:border-indigo-500 focus:outline-none"
                          dir="ltr"
                        />
                      </div>

                      {/* Admin Chat ID Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>شناسه عددی مدیر تلگرام (Admin Chat ID)</span>
                          <span className="text-[10px] text-indigo-600 font-semibold">تأیید نقش ادمین در ربات</span>
                        </label>
                        <input
                          type="text"
                          placeholder="مثال: 123456789"
                          value={settings.adminId || ''}
                          onChange={(e) => setSettings(prev => ({ ...prev, adminId: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-left focus:border-indigo-500 focus:outline-none"
                          dir="ltr"
                        />
                        <p className="text-[10px] text-slate-400">
                          پس از عضویت در ربات تلگرام، شناسه خود را از لیست کاربران (در تب داشبورد) کپی کرده و در اینجا ذخیره کنید تا دکمه کنترل مدیریت زیر چت تلگرام برای شما فعال گردد.
                        </p>
                      </div>

                      {/* Branding Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>نام برندسازی کانفیگ‌ها (remarks)</span>
                          <span className="text-[10px] text-slate-400">به انتهای کانفیگ‌های کاربران پیوست می‌شود</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="مثلا:🌟 @MyChannelConfig"
                          value={settings.branding}
                          onChange={(e) => setSettings(prev => ({ ...prev, branding: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                        <p className="text-[10px] text-slate-400">
                          وقتی کاربران درخواست دریافت کانفیگ v2ray یا NPV دهند، نام کانفیگ به این مقدار تغییر خواهد یافت.
                        </p>
                      </div>

                      {/* Interval Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>فاصله زمانی پایش و استخراج اتوماتیک (دقیقه)</span>
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="1440"
                          required
                          value={settings.autoExtractInterval}
                          onChange={(e) => setSettings(prev => ({ ...prev, autoExtractInterval: Number(e.target.value) }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none text-left"
                          dir="ltr"
                        />
                      </div>

                      {/* Toggles */}
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-slate-800">تست اتوماتیک پورت پس از استخراج</h4>
                            <p className="text-[10px] text-slate-400">به محض استخراج کانفیگ جدید، پورت آن پینگ و ارزیابی می‌شود.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSettings(prev => ({ ...prev, autoTest: !prev.autoTest }))}
                            className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer p-0.5 flex items-center ${
                              settings.autoTest ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={actionLoading === 'save_settings'}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading === 'save_settings' ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>در حال ذخیره...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>ذخیره تنظیمات ربات</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleTestBot}
                          disabled={actionLoading === 'test_bot' || !settings.botToken}
                          className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading === 'test_bot' ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>در حال تست اتصال...</span>
                            </>
                          ) : (
                            <>
                              <Radio className="w-4 h-4 text-indigo-600" />
                              <span>تست اتصال ربات</span>
                            </>
                          )}
                        </button>
                      </div>

                      {settings.isBotRunning && (
                        <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>ربات با شناسه فعال در حال اجرا است.</span>
                        </div>
                      )}
                    </div>
                  </form>

                  {/* --- DATABASE BACKUP & RESTORE CARD --- */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 mt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">پشتیبان‌گیری و بازگردانی دیتابیس (Backup & Restore)</h3>
                        <p className="text-xs text-slate-500 mt-0.5">می‌توانید از تمام اطلاعات دیتابیس فایل پشتیبان بگیرید یا فایل بکاپ قبلی خود را بارگذاری کنید.</p>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
                      <a
                        href="/api/backup/export"
                        target="_blank"
                        rel="noreferrer"
                        className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>دانلود فایل پشتیبان دیتابیس (Export JSON)</span>
                      </a>

                      <label className="w-full sm:w-auto px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span>بارگذاری و بازگردانی فایل بکاپ (Restore)</span>
                        <input
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={handleRestoreBackup}
                          disabled={actionLoading === 'restore_backup'}
                        />
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- TAB: BROADCAST --- */}
              {activeTab === 'broadcast' && (
                <motion.div
                  key="broadcast"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="max-w-2xl mx-auto"
                >
                  <form onSubmit={handleSendBroadcast} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Send className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-slate-900 text-base">ارسال پیام گروهی به کاربران ربات</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          متن ارسالی شما بلافاصله در صف ارسال سرور قرار گرفته و به صورت زمان‌بندی شده برای کلیه اعضای فعال ربات فرستاده خواهد شد.
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-1 text-xs text-slate-600 leading-relaxed">
                      <p className="font-bold text-slate-800">📍 امکانات و محدودیت‌های پیام همگانی:</p>
                      <p>۱. می‌توانید از قالب‌بندی استاندارد **Markdown** تلگرام (مانند نوشتن متون ضخیم یا لینک‌دار) استفاده کنید.</p>
                      <p>۲. جهت جلوگیری از اسپم شدن ربات توسط سرور تلگرام، ارسال‌ها دارای تاخیر کسری از ثانیه هستند.</p>
                      <p>۳. کاربران هدف: **{users.length} کاربر** که قبلا ربات را استارت زده‌اند.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">متن پیام ارسالی (Markdown آزاد)</label>
                      <textarea
                        required
                        rows={8}
                        placeholder="متن خود را در اینجا بنویسید...
مثال:
⭐️ تخفیف ویژه کانال vip آغاز شد!
برای خرید به پشتیبانی مراجعه کنید."
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading === 'broadcast' || users.length === 0}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>{actionLoading === 'broadcast' ? 'در حال ارسال پیام به اعضا...' : `ارسال همگانی پیام به ${users.length} کاربر`}</span>
                    </button>
                  </form>
                </motion.div>
              )}

            </AnimatePresence>
          )}

        </div>
      </main>
    </div>
  );
}
