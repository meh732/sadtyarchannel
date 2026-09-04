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

  // 5. Fun & General News Schedule (Channel 1)
  funNewsEnabled?: boolean; // Toggle for fun & general news auto-posting
  funNewsIntervalHours?: number;
  funNewsIntervalMinutes?: number;
  funNewsCount?: number; // Number of fun/news items to post (1, 2, 3, etc.)
  lastFunNewsPostedAt?: string | null;

  // Legacy/Backwards compatibility
  techPostMode?: 'combined' | 'standalone' | 'both';

  // Channel 2 Dedicated Auto-Post Configuration
  channel2?: SecondaryChannelSettings;
}

export interface SecondaryChannelSettings {
  enabled: boolean; // Master switch for Channel 2
  targetChannel: string; // e.g., @my_target_channel_2
  adText: string; // bot or channel to advertise on Channel 2
  silentMode: boolean; // send silently
  antiFloodDelayMinutes?: number; // Anti-flood delay between posts in minutes
  lastAnyPostAt?: string | null;
  lastPostedAt?: string | null;

  // 1. Configs & Proxies Schedule for Channel 2
  configsEnabled?: boolean;
  postIntervalHours?: number;
  configIntervalHours?: number;
  configIntervalMinutes?: number;
  configCount?: number;
  proxyCount?: number;
  customText?: string;
  lastConfigsPostedAt?: string | null;

  // 2. Tech News Schedule for Channel 2
  techNewsEnabled?: boolean;
  techNewsIntervalHours?: number;
  techNewsIntervalMinutes?: number;
  techNewsCount?: number;
  lastTechNewsPostedAt?: string | null;

  // 3. Tech Tricks & Secrets Schedule for Channel 2
  techTricksEnabled?: boolean;
  techTricksIntervalHours?: number;
  techTricksIntervalMinutes?: number;
  techTricksCount?: number;
  lastTechTricksPostedAt?: string | null;

  // 4. AI Prompts Schedule for Channel 2
  aiPromptsEnabled?: boolean;
  aiPromptsIntervalHours?: number;
  aiPromptsIntervalMinutes?: number;
  aiPromptsCount?: number;
  lastAiPromptsPostedAt?: string | null;

  // 5. Fun & General News Schedule for Channel 2 (Primary use-case)
  funNewsEnabled?: boolean;
  funNewsIntervalHours?: number;
  funNewsIntervalMinutes?: number;
  funNewsCount?: number;
  lastFunNewsPostedAt?: string | null;
}

export interface FunNewsItem {
  id: string;
  title: string;
  text: string;
  imageUrl?: string;
  sourceChannel: string; // e.g. @khandeh_bazaar
  sourceMessageId?: number;
  category: 'fun' | 'news' | 'meme' | 'lifestyle';
  tags: string[];
  createdAt: string;
  postedToChannel1?: boolean;
  postedToChannel2?: boolean;
  postedAt?: string | null;
}

export interface FunNewsSource {
  id: string;
  name: string;
  urlOrHandle: string; // Telegram channel handle (e.g. @channel) or URL
  category?: 'fun' | 'news';
  enabled: boolean;
  extractedCount: number;
  lastExtracted?: string | null;
  createdAt?: string;
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
  seenPrompts?: string[];
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
  styleCategory?: string; // e.g. 'pixar', 'cyberpunk'
  description: string; // توضیحات فارسی پرامپت و نتیجه حاصله
  promptText: string; // متن اصلی انگلیسی پرامپت جهت کپی کردن آسان
  imageUrl?: string; // تصویر نمونه برای پیش‌نمایش بصری (از لئوناردو، میدجرنی، دالی و غیره)
  tags: string[]; // هشتگ‌ها
  importance?: 'hot' | 'normal'; // داغ و ترند یا معمولی
  tipsForPersonalPhoto?: string; // راهنمای فارسی ترکیب با عکس
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
  // Fun & General News Stats
  totalFunNewsItems?: number;
  funItemsCount?: number;
  newsItemsCount?: number;
  funSourcesCount?: number;
}

