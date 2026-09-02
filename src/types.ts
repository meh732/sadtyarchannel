export type ProtocolType = 'vmess' | 'vless' | 'trojan' | 'ss' | 'npv' | 'unknown';

export interface ConfigItem {
  id: string;
  raw: string;
  protocol: ProtocolType;
  remark: string;
  server: string;
  port: number;
  source: string; // E.g., "@v2ray_channel" or "Github"
  status: 'working' | 'failed' | 'untested' | 'checking';
  latency: number | null;
  lastChecked: string | null;
  isNpv?: boolean;
  createdAt?: string;
  reports?: {
    up: number;
    down: number;
  };
}

export interface ProxyItem {
  id: string;
  raw: string;
  type: 'mtproto' | 'socks5';
  server: string;
  port: number;
  secret?: string;
  source: string;
  status: 'working' | 'failed' | 'untested' | 'checking';
  latency: number | null;
  lastChecked: string | null;
  createdAt?: string;
}

export interface SourceItem {
  id: string;
  type: 'telegram' | 'github' | 'sub';
  name: string;
  urlOrHandle: string; // Telegram handle (e.g. @channel) or full URL
  enabled: boolean;
  extractedCount: number;
  lastExtracted: string | null;
}

export interface ForceJoinChannel {
  id: string;
  username: string; // e.g., @mychannel
  title: string;
  inviteLink: string;
  enabled: boolean;
}

export interface AutoPostSettings {
  enabled: boolean; // Master auto-post switch
  targetChannel: string; // e.g., @my_target_channel
  adText: string; // bot or channel to advertise
  silentMode: boolean; // send silently (disable_notification)
  postFiles?: boolean; // send .npvt and .ovpn files
  includeTechImportanceBadge?: boolean; // Show 🔥 / 💡 / 🔐 badges
  autoPurgeOldTechDays?: number; // Auto purge news older than X days (default: 7)
  lastPostedAt?: string | null;

  // Global Anti-Flood delay between posts (in minutes)
  antiFloodDelayMinutes?: number; // e.g. 3, 5, 10 minutes
  lastAnyPostAt?: string | null;

  // 1. Configs & Proxies Schedule
  configsEnabled?: boolean; // Toggle for configs auto-posting
  postIntervalHours: number; // e.g. 1, 2, 4, 8, 12, 24 (configs interval in hours)
  configIntervalHours?: number; // alias/explicit
  configIntervalMinutes?: number; // minute precision (e.g. 30, 45, 60, 120, etc.)
  configCount: number; // number of configs (0, 1, 2, 3, 5, 10, 15, 20, 30, 50, etc.)
  proxyCount: number; // number of proxies (0, 1, 2, 3, 5, 10, 15, 20)
  customText: string; // custom Persian text to add to the config post
  lastConfigsPostedAt?: string | null;

  // 2. Tech News Schedule (Dedicated/Independent)
  techNewsEnabled?: boolean; // Toggle for tech news auto-posting
  techNewsIntervalHours?: number; // Interval in hours (1, 2, 4, 6, 8, 12, 24)
  techNewsIntervalMinutes?: number; // minute precision (e.g. 30, 45, 60, 120, etc.)
  techNewsCount?: number; // Number of tech news to post (1, 2, 3, 5, etc.)
  lastTechNewsPostedAt?: string | null;

  // 3. Tech Tricks & Secrets Schedule (Dedicated/Independent)
  techTricksEnabled?: boolean; // Toggle for tricks/secrets auto-posting
  techTricksIntervalHours?: number; // Interval in hours (1, 2, 4, 6, 8, 12, 24)
  techTricksIntervalMinutes?: number; // minute precision (e.g. 30, 45, 60, 120, etc.)
  techTricksCount?: number; // Number of mobile/tech tricks to post (1, 2, 3, etc.)
  lastTechTricksPostedAt?: string | null;

  // 4. AI Prompts Schedule (Dedicated/Independent)
  aiPromptsEnabled?: boolean; // Toggle for AI Prompts auto-posting
  aiPromptsIntervalHours?: number; // Interval in hours (1, 2, 4, 6, 8, 12, 24)
  aiPromptsIntervalMinutes?: number; // minute precision (e.g. 30, 45, 60, 120, etc.)
  aiPromptsCount?: number; // Number of AI prompts to post (1, 2, 3, etc.)
  lastAiPromptsPostedAt?: string | null;

  // Legacy/Backwards compatibility
  techPostMode?: 'combined' | 'standalone' | 'both';
}

export interface SystemSettings {
  adminId: string;
  botToken: string;
  botUsername: string;
  branding: string; // e.g., "@MyChannel"
  isBotRunning: boolean;
  autoTest: boolean;
  autoTestInterval?: number; // Ping test interval in minutes
  testBatchLimit?: number; // Batch limit for config testing (default: 100)
  autoExtractInterval: number; // in minutes
  iranRelayProxy?: string; // Optional SOCKS5/HTTP relay proxy in Iran for 100% accurate Iran-net testing (e.g. socks5://185.x.x.x:1080)
  autoPost: AutoPostSettings;
  postMonitoringEnabled?: boolean;
  backupEnabled?: boolean;
  backupIntervalHours?: number;
  lastBackupAt?: string | null;
  botConnectionMode?: 'polling' | 'webhook';
  publicUrl?: string;
  adminUsername?: string;
  adminPassword?: string;
  maxConfigsRetention?: number; // Maximum retention limit for configs (default: 2000, range: 1-10000)
}

export interface ChannelPostConfig {
  id: string;
  raw: string;
  protocol: ProtocolType;
  remark: string;
  server: string;
  index: number;
}

export interface ChannelPostProxy {
  id: string;
  raw: string;
  type: 'mtproto' | 'socks5';
  server: string;
  port: number;
  secret?: string;
  index: number;
}

export interface ChannelPost {
  id: string;
  messageId: number;
  chatId: number | string;
  postedAt: string;
  originalText: string;
  configs: ChannelPostConfig[];
  proxies?: ChannelPostProxy[];
  repliedMessageId?: number | null;
}

export interface BotUser {
  chatId: number;
  username: string | null;
  firstName: string | null;
  joinedAt: string;
  lastActive: string;
  configsFetched: number;
}

export interface BotLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export type TechItemCategory = 'news' | 'trick' | 'secret';
export type TechImportance = 'breaking' | 'high' | 'medium' | 'normal';

export interface TechItem {
  id: string;
  title: string;
  summary: string;
  fullText?: string;
  imageUrl?: string;
  category: TechItemCategory; // 'news' (اخبار تکنولوژی), 'trick' (ترفندهای گوشی و تکنولوژی), 'secret' (رازهای تکنولوژی و امنیت)
  tags: string[];
  source: string;
  sourceUrl?: string;
  importance: TechImportance; // 'breaking' (فوری و داغ), 'high' (مهم), 'medium' (متوسط), 'normal' (عادی)
  importanceScore: number; // 1-100 (امتیاز اهمیت جهت اولویت‌بندی ارسال خودکار)
  createdAt: string;
  postedToChannel?: boolean;
  postedAt?: string | null;
}

export type AiPromptCategory = 'image' | 'video' | 'chat' | 'other';

export interface AiPrompt {
  id: string;
  title: string;
  category: AiPromptCategory; // 'image' (تصویر), 'video' (ویدیو), 'chat' (متنی / هوش مصنوعی), 'other' (سایر)
  description: string; // توضیحات فارسی پرامپت و نتیجه حاصله
  promptText: string; // متن اصلی انگلیسی پرامپت جهت کپی کردن آسان
  imageUrl?: string; // تصویر نمونه برای پیش‌نمایش بصری (از لئوناردو، میدجرنی، دالی و غیره)
  tags: string[]; // هشتگ‌ها
  importance?: 'hot' | 'normal'; // داغ و ترند یا معمولی
  createdAt: string;
  postedToChannel?: boolean;
  postedAt?: string | null;
}

export interface DashboardStats {
  totalUsers: number;
  totalConfigs: number;
  workingConfigsCount: number;
  failedConfigsCount: number;
  checkingConfigsCount: number;
  untestedConfigsCount: number;
  totalProxies: number;
  workingProxiesCount: number;
  failedProxiesCount: number;
  checkingProxiesCount: number;
  untestedProxiesCount: number;
  telegramChannelsCount: number;
  subsCount: number;
  extractedTodayCount: number;
  // Tech Stats
  totalTechItems?: number;
  techNewsCount?: number;
  techTricksCount?: number;
  techSecretsCount?: number;
  techHotCount?: number;
  // AI Prompts Stats
  totalAiPrompts?: number;
  aiPromptsImageCount?: number;
  aiPromptsVideoCount?: number;
  aiPromptsChatCount?: number;
}

