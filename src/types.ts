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
  enabled: boolean;
  targetChannel: string; // e.g., @my_target_channel
  postIntervalHours: number; // e.g. 1, 2, 4, 8, 12, 24
  configCount: number; // 1 or 2
  proxyCount: number; // 1 or 2
  customText: string; // custom Persian text to add to the post
  adText: string; // bot or channel to advertise
  postFiles?: boolean; // send .npvt and .ovpn files
  silentMode: boolean; // send silently (disable_notification)
  lastPostedAt: string | null;
}

export interface SystemSettings {
  adminId: string;
  botToken: string;
  botUsername: string;
  branding: string; // e.g., "@MyChannel"
  isBotRunning: boolean;
  autoTest: boolean;
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
}

