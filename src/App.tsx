import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  X,
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
  TrendingUp,
  Sliders,
  HelpCircle,
  Download,
  Upload,
  Bot,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Lightbulb,
  Flame,
  BookOpen,
  Smartphone,
  ShieldCheck,
  Eye,
  Award,
  Clock,
  Globe,
  ExternalLink,
  Zap,
  Newspaper,
  Image,
  Palette,
  Edit,
  Smile,
  Wrench
} from 'lucide-react';
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
  AutoPostSettings,
  SecondaryChannelSettings,
  TechItem,
  TechItemCategory,
  TechImportance,
  AiPrompt,
  AiPromptCategory,
  FunNewsItem,
  FunNewsSource,
  DigitalToolItem,
  DigitalToolCategory
} from './types';
import { AutoPostView } from './components/AutoPostView';
import { FunNewsView } from './components/FunNewsView';
import { PromptsView } from './components/PromptsView';
import { DigitalToolsView } from './components/DigitalToolsView';

// Define custom window type extensions for Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            username?: string;
            first_name?: string;
          };
        };
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

// Global fetch interceptor to automatically attach authorization token and handle 401
const originalFetch = window.fetch;
window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
  const token = localStorage.getItem('adminToken');
  if (token && typeof input === 'string' && input.startsWith('/api/')) {
    init = init || {};
    init.headers = init.headers || {};
    if (init.headers instanceof Headers) {
      init.headers.set('Authorization', `Bearer ${token}`);
    } else if (Array.isArray(init.headers)) {
      const hasAuth = init.headers.some(h => h[0].toLowerCase() === 'authorization');
      if (!hasAuth) {
        init.headers.push(['Authorization', `Bearer ${token}`]);
      }
    } else {
      init.headers = {
        ...init.headers,
        'Authorization': `Bearer ${token}`
      };
    }
  }
  
  const response = await originalFetch.call(this, input, init);
  
  if (response.status === 401 && typeof input === 'string' && input.startsWith('/api/') && !input.includes('/api/auth/')) {
    localStorage.removeItem('adminToken');
    window.dispatchEvent(new Event('admin-logout'));
  }
  
  return response;
};

export default function App() {
  // Auth States
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [isTgWebApp, setIsTgWebApp] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [logoClickCount, setLogoClickCount] = useState<number>(0);

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sources' | 'configs' | 'proxies' | 'vpn_files' | 'tech' | 'prompts' | 'fun_news' | 'digital_tools' | 'join' | 'settings' | 'autopost' | 'broadcast' | 'public_panel'>('dashboard');
  const [publicSubTab, setPublicSubTab] = useState<'configs' | 'proxies' | 'vpn_files' | 'tech' | 'prompts'>('configs');
  const [activeAutoPostChannelTab, setActiveAutoPostChannelTab] = useState<'channel1' | 'channel2'>('channel1');
  
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
  const [vpnFiles, setVpnFiles] = useState<any[]>([]);
  const [techItems, setTechItems] = useState<TechItem[]>([]);
  const [aiPrompts, setAiPrompts] = useState<AiPrompt[]>([]);
  const [funNewsItems, setFunNewsItems] = useState<FunNewsItem[]>([]);
  const [digitalTools, setDigitalTools] = useState<DigitalToolItem[]>([]);
  const [funSources, setFunSources] = useState<FunNewsSource[]>([]);
  const [funSearch, setFunSearch] = useState('');
  const [funCategoryFilter, setFunCategoryFilter] = useState<'all' | 'fun' | 'news'>('all');
  const [showAddFunSourceModal, setShowAddFunSourceModal] = useState(false);
  const [newFunSourceForm, setNewFunSourceForm] = useState({
    name: '',
    urlOrHandle: '',
    category: 'fun' as 'fun' | 'news'
  });
  const [users, setUsers] = useState<BotUser[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    adminId: '',
    botToken: '',
    botUsername: '',
    branding: '',
    isBotRunning: false,
    autoTest: true,
    autoTestInterval: 10,
    testBatchLimit: 100,
    autoExtractInterval: 30,
    autoPost: {
      enabled: false,
      targetChannel: '',
      postIntervalHours: 4,
      configCount: 5,
      proxyCount: 1,
      customText: '',
      adText: '',
      postFiles: false,
      silentMode: false,
      lastPostedAt: null,
      techNewsCount: 0,
      techTricksCount: 0,
      techPostMode: 'combined',
      autoPurgeOldTechDays: 7,
      includeTechImportanceBadge: true
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
  const [configPage, setConfigPage] = useState<number>(1);

  // Proxy Search & Filter States
  const [proxySearch, setProxySearch] = useState('');
  const [proxyTypeFilter, setProxyTypeFilter] = useState<string>('all');
  const [proxyStatusFilter, setProxyStatusFilter] = useState<string>('all');
  const [proxyPage, setProxyPage] = useState<number>(1);

  // Tech Items Search & Filter States
  const [techSearch, setTechSearch] = useState('');
  const [techCategoryFilter, setTechCategoryFilter] = useState<'all' | 'news' | 'trick' | 'secret'>('all');
  const [techImportanceFilter, setTechImportanceFilter] = useState<string>('all');
  const [showAddTechModal, setShowAddTechModal] = useState(false);
  const [newTechForm, setNewTechForm] = useState({
    title: '',
    summary: '',
    category: 'trick' as TechItemCategory,
    importance: 'high' as TechImportance
  });

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
    configsEnabled: true,
    postIntervalHours: 4,
    configIntervalHours: 4,
    configIntervalMinutes: 240,
    configCount: 5,
    proxyCount: 1,
    customText: '',
    adText: '',
    postFiles: false,
    silentMode: false,
    lastPostedAt: null,
    lastConfigsPostedAt: null,
    lastTechNewsPostedAt: null,
    lastTechTricksPostedAt: null,
    lastAiPromptsPostedAt: null,
    techNewsEnabled: true,
    techNewsIntervalHours: 4,
    techNewsIntervalMinutes: 240,
    techNewsCount: 2,
    techTricksEnabled: true,
    techTricksIntervalHours: 6,
    techTricksIntervalMinutes: 360,
    techTricksCount: 2,
    aiPromptsEnabled: true,
    aiPromptsIntervalHours: 6,
    aiPromptsIntervalMinutes: 360,
    aiPromptsCount: 1,
    funNewsEnabled: false,
    funNewsIntervalHours: 3,
    funNewsIntervalMinutes: 180,
    funNewsCount: 1,
    lastFunNewsPostedAt: null,
    antiFloodDelayMinutes: 3,
    techPostMode: 'combined',
    autoPurgeOldTechDays: 7,
    includeTechImportanceBadge: true,
    channel2: {
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
    }
  });

  const [detectedAppUrl, setDetectedAppUrl] = useState<string>('');

  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [restoreMode, setRestoreMode] = useState<'settings_and_sources' | 'full'>('settings_and_sources');
  const [showPasteBackup, setShowPasteBackup] = useState(false);
  const [pasteBackupText, setPasteBackupText] = useState('');
  const [broadcastProgress, setBroadcastProgress] = useState<{ total: number; done: boolean } | null>(null);

  // Refs for log scrolling & file input
  const logContainerRef = useRef<HTMLDivElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

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

  // --- Admin Access Authentication Layer ---
  
  // 1. Listen for global logout events (triggered by 401 response)
  useEffect(() => {
    const handleLogoutEvent = () => {
      setToken(null);
      localStorage.removeItem('adminToken');
      showToast('نشست شما منقضی شد. لطفا دوباره وارد شوید.', 'error');
    };
    window.addEventListener('admin-logout', handleLogoutEvent);
    return () => window.removeEventListener('admin-logout', handleLogoutEvent);
  }, []);

  // 2. Auth Initialization & Telegram Auto-Login
  useEffect(() => {
    const initAuth = async () => {
      try {
        const tgWebApp = window.Telegram?.WebApp;
        if (tgWebApp && tgWebApp.initDataUnsafe?.user) {
          setIsTgWebApp(true);
          const user = tgWebApp.initDataUnsafe.user;
          
          if (tgWebApp.ready) tgWebApp.ready();
          if (tgWebApp.expand) tgWebApp.expand();

          // Auto login Telegram Admin
          try {
            const res = await fetch('/api/auth/telegram-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id, username: user.username })
            });
            const data = await res.json();
            if (data.success && data.token) {
              localStorage.setItem('adminToken', data.token);
              setToken(data.token);
              setAuthError(null);
            } else {
              setToken(null);
              localStorage.removeItem('adminToken');
            }
          } catch (err) {
            console.error('Telegram auto-login error:', err);
            setToken(null);
            localStorage.removeItem('adminToken');
          }
        } else {
          // Normal web browser - no Telegram WebApp
          setIsTgWebApp(false);
          const cachedToken = localStorage.getItem('adminToken');
          if (cachedToken) {
            setToken(cachedToken);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();
  }, []);

  const handleHeaderLogoClick = () => {
    setLogoClickCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setShowLoginModal(true);
        return 0;
      }
      return next;
    });
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPassword) return;
    setActionLoading('login');
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('adminToken', data.token);
        setToken(data.token);
        setLoginPassword('');
        setLoginUsername('');
        showToast('ورود با موفقیت انجام شد.', 'success');
      } else {
        setAuthError(data.message || 'رمز عبور وارد شده نادرست است.');
      }
    } catch (err) {
      setAuthError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    setAuthError(null);
    showToast('شما با موفقیت خارج شدید.', 'info');
  };

  // --- API Integrations ---

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (!silent) {
        if (token) {
          const [statsRes, sourcesRes, fjRes, configsRes, proxiesRes, usersRes, logsRes, settingsRes, vpnRes, techRes, appUrlRes, promptsRes, funNewsRes, funSourcesRes, digitalToolsRes] = await Promise.all([
            fetch('/api/stats').then(r => r.json()).catch(() => ({})),
            fetch('/api/sources').then(r => r.json()).catch(() => []),
            fetch('/api/force-join').then(r => r.json()).catch(() => []),
            fetch('/api/configs?limit=500').then(r => r.json()).catch(() => []),
            fetch('/api/proxies?limit=500').then(r => r.json()).catch(() => []),
            fetch('/api/users').then(r => r.json()).catch(() => []),
            fetch('/api/logs').then(r => r.json()).catch(() => []),
            fetch('/api/settings').then(r => r.json()).catch(() => ({})),
            fetch('/api/vpn-files').then(r => r.json()).catch(() => []),
            fetch('/api/tech-items').then(r => r.json()).catch(() => []),
            fetch('/api/app-url').then(r => r.json()).catch(() => ({ url: window.location.origin })),
            fetch('/api/ai-prompts').then(r => r.json()).catch(() => []),
            fetch('/api/fun-news').then(r => r.json()).catch(() => []),
            fetch('/api/fun-sources').then(r => r.json()).catch(() => []),
            fetch('/api/digital-tools').then(r => r.json()).catch(() => [])
          ]);

          setStats(statsRes);
          setSources(sourcesRes);
          setForceJoinChannels(fjRes);
          setConfigs(configsRes);
          setProxies(proxiesRes || []);
          setVpnFiles(vpnRes || []);
          setTechItems(techRes || []);
          setAiPrompts(Array.isArray(promptsRes) ? promptsRes : []);
          setFunNewsItems(funNewsRes || []);
          setFunSources(funSourcesRes || []);
          setDigitalTools(Array.isArray(digitalToolsRes) ? digitalToolsRes : []);
          setUsers(usersRes);
          setLogs(logsRes);
          setSettings(settingsRes);
          if (appUrlRes && appUrlRes.url) {
            setDetectedAppUrl(appUrlRes.url);
          } else {
            setDetectedAppUrl(window.location.origin);
          }
          
          if (settingsRes && settingsRes.autoPost) {
            setAutoPostForm({
              ...settingsRes.autoPost,
              channel2: settingsRes.autoPost.channel2 || {
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
              }
            });
          }
        } else {
          // Regular user data fetch - only public routes
          const [configsRes, proxiesRes, vpnRes, techRes, promptsRes] = await Promise.all([
            fetch('/api/configs?limit=500').then(r => r.json()).catch(() => []),
            fetch('/api/proxies?limit=500').then(r => r.json()).catch(() => []),
            fetch('/api/vpn-files').then(r => r.json()).catch(() => []),
            fetch('/api/tech-items').then(r => r.json()).catch(() => []),
            fetch('/api/ai-prompts').then(r => r.json()).catch(() => [])
          ]);

          setConfigs(configsRes);
          setProxies(proxiesRes || []);
          setVpnFiles(vpnRes || []);
          setTechItems(techRes || []);
          setAiPrompts(Array.isArray(promptsRes) ? promptsRes : []);
        }
      } else {
        if (token) {
          // Fast lightweight silent poll for admins
          const promises: Promise<any>[] = [
            fetch('/api/stats').then(r => r.json()).catch(() => ({})),
            fetch('/api/logs').then(r => r.json()).catch(() => [])
          ];

          const isTesting = (stats.checkingConfigsCount || 0) > 0 || (stats.checkingProxiesCount || 0) > 0 || actionLoading === 'test_all';
          const fetchConfigsNeeded = activeTab === 'configs' || activeTab === 'dashboard' || isTesting;
          const fetchProxiesNeeded = activeTab === 'proxies' || activeTab === 'dashboard' || isTesting;
          const fetchSourcesNeeded = activeTab === 'sources';
          const fetchVpnNeeded = activeTab === 'vpn_files';
          const fetchJoinNeeded = activeTab === 'join';
          const fetchUsersNeeded = activeTab === 'broadcast';
          const fetchPromptsNeeded = activeTab === 'prompts';
          const fetchFunNewsNeeded = activeTab === 'fun_news';
          const fetchDigitalToolsNeeded = activeTab === 'digital_tools';

          if (fetchConfigsNeeded) promises.push(fetch('/api/configs?limit=500').then(r => r.json()).catch(() => []));
          if (fetchProxiesNeeded) promises.push(fetch('/api/proxies?limit=500').then(r => r.json()).catch(() => []));
          if (fetchSourcesNeeded) promises.push(fetch('/api/sources').then(r => r.json()).catch(() => []));
          if (fetchVpnNeeded) promises.push(fetch('/api/vpn-files').then(r => r.json()).catch(() => []));
          if (fetchJoinNeeded) promises.push(fetch('/api/force-join').then(r => r.json()).catch(() => []));
          if (fetchUsersNeeded) promises.push(fetch('/api/users').then(r => r.json()).catch(() => []));
          if (fetchPromptsNeeded) promises.push(fetch('/api/ai-prompts').then(r => r.json()).catch(() => []));
          if (fetchFunNewsNeeded) {
            promises.push(fetch('/api/fun-news').then(r => r.json()).catch(() => []));
            promises.push(fetch('/api/fun-sources').then(r => r.json()).catch(() => []));
          }
          if (fetchDigitalToolsNeeded) {
            promises.push(fetch('/api/digital-tools').then(r => r.json()).catch(() => []));
          }

          const results = await Promise.all(promises);
          setStats(results[0]);
          setLogs(results[1]);

          let idx = 2;
          if (fetchConfigsNeeded) { setConfigs(results[idx]); idx++; }
          if (fetchProxiesNeeded) { setProxies(results[idx] || []); idx++; }
          if (fetchSourcesNeeded) { setSources(results[idx]); idx++; }
          if (fetchVpnNeeded) { setVpnFiles(results[idx] || []); idx++; }
          if (fetchJoinNeeded) { setForceJoinChannels(results[idx]); idx++; }
          if (fetchUsersNeeded) { setUsers(results[idx]); idx++; }
          if (fetchPromptsNeeded) { setAiPrompts(Array.isArray(results[idx]) ? results[idx] : []); idx++; }
          if (fetchFunNewsNeeded) {
            setFunNewsItems(results[idx] || []); idx++;
            setFunSources(results[idx] || []); idx++;
          }
          if (fetchDigitalToolsNeeded) {
            setDigitalTools(Array.isArray(results[idx]) ? results[idx] : []); idx++;
          }
        } else {
          // Silent poll for public users
          const promises: Promise<any>[] = [];
          const fetchConfigsNeeded = activeTab === 'configs';
          const fetchProxiesNeeded = activeTab === 'proxies';
          const fetchVpnNeeded = activeTab === 'vpn_files';
          const fetchTechNeeded = activeTab === 'tech';
          const fetchPromptsNeeded = activeTab === 'prompts';

          if (fetchConfigsNeeded) promises.push(fetch('/api/configs?limit=500').then(r => r.json()).catch(() => []));
          if (fetchProxiesNeeded) promises.push(fetch('/api/proxies?limit=500').then(r => r.json()).catch(() => []));
          if (fetchVpnNeeded) promises.push(fetch('/api/vpn-files').then(r => r.json()).catch(() => []));
          if (fetchTechNeeded) promises.push(fetch('/api/tech-items').then(r => r.json()).catch(() => []));
          if (fetchPromptsNeeded) promises.push(fetch('/api/ai-prompts').then(r => r.json()).catch(() => []));

          if (promises.length > 0) {
            const results = await Promise.all(promises);
            let idx = 0;
            if (fetchConfigsNeeded) { setConfigs(results[idx]); idx++; }
            if (fetchProxiesNeeded) { setProxies(results[idx] || []); idx++; }
            if (fetchVpnNeeded) { setVpnFiles(results[idx] || []); idx++; }
            if (fetchTechNeeded) { setTechItems(results[idx] || []); idx++; }
            if (fetchPromptsNeeded) { setAiPrompts(Array.isArray(results[idx]) ? results[idx] : []); idx++; }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial fetch and adaptive fast polling when testing is active
  useEffect(() => {
    fetchData();
  }, [token]);

  // Fetch updated data when switching active tabs
  useEffect(() => {
    fetchData(true);
  }, [activeTab, token]);

  // Reset pagination when filters change
  useEffect(() => {
    setConfigPage(1);
  }, [configSearch, configProtocolFilter, configStatusFilter]);

  useEffect(() => {
    setProxyPage(1);
  }, [proxySearch, proxyTypeFilter, proxyStatusFilter]);

  useEffect(() => {
    const isTesting = token && ((stats.checkingConfigsCount || 0) > 0 || (stats.checkingProxiesCount || 0) > 0 || actionLoading === 'test_all');
    const pollMs = isTesting ? 1500 : (token ? 5000 : 15000);

    const interval = setInterval(() => {
      fetchData(true);
    }, pollMs);

    return () => clearInterval(interval);
  }, [stats.checkingConfigsCount, stats.checkingProxiesCount, actionLoading, token]);

  // Handle Restore Backup with fast native streaming (no main-thread JSON freeze)
  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>, overrideMode?: 'settings_and_sources' | 'full') => {
    const activeMode = overrideMode || restoreMode;
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const modeLabel = activeMode === 'settings_and_sources'
      ? 'فقط تنظیمات و لیست کانال‌ها/منابع (بدون تغییر کانفیگ‌ها)'
      : 'کامل (همراه با تمام کانفیگ‌ها و لاگ‌ها)';

    if (!window.confirm(`آیا مطمئن هستید که می‌خواهید دیتابیس را بازگردانی (Restore) کنید؟\n\nحالت انتخابی: ${modeLabel}\nحجم فایل: ${fileSizeMb} مگابایت`)) {
      e.target.value = '';
      return;
    }

    try {
      setActionLoading('restore_backup');

      // Direct streaming upload
      const res = await fetch(`/api/backup/upload-stream?mode=${activeMode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: file
      });
      
      let data: any;
      try {
        data = await res.json();
      } catch (parseErr) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || `خطا در دریافت پاسخ از سرور (کد وضعیت: ${res.status})`);
      }

      if (data.success) {
        const c = data.counts || {};
        let details = '✅ بازگردانی دیتابیس با موفقیت انجام شد!\n';
        if (activeMode === 'settings_and_sources') {
          details += `\n• تنظیمات و لیست ${c.sources !== undefined ? c.sources : ''} کانال/منبع و کانال‌های قفل بازیابی شدند.`;
          details += `\n• کانفیگ‌های فعلی دست‌نخورده باقی ماندند.`;
        } else {
          if (c.configs !== undefined) details += `\n• تعداد کانفیگ‌ها: ${c.configs}`;
          if (c.proxies !== undefined) details += `\n• تعداد پروکسی‌ها: ${c.proxies}`;
          if (c.sources !== undefined) details += `\n• تعداد منابع: ${c.sources}`;
          if (c.users !== undefined) details += `\n• تعداد کاربران: ${c.users}`;
        }
        showToast(details.split('\n')[0], 'success');
        alert(details);
        await fetchData();
        window.location.reload();
      } else {
        alert(`❌ خطا در بازگردانی بکاپ:\n${data.message || 'فایل ارسالی نامعتبر است'}`);
      }
    } catch (err: any) {
      alert(`❌ خطا در انتقال فایل یا پردازش در سرور:\n${err.message}`);
    } finally {
      setActionLoading(null);
      e.target.value = '';
    }
  };

  // Handle Restore Backup from pasted text/JSON
  const handleRestorePasteText = async (overrideMode?: 'settings_and_sources' | 'full') => {
    const activeMode = overrideMode || restoreMode;
    if (!pasteBackupText.trim()) {
      alert('لطفاً ابتدا متن JSON یا لینک‌های کانفیگ را در کادر وارد نمایید.');
      return;
    }

    const modeLabel = activeMode === 'settings_and_sources'
      ? 'فقط تنظیمات و لیست کانال‌ها/منابع (بدون تغییر کانفیگ‌ها)'
      : 'کامل (همراه با تمام کانفیگ‌ها و لاگ‌ها)';

    if (!window.confirm(`آیا مطمئن هستید که می‌خواهید دیتابیس را از متن وارد شده بازگردانی (Restore) کنید؟\n\nحالت انتخابی: ${modeLabel}`)) {
      return;
    }

    try {
      setActionLoading('restore_backup_text');

      const res = await fetch(`/api/backup/upload-stream?mode=${activeMode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: pasteBackupText.trim()
      });

      let data: any;
      try {
        data = await res.json();
      } catch (parseErr) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || `خطا در دریافت پاسخ از سرور (کد وضعیت: ${res.status})`);
      }

      if (data.success) {
        const c = data.counts || {};
        let details = '✅ بازگردانی دیتابیس با موفقیت انجام شد!\n';
        if (activeMode === 'settings_and_sources') {
          details += `\n• تنظیمات و لیست ${c.sources !== undefined ? c.sources : ''} کانال/منبع و کانال‌های قفل بازیابی شدند.`;
          details += `\n• کانفیگ‌های فعلی دست‌نخورده باقی ماندند.`;
        } else {
          if (c.configs !== undefined) details += `\n• تعداد کانفیگ‌ها: ${c.configs}`;
          if (c.proxies !== undefined) details += `\n• تعداد پروکسی‌ها: ${c.proxies}`;
          if (c.sources !== undefined) details += `\n• تعداد منابع: ${c.sources}`;
          if (c.users !== undefined) details += `\n• تعداد کاربران: ${c.users}`;
        }
        showToast(details.split('\n')[0], 'success');
        alert(details);
        await fetchData();
        window.location.reload();
      } else {
        alert(`❌ خطا در بازگردانی بکاپ:\n${data.message || 'متن وارد شده نامعتبر است'}`);
      }
    } catch (err: any) {
      alert(`❌ خطا در پردازش متن بکاپ در سرور:\n${err.message}`);
    } finally {
      setActionLoading(null);
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

  // Automatically configure Telegram WebApp Menu Button
  const handleSetMenuButton = async () => {
    setActionLoading('set_menu_button');
    try {
      const res = await fetch('/api/settings/set-menu-button', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'دکمه منوی وب‌ویو ربات در تلگرام با موفقیت فعال شد!', 'success');
      } else {
        showToast(data.message || 'خطا در ثبت دکمه منو در تلگرام', 'error');
      }
    } catch (err: any) {
      showToast('خطا در برقراری ارتباط با سرور', 'error');
    } finally {
      setActionLoading(null);
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
      const limit = settings.testBatchLimit || 100;
      const [res1, res2] = await Promise.all([
        fetch('/api/configs/test-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit })
        }),
        fetch('/api/proxies/test-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit })
        })
      ]);
      const data1 = await res1.json();
      const data2 = await res2.json();
      if (data1.success || data2.success) {
        showToast(`بررسی اتصال ${limit} کانفیگ و پروکسی اخیر در پس‌زمینه با سرعت بالا آغاز شد.`, 'success');
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

  const handleMarkConfigStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/configs/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        setConfigs(prev => prev.map(c => c.id === id ? { ...c, status: status as any, latency: status === 'working' ? 10 : c.latency, lastChecked: new Date().toISOString() } : c));
        showToast(`وضعیت کانفیگ با موفقیت به ${status === 'working' ? 'فعال' : 'غیرفعال'} تغییر یافت.`, 'success');
      } else {
        showToast(data.message || 'خطا در تغییر وضعیت', 'error');
      }
    } catch (err: any) {
      showToast('خطای شبکه در تغییر وضعیت', 'error');
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

  const handleMarkProxyStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/proxies/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        setProxies(prev => prev.map(p => p.id === id ? { ...p, status: status as any, latency: status === 'working' ? 10 : p.latency, lastChecked: new Date().toISOString() } : p));
        showToast(`وضعیت پروکسی با موفقیت به ${status === 'working' ? 'فعال' : 'غیرفعال'} تغییر یافت.`, 'success');
      } else {
        showToast(data.message || 'خطا در تغییر وضعیت', 'error');
      }
    } catch (err: any) {
      showToast('خطای شبکه در تغییر وضعیت', 'error');
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

  // --- VPN Files Handlers ---
  const handleDeleteVpnFile = async (id: string) => {
    if (!confirm('آیا از حذف این فایل مطمئن هستید؟')) return;
    try {
      const res = await fetch(`/api/vpn-files/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setVpnFiles(prev => prev.filter(f => f.id !== id));
        showToast('فایل با موفقیت حذف شد.', 'success');
      }
    } catch (err) {
      showToast('خطا در حذف فایل', 'error');
    }
  };

  const handleClearAllVpnFiles = async () => {
    if (!confirm('هشدار: آیا می‌خواهید تمام فایل‌های ذخیره شده را حذف کنید؟')) return;
    setActionLoading('clear_all_vpn_files');
    try {
      const res = await fetch('/api/vpn-files', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setVpnFiles([]);
        showToast('تمامی فایل‌ها با موفقیت حذف شدند.', 'success');
      }
    } catch (err) {
      showToast('خطا در حذف فایل‌ها', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // --- Auto Post Handlers ---
  const updateChannel2 = (patch: Partial<SecondaryChannelSettings>) => {
    setAutoPostForm(prev => ({
      ...prev,
      channel2: {
        ...(prev.channel2 || {
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
        }),
        ...patch
      }
    }));
  };

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

  const handleTriggerAutoPost = async (channelNum = 1) => {
    setActionLoading(`trigger_autopost_${channelNum}`);
    try {
      // Save current form settings first so the test post uses the latest values
      const saveRes = await fetch('/api/settings/auto-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoPostForm)
      });
      const saveData = await saveRes.json();
      if (saveData.success && saveData.autoPost) {
        setAutoPostForm(saveData.autoPost);
      }

      const res = await fetch('/api/bot/auto-post/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelNum })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `پست آزمایشی با موفقیت به کانال ${channelNum} ارسال گردید.`, 'success');
      } else {
        showToast(data.message || 'خطا در ارسال پست', 'error');
      }
    } catch (err) {
      showToast(`خطا در ارسال پست به کانال ${channelNum}`, 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  const handleTriggerConfigsAutoPost = async (channelNum = 1) => {
    setActionLoading(`trigger_configs_autopost_${channelNum}`);
    try {
      await fetch('/api/settings/auto-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoPostForm)
      });

      const res = await fetch('/api/bot/auto-post/trigger-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelNum })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `پست آزمایشی کانفیگ‌ها و پروکسی‌ها با موفقیت به کانال ${channelNum} ارسال شد.`, 'success');
      } else {
        showToast(data.message || 'خطا در ارسال کانفیگ‌ها', 'error');
      }
    } catch (err) {
      showToast('خطا در ارسال به کانال', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  const handleTriggerTechNewsAutoPost = async (channelNum = 1) => {
    setActionLoading(`trigger_tech_news_autopost_${channelNum}`);
    try {
      await fetch('/api/settings/auto-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoPostForm)
      });

      const res = await fetch('/api/bot/auto-post/trigger-tech-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelNum })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `پست آزمایشی اخبار روز تکنولوژی با موفقیت به کانال ${channelNum} ارسال شد.`, 'success');
      } else {
        showToast(data.message || 'خطا در ارسال اخبار', 'error');
      }
    } catch (err) {
      showToast('خطا در ارسال اخبار به کانال', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  const handleTriggerTechTricksAutoPost = async (channelNum = 1) => {
    setActionLoading(`trigger_tech_tricks_autopost_${channelNum}`);
    try {
      await fetch('/api/settings/auto-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoPostForm)
      });

      const res = await fetch('/api/bot/auto-post/trigger-tech-tricks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelNum })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `پست آزمایشی ترفندها و رازهای تکنولوژی با موفقیت به کانال ${channelNum} ارسال شد.`, 'success');
      } else {
        showToast(data.message || 'خطا در ارسال ترفندها', 'error');
      }
    } catch (err) {
      showToast('خطا در ارسال ترفندها به کانال', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // --- AI Prompts Handlers ---
  const handleTriggerAiPromptsAutoPost = async (channelNum = 1) => {
    setActionLoading(`trigger_ai_prompts_autopost_${channelNum}`);
    try {
      await fetch('/api/settings/auto-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoPostForm)
      });

      const res = await fetch('/api/bot/auto-post/trigger-ai-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelNum })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `پست آزمایشی پرامپت‌های طلایی با موفقیت به کانال ${channelNum} ارسال شد.`, 'success');
      } else {
        showToast(data.message || 'خطا در ارسال پرامپت‌ها', 'error');
      }
    } catch (err) {
      showToast('خطا در ارسال پرامپت‌ها به کانال', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  // --- Fun & General News Handlers ---
  const handleTriggerFunNewsAutoPost = async (channelNum: 1 | 2 = 2) => {
    setActionLoading(`trigger_fun_news_${channelNum}`);
    try {
      await fetch('/api/settings/auto-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoPostForm)
      });

      const res = await fetch('/api/bot/auto-post/trigger-fun-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelNum })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `پست فان و اخبار با موفقیت به کانال ${channelNum} ارسال شد.`, 'success');
      } else {
        showToast(data.message || 'خطا در ارسال فان و اخبار', 'error');
      }
    } catch (err) {
      showToast('خطا در ارتباط با سرور', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  const handleRefreshFunNews = async (sourceId?: string | any) => {
    // Sanitize sourceId so it's strictly a valid string ID or undefined (prevent React synthetic event from being serialized)
    const cleanSourceId = (typeof sourceId === 'string' && sourceId.trim().length > 0 && sourceId !== '[object Object]') 
      ? sourceId.trim() 
      : undefined;

    setActionLoading(cleanSourceId ? `refresh_fun_source_${cleanSourceId}` : 'refresh_fun_news');
    try {
      const res = await fetch('/api/fun-news/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: cleanSourceId })
      });
      if (!res.ok) {
        let msg = `خطای سرور (${res.status})`;
        try {
          const errData = await res.json();
          if (errData?.message) msg = errData.message;
        } catch {}
        showToast(msg, 'error');
        return;
      }
      const data = await res.json();
      if (data.success) {
        showToast(`استخراج با موفقیت انجام شد: ${data.addedCount} مطلب تازه افزوده شد (${data.totalCount} کل).`, 'success');
        fetchData(true);
      } else {
        showToast(data.message || 'خطا در استخراج از کانال‌ها', 'error');
      }
    } catch (err: any) {
      showToast(`خطای شبکه در استخراج مطالب: ${err?.message || 'بررسی ارتباط اینترنت'}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddFunSource = async (
    sourceData?: { name: string; urlOrHandle: string; category?: 'fun' | 'news' } | React.FormEvent
  ): Promise<boolean> => {
    if (sourceData && 'preventDefault' in (sourceData as any) && typeof (sourceData as any).preventDefault === 'function') {
      (sourceData as any).preventDefault();
    }
    const payload = (sourceData && 'urlOrHandle' in (sourceData as any))
      ? (sourceData as { name: string; urlOrHandle: string; category?: 'fun' | 'news' })
      : newFunSourceForm;

    if (!payload.urlOrHandle || !payload.urlOrHandle.trim()) {
      showToast('لطفا شناسه یا آدرس کانال تلگرام را وارد کنید.', 'error');
      return false;
    }
    setActionLoading('add_fun_source');
    try {
      const res = await fetch('/api/fun-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast('کانال تلگرام منبع با موفقیت افزوده شد.', 'success');
        setShowAddFunSourceModal(false);
        setNewFunSourceForm({ name: '', urlOrHandle: '', category: 'fun' });
        if (data.source) {
          setFunSources(prev => {
            const exists = prev.some(s => s.id === data.source.id);
            if (exists) return prev;
            return [...prev, data.source];
          });
        }
        fetchData(true);
        return true;
      } else {
        showToast(data.message || 'خطا در ثبت کانال منبع', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(err?.message || 'خطا در افزودن کانال منبع', 'error');
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleFunSource = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/fun-sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      if (data.success) {
        setFunSources(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
        showToast(enabled ? 'کانال منبع فعال شد.' : 'کانال منبع غیرفعال شد.', 'info');
      }
    } catch (err) {
      showToast('خطا در تغییر وضعیت منبع', 'error');
    }
  };

  const handleDeleteFunSource = async (id: string) => {
    setActionLoading(`delete_fun_source_${id}`);
    try {
      const res = await fetch(`/api/fun-sources/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setFunSources(prev => prev.filter(s => s.id !== id));
        showToast('کانال منبع و مطالب مرتبط با آن با موفقیت حذف گردید.', 'success');
        fetchData(true);
      } else {
        showToast(data.message || 'خطا در حذف کانال منبع', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'خطا در حذف کانال منبع', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendFunNewsItem = async (itemId: string, channelNum: 1 | 2 = 2) => {
    setActionLoading(`send_fun_item_${itemId}`);
    try {
      const res = await fetch('/api/fun-news/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, channelNum })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `مطلب با موفقیت به کانال ${channelNum} ارسال شد.`, 'success');
        fetchData(true);
      } else {
        showToast(data.message || 'خطا در ارسال مطلب', 'error');
      }
    } catch (err) {
      showToast('خطا در ارتباط با سرور تلگرام', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteFunNewsItem = async (id: string) => {
    if (!confirm('آیا از حذف این مطلب مطمئن هستید؟')) return;
    try {
      const res = await fetch(`/api/fun-news/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setFunNewsItems(prev => prev.filter(i => i.id !== id));
        showToast('مطلب با موفقیت حذف شد.', 'success');
      }
    } catch (err) {
      showToast('خطا در حذف مطلب', 'error');
    }
  };

  // --- Digital Tools (Evergreen Growth Content) Handlers ---
  const handleTriggerDigitalToolsAutoPost = async (channelNum: number = 1) => {
    setActionLoading(`trigger_digital_tools_${channelNum}`);
    try {
      await fetch('/api/settings/auto-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoPostForm)
      });

      const res = await fetch('/api/bot/auto-post/trigger-digital-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelNum })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || `مطلب جعبه‌ابزار دیجیتال با موفقیت به کانال ${channelNum} ارسال شد.`, 'success');
      } else {
        showToast(data.message || 'خطا در ارسال مطلب جعبه‌ابزار دیجیتال', 'error');
      }
    } catch (err) {
      showToast('خطا در ارتباط با سرور تلگرام', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  const handleSaveDigitalTool = async (toolData: Partial<DigitalToolItem>): Promise<boolean> => {
    setActionLoading('save_digital_tool');
    try {
      const isEditing = !!toolData.id;
      const url = isEditing ? `/api/digital-tools/${toolData.id}` : '/api/digital-tools';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolData)
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEditing ? 'ابزار دیجیتال با موفقیت ویرایش شد.' : 'ابزار دیجیتال جدید با موفقیت افزوده شد.', 'success');
        fetchData(true);
        return true;
      } else {
        showToast(data.message || 'خطا در ثبت ابزار دیجیتال', 'error');
        return false;
      }
    } catch (err: any) {
      showToast(err?.message || 'خطا در برقراری ارتباط با سرور', 'error');
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteDigitalTool = async (id: string) => {
    if (!confirm('آیا از حذف این ابزار از جعبه‌ابزار دیجیتال اطمینان دارید؟')) return;
    setActionLoading(`delete_digital_tool_${id}`);
    try {
      const res = await fetch(`/api/digital-tools/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setDigitalTools(prev => prev.filter(t => t.id !== id));
        showToast('ابزار با موفقیت از لیست حذف شد.', 'success');
      } else {
        showToast(data.message || 'خطا در حذف ابزار', 'error');
      }
    } catch (err) {
      showToast('خطا در حذف ابزار', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSavePrompt = async (promptData: {
    id?: string;
    title: string;
    category: AiPromptCategory;
    description: string;
    promptText: string;
    imageUrl?: string;
    tags?: string[];
  }): Promise<boolean> => {
    setActionLoading('save_prompt');
    try {
      const isEdit = !!promptData.id;
      const url = isEdit ? `/api/ai-prompts/${promptData.id}` : '/api/ai-prompts';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptData)
      });
      const data = await res.json();

      if (data.success) {
        showToast(isEdit ? 'پرامپت با موفقیت بروزرسانی شد.' : 'پرامپت جدید با موفقیت ثبت گردید.', 'success');
        const promptsRes = await fetch('/api/ai-prompts').then(r => r.json());
        setAiPrompts(Array.isArray(promptsRes) ? promptsRes : []);
        fetchData(true);
        return true;
      } else {
        showToast(data.message || 'خطا در ذخیره‌سازی پرامپت', 'error');
        return false;
      }
    } catch (err) {
      showToast('خطا در ارتباط با سرور', 'error');
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    if (!window.confirm('آیا از حذف این پرامپت هوش مصنوعی اطمینان دارید؟')) return;

    setActionLoading(`delete_prompt_${id}`);
    try {
      const res = await fetch(`/api/ai-prompts/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        showToast('پرامپت با موفقیت حذف شد.', 'success');
        const promptsRes = await fetch('/api/ai-prompts').then(r => r.json());
        setAiPrompts(Array.isArray(promptsRes) ? promptsRes : []);
      } else {
        showToast(data.message || 'خطا در حذف پرامپت', 'error');
      }
    } catch (err) {
      showToast('خطا در ارتباط با سرور', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // --- Tech Knowledgebase Handlers ---
  const handleRefreshTech = async () => {
    setActionLoading('refresh_tech');
    try {
      const res = await fetch('/api/tech-items/refresh', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`پویش آنلاین انجام شد: ${data.addedCount} مطلب جدید جمع‌آوری و بروزرسانی گردید.`, 'success');
        const itemsRes = await fetch('/api/tech-items').then(r => r.json());
        setTechItems(itemsRes);
      } else {
        showToast(data.message || 'خطا در دریافت مطالب', 'error');
      }
    } catch (err) {
      showToast('خطا در ارتباط با سرور', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  const handleRefreshPrompts = async () => {
    setActionLoading('refresh_prompts');
    try {
      const res = await fetch('/api/ai-prompts/refresh', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`پویش و استخراج آنلاین پرامپت‌ها انجام شد: ${data.addedCount} پرامپت طلایی و عکس واقعی از وب استخراج شد.`, 'success');
        const itemsRes = await fetch('/api/ai-prompts').then(r => r.json());
        setAiPrompts(Array.isArray(itemsRes) ? itemsRes : []);
      } else {
        showToast(data.message || 'خطا در دریافت پرامپت‌ها', 'error');
      }
    } catch (err) {
      showToast('خطا در ارتباط با سرور', 'error');
    } finally {
      setActionLoading(null);
      fetchData(true);
    }
  };

  const handleAddTechItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTechForm.title.trim() || !newTechForm.summary.trim()) {
      showToast('عنوان و متن ترفند یا خبر الزامی است.', 'error');
      return;
    }
    setActionLoading('add_tech');
    try {
      const res = await fetch('/api/tech-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTechForm)
      });
      const data = await res.json();
      if (data.success) {
        showToast('مطلب جدید با موفقیت به دانشنامه افزوده شد.', 'success');
        setTechItems(prev => [data.item, ...prev]);
        setShowAddTechModal(false);
        setNewTechForm({ title: '', summary: '', category: 'trick', importance: 'high' });
      } else {
        showToast(data.message || 'خطا در ثبت مطلب', 'error');
      }
    } catch (err) {
      showToast('خطا در ثبت مطلب', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTechItem = async (id: string) => {
    try {
      const res = await fetch(`/api/tech-items/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setTechItems(prev => prev.filter(t => t.id !== id));
        showToast('مطلب از بانک حذف شد.', 'info');
      }
    } catch (err) {
      showToast('خطا در حذف مطلب', 'error');
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
      { name: 'کانال فعال V2Ray Alpha', type: 'telegram' as const, urlOrHandle: '@v2ray_alpha' },
      { name: 'کانال پروکسی و کانفیگ VPN Ocean', type: 'telegram' as const, urlOrHandle: '@vpn_ocean' },
      { name: 'کانال پروکسی‌های تلگرام MTProto', type: 'telegram' as const, urlOrHandle: '@ProxyMTProto' },
      { name: 'مخزن رسمی تجمیعی MahdiBland Sub', type: 'sub' as const, urlOrHandle: 'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt' },
      { name: 'مخزن جامع کانفیگ‌های BarryFar', type: 'sub' as const, urlOrHandle: 'https://raw.githubusercontent.com/barry-far/V2ray-config/main/All_Configs_Sub.txt' }
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

  // Memoized Filtered configurations calculation
  const filteredConfigs = useMemo(() => {
    const s = configSearch.toLowerCase();
    return configs.filter(config => {
      const matchesSearch = !s ||
        (config.remark && config.remark.toLowerCase().includes(s)) ||
        (config.server && config.server.toLowerCase().includes(s)) ||
        (config.source && config.source.toLowerCase().includes(s));
      
      const matchesProtocol = configProtocolFilter === 'all' || config.protocol === configProtocolFilter;
      const matchesStatus = configStatusFilter === 'all' || config.status === configStatusFilter;

      return matchesSearch && matchesProtocol && matchesStatus;
    });
  }, [configs, configSearch, configProtocolFilter, configStatusFilter]);

  const ITEMS_PER_PAGE = 50;
  const configTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredConfigs.length / ITEMS_PER_PAGE)), [filteredConfigs.length]);
  const paginatedConfigs = useMemo(() => filteredConfigs.slice((configPage - 1) * ITEMS_PER_PAGE, configPage * ITEMS_PER_PAGE), [filteredConfigs, configPage]);

  // Memoized Filtered proxies calculation
  const filteredProxies = useMemo(() => {
    const s = proxySearch.toLowerCase();
    return proxies.filter(proxy => {
      const matchesSearch = !s ||
        (proxy.server && proxy.server.toLowerCase().includes(s)) ||
        (proxy.source && proxy.source.toLowerCase().includes(s));
      
      const matchesType = proxyTypeFilter === 'all' || proxy.type === proxyTypeFilter;
      const matchesStatus = proxyStatusFilter === 'all' || proxy.status === proxyStatusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [proxies, proxySearch, proxyTypeFilter, proxyStatusFilter]);

  const proxyTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredProxies.length / ITEMS_PER_PAGE)), [filteredProxies.length]);
  const paginatedProxies = useMemo(() => filteredProxies.slice((proxyPage - 1) * ITEMS_PER_PAGE, proxyPage * ITEMS_PER_PAGE), [filteredProxies, proxyPage]);

  // Memoized Filtered tech items calculation
  const filteredTechItems = useMemo(() => {
    const s = techSearch.toLowerCase().trim();
    return techItems.filter(item => {
      const matchesSearch = !s ||
        (item.title && item.title.toLowerCase().includes(s)) ||
        (item.summary && item.summary.toLowerCase().includes(s)) ||
        (item.tags && item.tags.some(t => t.toLowerCase().includes(s))) ||
        (item.source && item.source.toLowerCase().includes(s));

      const matchesCategory = techCategoryFilter === 'all' || item.category === techCategoryFilter;
      const matchesImportance = techImportanceFilter === 'all' || item.importance === techImportanceFilter;

      return matchesSearch && matchesCategory && matchesImportance;
    });
  }, [techItems, techSearch, techCategoryFilter, techImportanceFilter]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100" dir="rtl">
        <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <h1 className="text-lg font-bold">در حال بررسی دسترسی...</h1>
        <p className="text-xs text-slate-400 mt-2">لطفا شکیبا باشید.</p>
      </div>
    );
  }

  if (!token || activeTab === 'public_panel') {
    return renderPublicWebPanel();
  }

  function renderPublicWebPanel() {
    const resolvedTab = publicSubTab;

    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col relative" dir="rtl">
        
        {/* Sleek Client Header */}
        <header className="bg-slate-900 text-white shadow-md relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/40 to-slate-900 opacity-60 pointer-events-none" />
          <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 cursor-pointer select-none active:scale-95 transition-transform"
                onClick={handleHeaderLogoClick}
                title="سامانه هوشمند اشتراک‌گذاری کانفیگ"
              >
                <Radio className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <h1 className="font-extrabold text-xl text-white tracking-tight flex items-center gap-2">
                  <span>کانفیگ‌یاب و پروکسی‌ساز هوشمند</span>
                  <span className="text-[10px] bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full font-bold">نسخه کاربر</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">آرشیو روزانه و خودکار پروکسی‌های تلگرام، کلاینت‌های V2Ray و مطالب تکنولوژی</p>
              </div>
            </div>

            {/* Live stats counter */}
            {/* Live stats counter & Admin Button */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-3.5 bg-slate-800/40 backdrop-blur border border-slate-700/50 rounded-2xl p-3 px-4 text-xs">
                <div className="flex items-center gap-1.5 border-l border-slate-700/80 pl-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-slate-400">کانفیگ‌های فعال:</span>
                  <strong className="text-emerald-400 font-black">{configs.filter(c => c.status === 'working').length}</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">پروکسی فعال:</span>
                  <strong className="text-indigo-400 font-black">{proxies.filter(p => p.status === 'working').length}</strong>
                </div>
              </div>

              {token ? (
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                  title="بازگشت به پنل مدیریت"
                >
                  <Bot className="w-4 h-4" />
                  <span>داشبورد مدیریت</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700/60 transition-all cursor-pointer"
                  title="ورود مدیریت سیستم"
                >
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>ورود مدیر</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Tab selection menu */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex items-center gap-1.5 overflow-x-auto py-3 scrollbar-none">
              <button
                onClick={() => setPublicSubTab('configs')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  resolvedTab === 'configs'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15 font-black'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>کانفیگ‌های V2Ray ({configs.filter(c => c.status === 'working').length})</span>
              </button>

              <button
                onClick={() => setPublicSubTab('proxies')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  resolvedTab === 'proxies'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15 font-black'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Radio className="w-4 h-4 shrink-0" />
                <span>پروکسی تلگرام ({proxies.filter(p => p.status === 'working').length})</span>
              </button>

              <button
                onClick={() => setPublicSubTab('vpn_files')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  resolvedTab === 'vpn_files'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15 font-black'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>فایل‌های VPN ({vpnFiles.length})</span>
              </button>

              <button
                onClick={() => setPublicSubTab('tech')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  resolvedTab === 'tech'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15 font-black'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>اخبار و ترفندها ({techItems.length})</span>
              </button>

              <button
                onClick={() => setPublicSubTab('prompts')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  resolvedTab === 'prompts'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15 font-black'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Palette className="w-4 h-4 shrink-0 text-pink-500" />
                <span>بانک پرامپت‌ها ({aiPrompts.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <main className="flex-1 max-w-6xl w-full mx-auto p-5 md:py-8 space-y-6">
          {loading ? (
            <div className="py-24 text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
              <p className="text-xs text-slate-500">در حال بروزرسانی لیست کانفیگ‌ها و پروکسی‌ها...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              
              {/* --- TAB: CONFIGS --- */}
              {resolvedTab === 'configs' && (
                <motion.div
                  key="configs"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row items-center gap-4">
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
                      <div className="w-full md:w-48 flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                        <select
                          value={configProtocolFilter}
                          onChange={(e) => setConfigProtocolFilter(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="all">همه پروتکل‌ها</option>
                          <option value="vless">VLESS</option>
                          <option value="vmess">VMESS</option>
                          <option value="trojan">Trojan</option>
                          <option value="ss">ShadowSocks</option>
                          <option value="npv">NapsternetV (NPV)</option>
                        </select>
                      </div>
                      <div className="w-full md:w-48">
                        <select
                          value={configStatusFilter}
                          onChange={(e) => setConfigStatusFilter(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="all">همه وضعیت‌ها</option>
                          <option value="working">فعال (پاسخ پورت موفق)</option>
                          <option value="untested">در انتظار بررسی</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {filteredConfigs.length === 0 ? (
                      <div className="py-24 text-center flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Database className="w-12 h-12 text-slate-300" />
                        <p className="text-sm">هیچ کانفیگی مطابق با فیلتر شما یافت نشد.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {paginatedConfigs.map((config) => (
                          <div key={config.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
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
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                  config.status === 'working' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {config.status === 'working' ? `فعال ${config.latency ? `(${config.latency}ms)` : ''}` : 'در انتظار تست'}
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
                            <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                              <button
                                onClick={() => copyToClipboard(config.raw, config.id)}
                                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                              >
                                {copiedId === config.id ? <Check className="w-3.5 h-3.5 text-emerald-600 animate-bounce" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>کپی لینک کانفیگ</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {configTotalPages > 1 && (
                      <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="text-xs text-slate-500 font-medium">
                          نمایش {(configPage - 1) * ITEMS_PER_PAGE + 1} تا {Math.min(configPage * ITEMS_PER_PAGE, filteredConfigs.length)} از {filteredConfigs.length}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setConfigPage(1)}
                            disabled={configPage === 1}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                          >
                            <ChevronsRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfigPage(p => Math.max(1, p - 1))}
                            disabled={configPage === 1}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <span className="px-3 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm">
                            صفحه {configPage} از {configTotalPages}
                          </span>
                          <button
                            onClick={() => setConfigPage(p => Math.min(configTotalPages, p + 1))}
                            disabled={configPage === configTotalPages}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfigPage(configTotalPages)}
                            disabled={configPage === configTotalPages}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                          >
                            <ChevronsLeft className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* --- TAB: PROXIES --- */}
              {resolvedTab === 'proxies' && (
                <motion.div
                  key="proxies"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500">وضعیت اتصال</label>
                        <select
                          value={proxyStatusFilter}
                          onChange={(e) => setProxyStatusFilter(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none bg-white cursor-pointer"
                        >
                          <option value="all">همه وضعیت‌ها</option>
                          <option value="working">فعال (پینگ موفق)</option>
                          <option value="untested">در انتظار بررسی</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {filteredProxies.length === 0 ? (
                      <div className="py-24 text-center flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Radio className="w-12 h-12 text-slate-300" />
                        <p className="text-sm">هیچ پروکسی تلگرامی مطابق با فیلتر شما یافت نشد.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {paginatedProxies.map((proxy) => (
                          <div key={proxy.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
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
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                  proxy.status === 'working' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {proxy.status === 'working' ? `فعال ${proxy.latency ? `(${proxy.latency}ms)` : ''}` : 'در انتظار تست'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 font-mono" dir="ltr">
                                IP: <strong className="text-slate-700">{proxy.server}</strong> | Port: <strong className="text-slate-700">{proxy.port}</strong>
                              </p>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
                                <span>منبع: <strong className="text-slate-600">{proxy.source}</strong></span>
                                {proxy.lastChecked && (
                                  <span>آخرین بررسی: <strong>{new Date(proxy.lastChecked).toLocaleTimeString('fa-IR')}</strong></span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                              <button
                                onClick={() => copyToClipboard(proxy.raw, proxy.id)}
                                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                              >
                                {copiedId === proxy.id ? <Check className="w-3.5 h-3.5 text-emerald-600 animate-bounce" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>اتصال و کپی پروکسی</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {proxyTotalPages > 1 && (
                      <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="text-xs text-slate-500 font-medium">
                          نمایش {(proxyPage - 1) * ITEMS_PER_PAGE + 1} تا {Math.min(proxyPage * ITEMS_PER_PAGE, filteredProxies.length)} از {filteredProxies.length}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setProxyPage(1)}
                            disabled={proxyPage === 1}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                          >
                            <ChevronsRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProxyPage(p => Math.max(1, p - 1))}
                            disabled={proxyPage === 1}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <span className="px-3 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm">
                            صفحه {proxyPage} از {proxyTotalPages}
                          </span>
                          <button
                            onClick={() => setProxyPage(p => Math.min(proxyTotalPages, p + 1))}
                            disabled={proxyPage === proxyTotalPages}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProxyPage(proxyTotalPages)}
                            disabled={proxyPage === proxyTotalPages}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                          >
                            <ChevronsLeft className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* --- TAB: VPN FILES --- */}
              {resolvedTab === 'vpn_files' && (
                <motion.div
                  key="vpn_files"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {vpnFiles.length === 0 ? (
                      <div className="py-24 text-center flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Download className="w-12 h-12 text-slate-300" />
                        <p className="text-sm">هیچ فایل VPN (.npvt یا .ovpn) آرشیو نشده است.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {vpnFiles.map((file) => (
                          <div key={file.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                            <div className="flex-1 space-y-1">
                              <h4 className="text-sm font-bold text-slate-800" dir="ltr">
                                {file.filename}
                              </h4>
                              <p className="text-[10px] text-slate-400">آرشیو شده در تاریخ: {new Date(file.createdAt).toLocaleDateString('fa-IR')}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg font-bold">قابل دریافت در ربات تلگرام 🤖</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* --- TAB: TECH --- */}
              {resolvedTab === 'tech' && (
                <motion.div
                  key="tech"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex flex-col md:flex-row items-center gap-3">
                      <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="جستجو در عنوان، متن، برچسب‌ها..."
                          value={techSearch}
                          onChange={(e) => setTechSearch(e.target.value)}
                          className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
                        <button
                          onClick={() => setTechCategoryFilter('all')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            techCategoryFilter === 'all' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          همه ({techItems.length})
                        </button>
                        <button
                          onClick={() => setTechCategoryFilter('news')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            techCategoryFilter === 'news' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          📰 اخبار روز
                        </button>
                        <button
                          onClick={() => setTechCategoryFilter('trick')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            techCategoryFilter === 'trick' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          💡 ترفندها
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {filteredTechItems.length === 0 ? (
                      <div className="py-20 text-center text-slate-400">
                        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm">مطلبی مطابق با فیلتر شما یافت نشد.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {filteredTechItems.map((item) => (
                          <div key={item.id} className="p-5 hover:bg-slate-50/50 transition-colors space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg ${
                                  item.category === 'news' ? 'bg-blue-50 text-blue-700 border border-blue-200/50' :
                                  item.category === 'trick' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' :
                                  'bg-purple-50 text-purple-700 border border-purple-200/50'
                                }`}>
                                  {item.category === 'news' && '📰 خبر تکنولوژی'}
                                  {item.category === 'trick' && '💡 ترفند و آموزش'}
                                  {item.category === 'secret' && '🔐 امنیت و شبکه'}
                                </span>
                                {item.importance === 'breaking' && (
                                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/50 flex items-center gap-1">
                                    <Flame className="w-3 h-3 text-rose-500" />
                                    <span>فوری و داغ</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleDateString('fa-IR')}</span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 leading-snug">{item.title}</h4>
                            <p className="text-xs text-slate-600 leading-relaxed">{item.summary}</p>
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 pt-1.5">
                                {item.tags.map((tag, tIdx) => (
                                  <span key={tIdx} className="bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-lg text-[9px]">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* --- TAB: AI PROMPTS --- */}
              {resolvedTab === 'prompts' && (
                <motion.div
                  key="prompts"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                >
                  <PromptsView
                    aiPrompts={aiPrompts}
                    token={token}
                    actionLoading={actionLoading}
                    targetChannel1={settings?.autoPost?.targetChannel}
                    targetChannel2={settings?.autoPost?.channel2?.targetChannel}
                    showToast={showToast}
                    onRefreshPrompts={handleRefreshPrompts}
                    onSavePrompt={handleSavePrompt}
                    onDeletePrompt={handleDeletePrompt}
                    onTriggerSendPrompt={handleTriggerAiPromptsAutoPost}
                  />
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </main>

        {/* Client Footer */}
        <footer className="bg-white border-t border-slate-200 shrink-0 py-6 text-center text-[11px] text-slate-400 mt-12 shadow-inner">
          <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p>تمامی سرویس‌ها به صورت دوره‌ای اسکن شده و پس از اعتبارسنجی پینگ منتشر می‌شوند.</p>
            <p className="font-mono text-slate-500">Smart Config Hub © 2026</p>
          </div>
        </footer>

        {/* Sleek Modal for Hidden Admin Access */}
        <AnimatePresence>
          {showLoginModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-7 text-white shadow-2xl relative"
                dir="rtl"
              >
                <button 
                  onClick={() => { setShowLoginModal(false); setAuthError(null); }}
                  className="absolute left-4 top-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="text-center mb-6 space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center mx-auto mb-2">
                    <ShieldCheck className="w-6 h-6 text-indigo-400 animate-pulse" />
                  </div>
                  <h3 className="font-black text-sm text-white">ورود مدیریت سیستم ⚙️</h3>
                  <p className="text-[11px] text-slate-400">جهت دسترسی به داشبورد کنترل, استخراج و پیکربندی ربات</p>
                </div>

                {authError && (
                  <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/20 rounded-xl text-[11px] text-rose-300 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-300">نام کاربری:</label>
                    <input
                      type="text"
                      autoFocus
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-center tracking-widest text-white transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-300">گذرواژه مدیریت:</label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-center tracking-widest text-white transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading === 'login'}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {actionLoading === 'login' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>تایید هویت و ورود</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Public Toast Container */}
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

      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row relative" dir="rtl">
      
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
      <aside className="w-full md:w-80 bg-slate-900 text-slate-100 flex flex-col shrink-0 border-l border-slate-800 relative z-10">
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
            onClick={() => setActiveTab('public_panel')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'public_panel'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20'
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>مشاهده پنل وب عمومی</span>
            <span className="mr-auto text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
              کاربر
            </span>
          </button>

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
            onClick={() => setActiveTab('vpn_files')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'vpn_files'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>فایل‌های VPN</span>
            <span className="mr-auto bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full">
              {vpnFiles.length} فایل
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tech')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'tech'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>اخبار و ترفندها</span>
            <span className="mr-auto bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full">
              {techItems.length} مطلب
            </span>
          </button>

          <button
            onClick={() => setActiveTab('prompts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'prompts'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Palette className="w-4 h-4 text-pink-400" />
            <span>پرامپت‌های تصویری</span>
            <span className="mr-auto bg-pink-500/20 text-pink-300 text-xs px-2 py-0.5 rounded-full">
              {aiPrompts.length} پرامپت
            </span>
          </button>

          <button
            onClick={() => setActiveTab('fun_news')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'fun_news'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Smile className="w-4 h-4 text-yellow-400" />
            <span>فان و اخبار عمومی</span>
            <span className="mr-auto bg-yellow-500/20 text-yellow-300 text-xs px-2 py-0.5 rounded-full">
              {funNewsItems.length} مطلب
            </span>
          </button>

          <button
            onClick={() => setActiveTab('digital_tools')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === 'digital_tools'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <Wrench className="w-4 h-4 text-emerald-400" />
            <span>جعبه‌ابزار دیجیتال</span>
            <span className="mr-auto bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-bold">
              {digitalTools.length} ابزار
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
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>کرون جاب و ارسال خودکار</span>
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

          <button
            onClick={async () => {
              setActionLoading('set_menu_button');
              try {
                const res = await fetch('/api/settings/set-menu-button', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                  showToast(data.message || 'منوی عمومی ربات به منوی اصلی تلگرام بازگردانی شد ✅', 'success');
                } else {
                  showToast(data.message || 'خطا در ثبت منوی ربات', 'error');
                }
              } catch (err) {
                showToast('خطا در ارتباط با سرور', 'error');
              } finally {
                setActionLoading(null);
              }
            }}
            disabled={actionLoading === 'set_menu_button'}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50"
          >
            {actionLoading === 'set_menu_button' ? (
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            ) : (
              <Globe className="w-4 h-4 text-indigo-400" />
            )}
            <span>تنظیم منوی اصلی ربات</span>
          </button>

          {!isTgWebApp && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer text-rose-400 hover:bg-rose-500/10"
            >
              <Power className="w-4 h-4 text-rose-400" />
              <span>خروج از پنل</span>
            </button>
          )}
        </nav>

        {/* Footer info */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/20 text-xs text-slate-500 space-y-1">
          <p>وضعیت سرور: فعال 🟢</p>
          <p>سیستم تست پورت: فعال در ایران</p>
          <p className="pt-2 text-[10px] text-slate-600">طراحی شده با React 19 + Express</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        
        {/* Header Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-5 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeTab === 'dashboard' && 'داشبورد کنترل مرکزی'}
              {activeTab === 'sources' && 'مدیریت و پایش منابع'}
              {activeTab === 'configs' && 'بانک جامع کانفیگ‌های استخراج شده'}
              {activeTab === 'proxies' && 'بانک جامع پروکسی‌های استخراج شده'}
              {activeTab === 'vpn_files' && 'بانک فایل‌های پیکربندی (.npvt, .ovpn)'}
              {activeTab === 'tech' && 'دانشنامه و ترفندهای تکنولوژی و گوشی'}
              {activeTab === 'prompts' && 'پرامپت‌های هوشمند و طلایی هوش مصنوعی'}
              {activeTab === 'fun_news' && 'کانال‌های فان و اخبار عمومی تلگرام'}
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
              {activeTab === 'vpn_files' && 'مشاهده و مدیریت فایل‌های جمع‌آوری شده از منابع جهت ارسال مستقیم به کانال.'}
              {activeTab === 'tech' && 'جمع‌آوری هوشمند اخبار روز، ترفندهای آموزشی موبایل، کدهای مخفی و اولویت‌بندی بر اساس اهمیت جهت ارسال در کانال.'}
              {activeTab === 'prompts' && 'مدیریت و تنظیم نمونه پرامپت‌های آماده و ترند برای ساخت آثار گرافیکی بی‌نظیر با هوش مصنوعی و کپی آسان.'}
              {activeTab === 'fun_news' && 'استخراج هوشمند جوک، طنز و سرگرمی و اخبار مهم روز از کانال‌های تلگرامی برای ارسال اختصاصی به کانال دوم یا اول.'}
              {activeTab === 'join' && 'تنظیم کانال‌های حامی جهت ملزم کردن کاربران برای عضویت قبل از استفاده.'}
              {activeTab === 'settings' && 'تنظیم توکن API تلگرام، فواصل زمانی پویش خودکار و متن برندینگ شخصی.'}
              {activeTab === 'autopost' && 'پیکربندی هوشمند ربات برای ارسال اتوماتیک کانفیگ‌ها، پروکسی‌ها و ترفندهای تکنولوژی به کانال شما در فواصل مشخص.'}
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
            <AnimatePresence>
              
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
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">کانفیگ‌های فعال (V2Ray / NPV)</span>
                          {stats.checkingConfigsCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              در حال تست ({stats.checkingConfigsCount})
                            </span>
                          )}
                        </div>
                        <h3 className="text-3xl font-extrabold text-emerald-600">{stats.workingConfigsCount}</h3>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-emerald-700 font-bold">{stats.workingConfigsCount} فعال</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500">{stats.untestedConfigsCount} تست‌نشده</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400">کل: {stats.totalConfigs}</span>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Stat Card 3 */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">پروکسی‌های فعال (تلگرام)</span>
                          {stats.checkingProxiesCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              در حال تست ({stats.checkingProxiesCount})
                            </span>
                          )}
                        </div>
                        <h3 className="text-3xl font-extrabold text-indigo-600">{stats.workingProxiesCount}</h3>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-indigo-600 font-bold">{stats.workingProxiesCount} فعال</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500">{stats.untestedProxiesCount} تست‌نشده</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400">کل: {stats.totalProxies}</span>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
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
                      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 shrink-0">
                        <Database className="w-6 h-6" />
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions Panel */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-indigo-600" />
                        <span>عملیات کنترل سریع سیستم</span>
                      </div>
                      {((stats.checkingConfigsCount || 0) > 0 || (stats.checkingProxiesCount || 0) > 0 || actionLoading === 'test_all') && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>عملیات تست پورت در حال اجراست...</span>
                        </span>
                      )}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleScrapeAll}
                        disabled={actionLoading === 'scrape_all'}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        <RefreshCw className={`w-4 h-4 ${actionLoading === 'scrape_all' ? 'animate-spin' : ''}`} />
                        <span>اجرای پویش دستی و استخراج کانفیگ‌ها</span>
                      </button>

                      <button
                        onClick={handleTestAllPorts}
                        disabled={actionLoading === 'test_all' || (stats.checkingConfigsCount || 0) > 0}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        <Play className={`w-4 h-4 ${((stats.checkingConfigsCount || 0) > 0 || actionLoading === 'test_all') ? 'animate-spin' : ''}`} />
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

                  {/* Connected Visual Animated Testing Progress Bar Card */}
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

                    const isActivelyChecking = totalChecking > 0 || actionLoading === 'test_all';

                    return (
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <Sliders className={`w-4 h-4 ${isActivelyChecking ? 'text-amber-500 animate-spin' : 'text-indigo-600'}`} />
                              <span>نوار پیشرفت زنده وضعیت تست پورت و صف بررسی</span>
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              اطلاعات کاشی‌های بالا و نوار پیشرفت کاملاً متصل و همگام هستند و با انجام تست‌ها جابه‌جا می‌شوند.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isActivelyChecking && (
                              <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold flex items-center gap-1.5 animate-pulse">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                                در حال بررسی {totalChecking} مورد
                              </span>
                            )}
                            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold">
                              مجموع کل: {totalItems} مورد
                            </span>
                          </div>
                        </div>

                        {/* Multi-Segmented Animated Progress Bar */}
                        <div className="w-full h-5 bg-slate-100 rounded-xl overflow-hidden flex shadow-inner border border-slate-200 relative">
                          <div 
                            style={{ width: `${workingPct}%` }} 
                            className="bg-emerald-500 h-full transition-all duration-500" 
                            title={`فعال: ${totalWorking} مورد (${workingPct.toFixed(1)}%)`}
                          />
                          <div 
                            style={{ width: `${failedPct}%` }} 
                            className="bg-rose-500 h-full transition-all duration-500" 
                            title={`خراب: ${totalFailed} مورد (${failedPct.toFixed(1)}%)`}
                          />
                          <div 
                            style={{ width: `${checkingPct}%` }} 
                            className="bg-amber-500 h-full animate-stripe transition-all duration-500" 
                            title={`در حال تست: ${totalChecking} مورد (${checkingPct.toFixed(1)}%)`}
                          />
                          <div 
                            style={{ width: `${untestedPct}%` }} 
                            className="bg-slate-300 h-full transition-all duration-500" 
                            title={`تست نشده: ${totalUntested} مورد (${untestedPct.toFixed(1)}%)`}
                          />
                        </div>

                        {/* Legend / Stats Breakdown Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-medium text-emerald-600">فعال (Working)</p>
                              <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{totalWorking}</p>
                            </div>
                            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm" />
                          </div>

                          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-medium text-rose-600">خراب (Failed)</p>
                              <p className="text-lg font-extrabold text-rose-700 mt-0.5">{totalFailed}</p>
                            </div>
                            <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-sm" />
                          </div>

                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-medium text-amber-600 flex items-center gap-1">
                                {totalChecking > 0 && <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />}
                                <span>در حال تست (Checking)</span>
                              </p>
                              <p className="text-lg font-extrabold text-amber-700 mt-0.5">{totalChecking}</p>
                            </div>
                            <div className="w-3.5 h-3.5 rounded-full bg-amber-500 animate-pulse shadow-sm" />
                          </div>

                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-medium text-slate-500">تست نشده (Untested)</p>
                              <p className="text-lg font-extrabold text-slate-700 mt-0.5">{totalUntested}</p>
                            </div>
                            <div className="w-3.5 h-3.5 rounded-full bg-slate-300 shadow-sm" />
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
                            placeholder={newSource.type === 'telegram' ? '@v2ray_alpha' : 'https://raw.githubusercontent.com/...'}
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
                        {paginatedConfigs.map((config) => (
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
                                onClick={() => handleMarkConfigStatus(config.id, 'working')}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer border border-emerald-200"
                                title="تایید سلامت دستی (برای ارسال به کانال)"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>سالم</span>
                              </button>
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
                    
                    {configTotalPages > 1 && (
                      <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="text-xs text-slate-500 font-medium">
                          نمایش {(configPage - 1) * ITEMS_PER_PAGE + 1} تا {Math.min(configPage * ITEMS_PER_PAGE, filteredConfigs.length)} از {filteredConfigs.length}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setConfigPage(1)}
                            disabled={configPage === 1}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all"
                            title="صفحه اول"
                          >
                            <ChevronsRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfigPage(p => Math.max(1, p - 1))}
                            disabled={configPage === 1}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all"
                            title="صفحه قبل"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <span className="px-3 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm">
                            صفحه {configPage} از {configTotalPages}
                          </span>
                          <button
                            onClick={() => setConfigPage(p => Math.min(configTotalPages, p + 1))}
                            disabled={configPage === configTotalPages}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all"
                            title="صفحه بعد"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfigPage(configTotalPages)}
                            disabled={configPage === configTotalPages}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all"
                            title="صفحه آخر"
                          >
                            <ChevronsLeft className="w-4 h-4" />
                          </button>
                        </div>
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
                        {paginatedProxies.map((proxy) => (
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
                                onClick={() => handleMarkProxyStatus(proxy.id, 'working')}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer border border-emerald-200"
                                title="تایید سلامت دستی (برای ارسال به کانال)"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>سالم</span>
                              </button>
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

                    {proxyTotalPages > 1 && (
                      <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="text-xs text-slate-500 font-medium">
                          نمایش {(proxyPage - 1) * ITEMS_PER_PAGE + 1} تا {Math.min(proxyPage * ITEMS_PER_PAGE, filteredProxies.length)} از {filteredProxies.length}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setProxyPage(1)}
                            disabled={proxyPage === 1}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all"
                            title="صفحه اول"
                          >
                            <ChevronsRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProxyPage(p => Math.max(1, p - 1))}
                            disabled={proxyPage === 1}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all"
                            title="صفحه قبل"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <span className="px-3 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm">
                            صفحه {proxyPage} از {proxyTotalPages}
                          </span>
                          <button
                            onClick={() => setProxyPage(p => Math.min(proxyTotalPages, p + 1))}
                            disabled={proxyPage === proxyTotalPages}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all"
                            title="صفحه بعد"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProxyPage(proxyTotalPages)}
                            disabled={proxyPage === proxyTotalPages}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 disabled:opacity-30 border border-transparent hover:border-slate-200 transition-all"
                            title="صفحه آخر"
                          >
                            <ChevronsLeft className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* --- TAB: VPN FILES (.npvt / .ovpn) --- */}
              {activeTab === 'vpn_files' && (
                <motion.div
                  key="vpn_files"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-slate-800">مدیریت فایل‌های ذخیره شده</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          این فایل‌ها به صورت مستقیم از طریق منابع و یا ارسال توسط شما/ربات، دریافت و برای استفاده در کانال ذخیره شده‌اند.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleClearAllVpnFiles}
                          disabled={actionLoading === 'clear_all_vpn_files'}
                          className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          تخلیه کل فایل‌ها
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {vpnFiles.length === 0 ? (
                      <div className="py-24 text-center flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Download className="w-12 h-12 text-slate-300" />
                        <p className="text-sm">هیچ فایل VPN (.npvt یا .ovpn) ذخیره نشده است.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {vpnFiles.map((file) => (
                          <div key={file.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                            <div className="flex-1 space-y-1.5 min-w-0">
                              <h4 className="text-sm font-bold text-slate-800" dir="ltr">
                                {file.filename}
                              </h4>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
                                <span>دریافت: <strong>{new Date(file.createdAt).toLocaleDateString('fa-IR')} - {new Date(file.createdAt).toLocaleTimeString('fa-IR')}</strong></span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                              <button
                                onClick={() => handleDeleteVpnFile(file.id)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer"
                              >
                                حذف فایل
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* --- TAB: TECH KNOWLEDGEBASE & TRICKS --- */}
              {activeTab === 'tech' && (
                <motion.div
                  key="tech"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  {/* Top Stats Banner */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block">اخبار روز تکنولوژی</span>
                        <span className="text-lg font-black text-slate-900">
                          {techItems.filter(i => i.category === 'news').length}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block">ترفندهای گوشی و وب</span>
                        <span className="text-lg font-black text-slate-900">
                          {techItems.filter(i => i.category === 'trick').length}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block">رازها و امنیت شبکه</span>
                        <span className="text-lg font-black text-slate-900">
                          {techItems.filter(i => i.category === 'secret').length}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Flame className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block">مطالب مهم و داغ</span>
                        <span className="text-lg font-black text-amber-600">
                          {techItems.filter(i => i.importance === 'breaking' || i.importance === 'high').length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Description */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>سیستم هوشمند جمع‌آوری و اولویت‌بندی اخبار و ترفندهای تکنولوژی</span>
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                        این بخش به صورت کاملاً خودکار و ۲۴ ساعته جذاب‌ترین اخبار تکنولوژی، ترفندهای کاربردی موبایل (اندروید/آیفون)، کدهای مخفی و نکات امنیتی را جمع‌آوری کرده و بر اساس درجه اهمیت جهت ارسال در کانال تلگرام رتبه‌بندی می‌کند.
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
                      <button
                        onClick={handleRefreshTech}
                        disabled={actionLoading === 'refresh_tech'}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'refresh_tech' ? 'animate-spin' : ''}`} />
                        <span>{actionLoading === 'refresh_tech' ? 'در حال پویش...' : 'بروزرسانی آنلاین'}</span>
                      </button>

                      <button
                        onClick={() => setShowAddTechModal(true)}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ثبت مطلب دستی</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row items-center gap-3">
                      {/* Search */}
                      <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="جستجو در عنوان، متن، برچسب‌ها یا منبع..."
                          value={techSearch}
                          onChange={(e) => setTechSearch(e.target.value)}
                          className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      {/* Category Pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                        <button
                          onClick={() => setTechCategoryFilter('all')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            techCategoryFilter === 'all'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          همه ({techItems.length})
                        </button>
                        <button
                          onClick={() => setTechCategoryFilter('news')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            techCategoryFilter === 'news'
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          📰 اخبار روز ({techItems.filter(i => i.category === 'news').length})
                        </button>
                        <button
                          onClick={() => setTechCategoryFilter('trick')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            techCategoryFilter === 'trick'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          💡 ترفندها ({techItems.filter(i => i.category === 'trick').length})
                        </button>
                        <button
                          onClick={() => setTechCategoryFilter('secret')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                            techCategoryFilter === 'secret'
                              ? 'bg-purple-600 text-white'
                              : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                          }`}
                        >
                          🔐 رازها و امنیت ({techItems.filter(i => i.category === 'secret').length})
                        </button>
                      </div>

                      {/* Importance Filter */}
                      <div className="w-full md:w-auto shrink-0">
                        <select
                          value={techImportanceFilter}
                          onChange={(e) => setTechImportanceFilter(e.target.value)}
                          className="w-full md:w-auto px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none bg-white cursor-pointer"
                        >
                          <option value="all">تمام سطوح اهمیت</option>
                          <option value="breaking">🔥 فوری و داغ (Breaking)</option>
                          <option value="high">⚡️ اولویت بالا (High)</option>
                          <option value="medium">⭐️ اهمیت متوسط (Medium)</option>
                          <option value="normal">⚪️ عادی (Normal)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Tech Items List */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    {filteredTechItems.length === 0 ? (
                      <div className="p-12 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 mx-auto flex items-center justify-center">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm">مطلبی یافت نشد</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          هیچ خبر یا ترفندی با فیلترهای انتخابی مطابقت ندارد. برای دریافت جدیدترین مطالب روی دکمه «بروزرسانی آنلاین» کلیک کنید.
                        </p>
                        <button
                          onClick={handleRefreshTech}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>بروزرسانی و بارگذاری فوری</span>
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {filteredTechItems.map((item) => (
                          <div key={item.id} className="p-5 hover:bg-slate-50/50 transition-colors space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              {/* Badges */}
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Category Badge */}
                                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg ${
                                  item.category === 'news'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200/50'
                                    : item.category === 'trick'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200/50'
                                }`}>
                                  {item.category === 'news' && '📰 خبر روز'}
                                  {item.category === 'trick' && '💡 ترفند و آموزش'}
                                  {item.category === 'secret' && '🔐 راز تکنولوژی'}
                                </span>

                                {/* Importance Badge */}
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                                  item.importance === 'breaking'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200/60 font-black'
                                    : item.importance === 'high'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                    : item.importance === 'medium'
                                    ? 'bg-sky-50 text-sky-700 border border-sky-200/60'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {item.importance === 'breaking' && <Flame className="w-3 h-3 text-rose-500" />}
                                  {item.importance === 'high' && <Award className="w-3 h-3 text-amber-500" />}
                                  <span>
                                    {item.importance === 'breaking' && '🔥 فوری و داغ'}
                                    {item.importance === 'high' && '⚡️ بسیار مهم'}
                                    {item.importance === 'medium' && '⭐️ مهم'}
                                    {item.importance === 'normal' && 'عادی'}
                                  </span>
                                  <span className="text-[9px] opacity-75 font-mono">({item.importanceScore} امتیاز)</span>
                                </span>

                                {/* Posted to Channel Status */}
                                {item.postedToChannel ? (
                                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>ارسال شده به کانال</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                                    در صف ارسال
                                  </span>
                                )}
                              </div>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteTechItem(item.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="حذف این مطلب"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Title */}
                            <h4 className="text-sm font-bold text-slate-900 leading-snug">
                              {item.title}
                            </h4>

                            {/* Summary */}
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {item.summary}
                            </p>

                            {/* Footer & Meta */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                              <div className="flex flex-wrap items-center gap-3">
                                <span>منبع: <strong className="text-slate-600">{item.source}</strong></span>
                                <span>ثبت: <strong>{new Date(item.createdAt).toLocaleDateString('fa-IR')} - {new Date(item.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                                {item.postedAt && (
                                  <span>زمان ارسال به کانال: <strong>{new Date(item.postedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                                )}
                              </div>

                              {/* Tags */}
                              {item.tags && item.tags.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  {item.tags.map((tag, tIdx) => (
                                    <span key={tIdx} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px]">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Tech Item Modal */}
                  {showAddTechModal && (
                    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4"
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            <Plus className="w-4 h-4 text-indigo-600" />
                            <span>ثبت مطلب اختصاصی یا ترفند جدید</span>
                          </h3>
                          <button
                            onClick={() => setShowAddTechModal(false)}
                            className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
                          >
                            ×
                          </button>
                        </div>

                        <form onSubmit={handleAddTechItem} className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">عنوان مطلب یا ترفند</label>
                            <input
                              type="text"
                              required
                              placeholder="مثال: ترفند مخفی افزایش سرعت اینترنت در شیائومی"
                              value={newTechForm.title}
                              onChange={(e) => setNewTechForm(prev => ({ ...prev, title: e.target.value }))}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700">دسته‌بندی</label>
                              <select
                                value={newTechForm.category}
                                onChange={(e) => setNewTechForm(prev => ({ ...prev, category: e.target.value as any }))}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none bg-white cursor-pointer"
                              >
                                <option value="trick">💡 ترفند و آموزش کاربردی</option>
                                <option value="news">📰 خبر روز دنیای تکنولوژی</option>
                                <option value="secret">🔐 راز مخفی و امنیت شبکه</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700">درجه اهمیت</label>
                              <select
                                value={newTechForm.importance}
                                onChange={(e) => setNewTechForm(prev => ({ ...prev, importance: e.target.value as any }))}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none bg-white cursor-pointer"
                              >
                                <option value="breaking">🔥 فوری و داغ (Breaking)</option>
                                <option value="high">⚡️ بسیار مهم (High)</option>
                                <option value="medium">⭐️ اهمیت متوسط (Medium)</option>
                                <option value="normal">⚪️ عادی (Normal)</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">متن کامل یا توضیحات ترفند</label>
                            <textarea
                              rows={5}
                              required
                              placeholder="آموزش گام به گام یا جزئیات خبر را اینجا بنویسید..."
                              value={newTechForm.summary}
                              onChange={(e) => setNewTechForm(prev => ({ ...prev, summary: e.target.value }))}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none leading-relaxed"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setShowAddTechModal(false)}
                              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              انصراف
                            </button>
                            <button
                              type="submit"
                              disabled={actionLoading === 'add_tech'}
                              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              {actionLoading === 'add_tech' ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>در حال ثبت...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>ثبت مطلب</span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* --- TAB: AI PROMPTS MANAGEMENT --- */}
              {activeTab === 'prompts' && (
                <PromptsView
                  aiPrompts={aiPrompts}
                  token={token}
                  actionLoading={actionLoading}
                  targetChannel1={settings?.autoPost?.targetChannel}
                  targetChannel2={settings?.autoPost?.channel2?.targetChannel}
                  showToast={showToast}
                  onRefreshPrompts={handleRefreshPrompts}
                  onSavePrompt={handleSavePrompt}
                  onDeletePrompt={handleDeletePrompt}
                  onTriggerSendPrompt={handleTriggerAiPromptsAutoPost}
                />
              )}
              {activeTab === 'autopost' && (
                <motion.div
                  key="autopost"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                >
                  <AutoPostView
                    autoPostForm={autoPostForm}
                    setAutoPostForm={setAutoPostForm}
                    updateChannel2={updateChannel2}
                    activeAutoPostChannelTab={activeAutoPostChannelTab}
                    setActiveAutoPostChannelTab={setActiveAutoPostChannelTab}
                    actionLoading={actionLoading}
                    handleSaveAutoPostSettings={handleSaveAutoPostSettings}
                    handleTriggerAutoPost={handleTriggerAutoPost}
                    handleTriggerConfigsAutoPost={handleTriggerConfigsAutoPost}
                    handleTriggerTechNewsAutoPost={handleTriggerTechNewsAutoPost}
                    handleTriggerTechTricksAutoPost={handleTriggerTechTricksAutoPost}
                    handleTriggerAiPromptsAutoPost={handleTriggerAiPromptsAutoPost}
                    handleTriggerFunNewsAutoPost={handleTriggerFunNewsAutoPost}
                    handleTriggerDigitalToolsAutoPost={handleTriggerDigitalToolsAutoPost}
                  />
                </motion.div>
              )}

              {activeTab === 'fun_news' && (
                <motion.div
                  key="fun_news"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                >
                  <FunNewsView
                    funNewsItems={funNewsItems}
                    funSources={funSources}
                    actionLoading={actionLoading}
                    targetChannel1={autoPostForm.targetChannel}
                    targetChannel2={autoPostForm.channel2?.targetChannel || ''}
                    showToast={showToast}
                    onRefreshSources={handleRefreshFunNews}
                    onAddSource={handleAddFunSource}
                    onToggleSource={handleToggleFunSource}
                    onDeleteSource={handleDeleteFunSource}
                    onSendItem={handleSendFunNewsItem}
                    onDeleteItem={handleDeleteFunNewsItem}
                  />
                </motion.div>
              )}

              {activeTab === 'digital_tools' && (
                <motion.div
                  key="digital_tools"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                >
                  <DigitalToolsView
                    tools={digitalTools}
                    targetChannel1={autoPostForm.targetChannel}
                    targetChannel2={autoPostForm.channel2?.targetChannel || ''}
                    actionLoading={actionLoading}
                    showToast={showToast}
                    onSaveTool={handleSaveDigitalTool}
                    onDeleteTool={handleDeleteDigitalTool}
                    onTriggerSendTool={handleTriggerDigitalToolsAutoPost}
                  />
                </motion.div>
              )}

              {/* --- TAB: SETTINGS --- */}
              {activeTab === 'settings' && (
                <div key="settings" className="max-w-3xl mx-auto space-y-6">
                  {/* Telegram Web App / Webview Integration Card */}
                  <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl p-6 shadow-md border border-indigo-800/40 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base flex items-center gap-2">
                            <span>آدرس پنل وب و وب‌اپ تلگرام (Telegram Web App / TWA)</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              اتصال فعال
                            </span>
                          </h3>
                          <p className="text-xs text-slate-300 mt-0.5">
                            آدرس شناسایی شده پنل وب که می‌توانید به عنوان وب‌ویو (Web App) در دکمه‌های شیشه‌ای ربات یا منوی تلگرام تنظیم کنید.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span>آدرس وب‌اپلیکیشن سرور (Web Panel URL)</span>
                        <span className="text-[10px] text-indigo-300">مناسب باز کردن مستقیم در تلگرام</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={detectedAppUrl || (typeof window !== 'undefined' ? window.location.origin : '')}
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-800/90 border border-indigo-700/50 text-xs font-mono text-indigo-200 select-all focus:outline-none"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const url = detectedAppUrl || window.location.origin;
                            navigator.clipboard.writeText(url);
                            showToast('آدرس پنل وب با موفقیت کپی گردید.', 'success');
                          }}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                          <span>کپی آدرس</span>
                        </button>
                        <a
                          href={detectedAppUrl || (typeof window !== 'undefined' ? window.location.origin : '#')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>باز کردن در تب جدید</span>
                        </a>
                      </div>

                      {/* Instant 1-Click Bot Menu Setup Action */}
                      <div className="pt-2 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSetMenuButton}
                          disabled={actionLoading === 'set_menu_button' || !settings.botToken}
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                          title="تنظیم خودکار دکمه منوی تلگرام به صورت Web App"
                        >
                          {actionLoading === 'set_menu_button' ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>در حال اتصال و تنظیم در تلگرام...</span>
                            </>
                          ) : (
                            <>
                              <Bot className="w-4 h-4" />
                              <span>⚡️ تنظیم خودکار دکمه منوی وب‌ویو در ربات تلگرام</span>
                            </>
                          )}
                        </button>
                        <span className="text-[11px] text-emerald-300">
                          (به صورت خودکار دکمه منوی چت تلگرام را روی این آدرس تنظیم می‌کند)
                        </span>
                      </div>
                    </div>

                    <div className="bg-indigo-900/40 border border-indigo-700/30 rounded-xl p-3.5 text-xs text-indigo-200 space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5 text-indigo-100">
                        <Bot className="w-4 h-4 text-indigo-300" />
                        <span>دسترسی به وب‌ویو برای ادمین در ربات تلگرام:</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        ۱. <strong>دکمه شیشه‌ای و کیبورد اختصاصی:</strong> اگر شناسه ادمین شما در زیر ذخیره شده باشد، دکمه <strong>«🌐 باز کردن وب‌ویو پنل مدیریت (WebApp)»</strong> به بالای کیبورد چت و منوی استارت اضافه می‌گردد.<br />
                        ۲. <strong>دستور مستقیم:</strong> با فرستادن دستور <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">/panel</code> یا <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300">/admin</code> در ربات، لینک و دکمه وب‌ویو فوراً ارسال می‌شود.<br />
                        ۳. <strong>دکمه منوی گوشه چت:</strong> با زدن دکمه سبز رنگ بالا، دکمه Menu تلگرام برای باز کردن مستقیم وب‌اپ تنظیم می‌گردد.
                      </p>
                    </div>
                  </div>

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

                      {/* Connection Mode Selection */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700">روش دریافت پیام‌ها (دریافت مکرر یا وب‌هوک)</label>
                          <select
                            value={settings.botConnectionMode || 'polling'}
                            onChange={(e) => setSettings(prev => ({ ...prev, botConnectionMode: e.target.value as any }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 focus:outline-none bg-white cursor-pointer"
                          >
                            <option value="polling">دریافت مکرر (Polling - مناسب سیستم تست)</option>
                            <option value="webhook">وب‌هوک (Webhook - مناسب کلودران و هاست دائمی)</option>
                          </select>
                        </div>

                        {/* Public Domain URL */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span>آدرس سرور یا دامنه عمومی پنل (بدون https)</span>
                            <span className="text-[10px] text-indigo-600 font-semibold">برای منوی وب‌اپ و وب‌هوک</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="مثال: 192.168.1.100:3000 یا my-domain.com"
                            value={settings.publicUrl || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, publicUrl: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-left focus:border-indigo-500 focus:outline-none"
                            dir="ltr"
                          />
                          <p className="text-[10px] text-slate-400">
                            آدرس آی‌پی لینوکس به همراه پورت نصب شده (مثل 12.34.56.78:3000) یا دامنه‌ای که پنل روی آن قرار دارد را بدون بخش http:// وارد نمایید.
                          </p>
                        </div>
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

                      {/* Admin Access Username Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>نام کاربری پنل مدیریت (Admin Username)</span>
                          <span className="text-[10px] text-indigo-600 font-semibold">تأیید هویت مرورگر</span>
                        </label>
                        <input
                          type="text"
                          placeholder="مثال: admin"
                          value={settings.adminUsername || ''}
                          onChange={(e) => setSettings(prev => ({ ...prev, adminUsername: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-left focus:border-indigo-500 focus:outline-none"
                          dir="ltr"
                        />
                      </div>

                      {/* Admin Access Password Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>رمز عبور دسترسی پنل مدیریت (Admin Password)</span>
                          <span className="text-[10px] text-indigo-600 font-semibold">تأیید هویت در مرورگر خارج از تلگرام</span>
                        </label>
                        <input
                          type="password"
                          placeholder="مثال: admin"
                          value={settings.adminPassword || ''}
                          onChange={(e) => setSettings(prev => ({ ...prev, adminPassword: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-left focus:border-indigo-500 focus:outline-none"
                          dir="ltr"
                        />
                        <p className="text-[10px] text-slate-400">
                          برای دسترسی به پنل ادمین در وب‌مرورگرهای عادی، باید از این رمز عبور استفاده کنید (رمز پیش‌فرض: admin).
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

                      {/* Iran Relay Proxy Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>پروکسی/واسط تست از داخل ایران (Iran Relay Proxy - اختیاری)</span>
                          <span className="text-[10px] text-emerald-600 font-semibold">تست ۱۰۰٪ واقعی از داخل نت ایران</span>
                        </label>
                        <input
                          type="text"
                          placeholder="مثال: socks5://user:pass@185.x.x.x:1080 یا http://185.x.x.x:3128"
                          value={settings.iranRelayProxy || ''}
                          onChange={(e) => setSettings(prev => ({ ...prev, iranRelayProxy: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-left focus:border-indigo-500 focus:outline-none"
                          dir="ltr"
                        />
                        <p className="text-[10px] text-slate-400">
                          در صورت وارد کردن آدرس SOCKS5 یا HTTP پروکسی/سرور داخل ایران، تمام تست‌های دست‌تکانی Xray از مسیر این پروکسی و دقیقاً از داخل ایران صورت می‌گیرد.
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

                      {/* Max Configs Retention Limit Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>سقف نگهداری کانفیگ‌ها در دیتابیس (۱ تا ۱۰,۰۰۰)</span>
                          <span className="text-[10px] text-indigo-600 font-semibold">پیش‌فرض: ۲۰۰۰</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          required
                          value={settings.maxConfigsRetention === undefined || settings.maxConfigsRetention === null ? 2000 : settings.maxConfigsRetention}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSettings(prev => ({ 
                              ...prev, 
                              maxConfigsRetention: val === '' ? '' as any : Number(val) 
                            }));
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none text-left"
                          dir="ltr"
                        />
                        <p className="text-[10px] text-slate-400">
                          هنگامی که ظرفیت کانفیگ‌های ذخیره‌شده به این عدد برسد، موارد قدیمی‌تر به صورت اتوماتیک پاکسازی می‌شوند تا سرعت سیستم و وب‌پنل حفظ گردد.
                        </p>
                      </div>

                      {/* Test Batch Limit Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>محدودیت تعداد تست همزمان (پیش‌فرض: ۱۰۰ کانفیگ اخیر)</span>
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="2000"
                          required
                          value={settings.testBatchLimit === undefined || settings.testBatchLimit === null ? '' : settings.testBatchLimit}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSettings(prev => ({ 
                              ...prev, 
                              testBatchLimit: val === '' ? '' as any : Number(val) 
                            }));
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none text-left"
                          dir="ltr"
                        />
                        <p className="text-[10px] text-slate-400">
                          تست پورت‌ها فقط روی این تعداد از آخرین کانفیگ‌های جدید استخراج‌شده انجام می‌شود تا سرعت تست حداکثری باشد.
                        </p>
                      </div>

                      {/* Test Interval Input */}
                      <div className="space-y-2 mt-4">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>فاصله زمانی تست خودکار (دقیقه)</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          required
                          value={settings.autoTestInterval || 10}
                          onChange={(e) => setSettings(prev => ({ ...prev, autoTestInterval: Number(e.target.value) }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none text-left"
                          dir="ltr"
                        />
                        <p className="text-[10px] text-slate-400">
                          ربات هر چند دقیقه یک‌بار کانفیگ‌های جدید را بررسی کند.
                        </p>
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
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">پشتیبان‌گیری و بازگردانی دیتابیس (Backup & Restore)</h3>
                        <p className="text-xs text-slate-500 mt-0.5">امکان دانلود نسخه پشتیبان کامل، بازگردانی از فایل، یا بازگردانی مستقیم و آسان از طریق ربات تلگرام</p>
                      </div>
                    </div>

                    {/* Telegram Bot Direct Restore Notice */}
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-emerald-950 block">⚡ بازگردانی آسان و فوری از طریق خود ربات تلگرام فعال است:</span>
                        <p className="text-[12px] text-emerald-800 leading-relaxed">
                          شما می‌توانید به عنوان ادمین، فایل بکاپ (<code className="font-mono bg-emerald-100/70 px-1 py-0.5 rounded text-emerald-900">.json</code> یا <code className="font-mono bg-emerald-100/70 px-1 py-0.5 rounded text-emerald-900">.txt</code>) را <strong>مستقیماً در چت خصوصی ربات تلگرام ارسال یا فوروارد فرمایید</strong>، یا دستور <code className="font-mono bg-emerald-100/70 px-1 py-0.5 rounded font-bold text-emerald-950">/restore</code> را به ربات بفرستید. ربات بلافاصله فایل را پردازش، دیتابیس را بازگردانی و گزارش دقیق آن را به شما اعلام می‌کند.
                        </p>
                        <p className="text-[11px] text-emerald-700 font-medium">
                          همچنین با ارسال دستور <code className="font-mono bg-emerald-100/70 px-1 py-0.5 rounded text-emerald-900">/backup</code> در پیوی ربات، فایل بکاپ همان لحظه برای شما صادر و فرستاده می‌شود.
                        </p>
                      </div>
                    </div>

                    {/* Mode selection for Restore */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                      <span className="text-xs font-bold text-slate-700 block">حالت بازگردانی فایل بکاپ (Restore Mode):</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRestoreMode('settings_and_sources')}
                          className={`p-3 rounded-lg border text-right transition-all flex items-start gap-2.5 ${
                            restoreMode === 'settings_and_sources'
                              ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 ring-1 ring-indigo-400/50'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                            restoreMode === 'settings_and_sources' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                          }`}>
                            {restoreMode === 'settings_and_sources' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <span className="text-xs font-bold block">فقط تنظیمات و لیست کانال‌ها (توصیه‌شده)</span>
                            <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                              فقط منابع، کانال‌های قفل و تنظیمات را بازیابی می‌کند. کانفیگ‌های فعلی حفظ شده و عملیات در کسری از ثانیه انجام می‌شود.
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRestoreMode('full')}
                          className={`p-3 rounded-lg border text-right transition-all flex items-start gap-2.5 ${
                            restoreMode === 'full'
                              ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 ring-1 ring-indigo-400/50'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                            restoreMode === 'full' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                          }`}>
                            {restoreMode === 'full' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <span className="text-xs font-bold block">بازگردانی کامل (شامل کانفیگ‌ها)</span>
                            <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                              تمام کانفیگ‌ها، پروکسی‌ها، اعضا و تنظیمات را عینا جایگزین می‌کند.
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-1 flex flex-wrap items-center gap-3">
                      <a
                        href="/api/backup/export?mode=light"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                        title="شامل تنظیمات، لیست منابع، کانال‌های قفل و کاربران (بدون فایل‌ها و کانفیگ‌های سنگین)"
                      >
                        <Download className="w-4 h-4 text-indigo-600" />
                        <span>دانلود بکاپ سبک (بدون کانفیگ و فایل)</span>
                      </a>

                      <a
                        href="/api/backup/export?mode=full"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                        title="شامل تمام کانفیگ‌ها و فایل‌های دیتابیس"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>دانلود فول بکاپ (کامل)</span>
                      </a>

                      <input
                        ref={backupFileInputRef}
                        type="file"
                        accept=".json,.txt"
                        className="hidden"
                        onChange={handleRestoreBackup}
                        disabled={actionLoading === 'restore_backup'}
                      />

                      <button
                        type="button"
                        onClick={() => backupFileInputRef.current?.click()}
                        disabled={actionLoading === 'restore_backup'}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                      >
                        <Upload className="w-4 h-4" />
                        <span>
                          {actionLoading === 'restore_backup' ? 'در حال بازگردانی بکاپ...' : 'آپلود فایل بکاپ (Restore File)'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowPasteBackup(!showPasteBackup)}
                        className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span>{showPasteBackup ? 'بستن کادر متن' : 'چسباندن متن JSON'}</span>
                      </button>
                    </div>

                    {/* Direct Paste Box */}
                    {showPasteBackup && (
                      <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <label className="text-xs font-bold text-slate-700 block">
                          محتوای متن JSON بکاپ یا لیست کانفیگ‌ها/پروکسی‌ها را در کادر زیر جای‌گذاری (Paste) کنید:
                        </label>
                        <textarea
                          rows={6}
                          dir="ltr"
                          value={pasteBackupText}
                          onChange={(e) => setPasteBackupText(e.target.value)}
                          placeholder='{"settings": {...}, "sources": [...]} یا متن لینک‌های vless:// و tg://proxy?...'
                          className="w-full text-xs font-mono p-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">
                            {pasteBackupText.length > 0 ? `${pasteBackupText.length.toLocaleString('fa-IR')} کاراکتر وارد شده` : 'کادر خالی است'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRestorePasteText()}
                            disabled={actionLoading === 'restore_backup_text' || !pasteBackupText.trim()}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {actionLoading === 'restore_backup_text' ? 'در حال بازگردانی دیتابیس...' : 'بازگردانی دیتابیس از متن'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
