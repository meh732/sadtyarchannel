import express from 'express';
import path from 'path';
import fs from 'fs';
import net from 'net';
import dns from 'dns';
import { createServer as createViteServer } from 'vite';
import { 
  ConfigItem, 
  ProxyItem,
  SourceItem, 
  ForceJoinChannel, 
  AutoPostSettings,
  SystemSettings, 
  BotUser, 
  BotLog,
  DashboardStats,
  ProtocolType,
  ChannelPost
} from './src/types';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_FILE = path.join(process.cwd(), 'data_store.json');

// --- Helper: Generate unique ID ---
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// --- Local Data Store Structure ---
interface DatabaseSchema {
  settings: SystemSettings;
  sources: SourceItem[];
  forceJoinChannels: ForceJoinChannel[];
  configs: ConfigItem[];
  proxies: ProxyItem[];
  users: BotUser[];
  logs: BotLog[];
  postedMessages?: ChannelPost[];
}

// --- Pre-populated default sources ---
const DEFAULT_SOURCES: SourceItem[] = [
  {
    id: 'src-1',
    type: 'telegram',
    name: 'V2ray Outline configs',
    urlOrHandle: '@v2ray_outline',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'src-2',
    type: 'telegram',
    name: 'V2Ray Free Configs',
    urlOrHandle: '@v2ray_free_conf',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'src-3',
    type: 'telegram',
    name: 'V2Ray Configs Pool',
    urlOrHandle: '@v2ray_configs_pool',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'src-4',
    type: 'github',
    name: 'Yebekhe V2ray Mix Source',
    urlOrHandle: 'https://raw.githubusercontent.com/yebekhe/TVC/main/v2ray/mix',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'src-5',
    type: 'sub',
    name: 'BarryFar All Configs Sub',
    urlOrHandle: 'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/All_Configs_Sub.txt',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  }
];

const DEFAULT_AUTO_POST: AutoPostSettings = {
  enabled: false,
  targetChannel: '',
  postIntervalHours: 4,
  configCount: 1,
  proxyCount: 1,
  customText: '💎 کانفیگ‌ها و پروکسی‌های اختصاصی و تست‌شده ما تقدیم به شما:',
  adText: 'Sponsor: @MyChannel',
  silentMode: true,
  lastPostedAt: null
};

const DEFAULT_SETTINGS: SystemSettings = {
  adminId: process.env.ADMIN_ID || '',
  botToken: process.env.BOT_TOKEN || '',
  botUsername: '',
  branding: '🌟 @MyChannelConfig',
  isBotRunning: false,
  autoTest: true,
  autoExtractInterval: 30, // minutes
  autoPost: DEFAULT_AUTO_POST,
  postMonitoringEnabled: false,
  backupEnabled: false,
  backupIntervalHours: 24,
  lastBackupAt: null
};

// --- Load/Save Database ---
let db: DatabaseSchema = {
  settings: DEFAULT_SETTINGS,
  sources: DEFAULT_SOURCES,
  forceJoinChannels: [
    {
      id: 'fj-1',
      username: '@MyChannel',
      title: 'کانال من (مثال)',
      inviteLink: 'https://t.me/MyChannel',
      enabled: false
    }
  ],
  configs: [],
  proxies: [],
  users: [],
  logs: [],
  postedMessages: []
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      const loaded = JSON.parse(content);
      db = {
        settings: { 
          ...DEFAULT_SETTINGS, 
          ...loaded.settings,
          autoPost: { ...DEFAULT_AUTO_POST, ...(loaded.settings?.autoPost || {}) }
        },
        sources: Array.isArray(loaded.sources) ? loaded.sources : DEFAULT_SOURCES,
        forceJoinChannels: Array.isArray(loaded.forceJoinChannels) ? loaded.forceJoinChannels : [],
        configs: Array.isArray(loaded.configs) ? loaded.configs : [],
        proxies: Array.isArray(loaded.proxies) ? loaded.proxies : [],
        users: Array.isArray(loaded.users) ? loaded.users : [],
        logs: Array.isArray(loaded.logs) ? loaded.logs : [],
        postedMessages: Array.isArray(loaded.postedMessages) ? loaded.postedMessages : []
      };
    } else {
      saveDatabase();
    }
  } catch (err) {
    console.error('Failed to load database:', err);
    addLog('error', 'خطا در بارگذاری پایگاه داده محلی، تنظیمات پیش‌فرض اعمال شد.');
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save database:', err);
  }
}

// --- Logger Helper ---
function addLog(level: 'info' | 'warn' | 'error' | 'success', message: string) {
  const log: BotLog = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    level,
    message
  };
  db.logs.unshift(log);
  if (db.logs.length > 300) {
    db.logs.pop();
  }
  saveDatabase();
  console.log(`[${level.toUpperCase()}] ${message}`);
}

// Ensure database is loaded right away
loadDatabase();

// --- Configuration String Parsers & Branders ---

/**
 * Checks if a string is Base64
 */
function isBase64(str: string): boolean {
  if (!str || str.trim() === '') return false;
  try {
    return Buffer.from(str, 'base64').toString('base64') === str.trim();
  } catch (e) {
    return false;
  }
}

/**
 * Parses and modifies a config to inject branding
 */
function applyBrandingToConfig(rawConfig: string, brandingText: string): string {
  if (!rawConfig) return rawConfig;
  const trimmed = rawConfig.trim();
  
  try {
    if (trimmed.startsWith('vmess://')) {
      const base64Part = trimmed.substring(8).trim();
      const decoded = Buffer.from(base64Part, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      parsed.ps = brandingText; // Set name of config (remarks)
      const encoded = Buffer.from(JSON.stringify(parsed, null, 2)).toString('base64');
      return `vmess://${encoded}`;
    }

    if (trimmed.startsWith('vless://') || trimmed.startsWith('trojan://') || trimmed.startsWith('ss://') || trimmed.startsWith('npv://')) {
      // Split by hash to update remarks
      const hashIndex = trimmed.lastIndexOf('#');
      if (hashIndex !== -1) {
        return trimmed.substring(0, hashIndex + 1) + encodeURIComponent(brandingText);
      } else {
        return trimmed + '#' + encodeURIComponent(brandingText);
      }
    }
  } catch (e) {
    // If branding failed due to malformed json/base64, return original
  }
  return rawConfig;
}

/**
 * Extracts connection host/IP and port from any v2ray/npv config for testing
 */
function parseConfigHostPort(rawConfig: string): { host: string; port: number; protocol: ProtocolType; remark: string } {
  const result = { host: '', port: 0, protocol: 'unknown' as ProtocolType, remark: 'کانفیگ استخراج‌شده' };
  if (!rawConfig) return result;
  const trimmed = rawConfig.trim();

  try {
    if (trimmed.startsWith('vmess://')) {
      result.protocol = 'vmess';
      const base64Part = trimmed.substring(8).trim();
      const decoded = Buffer.from(base64Part, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      result.host = parsed.add || '';
      result.port = Number(parsed.port) || 0;
      result.remark = parsed.ps || 'vmess config';
      return result;
    }

    if (trimmed.startsWith('vless://')) {
      result.protocol = 'vless';
    } else if (trimmed.startsWith('trojan://')) {
      result.protocol = 'trojan';
    } else if (trimmed.startsWith('ss://')) {
      result.protocol = 'ss';
    } else if (trimmed.startsWith('npv://')) {
      result.protocol = 'npv';
    }

    // For links of type protocol://[userinfo]@[host]:[port][path]#[remark]
    const hashIndex = trimmed.indexOf('#');
    let urlPart = hashIndex !== -1 ? trimmed.substring(0, hashIndex) : trimmed;
    const remarkPart = hashIndex !== -1 ? decodeURIComponent(trimmed.substring(hashIndex + 1)) : '';
    if (remarkPart) result.remark = remarkPart;

    if (result.protocol === 'npv') {
      // napsternetV configurations can be custom base64 encoded.
      // Let's see if we can decode it to search for hosts/ports.
      const payload = urlPart.replace('npv://', '');
      try {
        const decoded = Buffer.from(payload, 'base64').toString('utf8');
        const json = JSON.parse(decoded);
        // napsternetv schema fields:
        result.host = json.host || json.v2rayHost || json.sshHost || json.address || '';
        result.port = Number(json.port || json.v2rayPort || json.sshPort) || 0;
        result.remark = json.remarks || remarkPart || 'NPV Config';
        if (result.host && result.port) return result;
      } catch(e) {
        // Fallback or plain text
      }
    }

    // Standard parse: look for @ followed by host:port
    const atIndex = urlPart.lastIndexOf('@');
    if (atIndex !== -1) {
      const hostPortPart = urlPart.substring(atIndex + 1);
      const colonIndex = hostPortPart.indexOf(':');
      if (colonIndex !== -1) {
        result.host = hostPortPart.substring(0, colonIndex);
        // port is until query params or end
        const portPart = hostPortPart.substring(colonIndex + 1);
        const questionIndex = portPart.indexOf('?');
        const slashIndex = portPart.indexOf('/');
        let endIdx = portPart.length;
        if (questionIndex !== -1) endIdx = Math.min(endIdx, questionIndex);
        if (slashIndex !== -1) endIdx = Math.min(endIdx, slashIndex);
        result.port = parseInt(portPart.substring(0, endIdx)) || 0;
      }
    } else {
      // shadowsocks might pack userinfo inside base64, e.g. ss://base64@host:port
      const doubleSlashIdx = urlPart.indexOf('://');
      const cleanUrl = doubleSlashIdx !== -1 ? urlPart.substring(doubleSlashIdx + 3) : urlPart;
      const colonIdx = cleanUrl.lastIndexOf(':');
      if (colonIdx !== -1) {
        result.host = cleanUrl.substring(0, colonIdx);
        const portPart = cleanUrl.substring(colonIdx + 1);
        result.port = parseInt(portPart) || 0;
      }
    }
  } catch (err) {
    // Parsing fail
  }

  return result;
}

// --- Connection Port Tester ---
function checkPort(host: string, port: number, timeout = 2500): Promise<{ working: boolean; latency: number }> {
  return new Promise((resolve) => {
    if (!host || !port) {
      return resolve({ working: false, latency: 999 });
    }

    const start = Date.now();
    const socket = new net.Socket();
    let resolved = false;

    socket.setTimeout(timeout);

    const finish = (working: boolean) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      const latency = Date.now() - start;
      resolve({ working, latency: working ? latency : 999 });
    };

    socket.on('connect', () => finish(true));
    socket.on('error', () => finish(false));
    socket.on('timeout', () => finish(false));

    socket.connect(port, host);
  });
}

// --- Scraping & Extraction Engine ---

/**
 * Extracts configuration protocols from HTML or plain text
 */
function extractConfigsFromText(text: string, sourceName: string): ConfigItem[] {
  if (!text) return [];
  
  // Decodes html entities that telegram public feed may encode
  let cleanText = text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/%20/g, ' ');

  // Look for configuration protocols (vless://, vmess://, trojan://, ss://, npv://, hy2://, hysteria2://)
  // Matching up to a space, double quote, single quote, less-than, greater-than, newline or backtick
  const regex = /(vless|vmess|trojan|ss|npv):\/\/[^\s"'<>\`\\|]+/g;
  const matches = cleanText.match(regex);
  if (!matches) return [];

  const extracted: ConfigItem[] = [];
  const uniqueRaw = Array.from(new Set(matches));

  for (const raw of uniqueRaw) {
    // Basic formatting cleanups
    let rawConfig = raw.trim();
    if (rawConfig.endsWith('.') || rawConfig.endsWith(',') || rawConfig.endsWith(')') || rawConfig.endsWith(']')) {
      rawConfig = rawConfig.slice(0, -1);
    }

    // Skip duplicates in currently existing db configs
    const exists = db.configs.some(c => c.raw === rawConfig);
    if (exists) continue;

    const info = parseConfigHostPort(rawConfig);
    if (!info.host || !info.port) {
      // Skip invalid formats that we cannot parse
      continue;
    }

    extracted.push({
      id: generateId(),
      raw: rawConfig,
      protocol: info.protocol,
      remark: info.remark,
      server: info.host,
      port: info.port,
      source: sourceName,
      status: 'untested',
      latency: null,
      lastChecked: null
    });
  }

  return extracted;
}

/**
 * Extracts MTProto & Socks5 proxies from HTML or plain text
 */
function extractProxiesFromText(text: string, sourceName: string): ProxyItem[] {
  if (!text) return [];

  let cleanText = text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/%20/g, ' ');

  // Match:
  // tg://proxy?server=SERVER&port=PORT&secret=SECRET
  // tg://socks?server=SERVER&port=PORT
  // t.me/proxy?server=SERVER&port=PORT&secret=SECRET
  // t.me/socks?server=SERVER&port=PORT
  // socks5://SERVER:PORT
  const regex = /(?:tg:\/\/|t\.me\/|https:\/\/t\.me\/)(?:proxy|socks)\?[^\s"'<>\`\\|]+/g;
  const matches1 = cleanText.match(regex) || [];
  
  const socks5Regex = /socks5:\/\/[^\s"'<>\`\\|]+/g;
  const matches2 = cleanText.match(socks5Regex) || [];
  
  const allMatches = [...matches1, ...matches2];
  if (allMatches.length === 0) return [];

  const extracted: ProxyItem[] = [];
  const uniqueRaw = Array.from(new Set(allMatches));

  for (let raw of uniqueRaw) {
    let rawProxy = raw.trim();
    if (rawProxy.startsWith('t.me/') || rawProxy.startsWith('https://t.me/')) {
      rawProxy = rawProxy.replace(/^https:\/\/t\.me\//, 'tg://').replace(/^t\.me\//, 'tg://');
    }

    if (rawProxy.endsWith('.') || rawProxy.endsWith(',') || rawProxy.endsWith(')') || rawProxy.endsWith(']')) {
      rawProxy = rawProxy.slice(0, -1);
    }

    // Skip duplicates
    if (!db.proxies) db.proxies = [];
    const exists = db.proxies.some(p => p.raw === rawProxy);
    if (exists) continue;

    let server = '';
    let port = 0;
    let secret = '';
    let type: 'mtproto' | 'socks5' = 'mtproto';

    if (rawProxy.startsWith('tg://proxy')) {
      type = 'mtproto';
      try {
        const query = rawProxy.split('?')[1] || '';
        const params = new URLSearchParams(query);
        server = params.get('server') || '';
        port = parseInt(params.get('port') || '0') || 0;
        secret = params.get('secret') || '';
      } catch (e) {}
    } else if (rawProxy.startsWith('tg://socks')) {
      type = 'socks5';
      try {
        const query = rawProxy.split('?')[1] || '';
        const params = new URLSearchParams(query);
        server = params.get('server') || '';
        port = parseInt(params.get('port') || '0') || 0;
      } catch (e) {}
    } else if (rawProxy.startsWith('socks5://')) {
      type = 'socks5';
      try {
        const urlPart = rawProxy.replace('socks5://', '');
        const atIdx = urlPart.lastIndexOf('@');
        const hostPort = atIdx !== -1 ? urlPart.substring(atIdx + 1) : urlPart;
        const colonIdx = hostPort.lastIndexOf(':');
        if (colonIdx !== -1) {
          server = hostPort.substring(0, colonIdx);
          port = parseInt(hostPort.substring(colonIdx + 1)) || 0;
        }
      } catch (e) {}
    }

    if (!server || !port) continue;

    extracted.push({
      id: generateId(),
      raw: rawProxy,
      type,
      server,
      port,
      secret: secret || undefined,
      source: sourceName,
      status: 'untested',
      latency: null,
      lastChecked: null
    });
  }

  return extracted;
}

/**
 * Scrapes a single source (Telegram Web, Sub, or GitHub Raw)
 */
async function scrapeSource(source: SourceItem): Promise<number> {
  if (!source.enabled) return 0;
  
  try {
    let url = source.urlOrHandle;
    addLog('info', `در حال استخراج کدهای کانفیگ و پروکسی از منبع: ${source.name}`);

    if (source.type === 'telegram') {
      // Remove @ prefix if provided
      const handle = source.urlOrHandle.startsWith('@') ? source.urlOrHandle.substring(1) : source.urlOrHandle;
      url = `https://t.me/s/${handle}`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`خطای HTTP: ${response.status}`);
    }

    const text = await response.text();
    let extracted: ConfigItem[] = [];
    let extractedProxies: ProxyItem[] = [];

    // Check if subscription body is base64 encoded (very common for V2Ray subscriptions)
    if (source.type === 'sub' && isBase64(text)) {
      const decoded = Buffer.from(text, 'base64').toString('utf8');
      extracted = extractConfigsFromText(decoded, source.name);
      extractedProxies = extractProxiesFromText(decoded, source.name);
    } else {
      extracted = extractConfigsFromText(text, source.name);
      extractedProxies = extractProxiesFromText(text, source.name);
    }

    if (!db.proxies) db.proxies = [];

    if (extracted.length > 0 || extractedProxies.length > 0) {
      if (extracted.length > 0) {
        db.configs.unshift(...extracted);
      }
      if (extractedProxies.length > 0) {
        db.proxies.unshift(...extractedProxies);
      }

      source.extractedCount += (extracted.length + extractedProxies.length);
      source.lastExtracted = new Date().toISOString();
      saveDatabase();
      
      addLog('success', `موفقیت: تعداد ${extracted.length} کانفیگ و ${extractedProxies.length} پروکسی جدید از منبع ${source.name} استخراج شد.`);
      
      // Auto-test ports if auto-test is enabled
      if (db.settings.autoTest) {
        if (extracted.length > 0) {
          testConfigsBatch(extracted.map(c => c.id));
        }
        if (extractedProxies.length > 0) {
          testProxiesBatch(extractedProxies.map(p => p.id));
        }
      }
    } else {
      addLog('info', `هیچ کانفیگ یا پروکسی جدیدی در ${source.name} یافت نشد (یا تکراری بودند).`);
    }

    return extracted.length + extractedProxies.length;
  } catch (err: any) {
    addLog('error', `خطا در استخراج از منبع ${source.name}: ${err.message || err}`);
    return 0;
  }
}

/**
 * Run test on specific proxy IDs
 */
async function testProxiesBatch(ids: string[]) {
  if (!db.proxies) db.proxies = [];
  addLog('info', `در حال آغاز تست اتصال پورت برای تعداد ${ids.length} پروکسی...`);
  
  let workingCount = 0;
  let failedCount = 0;

  for (const id of ids) {
    const proxy = db.proxies.find(p => p.id === id);
    if (!proxy) continue;

    proxy.status = 'checking';
    saveDatabase();

    const checkResult = await checkPort(proxy.server, proxy.port);
    
    const currentProxy = db.proxies.find(p => p.id === id);
    if (currentProxy) {
      currentProxy.status = checkResult.working ? 'working' : 'failed';
      currentProxy.latency = checkResult.working ? checkResult.latency : null;
      currentProxy.lastChecked = new Date().toISOString();
      
      if (checkResult.working) workingCount++;
      else failedCount++;
    }
  }

  saveDatabase();
  addLog('success', `پایان تست اتصال پورت پروکسی: تعداد ${workingCount} فعال و ${failedCount} غیرفعال شناسایی شدند.`);
}

/**
 * Run test on specific config IDs
 */
async function testConfigsBatch(ids: string[]) {
  addLog('info', `در حال آغاز تست اتصال پورت برای تعداد ${ids.length} کانفیگ...`);
  
  let workingCount = 0;
  let failedCount = 0;

  for (const id of ids) {
    const config = db.configs.find(c => c.id === id);
    if (!config) continue;

    config.status = 'checking';
    // Save checking status
    saveDatabase();

    const checkResult = await checkPort(config.server, config.port);
    
    // Refresh connection to DB object in case it was modified
    const currentConfig = db.configs.find(c => c.id === id);
    if (currentConfig) {
      currentConfig.status = checkResult.working ? 'working' : 'failed';
      currentConfig.latency = checkResult.working ? checkResult.latency : null;
      currentConfig.lastChecked = new Date().toISOString();
      
      if (checkResult.working) workingCount++;
      else failedCount++;
    }
  }

  saveDatabase();
  addLog('success', `پایان تست اتصال پورت: تعداد ${workingCount} فعال و ${failedCount} غیرفعال شناسایی شدند.`);
}

/**
 * Triggers bulk extraction across all active sources
 */
async function triggerBulkScrape(): Promise<number> {
  let totalExtracted = 0;
  for (const src of db.sources) {
    if (src.enabled) {
      const count = await scrapeSource(src);
      totalExtracted += count;
    }
  }
  return totalExtracted;
}

// --- Geolocation & Flag Helpers ---
async function getIpLocation(host: string): Promise<{ country: string; countryCode: string }> {
  try {
    let ip = host;
    if (!net.isIP(host)) {
      const ips = await new Promise<string[]>((resolve, reject) => {
        dns.resolve4(host, (err, addresses) => {
          if (err || !addresses || addresses.length === 0) reject(err);
          else resolve(addresses);
        });
      });
      ip = ips[0];
    }
    
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success') {
        return {
          country: data.country || 'Unknown',
          countryCode: data.countryCode || ''
        };
      }
    }
  } catch (e) {
    // Silent
  }
  return { country: 'نامشخص', countryCode: '' };
}

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// --- Auto-Posting Logic ---
async function executeAutoPost(): Promise<boolean> {
  const settings = db.settings.autoPost;
  if (!settings || !settings.enabled || !settings.targetChannel) {
    addLog('warn', 'ارسال خودکار انجام نشد: غیرفعال است یا کانال هدف تنظیم نشده است.');
    return false;
  }
  if (!db.settings.botToken) {
    addLog('warn', 'ارسال خودکار انجام نشد: توکن ربات فعال نیست.');
    return false;
  }

  try {
    addLog('info', `در حال آماده‌سازی و ارسال پست خودکار به کانال ${settings.targetChannel}...`);

    // Get configs
    const workingConfigs = db.configs.filter(c => c.status === 'working');
    const availableConfigs = workingConfigs.length > 0 ? workingConfigs : db.configs.slice(0, 50);
    const shuffledConfigs = [...availableConfigs].sort(() => 0.5 - Math.random());
    const selectedConfigs = shuffledConfigs.slice(0, Math.min(settings.configCount || 1, shuffledConfigs.length));

    // Get proxies
    const workingProxies = (db.proxies || []).filter(p => p.status === 'working');
    const availableProxies = workingProxies.length > 0 ? workingProxies : (db.proxies || []).slice(0, 50);
    const shuffledProxies = [...availableProxies].sort(() => 0.5 - Math.random());
    const selectedProxies = shuffledProxies.slice(0, Math.min(settings.proxyCount || 1, shuffledProxies.length));

    if (selectedConfigs.length === 0 && selectedProxies.length === 0) {
      addLog('warn', 'ارسال خودکار انجام نشد زیرا هیچ کانفیگ یا پروکسی فعالی در دیتابیس یافت نشد.');
      return false;
    }

    let text = `${settings.customText || '💎 کانفیگ‌ها و پروکسی‌های جدید تقدیم به شما:'}\n\n`;
  
    // Append configs
    for (let i = 0; i < selectedConfigs.length; i++) {
      const conf = selectedConfigs[i];
      const loc = await getIpLocation(conf.server);
      const flag = getFlagEmoji(loc.countryCode);
      const pingText = conf.latency ? `پینگ: ${conf.latency}ms` : 'پورت: فعال';
      
      text += `🟢 **کانفیگ شماره ${i + 1}** [${conf.protocol.toUpperCase()}]\n`;
      text += `🔹 ${pingText} | لوکیشن: ${loc.country} ${flag}\n`;
      const brandedRaw = applyBrandingToConfig(conf.raw, db.settings.branding);
      text += `\`${brandedRaw}\`\n\n`;
    }

    // Append proxies
    if (selectedProxies.length > 0) {
      text += `🔌 **لیست پروکسی‌های جدید تلگرام:**\n`;
      for (let i = 0; i < selectedProxies.length; i++) {
        const proxy = selectedProxies[i];
        const loc = await getIpLocation(proxy.server);
        const flag = getFlagEmoji(loc.countryCode);
        const pingText = proxy.latency ? `پینگ: ${proxy.latency}ms` : 'پورت: فعال';
        text += `🔹 پروکسی ${proxy.type.toUpperCase()} | ${pingText} | کشور: ${loc.country} ${flag}\n`;
      }
      text += `\n👇 برای اتصال، روی دکمه‌های شیشه‌ای زیر ضربه بزنید:\n`;
    }

    const inlineButtons: any[] = [];
    selectedProxies.forEach((p, idx) => {
      const label = `🔌 اتصال به پروکسی ${p.type.toUpperCase()} شماره ${idx + 1}`;
      inlineButtons.push([{
        text: label,
        url: p.raw
      }]);
    });

    if (settings.adText && settings.adText.trim() !== '') {
      let adUrl = 'https://t.me';
      let adLabel = settings.adText;
      if (settings.adText.includes('@')) {
        const handle = settings.adText.match(/@[a-zA-Z0-9_]+/)?.[0]?.replace('@', '');
        if (handle) {
          adUrl = `https://t.me/${handle}`;
          adLabel = `📢 عضویت در کانال اسپانسر: ${settings.adText}`;
        }
      } else if (settings.adText.startsWith('http')) {
        adUrl = settings.adText;
      }
      inlineButtons.push([{ text: adLabel, url: adUrl }]);
    }

    const channelHandle = settings.targetChannel.startsWith('@') ? settings.targetChannel : `@${settings.targetChannel.replace('@', '')}`;
    const sentMsg = await callTelegramApi('sendMessage', {
      chat_id: channelHandle,
      text: text,
      parse_mode: 'Markdown',
      reply_markup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined,
      disable_notification: !!settings.silentMode
    });

    // Add to posted messages
    const postConfigs = selectedConfigs.map((c, idx) => ({
      id: c.id,
      raw: c.raw,
      protocol: c.protocol,
      remark: c.remark,
      server: c.server,
      port: c.port,
      index: idx + 1
    }));

    const postProxies = selectedProxies.map((p, idx) => ({
      id: p.id,
      raw: p.raw,
      type: p.type,
      server: p.server,
      port: p.port,
      secret: p.secret,
      index: idx + 1
    }));

    if (!db.postedMessages) db.postedMessages = [];
    db.postedMessages.push({
      id: generateId(),
      messageId: sentMsg.message_id,
      chatId: channelHandle,
      postedAt: new Date().toISOString(),
      originalText: text,
      configs: postConfigs,
      repliedMessageId: null
    });

    settings.lastPostedAt = new Date().toISOString();
    saveDatabase();
    addLog('success', `پست خودکار با موفقیت به کانال ${settings.targetChannel} ارسال گردید.`);
    return true;
  } catch (err: any) {
    addLog('error', `خطا در ارسال پست خودکار به کانال: ${err.message || err}`);
    return false;
  }
}

// --- Dynamic Post Monitoring & Text Regeneration ---
async function generatePostText(post: ChannelPost): Promise<string> {
  const ap = db.settings.autoPost;
  let text = `${ap.customText || '💎 کانفیگ‌ها و پروکسی‌های اختصاصی و تست‌شده ما تقدیم به شما:'}\n\n`;
  
  for (let i = 0; i < post.configs.length; i++) {
    const conf = post.configs[i];
    // Find latest live status from db
    const dbConf = db.configs.find(c => c.id === conf.id || c.raw === conf.raw);
    const status = dbConf ? dbConf.status : 'failed';
    const latency = dbConf ? dbConf.latency : null;
    
    const loc = await getIpLocation(conf.server);
    const flag = getFlagEmoji(loc.countryCode);
    
    if (status === 'working') {
      const pingText = latency ? `پینگ: ${latency}ms` : 'پورت: فعال';
      text += `🟢 **کانفیگ شماره ${conf.index}** [${conf.protocol.toUpperCase()}]\n`;
      text += `🔹 ${pingText} | لوکیشن: ${loc.country} ${flag}\n`;
    } else {
      text += `🔴 **کانفیگ شماره ${conf.index}** [${conf.protocol.toUpperCase()}] (غیرفعال ❌)\n`;
      text += `🔹 لوکیشن: ${loc.country} ${flag}\n`;
    }
    const brandedRaw = applyBrandingToConfig(conf.raw, db.settings.branding);
    text += `\`${brandedRaw}\`\n\n`;
  }

  // Proxies
  if (post.proxies && post.proxies.length > 0) {
    text += `🔌 **لیست پروکسی‌های جدید تلگرام:**\n`;
    for (let i = 0; i < post.proxies.length; i++) {
      const p = post.proxies[i];
      const dbProxy = db.proxies.find(pr => pr.id === p.id || pr.raw === p.raw);
      const status = dbProxy ? dbProxy.status : 'failed';
      const latency = dbProxy ? dbProxy.latency : null;

      const loc = await getIpLocation(p.server);
      const flag = getFlagEmoji(loc.countryCode);

      if (status === 'working') {
        const pingText = latency ? `پینگ: ${latency}ms` : 'پورت: فعال';
        text += `🔹 پروکسی ${p.type.toUpperCase()} | ${pingText} | کشور: ${loc.country} ${flag}\n`;
      } else {
        text += `🔹 پروکسی ${p.type.toUpperCase()} | (غیرفعال ❌) | کشور: ${loc.country} ${flag}\n`;
      }
    }
    text += `\n👇 برای اتصال، روی دکمه‌های شیشه‌ای زیر ضربه بزنید:\n`;
  }

  return text;
}

async function monitorChannelPosts() {
  if (!db.settings.postMonitoringEnabled) return;
  if (!db.postedMessages || db.postedMessages.length === 0) return;

  const now = Date.now();
  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  
  // Keep only posts within 5 days
  const activePosts = (db.postedMessages || []).filter(post => {
    const age = now - new Date(post.postedAt).getTime();
    return age <= fiveDaysMs;
  });
  
  if (activePosts.length !== db.postedMessages.length) {
    db.postedMessages = activePosts;
    saveDatabase();
  }

  if (activePosts.length === 0) return;

  addLog('info', `در حال بررسی وضعیت و پینگ کانفیگ‌های پست‌شده در ۵ روز گذشته (تعداد ${activePosts.length} پست)...`);

  for (const post of activePosts) {
    try {
      const newText = await generatePostText(post);
      const channelHandle = typeof post.chatId === 'string' ? post.chatId : String(post.chatId);
      
      // Rebuild reply buttons for proxies
      const inlineButtons: any[] = [];
      post.proxies.forEach((p, idx) => {
        const dbProxy = db.proxies.find(pr => pr.id === p.id || pr.raw === p.raw);
        const status = dbProxy ? dbProxy.status : 'failed';
        if (status === 'working') {
          const label = `🔌 اتصال به پروکسی ${p.type.toUpperCase()} شماره ${p.index}`;
          inlineButtons.push([{
            text: label,
            url: p.raw
          }]);
        }
      });

      const ap = db.settings.autoPost;
      if (ap.adText && ap.adText.trim() !== '') {
        let adUrl = 'https://t.me';
        let adLabel = ap.adText;
        if (ap.adText.includes('@')) {
          const handle = ap.adText.match(/@[a-zA-Z0-9_]+/)?.[0]?.replace('@', '');
          if (handle) {
            adUrl = `https://t.me/${handle}`;
            adLabel = `📢 عضویت در کانال اسپانسر: ${ap.adText}`;
          }
        } else if (ap.adText.startsWith('http')) {
          adUrl = ap.adText;
        }
        inlineButtons.push([{ text: adLabel, url: adUrl }]);
      }

      // 1. Edit the main post
      try {
        await callTelegramApi('editMessageText', {
          chat_id: channelHandle,
          message_id: post.messageId,
          text: newText,
          parse_mode: 'Markdown',
          reply_markup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined
        });
      } catch (err: any) {
        if (!err.message.includes('message is not modified')) {
          console.error(`Failed to edit message ${post.messageId}:`, err.message);
        }
      }

      // 2. Reply logic for the working config with lowest ping
      let lowestPingConfig: any = null;
      for (const conf of post.configs) {
        const dbConf = db.configs.find(c => c.id === conf.id || c.raw === conf.raw);
        if (dbConf && dbConf.status === 'working') {
          if (!lowestPingConfig || (dbConf.latency !== null && (lowestPingConfig.latency === null || dbConf.latency < lowestPingConfig.latency))) {
            lowestPingConfig = {
              ...conf,
              latency: dbConf.latency
            };
          }
        }
      }

      if (lowestPingConfig) {
        const elapsedMs = Date.now() - new Date(post.postedAt).getTime();
        const days = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
        const hours = Math.floor((elapsedMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        
        let timeStr = '';
        if (days > 0) {
          timeStr = `${days} روز`;
          if (hours > 0) {
            timeStr += ` و ${hours} ساعت`;
          }
        } else {
          timeStr = `${hours} ساعت`;
        }

        const replyText = `⚡️ **گزارش پایداری اتصال کانفیگ‌ها**\n\nکانفیگ شماره **${lowestPingConfig.index}** بعد از گذشت **${timeStr}** همچنان با قدرت متصل است! 💪\n\n⏱ پینگ واقعی: **${lowestPingConfig.latency}ms**`;

        if (!post.repliedMessageId) {
          try {
            const replyMsg = await callTelegramApi('sendMessage', {
              chat_id: channelHandle,
              text: replyText,
              parse_mode: 'Markdown',
              reply_to_message_id: post.messageId
            });
            post.repliedMessageId = replyMsg.message_id;
            saveDatabase();
          } catch (e: any) {
            console.error(`Error sending reply to message ${post.messageId}:`, e.message);
          }
        } else {
          try {
            await callTelegramApi('editMessageText', {
              chat_id: channelHandle,
              message_id: post.repliedMessageId,
              text: replyText,
              parse_mode: 'Markdown'
            });
          } catch (e: any) {
            if (!e.message.includes('message is not modified')) {
              console.error(`Error editing reply to message ${post.messageId}:`, e.message);
            }
          }
        }
      } else {
        if (post.repliedMessageId) {
          try {
            await callTelegramApi('editMessageText', {
              chat_id: channelHandle,
              message_id: post.repliedMessageId,
              text: `⚠️ **گزارش اتصال**\n\nتمام کانفیگ‌های این پست غیرفعال شده‌اند. جهت دریافت کانفیگ‌های جدید، آخرین پست‌های کانال را بررسی کنید.`,
              parse_mode: 'Markdown'
            });
          } catch (e: any) {
            if (!e.message.includes('message is not modified')) {
              console.error(`Error updating expired reply to message ${post.messageId}:`, e.message);
            }
          }
        }
      }
    } catch (outerErr: any) {
      console.error(`Outer error monitoring post ${post.messageId}:`, outerErr.message);
    }
  }
}

// --- Automated Local DB Backup Systems ---
async function sendBackupToAdmin(): Promise<boolean> {
  const adminId = db.settings.adminId;
  const token = db.settings.botToken;
  if (!adminId || !token) return false;
  try {
    if (!fs.existsSync(DB_FILE)) return false;
    const content = fs.readFileSync(DB_FILE, 'utf8');
    const formData = new FormData();
    formData.append('chat_id', adminId);
    
    const blob = new Blob([content], { type: 'application/json' });
    const filename = `db_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    formData.append('document', blob, filename);
    formData.append('caption', `📦 **نسخه پشتیبان خودکار دیتابیس ربات**\n\n🕒 زمان: **${new Date().toLocaleString('fa-IR')}**\n💾 حجم فایل: **${(content.length / 1024).toFixed(2)} کیلوبایت**`);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    
    const resData = await res.json();
    if (resData.ok) {
      db.settings.lastBackupAt = new Date().toISOString();
      saveDatabase();
      addLog('success', `نسخه پشتیبان دیتابیس با موفقیت برای ادمین ارسال گردید.`);
      return true;
    } else {
      addLog('error', `خطا در ارسال بکاپ به تلگرام: ${resData.description}`);
      return false;
    }
  } catch (err: any) {
    addLog('error', `خطا در فرآیند پشتیبان‌گیری دیتابیس: ${err.message || err}`);
    return false;
  }
}

async function checkAndTriggerBackup() {
  if (!db.settings.backupEnabled) return;
  const lastBackup = db.settings.lastBackupAt;
  if (!lastBackup) {
    await sendBackupToAdmin();
    return;
  }
  try {
    const diffMs = Date.now() - new Date(lastBackup).getTime();
    const intervalMs = (db.settings.backupIntervalHours || 24) * 60 * 60 * 1000;
    if (diffMs >= intervalMs) {
      await sendBackupToAdmin();
    }
  } catch (e) {
    console.error('Error checking backup schedule:', e);
  }
}

async function checkAndTriggerAutoPost() {
  const settings = db.settings.autoPost;
  if (!settings || !settings.enabled || !settings.targetChannel) return;

  const lastPosted = settings.lastPostedAt;
  if (!lastPosted) {
    await executeAutoPost();
    return;
  }

  try {
    const diffMs = Date.now() - new Date(lastPosted).getTime();
    const intervalMs = (settings.postIntervalHours || 4) * 60 * 60 * 1000;
    if (diffMs >= intervalMs) {
      await executeAutoPost();
    }
  } catch (e) {
    console.error('Error checking auto post schedule:', e);
  }
}

let autoPostIntervalRef: NodeJS.Timeout | null = null;
function setupAutoPostInterval() {
  if (autoPostIntervalRef) clearInterval(autoPostIntervalRef);

  const settings = db.settings.autoPost;
  if (settings && settings.enabled) {
    // Check every 5 minutes if it's time to post
    autoPostIntervalRef = setInterval(() => {
      checkAndTriggerAutoPost();
    }, 5 * 60 * 1000);
    // Also run an initial check
    checkAndTriggerAutoPost();
  }
}

// --- Telegram Bot Long-Polling Client ---
let pollingActive = false;
let botOffset = 0;
let botTimeoutRef: NodeJS.Timeout | null = null;

// Temporary cache for force join verification responses
const joinChecksCache: Record<number, { checkedAt: number; hasJoined: boolean }> = {};

/**
 * Sends request to Telegram Bot API
 */
async function callTelegramApi(method: string, body: object): Promise<any> {
  const token = db.settings.botToken;
  if (!token) {
    throw new Error('Bot token is not configured');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Unknown Telegram Error');
  }
  return data.result;
}

/**
 * Tests Bot Connection / Fetches Profile info
 */
async function testBotConnection(token: string): Promise<string> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();
    if (data.ok && data.result) {
      return data.result.username || 'unknown_bot';
    }
    throw new Error(data.description || 'کد خطا نامعتبر است');
  } catch (err: any) {
    throw new Error(err.message || 'ارتباط برقرار نشد');
  }
}

/**
 * Core Bot Polling Loop
 */
async function runBotPolling() {
  if (!pollingActive) return;
  const token = db.settings.botToken;
  if (!token) {
    db.settings.isBotRunning = false;
    pollingActive = false;
    addLog('warn', 'ربات به علت عدم تعریف توکن خاموش شد.');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${botOffset}&timeout=10`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Telegram API responded with status ${response.status}`);
    }

    const data = await response.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        botOffset = update.update_id + 1;
        await handleBotUpdate(update);
      }
    }
  } catch (err: any) {
    console.error('Bot polling error:', err);
    // Silent sleep on network timeout, wait 5s to avoid tight loop
    await new Promise(r => setTimeout(r, 5000));
  }

  // Continue polling if still active
  if (pollingActive) {
    botTimeoutRef = setTimeout(runBotPolling, 200);
  }
}

const adminStates: Record<number, { action: string; data?: any }> = {};

/**
 * Handles incoming bot message or callback query
 */
async function handleBotUpdate(update: any) {
  try {
    let chatId: number = 0;
    let userId: number = 0;
    let messageText: string = '';
    let username: string | null = null;
    let firstName: string | null = null;
    let callbackData: string | null = null;
    let callbackQueryId: string | null = null;

    if (update.message) {
      chatId = update.message.chat.id;
      userId = update.message.from.id;
      messageText = update.message.text || '';
      username = update.message.from.username || null;
      firstName = update.message.from.first_name || 'کاربر';
    } else if (update.callback_query) {
      chatId = update.callback_query.message.chat.id;
      userId = update.callback_query.from.id;
      callbackData = update.callback_query.data;
      callbackQueryId = update.callback_query.id;
      username = update.callback_query.from.username || null;
      firstName = update.callback_query.from.first_name || 'کاربر';
    }

    if (!chatId) return;

    // Save or update bot user
    let userIdx = db.users.findIndex(u => u.chatId === chatId);
    if (userIdx === -1) {
      db.users.push({
        chatId,
        username,
        firstName,
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        configsFetched: 0
      });
      addLog('info', `کاربر جدید تلگرام به ربات پیوست: ${firstName} (@${username || 'بدون_نام'})`);
    } else {
      db.users[userIdx].lastActive = new Date().toISOString();
      if (username) db.users[userIdx].username = username;
      if (firstName) db.users[userIdx].firstName = firstName;
    }
    saveDatabase();

    // --- Verification: Force Join check ---
    const requiredChannels = db.forceJoinChannels.filter(c => c.enabled && c.username);
    let userHasJoinedAll = true;
    const notJoinedList: ForceJoinChannel[] = [];

    const isAdmin = db.settings.adminId && String(userId) === String(db.settings.adminId);

    if (requiredChannels.length > 0 && !isAdmin) {
      // Check cache first to avoid rate limits (valid for 30 seconds)
      const cached = joinChecksCache[userId];
      if (cached && (Date.now() - cached.checkedAt < 30000) && cached.hasJoined) {
        userHasJoinedAll = true;
      } else {
        for (const channel of requiredChannels) {
          try {
            const handle = channel.username.startsWith('@') ? channel.username : `@${channel.username}`;
            const member = await callTelegramApi('getChatMember', {
              chat_id: handle,
              user_id: userId
            });
            const validStatus = ['creator', 'administrator', 'member'];
            if (!member || !validStatus.includes(member.status)) {
              userHasJoinedAll = false;
              notJoinedList.push(channel);
            }
          } catch (e) {
            // If bot is not admin, it might throw error. In that case, bypass or log
            console.error(`Force join check error for ${channel.username}:`, e);
          }
        }
        joinChecksCache[userId] = {
          checkedAt: Date.now(),
          hasJoined: userHasJoinedAll
        };
      }
    }

    // --- Callback query response wrapper ---
    const answerCallback = async (text: string, showAlert = false) => {
      if (callbackQueryId) {
        try {
          await callTelegramApi('answerCallbackQuery', {
            callback_query_id: callbackQueryId,
            text,
            show_alert: showAlert
          });
        } catch (e) {
          // ignore
        }
      }
    };

    // --- ADMIN CONTROLS BYPASS ---
    if (isAdmin) {
      // Backup document restore check
      if (update.message?.document) {
        const doc = update.message.document;
        if (doc.file_name && doc.file_name.endsWith('.json')) {
          try {
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: '⏳ **در حال دریافت فایل نسخه پشتیبان و تحلیل ساختار دیتابیس...**',
              parse_mode: 'Markdown'
            });

            const fileInfo = await callTelegramApi('getFile', { file_id: doc.file_id });
            const filePath = fileInfo.file_path;
            
            const fileRes = await fetch(`https://api.telegram.org/file/bot${db.settings.botToken}/${filePath}`);
            const fileContent = await fileRes.text();
            
            const parsed = JSON.parse(fileContent);
            
            if (parsed && (parsed.settings || parsed.sources || parsed.configs)) {
              db = {
                settings: {
                  ...DEFAULT_SETTINGS,
                  ...parsed.settings,
                  adminId: db.settings.adminId, // Keep current adminId
                  botToken: db.settings.botToken // Keep current botToken
                },
                sources: Array.isArray(parsed.sources) ? parsed.sources : db.sources,
                forceJoinChannels: Array.isArray(parsed.forceJoinChannels) ? parsed.forceJoinChannels : db.forceJoinChannels,
                configs: Array.isArray(parsed.configs) ? parsed.configs : db.configs,
                proxies: Array.isArray(parsed.proxies) ? parsed.proxies : db.proxies,
                users: Array.isArray(parsed.users) ? parsed.users : db.users,
                logs: Array.isArray(parsed.logs) ? parsed.logs : db.logs,
                postedMessages: Array.isArray(parsed.postedMessages) ? parsed.postedMessages : (db.postedMessages || [])
              };
              saveDatabase();
              
              await callTelegramApi('sendMessage', {
                chat_id: chatId,
                text: '🔄 **پایگاه داده با موفقیت بازگردانی شد!**\n\nتنظیمات، لیست منابع، کانفیگ‌ها و کاربران ربات با موفقیت به تاریخ نسخه پشتیبان بازیابی شدند.',
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '🔙 ورود به پنل مدیریت', callback_data: 'admin_menu' }]] }
              });
              addLog('success', `پایگاه داده ربات به صورت دستی توسط ادمین از روی فایل بکاپ بازگردانی شد.`);
              return;
            } else {
              await callTelegramApi('sendMessage', {
                chat_id: chatId,
                text: '❌ ساختار فایل پشتیبان ارسالی نامعتبر است یا با این ربات همخوانی ندارد.'
              });
              return;
            }
          } catch (err: any) {
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: `❌ خطا در بازگردانی فایل بکاپ: ${err.message || err}`
            });
            return;
          }
        }
      }

      // 1. Scene State Inputs
      if (adminStates[chatId]) {
        const state = adminStates[chatId];
        
        if (messageText === 'لغو' || messageText === '/cancel') {
          delete adminStates[chatId];
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `❌ عملیات ویرایش لغو گردید.`,
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]] }
          });
          return;
        }

        if (state.action === 'await_branding') {
          if (!messageText || messageText.trim() === '') {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⚠️ لطفاً متن معتبری بفرستید.' });
            return;
          }
          db.settings.branding = messageText.trim();
          saveDatabase();
          delete adminStates[chatId];
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ برندینگ اختصاصی با موفقیت تغییر یافت به:\n\`${db.settings.branding}\``,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]] }
          });
          return;
        }

        if (state.action === 'await_broadcast') {
          if (!messageText || messageText.trim() === '') {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⚠️ متن پیام نمی‌تواند خالی باشد.' });
            return;
          }
          delete adminStates[chatId];
          await callTelegramApi('sendMessage', { chat_id: chatId, text: '⏳ در حال ارسال پیام همگانی به تمامی کاربران ربات...' });
          
          let success = 0;
          let fail = 0;
          for (const user of db.users) {
            try {
              await callTelegramApi('sendMessage', {
                chat_id: user.chatId,
                text: messageText,
                parse_mode: 'Markdown'
              });
              success++;
            } catch {
              fail++;
            }
          }
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `📢 **گزارش ارسال پیام همگانی:**\n\n🟢 ارسال موفق: **${success} کاربر**\n🔴 ارسال ناموفق (بلاک ربات): **${fail} کاربر**`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]] }
          });
          return;
        }

        if (state.action === 'await_add_fj') {
          if (!messageText || messageText.trim() === '') {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⚠️ اطلاعات ارسالی نامعتبر است.' });
            return;
          }
          const parts = messageText.split('|');
          if (parts.length < 2) {
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: '⚠️ فرمت وارد شده صحیح نیست. باید با کاراکتر خط عمودی | جدا کنید:\n`@آیدی_کانال|عنوان_کانال|لینک_دعوت_اختیاری`'
            });
            return;
          }
          const username = parts[0].trim();
          const title = parts[1].trim();
          const inviteLink = parts[2] ? parts[2].trim() : `https://t.me/${username.replace('@', '')}`;

          const newCh: ForceJoinChannel = {
            id: generateId(),
            username: username.startsWith('@') ? username : `@${username}`,
            title,
            inviteLink,
            enabled: true
          };

          db.forceJoinChannels.push(newCh);
          saveDatabase();
          delete adminStates[chatId];
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ کانال حامی با موفقیت ثبت و فعال گردید:\n\n📢 **${title}** (${newCh.username})`,
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به مدیریت کانال‌ها', callback_data: 'admin_fj_list' }]] }
          });
          return;
        }

        if (state.action === 'await_autopost_channel') {
          if (!messageText || messageText.trim() === '') {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⚠️ شناسه کانال هدف نامعتبر است.' });
            return;
          }
          db.settings.autoPost.targetChannel = messageText.trim();
          saveDatabase();
          delete adminStates[chatId];
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ کانال هدف ارسال خودکار با موفقیت به \`${db.settings.autoPost.targetChannel}\` تغییر یافت.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به تنظیمات خودکار', callback_data: 'admin_autopost_menu' }]] }
          });
          return;
        }

        if (state.action === 'await_autopost_text') {
          if (!messageText || messageText.trim() === '') {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⚠️ متن ارسالی نامعتبر است.' });
            return;
          }
          db.settings.autoPost.customText = messageText.trim();
          saveDatabase();
          delete adminStates[chatId];
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ متن توضیحات پست خودکار با موفقیت تغییر یافت.`,
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به تنظیمات خودکار', callback_data: 'admin_autopost_menu' }]] }
          });
          return;
        }
      }

      // 2. Admin Menus & Callback Actions
      if (messageText === '/admin' || callbackData === 'admin_menu') {
        if (callbackQueryId) await answerCallback('پنل مدیریت ⚙️');
        
        const welcome = `⚙️ **پنل فوق‌پیشرفته مدیریت ربات** ⚙️\n\nمدیر گرامی، به مرکز کنترل خوش آمدید.\nاز دکمه‌های شیشه‌ای زیر برای تغییر فوری تنظیمات ربات، پایش لحظه‌ای و تعامل با اعضا استفاده کنید:`;
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: `📊 آمار لحظه‌ای سیستم`, callback_data: 'admin_stats' },
              { text: `${db.settings.isBotRunning ? '🟢 ربات: روشن' : '🔴 ربات: خاموش'}`, callback_data: 'admin_toggle_bot' }
            ],
            [
              { text: `🔄 استخراج فوری همین حالا`, callback_data: 'admin_scrape_now' },
              { text: `🌐 تست اتصال پورت‌ها`, callback_data: 'admin_test_configs' }
            ],
            [
              { text: `📢 عضویت اجباری (Force Join)`, callback_data: 'admin_fj_list' },
              { text: `📝 تنظیم ارسال خودکار`, callback_data: 'admin_autopost_menu' }
            ],
            [
              { text: `🔍 پایش ۵ روزه کانال`, callback_data: 'admin_monitor_menu' },
              { text: `📦 پشتیبانی و بکاپ دیتابیس`, callback_data: 'admin_backup_menu' }
            ],
            [
              { text: `✍️ برندینگ: ${db.settings.branding}`, callback_data: 'admin_edit_branding' }
            ],
            [
              { text: `🧹 پاکسازی دیتابیس`, callback_data: 'admin_cleanup_menu' },
              { text: `📣 ارسال پیام همگانی`, callback_data: 'admin_broadcast_start' }
            ]
          ]
        };

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: welcome,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        return;
      }

      // --- Post Monitoring Menu ---
      if (callbackData === 'admin_monitor_menu') {
        await answerCallback('پایش کانال...');
        const enabled = db.settings.postMonitoringEnabled;
        const postsCount = db.postedMessages ? db.postedMessages.length : 0;

        let msg = `🔍 **تنظیمات پایش خودکار مطالب کانال**\n\n`;
        msg += `این سیستم کانال را تا **۵ روز گذشته** پایش کرده و کانفیگ‌ها و پروکسی‌های غیرفعال‌شده را به حالت **(غیرفعال ❌)** تغییر می‌دهد. همچنین کانفیگی که بهترین پینگ را داشته باشد را ریپلای کرده و مدت زمان فعالیت آن را اعلام می‌کند.\n\n`;
        msg += `وضعیت پایش خودکار: ${enabled ? '🟢 فعال و هوشمند' : '🔴 غیرفعال'}\n`;
        msg += `تعداد پست‌های تحت نظر در ۵ روز گذشته: **${postsCount} پست**\n\n`;
        msg += `می‌توانید وضعیت پایش را تغییر دهید یا همین حالا به صورت دستی پایش را اجرا کنید:`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: `${enabled ? '🔴 غیرفعال‌سازی پایش' : '🟢 فعال‌سازی پایش'}`, callback_data: 'admin_monitor_toggle' }
            ],
            [
              { text: `🚀 اجرای دستی پایش و ویرایش پست‌ها`, callback_data: 'admin_monitor_trigger' }
            ],
            [{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]
          ]
        };

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        return;
      }

      if (callbackData === 'admin_monitor_toggle') {
        db.settings.postMonitoringEnabled = !db.settings.postMonitoringEnabled;
        saveDatabase();
        await answerCallback(`پایش ۵ روزه کانال: ${db.settings.postMonitoringEnabled ? 'روشن' : 'خاموش'}`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_monitor_menu' } });
        return;
      }

      if (callbackData === 'admin_monitor_trigger') {
        await answerCallback('⏳ در حال پایش و اصلاح مطالب کانال...', true);
        await monitorChannelPosts();
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ **عملیات پایش و به‌روزرسانی مطالب کانال با موفقیت انجام شد.**\n\nتمام پست‌های ۵ روز گذشته بررسی، اصلاح و در صورت وجود کانفیگ سالم، ریپلای پایداری اتصال ثبت/به‌روزرسانی گردید.`,
          reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_monitor_menu' }]] }
        });
        return;
      }

      // --- Backup and Restore Menu ---
      if (callbackData === 'admin_backup_menu') {
        await answerCallback('پشتیبان‌گیری دیتابیس...');
        const enabled = db.settings.backupEnabled;
        const interval = db.settings.backupIntervalHours || 24;
        const lastBackup = db.settings.lastBackupAt;

        let msg = `📦 **مدیریت نسخه پشتیبان و بازگردانی دیتابیس (Backup & Restore)**\n\n`;
        msg += `این سیستم می‌تواند دیتابیس کامل ربات (کانال‌ها، کانفیگ‌ها، آمار، کاربران و تنظیمات) را به صورت دوره‌ای بکاپ گرفته و فایل بکاپ را مستقیم در چت شما ارسال کند.\n\n`;
        msg += `وضعیت بکاپ خودکار: ${enabled ? '🟢 فعال' : '🔴 غیرفعال'}\n`;
        msg += `بازه زمانی بکاپ خودکار: **هر ${interval} ساعت**\n`;
        msg += `آخرین پشتیبان‌گیری موفق: **${lastBackup ? new Date(lastBackup).toLocaleString('fa-IR') : 'هنوز ثبت نشده'}**\n\n`;
        msg += `🔄 **راهنمای بازگردانی دیتابیس:**\n`;
        msg += `کافیست فایل بکاپ \`.json\` که قبلا ربات برای شما ارسال کرده را مستقیماً به چت ربات فوروارد کرده یا بفرستید. ربات آن را بررسی و دیتابیس را بازگردانی می‌کند.\n\n`;
        msg += `تنظیمات زیر را انتخاب کنید:`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: `${enabled ? '🔴 غیرفعال‌سازی بکاپ' : '🟢 فعال‌سازی بکاپ'}`, callback_data: 'admin_backup_toggle' },
              { text: `🕒 فاصله: ${interval} ساعت`, callback_data: 'admin_backup_interval_menu' }
            ],
            [
              { text: `📥 دریافت فوری بکاپ همین حالا`, callback_data: 'admin_backup_trigger' }
            ],
            [{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]
          ]
        };

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        return;
      }

      if (callbackData === 'admin_backup_toggle') {
        db.settings.backupEnabled = !db.settings.backupEnabled;
        saveDatabase();
        await answerCallback(`بکاپ خودکار: ${db.settings.backupEnabled ? 'روشن' : 'خاموش'}`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_backup_menu' } });
        return;
      }

      if (callbackData === 'admin_backup_interval_menu') {
        await answerCallback('انتخاب بازه بکاپ...');
        let msg = `🕒 **انتخاب بازه زمانی پشتیبان‌گیری خودکار**\n\nیک بازه زمانی مناسب انتخاب کنید:`;
        const keyboard = {
          inline_keyboard: [
            [
              { text: '⏱ هر ۱ ساعت', callback_data: 'admin_backup_set_1' },
              { text: '⏱ هر ۲ ساعت', callback_data: 'admin_backup_set_2' }
            ],
            [
              { text: '⏱ هر ۶ ساعت', callback_data: 'admin_backup_set_6' },
              { text: '⏱ هر ۱۲ ساعت', callback_data: 'admin_backup_set_12' }
            ],
            [
              { text: '⏱ هر ۲۴ ساعت', callback_data: 'admin_backup_set_24' },
              { text: '⏱ هر ۴۸ ساعت', callback_data: 'admin_backup_set_48' }
            ],
            [{ text: '🔙 انصراف و بازگشت', callback_data: 'admin_backup_menu' }]
          ]
        };

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          reply_markup: keyboard
        });
        return;
      }

      if (callbackData?.startsWith('admin_backup_set_')) {
        const hours = Number(callbackData.replace('admin_backup_set_', ''));
        db.settings.backupIntervalHours = hours;
        saveDatabase();
        await answerCallback(`بازه زمانی بکاپ به ${hours} ساعت تغییر یافت`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_backup_menu' } });
        return;
      }

      if (callbackData === 'admin_backup_trigger') {
        await answerCallback('⏳ در حال ایجاد فایل پشتیبان...', true);
        const success = await sendBackupToAdmin();
        if (success) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ **فایل پشتیبان دیتابیس با موفقیت صادر و بالا ارسال گردید.**`,
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_backup_menu' }]] }
          });
        } else {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `❌ **ارسال فایل پشتیبان با خطا مواجه شد.** لطفا لاگ سیستم را بررسی کنید.`,
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_backup_menu' }]] }
          });
        }
        return;
      }

      // --- Admin Stats ---
      if (callbackData === 'admin_stats') {
        await answerCallback('در حال آماده‌سازی آمار...');
        
        const totalUsers = db.users.length;
        const totalConfigs = db.configs.length;
        const workingConfigsCount = db.configs.filter(c => c.status === 'working').length;
        const failedConfigsCount = db.configs.filter(c => c.status === 'failed').length;
        const untestedConfigs = db.configs.filter(c => c.status === 'untested').length;
        
        const totalProxies = db.proxies ? db.proxies.length : 0;
        const workingProxiesCount = db.proxies ? db.proxies.filter(p => p.status === 'working').length : 0;
        const failedProxiesCount = db.proxies ? db.proxies.filter(p => p.status === 'failed').length : 0;
        const untestedProxies = db.proxies ? db.proxies.filter(p => p.status === 'untested').length : 0;
        
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const extractedTodayCount = db.configs.filter(c => {
          if (!c.lastChecked) return false;
          try { return new Date(c.lastChecked) > oneDayAgo; } catch { return false; }
        }).length + (db.proxies ? db.proxies.filter(p => {
          if (!p.lastChecked) return false;
          try { return new Date(p.lastChecked) > oneDayAgo; } catch { return false; }
        }).length : 0);

        let msg = `📊 **گزارش لحظه‌ای عملکرد ربات و پلتفرم**\n\n`;
        msg += `👥 کل کاربران ربات: **${totalUsers} کاربر**\n`;
        msg += `📥 کدهای استخراج شده امروز: **${extractedTodayCount} مورد**\n\n`;
        msg += `🛡️ **کانفیگ‌های V2Ray (ویتوری):**\n`;
        msg += `🟢 فعال و پاسخ‌ده: **${workingConfigsCount} مورد**\n`;
        msg += `🔴 مسدود/غیرفعال: **${failedConfigsCount} مورد**\n`;
        msg += `⏳ در صف بررسی پورت: **${untestedConfigs} مورد**\n`;
        msg += `📦 کل آرشیو: **${totalConfigs} عدد**\n\n`;
        msg += `🔌 **پروکسی‌های تلگرام (Socks5/MTProto):**\n`;
        msg += `🟢 فعال و پاسخ‌ده: **${workingProxiesCount} مورد**\n`;
        msg += `🔴 مسدود/غیرفعال: **${failedProxiesCount} مورد**\n`;
        msg += `⏳ در صف بررسی پورت: **${untestedProxies} مورد**\n`;
        msg += `📦 کل آرشیو: **${totalProxies} عدد**\n\n`;
        msg += `🕒 زمان سیستم: \`${new Date().toLocaleTimeString('fa-IR')} - ${new Date().toLocaleDateString('fa-IR')}\``;

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]]
          }
        });
        return;
      }

      // --- Toggle Bot Status ---
      if (callbackData === 'admin_toggle_bot') {
        if (db.settings.isBotRunning) {
          stopBot();
          await answerCallback('🔴 ربات متوقف شد');
        } else {
          try {
            await startBot();
            await answerCallback('🟢 ربات روشن شد');
          } catch (e: any) {
            await answerCallback('❌ خطا: ' + e.message, true);
          }
        }
        // Force refresh
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_menu' } });
        return;
      }

      // --- Scrape Now ---
      if (callbackData === 'admin_scrape_now') {
        await answerCallback('⏳ استخراج فوری کل منابع آغاز شد...', true);
        const count = await triggerBulkScrape();
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ **استخراج با موفقیت خاتمه یافت.**\n\nتعداد **${count}** کانفیگ و پروکسی جدید از کانال‌ها و منابع گیت‌هاب دریافت شد.`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🌐 شروع فوری تست پورت‌ها', callback_data: 'admin_test_configs' }],
              [{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]
            ]
          }
        });
        return;
      }

      // --- Test Configs ---
      if (callbackData === 'admin_test_configs') {
        await answerCallback('⏳ تست اتوماتیک اتصال آغاز شد...', true);
        const untestedIds = db.configs.filter(c => c.status === 'untested').map(c => c.id);
        const untestedProxies = (db.proxies || []).filter(p => p.status === 'untested').map(p => p.id);

        if (untestedIds.length > 0) testConfigsBatch(untestedIds).catch(console.error);
        if (untestedProxies.length > 0) testProxiesBatch(untestedProxies).catch(console.error);

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `⏳ **عملیات بررسی پورت‌ها شروع شد.**\n\nتعداد **${untestedIds.length}** کانفیگ ویتوری و **${untestedProxies.length}** پروکسی به صف بررسی متصل شدند.\nآمار بررسی نهایی در بخش آمار سیستم بروز خواهد شد.`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 مشاهده آمار سیستم', callback_data: 'admin_stats' }],
              [{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]
            ]
          }
        });
        return;
      }

      // --- Force Join Channel List ---
      if (callbackData === 'admin_fj_list') {
        await answerCallback('مدیریت حامیان...');
        let msg = `📢 **پیکربندی و مدیریت عضویت اجباری (Force Join)**\n\nکاربر قبل از باز شدن دسترسی باید در کانال‌های زیر عضو شود:\n\n`;
        const keyboard: any[] = [];

        if (db.forceJoinChannels.length === 0) {
          msg += `❌ هیچ کانال حامی ثبت نشده است.`;
        } else {
          db.forceJoinChannels.forEach((ch, idx) => {
            msg += `🔹 ${idx + 1}. **${ch.title}** (${ch.username})\n`;
            msg += `وضعیت: ${ch.enabled ? '🟢 فعال' : '🔴 غیرفعال'}\n`;
            msg += `لینک دعوت: ${ch.inviteLink}\n\n`;
            
            keyboard.push([
              { text: `❌ حذف ${ch.title}`, callback_data: `admin_fj_del_${ch.id}` },
              { text: `${ch.enabled ? '🔴 غیرفعال‌سازی' : '🟢 فعال‌سازی'}`, callback_data: `admin_fj_toggle_${ch.id}` }
            ]);
          });
        }

        keyboard.push([{ text: '➕ افزودن کانال اسپانسر جدید', callback_data: 'admin_fj_add' }]);
        keyboard.push([{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]);

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      if (callbackData === 'admin_fj_add') {
        adminStates[chatId] = { action: 'await_add_fj' };
        await answerCallback('افزودن اسپانسر...');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `➕ **افزودن کانال حامی جدید**\n\nلطفاً اطلاعات کانال را به فرمت دقیق زیر برای من ارسال کنید:\n\n\`@آیدی_کانال|عنوان_نمایشی_کانال|لینک_دعوت_اختیاری\`\n\nمثال:\n\`@MyChannel|کانال رسمی ویتوری|https://t.me/MyChannel\``,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'admin_fj_list' }]]
          }
        });
        return;
      }

      if (callbackData?.startsWith('admin_fj_toggle_')) {
        const id = callbackData.replace('admin_fj_toggle_', '');
        const ch = db.forceJoinChannels.find(c => c.id === id);
        if (ch) {
          ch.enabled = !ch.enabled;
          saveDatabase();
          await answerCallback(`تغییر وضعیت به: ${ch.enabled ? 'فعال' : 'غیرفعال'}`);
        }
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_fj_list' } });
        return;
      }

      if (callbackData?.startsWith('admin_fj_del_')) {
        const id = callbackData.replace('admin_fj_del_', '');
        const idx = db.forceJoinChannels.findIndex(c => c.id === id);
        if (idx !== -1) {
          const name = db.forceJoinChannels[idx].title;
          db.forceJoinChannels.splice(idx, 1);
          saveDatabase();
          await answerCallback(`کانال ${name} حذف شد`);
        }
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_fj_list' } });
        return;
      }

      // --- Edit Branding ---
      if (callbackData === 'admin_edit_branding') {
        adminStates[chatId] = { action: 'await_branding' };
        await answerCallback('تغییر نام برند...');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✍️ **تغییر برندینگ اختصاصی فایل‌ها و کدهای کانفیگ**\n\nلطفاً آیدی کانال یا نام تجاری خود را ارسال کنید (این نام در انتهای کدهای کپی شده قرار می‌گیرد):\n\nبرندینگ فعلی: \`${db.settings.branding}\`\n\nبرای انصراف کلمه **لغو** را بفرستید.`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'admin_menu' }]]
          }
        });
        return;
      }

      // --- Auto Post Menu ---
      if (callbackData === 'admin_autopost_menu') {
        await answerCallback('ارسال خودکار...');
        const ap = db.settings.autoPost;
        let msg = `📝 **تنظیمات سیستم ارسال خودکار به کانال (Auto-Post)**\n\n`;
        msg += `وضعیت ارسال: ${ap.enabled ? '🟢 فعال و اتوماتیک' : '🔴 خاموش'}\n`;
        msg += `کانال هدف: \`${ap.targetChannel || 'تنظیم نشده'}\`\n`;
        msg += `بازه زمانی ارسال: **هر ${ap.postIntervalHours} ساعت**\n`;
        msg += `تعداد کانفیگ ویتوری: **${ap.configCount} عدد**\n`;
        msg += `تعداد پروکسی تلگرام: **${ap.proxyCount} عدد**\n`;
        msg += `ارسال بدون صدا (Silent): **${ap.silentMode ? '🟢 فعال' : '🔴 غیرفعال'}**\n`;
        msg += `آخرین ارسال موفق: **${ap.lastPostedAt ? new Date(ap.lastPostedAt).toLocaleString('fa-IR') : 'هنوز ارسالی ثبت نشده'}**\n\n`;
        msg += `تنظیمات زیر را ویرایش کنید:`;

        const keyboard = [
          [
            { text: `${ap.enabled ? '🔴 خاموش کردن ارسال' : '🟢 روشن کردن ارسال'}`, callback_data: 'admin_ap_toggle' },
            { text: `${ap.silentMode ? '🔴 نوتیفیکیشن‌دار' : '🟢 بدون صدا'}`, callback_data: 'admin_ap_silent' }
          ],
          [
            { text: `📢 کانال هدف: ${ap.targetChannel || 'ثبت نشده'}`, callback_data: 'admin_ap_channel' },
            { text: `🕒 فاصله: ${ap.postIntervalHours} ساعت`, callback_data: 'admin_ap_interval_menu' }
          ],
          [
            { text: `📦 کانفیگ: ${ap.configCount} عدد`, callback_data: 'admin_ap_conf_count' },
            { text: `🔌 پروکسی: ${ap.proxyCount} عدد`, callback_data: 'admin_ap_proxy_count' }
          ],
          [
            { text: `✍️ تغییر متن اصلی پست`, callback_data: 'admin_ap_edit_text' }
          ],
          [
            { text: `🚀 ارسال فوری همین حالا (تست)`, callback_data: 'admin_ap_trigger' }
          ],
          [{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]
        ];

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      // Sub-actions for AutoPost configuration
      if (callbackData === 'admin_ap_toggle') {
        db.settings.autoPost.enabled = !db.settings.autoPost.enabled;
        saveDatabase();
        setupAutoPostInterval();
        await answerCallback(`ارسال خودکار: ${db.settings.autoPost.enabled ? 'روشن' : 'خاموش'}`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_autopost_menu' } });
        return;
      }

      if (callbackData === 'admin_ap_silent') {
        db.settings.autoPost.silentMode = !db.settings.autoPost.silentMode;
        saveDatabase();
        await answerCallback(`حالت بی‌صدا: ${db.settings.autoPost.silentMode ? 'فعال' : 'غیرفعال'}`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_autopost_menu' } });
        return;
      }

      if (callbackData === 'admin_ap_channel') {
        adminStates[chatId] = { action: 'await_autopost_channel' };
        await answerCallback('تنظیم کانال هدف...');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `📢 **تنظیم کانال مقصد ارسال خودکار**\n\nلطفاً شناسه کانال را به همراه علامت @ ارسال کنید (مثال: \`@MyChannel\`):\n\nکانال هدف فعلی: \`${db.settings.autoPost.targetChannel || 'تنظیم نشده'}\`\n\n⚠️ توجه: ربات باید دسترسی ارسال مطلب در این کانال را داشته باشد.`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'admin_autopost_menu' }]]
          }
        });
        return;
      }

      if (callbackData === 'admin_ap_edit_text') {
        adminStates[chatId] = { action: 'await_autopost_text' };
        await answerCallback('ویرایش متن...');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✍️ **ویرایش متن توضیحات پست خودکار**\n\nلطفاً متن جدیدی که دوست دارید در شروع هر پست خودکار قرار بگیرد را بفرستید:\n\nمتن فعلی:\n\`${db.settings.autoPost.customText}\``,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'admin_autopost_menu' }]]
          }
        });
        return;
      }

      if (callbackData === 'admin_ap_interval_menu') {
        await answerCallback('انتخاب بازه...');
        const keyboard = [
          [
            { text: 'هر ۱ ساعت', callback_data: 'admin_ap_set_interval_1' },
            { text: 'هر ۲ ساعت', callback_data: 'admin_ap_set_interval_2' }
          ],
          [
            { text: 'هر ۴ ساعت', callback_data: 'admin_ap_set_interval_4' },
            { text: 'هر ۶ ساعت', callback_data: 'admin_ap_set_interval_6' }
          ],
          [
            { text: 'هر ۱۲ ساعت', callback_data: 'admin_ap_set_interval_12' },
            { text: 'هر ۲۴ ساعت', callback_data: 'admin_ap_set_interval_24' }
          ],
          [{ text: '🔙 بازگشت', callback_data: 'admin_autopost_menu' }]
        ];
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `🕒 **فاصله زمانی ارسال خودکار را انتخاب کنید:**\n\nفاصله فعلی: **هر ${db.settings.autoPost.postIntervalHours} ساعت یکبار**`,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      if (callbackData?.startsWith('admin_ap_set_interval_')) {
        const hrs = parseInt(callbackData.replace('admin_ap_set_interval_', '')) || 4;
        db.settings.autoPost.postIntervalHours = hrs;
        saveDatabase();
        setupAutoPostInterval();
        await answerCallback(`فاصله زمانی به ${hrs} ساعت تغییر یافت.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_autopost_menu' } });
        return;
      }

      if (callbackData === 'admin_ap_conf_count') {
        let count = (db.settings.autoPost.configCount || 0) + 1;
        if (count > 2) count = 0;
        db.settings.autoPost.configCount = count;
        saveDatabase();
        await answerCallback(`تعداد کانفیگ: ${count} عدد`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_autopost_menu' } });
        return;
      }

      if (callbackData === 'admin_ap_proxy_count') {
        let count = (db.settings.autoPost.proxyCount || 0) + 1;
        if (count > 2) count = 0;
        db.settings.autoPost.proxyCount = count;
        saveDatabase();
        await answerCallback(`تعداد پروکسی: ${count} عدد`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_autopost_menu' } });
        return;
      }

      if (callbackData === 'admin_ap_trigger') {
        await answerCallback('⏳ در حال تلاش برای ارسال پست تست...', true);
        const ok = await executeAutoPost();
        if (ok) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ **پست تست با موفقیت به کانال ارسال گردید!**\n\nلطفاً کانال خود (\`${db.settings.autoPost.targetChannel}\`) را بررسی نمایید.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_autopost_menu' }]] }
          });
        } else {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `❌ **ارسال پست تست ناموفق بود.**\n\nمطمئن شوید که ربات ادمین کانال با دسترسی ارسال مطلب است.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_autopost_menu' }]] }
          });
        }
        return;
      }

      // --- Cleanup Menu ---
      if (callbackData === 'admin_cleanup_menu') {
        await answerCallback('پاکسازی...');
        const workingC = db.configs.filter(c => c.status === 'working').length;
        const failedC = db.configs.filter(c => c.status === 'failed').length;
        const workingP = db.proxies ? db.proxies.filter(p => p.status === 'working').length : 0;
        const failedP = db.proxies ? db.proxies.filter(p => p.status === 'failed').length : 0;

        let msg = `🧹 **پاکسازی و تخلیه حافظه کش دیتابیس ربات**\n\n`;
        msg += `📦 کل کانفیگ‌ها: **${workingC} فعال** | **${failedC} مسدود**\n`;
        msg += `🔌 کل پروکسی‌ها: **${workingP} فعال** | **${failedP} مسدود**\n\n`;
        msg += `یکی از گزینه‌های تخلیه را انتخاب کنید:`;

        const keyboard = [
          [
            { text: `🧹 حذف کانفیگ‌های مسدود (${failedC} مورد)`, callback_data: 'admin_clean_failed_configs' }
          ],
          [
            { text: `🧹 حذف پروکسی‌های مسدود (${failedP} مورد)`, callback_data: 'admin_clean_failed_proxies' }
          ],
          [
            { text: `🚨 حذف کل کانفیگ‌ها`, callback_data: 'admin_clean_all_configs' },
            { text: `🚨 حذف کل پروکسی‌ها`, callback_data: 'admin_clean_all_proxies' }
          ],
          [{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]
        ];

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      if (callbackData === 'admin_clean_failed_configs') {
        const before = db.configs.length;
        db.configs = db.configs.filter(c => c.status !== 'failed');
        const diff = before - db.configs.length;
        saveDatabase();
        await answerCallback(`تعداد ${diff} کانفیگ مسدود با موفقیت حذف گردید.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_cleanup_menu' } });
        return;
      }

      if (callbackData === 'admin_clean_failed_proxies') {
        if (!db.proxies) db.proxies = [];
        const before = db.proxies.length;
        db.proxies = db.proxies.filter(p => p.status !== 'failed');
        const diff = before - db.proxies.length;
        saveDatabase();
        await answerCallback(`تعداد ${diff} پروکسی مسدود با موفقیت حذف گردید.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_cleanup_menu' } });
        return;
      }

      if (callbackData === 'admin_clean_all_configs') {
        db.configs = [];
        saveDatabase();
        await answerCallback(`تمامی کانفیگ‌های ویتوری حذف گردید.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_cleanup_menu' } });
        return;
      }

      if (callbackData === 'admin_clean_all_proxies') {
        db.proxies = [];
        saveDatabase();
        await answerCallback(`تمامی پروکسی‌های تلگرام حذف گردید.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_cleanup_menu' } });
        return;
      }

      // --- Broadcast Message Start ---
      if (callbackData === 'admin_broadcast_start') {
        adminStates[chatId] = { action: 'await_broadcast' };
        await answerCallback('پیام همگانی...');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✉️ **ارسال پیام همگانی به کاربران ربات**\n\nلطفاً پیام متنی یا بنر خود را بفرستید تا برای تمامی کاربران دیتابیس ربات ارسال گردد (پشتیبانی از فرمت‌های Markdown مانند لینک و متن ضخیم).\n\nبرای لغو کلمه **لغو** را بفرستید.`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'admin_menu' }]]
          }
        });
        return;
      }
    }
    // --- END ADMIN CONTROLS BYPASS ---

    // If user has not joined mandatory channels, block everything except the join checks
    if (!userHasJoinedAll && notJoinedList.length > 0) {
      if (callbackData === 'check_join_status') {
        // Clear cache and re-evaluate
        delete joinChecksCache[userId];
        await answerCallback('در حال بررسی مجدد عضویت...');
        await handleBotUpdate({
          message: {
            chat: { id: chatId },
            from: { id: userId, username, first_name: firstName },
            text: '/start'
          }
        });
        return;
      }

      // Present join channels message
      let msg = `⚠️ **عضویت اجباری**\n\nکاربر گرامی **${firstName}**، برای استفاده از ربات و دریافت کانفیگ‌های رایگان و پرسرعت، ابتدا باید در کانال‌های اسپانسر ما عضو شوید:\n\n`;
      
      const keyboard: any[] = [];
      notJoinedList.forEach((ch, idx) => {
        msg += `${idx + 1}️⃣ کانال ${ch.title} (${ch.username})\n`;
        const url = ch.inviteLink || `https://t.me/${ch.username.replace('@', '')}`;
        keyboard.push([{ text: `📢 عضویت در کانال ${ch.title}`, url }]);
      });
      
      msg += `\nپس از عضویت در تمامی کانال‌ها، دکمه **تایید عضویت ✅** را در زیر فشار دهید تا ربات برای شما فعال شود.`;
      
      keyboard.push([{ text: '✅ تایید عضویت (بررسی مجدد)', callback_data: 'check_join_status' }]);

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: msg,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
    }

    // --- Action Handlers ---

    // Handle button selections or commands
    const startKeyboard = {
      inline_keyboard: [
        [
          { text: '📥 دریافت کانفیگ V2Ray (ویتوری)', callback_data: 'get_v2ray_configs' },
          { text: '🌀 دریافت کانفیگ NPV تانل', callback_data: 'get_npv_configs' }
        ],
        [
          { text: '🔌 دریافت پروکسی جدید تلگرام', callback_data: 'get_proxies' },
          { text: '📊 وضعیت اتصال و تست نت ایران', callback_data: 'get_net_status' }
        ],
        [
          { text: 'ℹ️ راهنمای اتصال آسان', callback_data: 'get_help' }
        ],
        [
          { text: '⭐ عضویت در کانال‌های ما', url: requiredChannels[0]?.inviteLink || 'https://t.me' }
        ]
      ]
    };

    if (messageText === '/start') {
      const welcome = `سلام ${firstName} عزیز! 🌹\nبه ربات بزرگ استخراج و پخش کانفیگ‌ها و پروکسی‌های کاملاً تست شده و پرسرعت خوش آمدید.\n\nمن هر چند دقیقه کانال‌ها و منابع معتبر را جستجو می‌کنم، پورت‌های آن‌ها را در داخل نت ایران تست می‌کنم و فقط موارد فعال را ارائه می‌دهم.\n\nنوع اتصال درخواستی خود را از منوی زیر انتخاب کنید:`;
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: welcome,
        reply_markup: startKeyboard
      });
      return;
    }

    if (callbackData === 'get_v2ray_configs') {
      await answerCallback('در حال آماده‌سازی کانفیگ‌های ویتوری...');
      
      // Filter configurations
      const available = db.configs.filter(c => c.status === 'working' && ['vmess', 'vless', 'trojan', 'ss'].includes(c.protocol));
      const list = available.length > 0 ? available : db.configs.filter(c => ['vmess', 'vless', 'trojan', 'ss'].includes(c.protocol)).slice(0, 50);

      if (list.length === 0) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '❌ متاسفانه در حال حاضر کانفیگ تست‌شده ویتوری در دیتابیس موجود نیست. تیم ما هم‌اکنون در حال استخراج و بررسی خودکار است. لطفاً چند دقیقه دیگر دوباره امتحان کنید.'
        });
        return;
      }

      // Shuffle and pick 3 configs
      const shuffled = [...list].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 3);
      
      let msg = `📥 **کانفیگ‌های اختصاصی V2Ray**\n`;
      msg += `🔔 اتصال: همراه اول، ایرانسل، مخابرات و وای‌فای خانگی\n`;
      msg += `🏷️ برندینگ انحصاری: \`${db.settings.branding}\`\n\n`;

      selected.forEach((conf, idx) => {
        // Apply custom branding before sending
        const branded = applyBrandingToConfig(conf.raw, db.settings.branding);
        const latencyText = conf.latency ? `(پینگ: ${conf.latency}ms)` : '';
        
        msg += `⚡ **کانفیگ ${idx + 1}** [${conf.protocol.toUpperCase()}] ${latencyText}:\n`;
        msg += `\`${branded}\`\n\n`;
      });

      msg += `📍 جهت کپی روی کانفیگ‌ها ضربه بزنید. سپس در نرم‌افزارهای v2rayNG یا NapsternetV یا Streisand وارد (Import) کنید.\n\n🆔 ${db.settings.branding}`;

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: msg,
        parse_mode: 'Markdown',
        reply_markup: startKeyboard
      });

      // Increment statistics
      const idx = db.users.findIndex(u => u.chatId === chatId);
      if (idx !== -1) db.users[idx].configsFetched += selected.length;
      saveDatabase();
      return;
    }

    if (callbackData === 'get_npv_configs') {
      await answerCallback('در حال آماده‌سازی کانفیگ‌های NPV...');
      
      // Filter NPV configs
      const available = db.configs.filter(c => c.status === 'working' && c.protocol === 'npv');
      const list = available.length > 0 ? available : db.configs.filter(c => c.protocol === 'npv').slice(0, 30);

      if (list.length === 0) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '❌ در حال حاضر کانفیگ NapsternetV (npv://) جدیدی در سیستم ثبت نشده است. هم‌اکنون سیستم در حال پویش است. برای جبران می‌توانید از بخش کانفیگ‌های V2ray در منو استفاده کنید.'
        });
        return;
      }

      // Shuffle and pick 2 configs
      const shuffled = [...list].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 2);

      let msg = `🌀 **کانفیگ‌های اختصاصی NPV Tunnel**\n`;
      msg += `🔒 برای نرم‌افزار NapsternetV در گوشی‌های اندروید و آیفون\n`;
      msg += `🏷️ برندینگ: \`${db.settings.branding}\`\n\n`;

      selected.forEach((conf, idx) => {
        const branded = applyBrandingToConfig(conf.raw, db.settings.branding);
        msg += `💎 **کانفیگ تانل NPV ${idx + 1}**:\n`;
        msg += `\`${branded}\`\n\n`;
      });

      msg += `📍 برای کپی روی متن ضربه بزنید.\n\n🆔 ${db.settings.branding}`;

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: msg,
        parse_mode: 'Markdown',
        reply_markup: startKeyboard
      });

      const idx = db.users.findIndex(u => u.chatId === chatId);
      if (idx !== -1) db.users[idx].configsFetched += selected.length;
      saveDatabase();
      return;
    }

    if (callbackData === 'get_net_status') {
      await answerCallback('در حال محاسبه آمار سیستم...');
      
      const totalCount = db.configs.length;
      const workingCount = db.configs.filter(c => c.status === 'working').length;
      const failedCount = db.configs.filter(c => c.status === 'failed').length;
      const untestedCount = db.configs.filter(c => c.status === 'untested').length;

      let msg = `📊 **وضعیت لحظه‌ای شبکه و کانفیگ‌ها**\n\n`;
      msg += `🟢 کانفیگ‌های فعال (تست شده در نت ایران): **${workingCount} مورد**\n`;
      msg += `🔴 کانفیگ‌های نامناسب/مسدود: **${failedCount} مورد**\n`;
      msg += `⏳ در انتظار بررسی پورت: **${untestedCount} مورد**\n`;
      msg += `📦 کل آرشیو منابع: **${totalCount} کانفیگ**\n\n`;
      msg += `💻 تمام کانفیگ‌ها قبل از ارائه، از نظر اتصال TCP و پاسخ‌دهی سرور چک می‌شوند تا اتصال پایداری را تجربه کنید.`;

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: msg,
        parse_mode: 'Markdown',
        reply_markup: startKeyboard
      });
      return;
    }

    if (callbackData === 'get_help') {
      await answerCallback('راهنما...');
      
      let msg = `ℹ️ **راهنمای گام به گام اتصال به فیلترشکن**\n\n`;
      msg += `1️⃣ **دانلود برنامه کلاینت:**\n`;
      msg += `▫️ اندروید: نرم‌افزار **v2rayNG** یا **NapsternetV** از گوگل پلی\n`;
      msg += `▫️ آیفون (iOS): نرم‌افزار **Streisand** یا **NapsternetV** یا **FoXray** از اپ استور\n`;
      msg += `▫️ ویندوز: نرم‌افزار **v2rayN** یا **NekoBox**\n\n`;
      msg += `2️⃣ **نحوه کپی و وارد کردن کانفیگ:**\n`;
      msg += `▫️ روی کانفیگ ارسال شده در ربات ضربه بزنید تا کپی شود.\n`;
      msg += `▫️ وارد برنامه v2rayNG شوید، علامت + را در بالای صفحه بزنید و دکمه "Import config from Clipboard" را انتخاب کنید.\n\n`;
      msg += `3️⃣ **اتصال نهایی:**\n`;
      msg += `▫️ روی کانفیگ اضافه شده بزنید تا انتخاب شود (سبز رنگ شود) و سپس دکمه دایره شکل اتصال در پایین را بفشارید.`;

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: msg,
        reply_markup: startKeyboard
      });
      return;
    }

    if (callbackData === 'get_proxies') {
      await answerCallback('در حال آماده‌سازی پروکسی‌های فعال...');
      
      const list = (db.proxies || []).filter(p => p.status === 'working');
      const fallbackList = (db.proxies || []).slice(0, 30);
      const available = list.length > 0 ? list : fallbackList;

      if (available.length === 0) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '❌ متاسفانه در حال حاضر پروکسی تست‌شده‌ای در دیتابیس یافت نشد. تیم ما در حال استخراج و بررسی خودکار است. لطفاً چند دقیقه دیگر دوباره امتحان کنید.'
        });
        return;
      }

      // Shuffle and pick 4 proxies
      const shuffled = [...available].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 4);

      let msg = `🔌 **پروکسی‌های پرسرعت و تست‌شده تلگرام**\n\n`;
      msg += `✨ اتصال آسان و امن بدون نیاز به فیلترشکن اضافه!\n`;
      msg += `🏷️ برندینگ: \`${db.settings.branding}\`\n\n`;
      msg += `👇 برای اتصال به هر پروکسی، روی یکی از دکمه‌های شیشه‌ای زیر کلیک کنید:`;

      const proxyButtons: any[] = [];
      for (let i = 0; i < selected.length; i++) {
        const p = selected[i];
        const loc = await getIpLocation(p.server);
        const flag = getFlagEmoji(loc.countryCode);
        const pingText = p.latency ? `⚡ پینگ: ${p.latency}ms` : 'سرعت بالا 🚀';
        
        proxyButtons.push([{
          text: `🔌 پروکسی ${p.type.toUpperCase()} | ${pingText} (${loc.country} ${flag})`,
          url: p.raw
        }]);
      }
      
      proxyButtons.push([{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main' }]);

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: msg,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: proxyButtons }
      });
      return;
    }

    if (callbackData === 'back_to_main') {
      await answerCallback('منوی اصلی');
      const welcome = `نوع اتصال درخواستی خود را از منوی زیر انتخاب کنید:`;
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: welcome,
        reply_markup: startKeyboard
      });
      return;
    }

    // Default reply to unrecognized text message
    if (messageText) {
      const defaultMsg = `⚠️ متوجه دستور نشدم.\nبرای شروع کار ربات و دریافت منوی هوشمند، دستور /start را تایپ کنید و یا از دکمه‌های شیشه‌ای بالا استفاده نمایید.`;
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: defaultMsg,
        reply_markup: startKeyboard
      });
    }

  } catch (err: any) {
    console.error('Error handling Telegram update:', err);
  }
}

/**
 * Stop Bot Polling
 */
function stopBot() {
  pollingActive = false;
  if (botTimeoutRef) clearTimeout(botTimeoutRef);
  db.settings.isBotRunning = false;
  saveDatabase();
  addLog('warn', 'ربات تلگرام متوقف شد.');
}

/**
 * Start Bot Polling
 */
async function startBot() {
  if (pollingActive) return;
  const token = db.settings.botToken;
  if (!token) {
    addLog('error', 'خطا در فعال‌سازی ربات: توکن تعریف نشده است.');
    return;
  }

  try {
    addLog('info', 'در حال اتصال به سرورهای تلگرام...');
    const username = await testBotConnection(token);
    db.settings.botUsername = username;
    db.settings.isBotRunning = true;
    pollingActive = true;
    saveDatabase();
    
    // Start asynchronous loop
    runBotPolling();
    
    addLog('success', `ربات با موفقیت فعال شد و در حال شنود است: @${username}`);
  } catch (err: any) {
    db.settings.isBotRunning = false;
    pollingActive = false;
    saveDatabase();
    addLog('error', `ارتباط با توکن تلگرام برقرار نشد: ${err.message}`);
    throw err;
  }
}

// --- Background Intervals (Auto Extract & Auto Test) ---
let extractIntervalRef: NodeJS.Timeout | null = null;
let testIntervalRef: NodeJS.Timeout | null = null;
let monitorIntervalRef: NodeJS.Timeout | null = null;
let backupIntervalRef: NodeJS.Timeout | null = null;

function setupIntervals() {
  if (extractIntervalRef) clearInterval(extractIntervalRef);
  if (testIntervalRef) clearInterval(testIntervalRef);
  if (monitorIntervalRef) clearInterval(monitorIntervalRef);
  if (backupIntervalRef) clearInterval(backupIntervalRef);

  const mins = db.settings.autoExtractInterval || 30;
  
  // Scrape interval
  extractIntervalRef = setInterval(() => {
    addLog('info', 'اجرای خودکار استخراج دوره‌ای کانفیگ‌ها از منابع فعال...');
    triggerBulkScrape();
  }, mins * 60 * 1000);

  // Auto test interval (every 10 minutes test untested ones)
  testIntervalRef = setInterval(() => {
    if (db.settings.autoTest) {
      const untestedIds = db.configs
        .filter(c => c.status === 'untested')
        .slice(0, 100)
        .map(c => c.id);
      
      const untestedProxies = (db.proxies || [])
        .filter(p => p.status === 'untested')
        .slice(0, 50)
        .map(p => p.id);
      
      if (untestedIds.length > 0) {
        addLog('info', 'اجرای خودکار تست بر روی کانفیگ‌های جدید...');
        testConfigsBatch(untestedIds);
      }

      if (untestedProxies.length > 0) {
        addLog('info', 'اجرای خودکار تست بر روی پروکسی‌های جدید...');
        testProxiesBatch(untestedProxies);
      }
    }
  }, 10 * 60 * 1000);

  // Post monitoring check (every 15 minutes)
  monitorIntervalRef = setInterval(() => {
    monitorChannelPosts();
  }, 15 * 60 * 1000);

  // Backup check (every 15 minutes)
  backupIntervalRef = setInterval(() => {
    checkAndTriggerBackup();
  }, 15 * 60 * 1000);

  // Set up auto post interval
  setupAutoPostInterval();

  // Run initial checks shortly after startup
  setTimeout(() => {
    monitorChannelPosts();
    checkAndTriggerBackup();
  }, 10 * 1000);
}

// Initialize background schedules
setupIntervals();

// Start bot if token exists in saved DB
if (db.settings.botToken) {
  startBot().catch(() => {});
}

// --- API Routing Logic ---
async function startExpressServer() {
  const app = express();
  app.use(express.json());

  // API: Stats
  app.get('/api/stats', (req, res) => {
    const totalUsers = db.users.length;
    const totalConfigs = db.configs.length;
    const workingConfigsCount = db.configs.filter(c => c.status === 'working').length;
    const failedConfigsCount = db.configs.filter(c => c.status === 'failed').length;
    
    if (!db.proxies) db.proxies = [];
    const totalProxies = db.proxies.length;
    const workingProxiesCount = db.proxies.filter(p => p.status === 'working').length;
    const failedProxiesCount = db.proxies.filter(p => p.status === 'failed').length;

    const telegramChannelsCount = db.sources.filter(s => s.type === 'telegram').length;
    const subsCount = db.sources.filter(s => s.type !== 'telegram').length;

    // Extracted today calculation
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const extractedTodayCount = db.configs.filter(c => {
      if (!c.lastChecked) return false;
      try {
        return new Date(c.lastChecked) > oneDayAgo;
      } catch {
        return false;
      }
    }).length;

    res.json({
      totalUsers,
      totalConfigs,
      workingConfigsCount,
      failedConfigsCount,
      totalProxies,
      workingProxiesCount,
      failedProxiesCount,
      telegramChannelsCount,
      subsCount,
      extractedTodayCount
    } as DashboardStats);
  });

  // API: Get Settings
  app.get('/api/settings', (req, res) => {
    res.json(db.settings);
  });

  // API: Save Settings
  app.post('/api/settings', async (req, res) => {
    try {
      const oldToken = db.settings.botToken;
      const { adminId, botToken, branding, autoTest, autoExtractInterval } = req.body;
      
      if (adminId !== undefined) {
        db.settings.adminId = adminId;
      }
      db.settings.branding = branding || '@MyChannelConfigs';
      db.settings.autoTest = !!autoTest;
      db.settings.autoExtractInterval = Number(autoExtractInterval) || 30;

      let reconnectNeeded = false;
      if (botToken !== undefined && botToken !== oldToken) {
        db.settings.botToken = botToken;
        reconnectNeeded = true;
      }

      saveDatabase();
      addLog('success', 'تنظیمات سیستم با موفقیت بروزرسانی شد.');

      // Setup intervals again in case interval changed
      setupIntervals();

      if (reconnectNeeded) {
        stopBot();
        if (db.settings.botToken) {
          try {
            await startBot();
          } catch(e: any) {
            return res.status(400).json({ 
              success: false, 
              message: `تنظیمات ذخیره شد، اما اتصال ربات با خطا مواجه گردید: ${e.message}`,
              settings: db.settings
            });
          }
        }
      }

      res.json({ success: true, settings: db.settings });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Get Sources
  app.get('/api/sources', (req, res) => {
    res.json(db.sources);
  });

  // API: Add Source
  app.post('/api/sources', (req, res) => {
    const { type, name, urlOrHandle } = req.body;
    if (!type || !name || !urlOrHandle) {
      return res.status(400).json({ success: false, message: 'پر کردن تمامی فیلدها الزامی است.' });
    }

    const newSource: SourceItem = {
      id: generateId(),
      type,
      name,
      urlOrHandle,
      enabled: true,
      extractedCount: 0,
      lastExtracted: null
    };

    db.sources.push(newSource);
    saveDatabase();
    addLog('success', `منبع جدید ثبت شد: ${name} (${type})`);
    res.json({ success: true, source: newSource });
  });

  // API: Toggle/Edit Source
  app.post('/api/sources/:id/toggle', (req, res) => {
    const { id } = req.params;
    const src = db.sources.find(s => s.id === id);
    if (!src) {
      return res.status(404).json({ success: false, message: 'منبع یافت نشد.' });
    }

    src.enabled = !src.enabled;
    saveDatabase();
    addLog('info', `منبع ${src.name} ${src.enabled ? 'فعال' : 'غیرفعال'} شد.`);
    res.json({ success: true, source: src });
  });

  // API: Delete Source
  app.delete('/api/sources/:id', (req, res) => {
    const { id } = req.params;
    const index = db.sources.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'منبع یافت نشد.' });
    }

    const name = db.sources[index].name;
    db.sources.splice(index, 1);
    saveDatabase();
    addLog('warn', `منبع حذف گردید: ${name}`);
    res.json({ success: true });
  });

  // API: Manual Scrape Single Source
  app.post('/api/sources/:id/extract', async (req, res) => {
    const { id } = req.params;
    const src = db.sources.find(s => s.id === id);
    if (!src) {
      return res.status(404).json({ success: false, message: 'منبع یافت نشد.' });
    }

    try {
      const count = await scrapeSource(src);
      res.json({ success: true, extractedCount: count });
    } catch(err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Bulk Scrape All Sources
  app.post('/api/sources/extract-all', async (req, res) => {
    try {
      addLog('info', 'اجرای دستی استخراج همگانی کانفیگ‌ها...');
      const count = await triggerBulkScrape();
      res.json({ success: true, extractedCount: count });
    } catch(err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Force Join Channels
  app.get('/api/force-join', (req, res) => {
    res.json(db.forceJoinChannels);
  });

  // API: Add Force Join Channel
  app.post('/api/force-join', (req, res) => {
    const { username, title, inviteLink } = req.body;
    if (!username || !title) {
      return res.status(400).json({ success: false, message: 'شناسه و عنوان کانال اجباری است.' });
    }

    const cleanUsername = username.startsWith('@') ? username : `@${username}`;
    const newChannel: ForceJoinChannel = {
      id: generateId(),
      username: cleanUsername,
      title,
      inviteLink: inviteLink || `https://t.me/${cleanUsername.replace('@', '')}`,
      enabled: true
    };

    db.forceJoinChannels.push(newChannel);
    saveDatabase();
    addLog('success', `کانال عضویت اجباری اضافه شد: ${title} (${cleanUsername})`);
    res.json({ success: true, channel: newChannel });
  });

  // API: Toggle Force Join Channel
  app.post('/api/force-join/:id/toggle', (req, res) => {
    const { id } = req.params;
    const channel = db.forceJoinChannels.find(c => c.id === id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'کانال یافت نشد.' });
    }

    channel.enabled = !channel.enabled;
    saveDatabase();
    addLog('info', `عضویت اجباری کانال ${channel.title} ${channel.enabled ? 'فعال' : 'غیرفعال'} شد.`);
    res.json({ success: true, channel });
  });

  // API: Delete Force Join Channel
  app.delete('/api/force-join/:id', (req, res) => {
    const { id } = req.params;
    const idx = db.forceJoinChannels.findIndex(c => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'کانال یافت نشد.' });
    }

    const title = db.forceJoinChannels[idx].title;
    db.forceJoinChannels.splice(idx, 1);
    saveDatabase();
    addLog('warn', `کانال عضویت اجباری حذف شد: ${title}`);
    res.json({ success: true });
  });

  // API: Get Configs
  app.get('/api/configs', (req, res) => {
    // Limit to latest 1000 for client safety and performance
    res.json(db.configs.slice(0, 1000));
  });

  // API: Test All Configs
  app.post('/api/configs/test-all', (req, res) => {
    const ids = db.configs.map(c => c.id);
    if (ids.length === 0) {
      return res.json({ success: true, message: 'هیچ کانفیگی جهت تست موجود نیست.' });
    }

    // Async run to not block express response
    testConfigsBatch(ids);
    res.json({ success: true, message: 'تست اتصال همگانی در پس‌زمینه آغاز شد.' });
  });

  // API: Clear Failed Configs
  app.delete('/api/configs/failed', (req, res) => {
    const countBefore = db.configs.length;
    db.configs = db.configs.filter(c => c.status !== 'failed');
    const removedCount = countBefore - db.configs.length;
    saveDatabase();
    addLog('warn', `تعداد ${removedCount} کانفیگ غیرفعال (خراب) از آرشیو پاکسازی شد.`);
    res.json({ success: true, removedCount });
  });

  // API: Clear All Configs
  app.delete('/api/configs/all', (req, res) => {
    const count = db.configs.length;
    db.configs = [];
    saveDatabase();
    addLog('warn', `آرشیو کلی کانفیگ‌ها کاملا پاکسازی شد. (تعداد ${count} کانفیگ حذف شد)`);
    res.json({ success: true });
  });

  // API: Get Proxies
  app.get('/api/proxies', (req, res) => {
    if (!db.proxies) db.proxies = [];
    res.json(db.proxies.slice(0, 1000));
  });

  // API: Test All Proxies
  app.post('/api/proxies/test-all', (req, res) => {
    if (!db.proxies) db.proxies = [];
    const ids = db.proxies.map(p => p.id);
    if (ids.length === 0) {
      return res.json({ success: true, message: 'هیچ پروکسی جهت تست موجود نیست.' });
    }

    testProxiesBatch(ids);
    res.json({ success: true, message: 'تست اتصال همگانی پروکسی‌ها در پس‌زمینه آغاز شد.' });
  });

  // API: Clear Failed Proxies
  app.delete('/api/proxies/failed', (req, res) => {
    if (!db.proxies) db.proxies = [];
    const countBefore = db.proxies.length;
    db.proxies = db.proxies.filter(p => p.status !== 'failed');
    const removedCount = countBefore - db.proxies.length;
    saveDatabase();
    addLog('warn', `تعداد ${removedCount} پروکسی غیرفعال از آرشیو پاکسازی شد.`);
    res.json({ success: true, removedCount });
  });

  // API: Clear All Proxies
  app.delete('/api/proxies/all', (req, res) => {
    if (!db.proxies) db.proxies = [];
    const count = db.proxies.length;
    db.proxies = [];
    saveDatabase();
    addLog('warn', `آرشیو کلی پروکسی‌ها پاکسازی شد. (تعداد ${count} پروکسی حذف شد)`);
    res.json({ success: true });
  });

  // API: Save Auto-Post settings
  app.post('/api/settings/auto-post', (req, res) => {
    try {
      const { enabled, targetChannel, postIntervalHours, configCount, proxyCount, customText, adText, silentMode } = req.body;
      
      db.settings.autoPost = {
        enabled: !!enabled,
        targetChannel: targetChannel || '',
        postIntervalHours: Number(postIntervalHours) || 4,
        configCount: Number(configCount) || 1,
        proxyCount: Number(proxyCount) || 1,
        customText: customText || '',
        adText: adText || '',
        silentMode: !!silentMode,
        lastPostedAt: db.settings.autoPost?.lastPostedAt || null
      };

      saveDatabase();
      addLog('success', 'تنظیمات ارسال خودکار پست با موفقیت بروزرسانی شد.');
      
      // Update intervals/timers
      setupAutoPostInterval();
      
      res.json({ success: true, autoPost: db.settings.autoPost });
    } catch(err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Trigger Auto-Post manually
  app.post('/api/bot/auto-post/trigger', async (req, res) => {
    try {
      const success = await executeAutoPost();
      if (success) {
        res.json({ success: true, message: 'پست با موفقیت به کانال ارسال گردید.' });
      } else {
        res.status(400).json({ success: false, message: 'ارسال پست با خطا مواجه شد. جزئیات را در بخش گزارشات بررسی کنید.' });
      }
    } catch(err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Get Logs
  app.get('/api/logs', (req, res) => {
    res.json(db.logs);
  });

  // API: Clear Logs
  app.delete('/api/logs', (req, res) => {
    db.logs = [];
    saveDatabase();
    res.json({ success: true });
  });

  // API: Get Bot Users
  app.get('/api/users', (req, res) => {
    res.json(db.users);
  });

  // API: Broadcast Message
  app.post('/api/broadcast', async (req, res) => {
    const { message } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'پیام ارسال‌شده خالی است.' });
    }

    if (!db.settings.botToken) {
      return res.status(400).json({ success: false, message: 'ربات غیرفعال است (توکن ثبت نشده).' });
    }

    if (db.users.length === 0) {
      return res.json({ success: true, message: 'هیچ کاربری در ربات تلگرام عضو نیست.' });
    }

    addLog('info', `آغاز ارسال پیام همگانی به تعداد ${db.users.length} کاربر عضو ربات...`);

    // Async deliver to not lock API response
    (async () => {
      let successCount = 0;
      let errorCount = 0;

      for (const user of db.users) {
        try {
          await callTelegramApi('sendMessage', {
            chat_id: user.chatId,
            text: message,
            parse_mode: 'Markdown'
          });
          successCount++;
          // Minimal delay to prevent API flooding limits
          await new Promise(r => setTimeout(r, 60));
        } catch (e) {
          errorCount++;
        }
      }

      addLog('success', `پیام همگانی با موفقیت ارسال شد. ارسال موفق: ${successCount}، خطا: ${errorCount}`);
    })();

    res.json({ success: true, totalUsersCount: db.users.length });
  });

  // API: Bot Status Toggle
  app.post('/api/bot/toggle', async (req, res) => {
    try {
      if (pollingActive) {
        stopBot();
        res.json({ success: true, isBotRunning: false });
      } else {
        await startBot();
        res.json({ success: true, isBotRunning: true });
      }
    } catch(err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Vite middleware setup for Development vs Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startExpressServer().catch(err => {
  console.error('Failed to start Express server:', err);
});
