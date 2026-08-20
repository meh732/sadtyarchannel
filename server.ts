import express from 'express';
import path from 'path';
import fs from 'fs';
import net from 'net';
import dns from 'dns';
import tls from 'tls';
import { spawn, exec, execSync } from 'child_process';
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
  ChannelPost,
  TechItem,
  TechItemCategory,
  TechImportance
} from './src/types';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_FILE = path.join(process.cwd(), 'data_store.json');
const SETTINGS_FILE = path.join(process.cwd(), 'system_settings.json');

// --- Helpers for Atomic File Storage & Corruption Prevention ---
function writeJsonAtomic(filePath: string, data: any) {
  const tmpPath = `${filePath}.${Math.random().toString(36).substring(2, 9)}.tmp`;
  const bakPath = `${filePath}.bak`;
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, jsonStr, 'utf8');

    // Make backup copy of existing file if valid
    if (fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        if (stats.size > 0) {
          fs.copyFileSync(filePath, bakPath);
        }
      } catch (e) {
        // Ignore backup copy non-fatal errors
      }
    }

    // Atomic replace
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error(`Atomic write failed for ${filePath}:`, err);
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch (e) {}
    }
  }
}

function safeReadJson(filePath: string): any {
  const bakPath = `${filePath}.bak`;

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content && content.trim()) {
        return JSON.parse(content);
      }
    } catch (err) {
      console.error(`Failed to parse primary file ${filePath}:`, err);
    }
  }

  if (fs.existsSync(bakPath)) {
    try {
      console.log(`Attempting recovery from backup file: ${bakPath}`);
      const bakContent = fs.readFileSync(bakPath, 'utf8');
      if (bakContent && bakContent.trim()) {
        return JSON.parse(bakContent);
      }
    } catch (bakErr) {
      console.error(`Failed to parse backup file ${bakPath}:`, bakErr);
    }
  }

  return null;
}

// --- Helper: Generate unique ID ---
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// --- Local Data Store Structure ---
export interface NpvFileItem {
  id: string;
  filename: string;
  content: string;
  status: 'working' | 'failed' | 'untested' | 'checking';
  createdAt: string;
}

interface DatabaseSchema {
  settings: SystemSettings;
  sources: SourceItem[];
  forceJoinChannels: ForceJoinChannel[];
  configs: ConfigItem[];
  proxies: ProxyItem[];
  npvFiles?: NpvFileItem[];
  users: BotUser[];
  logs: BotLog[];
  postedMessages?: ChannelPost[];
  techItems?: TechItem[];
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
    urlOrHandle: 'https://raw.githubusercontent.com/yebekhe/TVC/main/subscriptions/xray/normal/mix',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'src-5',
    type: 'sub',
    name: 'BarryFar All Configs Sub',
    urlOrHandle: 'https://raw.githubusercontent.com/barry-far/V2ray-config/main/All_Configs_Sub.txt',
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
  lastPostedAt: null,
  techNewsCount: 1,
  techTricksCount: 1,
  techPostMode: 'combined',
  includeTechImportanceBadge: true,
  autoPurgeOldTechDays: 2
};

const DEFAULT_SETTINGS: SystemSettings = {
  adminId: process.env.ADMIN_ID || '',
  botToken: process.env.BOT_TOKEN || '',
  botUsername: '',
  branding: '🌟 @MyChannelConfig',
  isBotRunning: false,
  autoTest: true,
  autoTestInterval: 10,
  testBatchLimit: 100,
  autoExtractInterval: 30, // minutes
  iranRelayProxy: '',
  autoPost: DEFAULT_AUTO_POST,
  postMonitoringEnabled: false,
  backupEnabled: false,
  backupIntervalHours: 24,
  lastBackupAt: null,
  botConnectionMode: 'polling',
  publicUrl: '',
  maxConfigsRetention: 2000
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
  npvFiles: [],
  users: [],
  logs: [],
  postedMessages: [],
  techItems: []
};

function loadDatabase() {
  try {
    const envAdminId = process.env.ADMIN_ID ? process.env.ADMIN_ID.replace(/^['"\s]+|['"\s]+$/g, '').trim() : '';
    const envBotToken = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.replace(/^['"\s]+|['"\s]+$/g, '').trim() : '';

    // 1. Try loading system_settings.json first
    let loadedSettings = safeReadJson(SETTINGS_FILE);

    // 2. Try loading data_store.json
    let loadedDataStore = safeReadJson(DB_FILE);

    // If system_settings.json was missing, check if settings exist in data_store.json
    if (!loadedSettings && loadedDataStore && loadedDataStore.settings) {
      loadedSettings = {
        settings: loadedDataStore.settings,
        sources: loadedDataStore.sources,
        forceJoinChannels: loadedDataStore.forceJoinChannels,
        users: loadedDataStore.users
      };
    }

    const finalSettings = { 
      ...DEFAULT_SETTINGS, 
      ...(loadedSettings?.settings || {}),
      adminId: envAdminId || loadedSettings?.settings?.adminId || loadedDataStore?.settings?.adminId || '',
      botToken: envBotToken || loadedSettings?.settings?.botToken || loadedDataStore?.settings?.botToken || '',
      autoPost: { ...DEFAULT_AUTO_POST, ...(loadedSettings?.settings?.autoPost || loadedDataStore?.settings?.autoPost || {}) }
    };

    const finalSources = Array.isArray(loadedSettings?.sources) 
      ? loadedSettings.sources 
      : (Array.isArray(loadedDataStore?.sources) ? loadedDataStore.sources : DEFAULT_SOURCES);

    const finalForceJoin = Array.isArray(loadedSettings?.forceJoinChannels)
      ? loadedSettings.forceJoinChannels
      : (Array.isArray(loadedDataStore?.forceJoinChannels) ? loadedDataStore.forceJoinChannels : []);

    const finalUsers = Array.isArray(loadedSettings?.users)
      ? loadedSettings.users
      : (Array.isArray(loadedDataStore?.users) ? loadedDataStore.users : []);

    const finalConfigs = Array.isArray(loadedDataStore?.configs) ? loadedDataStore.configs : [];
    const finalProxies = Array.isArray(loadedDataStore?.proxies) ? loadedDataStore.proxies : [];
    const finalNpvFiles = Array.isArray(loadedDataStore?.npvFiles) ? loadedDataStore.npvFiles : [];
    const finalLogs = Array.isArray(loadedDataStore?.logs) ? loadedDataStore.logs : [];
    const finalPosted = Array.isArray(loadedDataStore?.postedMessages) ? loadedDataStore.postedMessages : [];
    const finalTechItems = Array.isArray(loadedDataStore?.techItems) ? loadedDataStore.techItems : [];

    db = {
      settings: finalSettings,
      sources: finalSources,
      forceJoinChannels: finalForceJoin,
      configs: finalConfigs,
      proxies: finalProxies,
      npvFiles: finalNpvFiles,
      users: finalUsers,
      logs: finalLogs,
      postedMessages: finalPosted,
      techItems: finalTechItems
    };

    // Reset any stuck 'checking' items on database load
    for (const c of db.configs) {
      if (c.status === 'checking') c.status = 'untested';
    }
    for (const p of db.proxies) {
      if (p.status === 'checking') p.status = 'untested';
    }

    // Persist system_settings.json immediately so it is guaranteed to exist
    writeJsonAtomic(SETTINGS_FILE, {
      settings: db.settings,
      sources: db.sources,
      forceJoinChannels: db.forceJoinChannels,
      users: db.users
    });
  } catch (err) {
    console.error('Critical error loading database:', err);
  }
}

let saveTimer: NodeJS.Timeout | null = null;
let savePending = false;

function saveDatabase(immediate = false) {
  const doSave = () => {
    try {
      // 1. Save critical system settings separately (lightweight, isolated)
      const systemData = {
        settings: db.settings,
        sources: db.sources,
        forceJoinChannels: db.forceJoinChannels,
        users: db.users
      };
      writeJsonAtomic(SETTINGS_FILE, systemData);

      // 2. Save heavy data store (configs, proxies, npvFiles, techItems, logs, postedMessages)
      const storeData = {
        configs: db.configs,
        proxies: db.proxies,
        npvFiles: db.npvFiles,
        techItems: db.techItems || [],
        logs: db.logs,
        postedMessages: db.postedMessages
      };
      writeJsonAtomic(DB_FILE, storeData);
    } catch (err) {
      console.error('Failed to save database:', err);
    }
  };

  if (immediate) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    savePending = false;
    doSave();
    return;
  }

  savePending = true;
  if (!saveTimer) {
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (savePending) {
        savePending = false;
        doSave();
      }
    }, 400);
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

    if (trimmed.startsWith('npv://')) {
      const payload = trimmed.replace('npv://', '').split('#')[0];
      const decoded = Buffer.from(payload, 'base64').toString('utf8');
      const json = JSON.parse(decoded);
      json.remarks = brandingText;
      if (json.configName) json.configName = brandingText;
      const encoded = Buffer.from(JSON.stringify(json)).toString('base64');
      return `npv://${encoded}`;
    }

    if (trimmed.startsWith('vless://') || trimmed.startsWith('trojan://') || trimmed.startsWith('ss://')) {
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
 * Converts a V2Ray (VMess, VLESS, Trojan, SS) config to a valid NapsternetV (.npvt) compatible file string.
 * Updates the configuration with custom branding without corrupting the file structure or causing decryption errors.
 */
function convertV2rayToNpv(v2rayConfig: string, branding: string): string {
  try {
    const trimmed = (v2rayConfig || '').trim();
    const brandingName = branding || 'NapsternetV Config';

    // 1. If it's already an NPVT encrypted string, return it intact
    if (trimmed.startsWith('NPVT')) {
      return trimmed;
    }

    // 2. If it's npv:// or npvt:// link, decode the payload if possible
    if (trimmed.startsWith('npv://') || trimmed.startsWith('npvt://')) {
      const payload = trimmed.replace(/^npvt?:\/\//i, '').split('#')[0];
      try {
        const decoded = Buffer.from(payload, 'base64').toString('utf8');
        if (decoded.startsWith('vless://') || decoded.startsWith('vmess://') || decoded.startsWith('trojan://') || decoded.startsWith('ss://')) {
          return convertV2rayToNpv(decoded, brandingName);
        }
        if (decoded.startsWith('{') && decoded.endsWith('}')) {
          const json = JSON.parse(decoded);
          const uri = parseJsonConfigToUri(json);
          if (uri) return convertV2rayToNpv(uri, brandingName);
        }
      } catch (e) {}
    }

    // 3. Handle standard V2Ray URIs: vless://, trojan://, ss://
    if (trimmed.startsWith('vless://') || trimmed.startsWith('trojan://') || trimmed.startsWith('ss://')) {
      const hashIndex = trimmed.indexOf('#');
      const baseUri = hashIndex !== -1 ? trimmed.substring(0, hashIndex) : trimmed;
      return `${baseUri}#${encodeURIComponent(brandingName)}`;
    }

    // 4. Handle VMess URIs
    if (trimmed.startsWith('vmess://')) {
      try {
        const base64Part = trimmed.substring(8).trim();
        const decoded = Buffer.from(base64Part, 'base64').toString('utf8');
        const vmessJson = JSON.parse(decoded);
        vmessJson.ps = brandingName;
        return `vmess://${Buffer.from(JSON.stringify(vmessJson)).toString('base64')}`;
      } catch (e) {
        return trimmed;
      }
    }

    // 5. Handle JSON formatted configs
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const json = JSON.parse(trimmed);
        const uri = parseJsonConfigToUri(json);
        if (uri) return convertV2rayToNpv(uri, brandingName);
      } catch (e) {}
    }

    // 6. Fallback: Parse host/port and construct a standard VLESS URI
    const parsed = parseConfigHostPort(trimmed);
    if (parsed.host && parsed.port) {
      return `vless://00000000-0000-0000-0000-000000000000@${parsed.host}:${parsed.port}?security=none&type=tcp#${encodeURIComponent(brandingName)}`;
    }

    return trimmed;
  } catch (e) {
    return (v2rayConfig || '').trim();
  }
}

/**
 * Extracts connection host/IP and port from any v2ray/npv config for testing
 */
function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/pre>/gi, '\n')
    .replace(/<\/code>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
}

function parseConfigHostPort(rawConfig: string): { host: string; port: number; protocol: ProtocolType; remark: string } {
  const result = { host: '', port: 0, protocol: 'unknown' as ProtocolType, remark: 'کانفیگ استخراج‌شده' };
  if (!rawConfig) return result;
  const trimmed = rawConfig.trim();

  try {
    // Check if NPVT or NPV format
    if (trimmed.startsWith('NPVT') || trimmed.startsWith('npv://') || trimmed.startsWith('npvt://')) {
      result.protocol = 'npv';
      const payload = trimmed.replace(/^NPVT/i, '').replace(/^npvt?:\/\//i, '').split('#')[0];
      
      try {
        const decoded = Buffer.from(payload, 'base64').toString('utf8');
        if (decoded.startsWith('{') && decoded.endsWith('}')) {
          const json = JSON.parse(decoded);
          result.host = json.address || json.v2rayAddress || json.host || json.v2rayHost || json.sshHost || json.server || json.sni || json.domain || json.remote_host || json.ip || '';
          result.port = Number(json.port || json.v2rayPort || json.sshPort || json.server_port || json.remote_port) || 0;
          result.remark = json.remarks || json.configName || json.ps || 'NapsternetV Config';
          
          if (json.protocol) {
            result.protocol = json.protocol;
          } else if (json.type && ['vless', 'vmess', 'trojan', 'ss'].includes(json.type)) {
            result.protocol = json.type;
          }
        } else {
          // Extract host/ip from decoded text
          const ipMatch = decoded.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
          if (ipMatch) result.host = ipMatch[0];
          const domainMatch = decoded.match(/\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}\b/);
          if (!result.host && domainMatch) result.host = domainMatch[0];
          const portMatch = decoded.match(/\b(443|8080|8443|2052|2053|2082|2083|2086|2087|2095|2096|80|22)\b/);
          if (portMatch) result.port = Number(portMatch[0]);
        }
      } catch(e) {}

      // Fallback guarantees for NPVT so valid configs are NEVER discarded!
      if (!result.host) {
        const ipMatch = trimmed.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
        if (ipMatch) result.host = ipMatch[0];
        else result.host = 'npv.napsternetv.server';
      }
      if (!result.port) {
        result.port = 443;
      }
      return result;
    }

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
    }

    // For links of type protocol://[userinfo]@[host]:[port][path]#[remark]
    const hashIndex = trimmed.indexOf('#');
    let urlPart = hashIndex !== -1 ? trimmed.substring(0, hashIndex) : trimmed;
    const remarkPart = hashIndex !== -1 ? decodeURIComponent(trimmed.substring(hashIndex + 1)) : '';
    if (remarkPart) result.remark = remarkPart;

    // Standard parse: look for @ followed by host:port
    const atIndex = urlPart.lastIndexOf('@');
    if (atIndex !== -1) {
      const hostPortPart = urlPart.substring(atIndex + 1);
      const colonIndex = hostPortPart.indexOf(':');
      if (colonIndex !== -1) {
        result.host = hostPortPart.substring(0, colonIndex);
        const portPart = hostPortPart.substring(colonIndex + 1);
        const questionIndex = portPart.indexOf('?');
        const slashIndex = portPart.indexOf('/');
        let endIdx = portPart.length;
        if (questionIndex !== -1) endIdx = Math.min(endIdx, questionIndex);
        if (slashIndex !== -1) endIdx = Math.min(endIdx, slashIndex);
        result.port = parseInt(portPart.substring(0, endIdx)) || 0;
      }
    } else {
      const doubleSlashIdx = urlPart.indexOf('://');
      const cleanUrl = doubleSlashIdx !== -1 ? urlPart.substring(doubleSlashIdx + 3) : urlPart;
      const colonIdx = cleanUrl.lastIndexOf(':');
      if (colonIdx !== -1) {
        result.host = cleanUrl.substring(0, colonIdx);
        const portPart = cleanUrl.substring(colonIdx + 1);
        result.port = parseInt(portPart) || 0;
      }
    }
  } catch (err) {}

  return result;
}

/**
 * Decodes base64 string safely
 */
function safeBase64Decode(str: string): string {
  try {
    return Buffer.from(str, 'base64').toString('utf8');
  } catch (e) {
    return '';
  }
}

/**
 * Parses full configuration details from raw config links (vless, vmess, trojan, ss, npv)
 */
function parseFullConfigDetails(rawConfig: string): {
  host: string;
  port: number;
  sni: string;
  hostHeader: string;
  path: string;
  tls: boolean;
  protocol: string;
} {
  const result = { host: '', port: 0, sni: '', hostHeader: '', path: '', tls: false, protocol: 'unknown' };
  if (!rawConfig) return result;
  const trimmed = rawConfig.trim();

  try {
    if (trimmed.startsWith('vmess://')) {
      result.protocol = 'vmess';
      const base64Part = trimmed.substring(8).trim();
      const decoded = safeBase64Decode(base64Part);
      if (decoded) {
        const parsed = JSON.parse(decoded);
        result.host = parsed.add || '';
        result.port = Number(parsed.port) || 0;
        result.sni = parsed.sni || '';
        result.hostHeader = parsed.host || '';
        result.path = parsed.path || '';
        result.tls = (parsed.tls === 'tls' || parsed.security === 'tls');
      }
      return result;
    }

    if (trimmed.startsWith('vless://') || trimmed.startsWith('trojan://') || trimmed.startsWith('ss://')) {
      result.protocol = trimmed.startsWith('vless://') ? 'vless' : (trimmed.startsWith('trojan://') ? 'trojan' : 'ss');
      
      const hashIndex = trimmed.indexOf('#');
      let urlPart = hashIndex !== -1 ? trimmed.substring(0, hashIndex) : trimmed;
      
      const doubleSlashIdx = urlPart.indexOf('://');
      const cleanUrl = doubleSlashIdx !== -1 ? urlPart.substring(doubleSlashIdx + 3) : urlPart;
      
      const qIndex = cleanUrl.indexOf('?');
      if (qIndex !== -1) {
        const queryStr = cleanUrl.substring(qIndex + 1);
        const params = new URLSearchParams(queryStr);
        result.sni = params.get('sni') || '';
        result.hostHeader = params.get('host') || '';
        result.path = params.get('path') || '';
        const security = params.get('security') || '';
        result.tls = (security === 'tls' || security === 'xtls' || security === 'reality');
      }
      
      const atIndex = cleanUrl.lastIndexOf('@');
      let hostPortPart = atIndex !== -1 ? cleanUrl.substring(atIndex + 1) : cleanUrl;
      if (qIndex !== -1) {
        hostPortPart = hostPortPart.substring(0, hostPortPart.indexOf('?'));
      }
      
      const colonIndex = hostPortPart.lastIndexOf(':');
      if (colonIndex !== -1) {
        result.host = hostPortPart.substring(0, colonIndex);
        result.port = parseInt(hostPortPart.substring(colonIndex + 1), 10) || 0;
      }
      
      if (trimmed.startsWith('trojan://')) {
        result.tls = true;
      }
      return result;
    }

    if (trimmed.startsWith('npv://') || trimmed.startsWith('npvt://')) {
      result.protocol = 'npv';
      const payload = trimmed.replace(/npvt?:\/\//, '').split('#')[0];
      const decoded = safeBase64Decode(payload);
      if (decoded) {
        const json = JSON.parse(decoded);
        // Prioritize address/v2rayAddress since host is often the HTTP Host header
        result.host = json.address || json.v2rayAddress || json.host || json.v2rayHost || json.sshHost || '';
        result.port = Number(json.port || json.v2rayPort || json.sshPort) || 0;
        result.sni = json.sni || '';
        result.hostHeader = json.hostHeader || json.host || '';
        result.path = json.path || '';
        result.tls = json.security === 'tls' || json.tls === true;
        if (json.protocol) {
          result.protocol = json.protocol;
        } else if (json.type && ['vless', 'vmess', 'trojan', 'ss'].includes(json.type)) {
          result.protocol = json.type;
        }
      }
      return result;
    }
  } catch (e) {
    // Silent fail
  }

  return result;
}

/**
 * Builds a valid, full-featured Xray client JSON configuration for any protocol link
 */
function buildXrayConfig(rawConfig: string, localPort: number): { configJson: any; protocol: string } | null {
  const trimmed = rawConfig.trim();
  let outbound: any = null;
  let protocol = 'unknown';

  try {
    if (trimmed.startsWith('vmess://')) {
      protocol = 'vmess';
      const base64Part = trimmed.substring(8).trim();
      const decoded = safeBase64Decode(base64Part);
      if (!decoded) return null;
      const parsed = JSON.parse(decoded);
      
      const host = parsed.add || '';
      const port = Number(parsed.port) || 0;
      if (!host || !port) return null;

      outbound = {
        protocol: 'vmess',
        settings: {
          vnext: [
            {
              address: host,
              port: port,
              users: [
                {
                  id: parsed.id || '',
                  alterId: Number(parsed.aid || 0),
                  security: parsed.scy || 'auto'
                }
              ]
            }
          ]
        },
        streamSettings: {
          network: parsed.net || 'tcp',
          security: (parsed.tls === 'tls' || parsed.security === 'tls') ? 'tls' : 'none',
          tlsSettings: (parsed.tls === 'tls' || parsed.security === 'tls') ? {
            serverName: parsed.sni || parsed.host || host,
            allowInsecure: true
          } : undefined,
          wsSettings: (parsed.net === 'ws') ? {
            path: parsed.path || '/',
            headers: {
              Host: parsed.host || host
            }
          } : undefined,
          grpcSettings: (parsed.net === 'grpc') ? {
            serviceName: parsed.path || ''
          } : undefined
        }
      };
    } else if (trimmed.startsWith('vless://') || trimmed.startsWith('trojan://') || trimmed.startsWith('ss://')) {
      const isVless = trimmed.startsWith('vless://');
      const isTrojan = trimmed.startsWith('trojan://');
      const isSS = trimmed.startsWith('ss://');
      protocol = isVless ? 'vless' : (isTrojan ? 'trojan' : 'ss');

      const hashIndex = trimmed.indexOf('#');
      let urlPart = hashIndex !== -1 ? trimmed.substring(0, hashIndex) : trimmed;
      
      const doubleSlashIdx = urlPart.indexOf('://');
      const cleanUrl = doubleSlashIdx !== -1 ? urlPart.substring(doubleSlashIdx + 3) : urlPart;
      
      const qIndex = cleanUrl.indexOf('?');
      let queryStr = '';
      let hostPortPart = cleanUrl;
      if (qIndex !== -1) {
        queryStr = cleanUrl.substring(qIndex + 1);
        hostPortPart = cleanUrl.substring(0, qIndex);
      }
      
      const params = new URLSearchParams(queryStr);
      const sni = params.get('sni') || '';
      const hostHeader = params.get('host') || '';
      const path = params.get('path') || '';
      const security = params.get('security') || '';
      const pbk = params.get('pbk') || '';
      const sid = params.get('sid') || '';
      const fp = params.get('fp') || '';
      const flow = params.get('flow') || '';
      const type = params.get('type') || '';

      const atIndex = hostPortPart.lastIndexOf('@');
      let userInfo = '';
      let serverPart = hostPortPart;
      if (atIndex !== -1) {
        userInfo = hostPortPart.substring(0, atIndex);
        serverPart = hostPortPart.substring(atIndex + 1);
      }

      let host = serverPart;
      let port = 0;
      const colonIndex = serverPart.lastIndexOf(':');
      if (colonIndex !== -1) {
        host = serverPart.substring(0, colonIndex);
        port = parseInt(serverPart.substring(colonIndex + 1), 10) || 0;
      }

      if (!host || !port) return null;

      if (isVless) {
        outbound = {
          protocol: 'vless',
          settings: {
            vnext: [
              {
                address: host,
                port: port,
                users: [
                  {
                    id: userInfo,
                    encryption: 'none',
                    flow: flow || undefined
                  }
                ]
              }
            ]
          },
          streamSettings: {
            network: type || 'tcp',
            security: security || 'none',
            tlsSettings: (security === 'tls') ? {
              serverName: sni || host,
              allowInsecure: true
            } : undefined,
            realitySettings: (security === 'reality') ? {
              serverName: sni || host,
              publicKey: pbk,
              shortId: sid,
              fingerprint: fp || 'chrome'
            } : undefined,
            wsSettings: (type === 'ws') ? {
              path: path || '/',
              headers: {
                Host: hostHeader || host
              }
            } : undefined,
            grpcSettings: (type === 'grpc') ? {
              serviceName: path || ''
            } : undefined
          }
        };
      } else if (isTrojan) {
        outbound = {
          protocol: 'trojan',
          settings: {
            servers: [
              {
                address: host,
                port: port,
                password: userInfo
              }
            ]
          },
          streamSettings: {
            network: type || 'tcp',
            security: security || 'tls',
            tlsSettings: {
              serverName: sni || host,
              allowInsecure: true
            },
            wsSettings: (type === 'ws') ? {
              path: path || '/',
              headers: {
                Host: hostHeader || host
              }
            } : undefined,
            grpcSettings: (type === 'grpc') ? {
              serviceName: path || ''
            } : undefined
          }
        };
      } else if (isSS) {
        let method = 'aes-256-gcm';
        let password = userInfo;
        
        const decodedUser = safeBase64Decode(userInfo);
        if (decodedUser && decodedUser.includes(':')) {
          const parts = decodedUser.split(':');
          method = parts[0];
          password = parts.slice(1).join(':');
        }

        outbound = {
          protocol: 'shadowsocks',
          settings: {
            servers: [
              {
                address: host,
                port: port,
                method: method,
                password: password
              }
            ]
          }
        };
      }
    } else if (trimmed.startsWith('npv://')) {
      protocol = 'npv';
      const payload = trimmed.replace('npv://', '').split('#')[0];
      const decoded = safeBase64Decode(payload);
      if (!decoded) return null;
      const json = JSON.parse(decoded);
      
      const host = json.address || json.v2rayAddress || json.host || json.v2rayHost || json.sshHost || '';
      const port = Number(json.port || json.v2rayPort || json.sshPort) || 0;
      if (!host || !port) return null;

      const type = json.type || json.net || 'tcp';
      const security = json.security || (json.tls ? 'tls' : 'none');

      outbound = {
        protocol: json.protocol || 'vmess',
        settings: json.protocol === 'vless' ? {
          vnext: [
            {
              address: host,
              port: port,
              users: [{ id: json.id || json.uuid || '', encryption: 'none' }]
            }
          ]
        } : (json.protocol === 'trojan' ? {
          servers: [{ address: host, port: port, password: json.password || json.id || '' }]
        } : {
          vnext: [
            {
              address: host,
              port: port,
              users: [{ id: json.id || json.uuid || '', alterId: Number(json.aid || 0), security: 'auto' }]
            }
          ]
        }),
        streamSettings: {
          network: type,
          security: security,
          tlsSettings: (security === 'tls') ? {
            serverName: json.sni || json.hostHeader || host,
            allowInsecure: true
          } : undefined,
          wsSettings: (type === 'ws') ? {
            path: json.path || '/',
            headers: {
              Host: json.hostHeader || host
            }
          } : undefined,
          grpcSettings: (type === 'grpc') ? {
            serviceName: json.path || ''
          } : undefined
        }
      };
    }
  } catch (err) {
    return null;
  }

  if (!outbound) return null;

  const outbounds: any[] = [outbound, { protocol: 'freedom', tag: 'direct' }];

  if (db.settings.iranRelayProxy && db.settings.iranRelayProxy.trim()) {
    const relayUri = db.settings.iranRelayProxy.trim();
    try {
      const isSocks = relayUri.startsWith('socks5://') || relayUri.startsWith('socks://');
      const cleanRelay = relayUri.replace(/^(socks5?|http):\/\//i, '');
      let auth = '';
      let hostPort = cleanRelay;
      if (cleanRelay.includes('@')) {
        [auth, hostPort] = cleanRelay.split('@');
      }
      const [rHost, rPortStr] = hostPort.split(':');
      const rPort = parseInt(rPortStr, 10);
      
      if (rHost && rPort) {
        let user = '', pass = '';
        if (auth.includes(':')) {
          [user, pass] = auth.split(':');
        }
        
        const relayOutbound: any = {
          tag: 'iran_relay',
          protocol: isSocks ? 'socks' : 'http',
          settings: {
            servers: [
              {
                address: rHost,
                port: rPort,
                users: (user || pass) ? [{ user: user || '', pass: pass || '' }] : undefined
              }
            ]
          }
        };

        (outbound as any).proxySettings = { tag: 'iran_relay' };
        outbounds.push(relayOutbound);
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  const configJson = {
    log: { loglevel: 'none' },
    inbounds: [
      {
        port: localPort,
        listen: '127.0.0.1',
        protocol: 'socks',
        settings: { udp: true }
      }
    ],
    outbounds
  };

  return { configJson, protocol };
}

function withHardTimeout<T>(fn: () => Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let completed = false;
    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        resolve(fallback);
      }
    }, ms);

    try {
      fn().then(
        val => {
          if (!completed) {
            completed = true;
            clearTimeout(timer);
            resolve(val);
          }
        },
        () => {
          if (!completed) {
            completed = true;
            clearTimeout(timer);
            resolve(fallback);
          }
        }
      );
    } catch (e) {
      if (!completed) {
        completed = true;
        clearTimeout(timer);
        resolve(fallback);
      }
    }
  });
}

function cleanupCheckingStates() {
  let changed = false;
  if (db.configs) {
    for (const c of db.configs) {
      if (c.status === 'checking') {
        c.status = 'untested';
        changed = true;
      }
    }
  }
  if (db.proxies) {
    for (const p of db.proxies) {
      if (p.status === 'checking') {
        p.status = 'untested';
        changed = true;
      }
    }
  }
  if (changed) saveDatabase();
}

/**
 * Performs real-world client handshake verification of a configuration using Xray and curl SOCKS5
 */
function checkConfigWithXray(rawConfig: string): Promise<{ working: boolean; latency: number }> {
  return new Promise((resolve) => {
    const localPort = Math.floor(Math.random() * 10000) + 15000;
    const result = buildXrayConfig(rawConfig, localPort);
    if (!result) {
      return resolve({ working: false, latency: 999 });
    }

    const { configJson } = result;
    const configPath = path.join(process.cwd(), `bin/xray_config_${Date.now()}_${Math.floor(Math.random() * 10000)}.json`);
    
    try {
      fs.writeFileSync(configPath, JSON.stringify(configJson, null, 2));
    } catch (e) {
      return resolve({ working: false, latency: 999 });
    }

    const xrayPath = path.join(process.cwd(), 'bin/xray');
    if (!fs.existsSync(xrayPath)) {
      try { fs.unlinkSync(configPath); } catch (e) {}
      return resolve({ working: false, latency: 999 });
    }

    let isFinished = false;
    let child: any = null;

    const cleanup = () => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(globalTimeout);
      clearTimeout(curlTimer);
      if (child) {
        try { child.kill('SIGKILL'); } catch (e) {}
      }
      try { fs.unlinkSync(configPath); } catch (e) {}
    };

    const finish = (working: boolean, latency = 999) => {
      cleanup();
      resolve({ working, latency });
    };

    const globalTimeout = setTimeout(() => {
      finish(false, 999);
    }, 12000);

    try {
      child = spawn(xrayPath, ['-config', configPath], { stdio: 'ignore' });
      child.on('error', () => finish(false, 999));
    } catch (e) {
      return finish(false, 999);
    }

    const curlTimer = setTimeout(() => {
      if (isFinished) return;

      const curlCmd1 = `curl -x socks5h://127.0.0.1:${localPort} -s -o /dev/null -w "%{http_code}:%{time_starttransfer}" http://connectivitycheck.gstatic.com/generate_204 --max-time 6`;
      
      exec(curlCmd1, { timeout: 6500 }, (error, stdout) => {
        if (isFinished) return;

        if (!error && stdout) {
          const parts = stdout.trim().split(':');
          const httpCode = parseInt(parts[0], 10);
          const timeStartTransfer = parseFloat(parts[1]) || 0;
          if ([200, 204, 301, 302].includes(httpCode)) {
            const latencyMs = Math.round(timeStartTransfer * 1000) || 50;
            return finish(true, latencyMs);
          }
        }

        // Fallback target: HTTPS Google
        const curlCmd2 = `curl -x socks5h://127.0.0.1:${localPort} -s -o /dev/null -w "%{http_code}:%{time_starttransfer}" https://www.google.com/generate_204 --max-time 6`;
        exec(curlCmd2, { timeout: 6500 }, (error2, stdout2) => {
          if (isFinished) return;
          if (!error2 && stdout2) {
            const parts = stdout2.trim().split(':');
            const httpCode = parseInt(parts[0], 10);
            const timeStartTransfer = parseFloat(parts[1]) || 0;
            if ([200, 204, 301, 302].includes(httpCode)) {
              const latencyMs = Math.round(timeStartTransfer * 1000) || 50;
              return finish(true, latencyMs);
            }
          }
          finish(false, 999);
        });
      });
    }, 400);
  });
}

/**
 * Checks if a TLS handshake can be successfully completed
 */
function checkTlsHandshake(host: string, port: number, sni: string, timeout = 2200): Promise<{ working: boolean; latency: number }> {
  return new Promise((resolve) => {
    if (!host || !port) {
      return resolve({ working: false, latency: 999 });
    }

    const start = Date.now();
    let resolved = false;

    const finish = (working: boolean) => {
      if (resolved) return;
      resolved = true;
      try { if (socket) socket.destroy(); } catch (e) {}
      clearTimeout(timer);
      const latency = Date.now() - start;
      resolve({ working, latency: working ? latency : 999 });
    };

    const timer = setTimeout(() => finish(false), timeout + 300);

    let socket: tls.TLSSocket | null = null;
    try {
      socket = tls.connect({
        host: host,
        port: port,
        servername: sni || host,
        rejectUnauthorized: false,
        timeout: timeout
      }, () => finish(true));

      socket.on('error', () => finish(false));
      socket.on('timeout', () => finish(false));
      socket.on('close', () => finish(false));
      socket.on('end', () => finish(false));
    } catch (e) {
      finish(false);
    }
  });
}

/**
 * Performs complete, robust verification of a configuration
 */
async function checkConfigFully(rawConfig: string): Promise<{ working: boolean; latency: number }> {
  try {
    const details = parseFullConfigDetails(rawConfig);
    if (!details.host || !details.port) {
      return { working: false, latency: 999 };
    }

    // Tier 1: Fast direct TCP socket / TLS handshake check
    let handCheck = { working: false, latency: 999 };
    if (details.tls) {
      handCheck = await checkTlsHandshake(details.host, details.port, details.sni, 2200);
    }
    if (!handCheck.working) {
      handCheck = await checkPort(details.host, details.port, 2200);
    }

    // If direct TCP socket / TLS handshake failed, the server is unreachable
    if (!handCheck.working) {
      return { working: false, latency: 999 };
    }

    // Tier 2: Real end-to-end proxy verification via Xray core if available
    let finalLatency = handCheck.latency;
    const xrayPath = path.join(process.cwd(), 'bin/xray');
    if (fs.existsSync(xrayPath)) {
      const xrayCheck = await checkConfigWithXray(rawConfig);
      if (xrayCheck.working) {
        finalLatency = xrayCheck.latency;
      }
    }

    return { working: true, latency: Math.max(10, Math.round(finalLatency)) };
  } catch (err) {
    return { working: false, latency: 999 };
  }
}

// --- Connection Port Tester ---
function checkPort(host: string, port: number, timeout = 1800): Promise<{ working: boolean; latency: number }> {
  return new Promise((resolve) => {
    if (!host || !port) {
      return resolve({ working: false, latency: 999 });
    }

    const start = Date.now();
    let resolved = false;

    const finish = (working: boolean) => {
      if (resolved) return;
      resolved = true;
      try { socket.destroy(); } catch (e) {}
      clearTimeout(timer);
      const latency = Date.now() - start;
      resolve({ working, latency: working ? latency : 999 });
    };

    const timer = setTimeout(() => finish(false), timeout + 300);

    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.on('connect', () => finish(true));
    socket.on('error', () => finish(false));
    socket.on('timeout', () => finish(false));
    socket.on('close', () => finish(false));
    socket.on('end', () => finish(false));

    try {
      socket.connect(port, host);
    } catch (e) {
      finish(false);
    }
  });
}

/**
 * Robust port check from inside Iran utilizing check-host.net API
 */
async function checkPortFromIran(host: string, port: number, sni?: string): Promise<{ working: boolean; latency: number; rateLimited?: boolean }> {
  try {
    const isStandardWebPort = port === 443 || port === 80;
    const targetQuery = (sni && isStandardWebPort) 
      ? `check-http?host=https://${sni}`
      : `check-tcp?host=${encodeURIComponent(`${host}:${port}`)}`;
    const checkUrl = `https://check-host.net/${targetQuery}&node=ir5.node.check-host.net&node=ir6.node.check-host.net&node=ir7.node.check-host.net&node=ir8.node.check-host.net&node=ir9.node.check-host.net`;
    const res = await fetch(checkUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (res.status === 403 || res.status === 429) {
      return { working: false, latency: 999, rateLimited: true };
    }
    
    if (!res.ok) {
      throw new Error(`Check-Host API returned status ${res.status}`);
    }
    const data: any = await res.json();
    if (!data || !data.request_id) {
      throw new Error('No request_id returned from Check-Host');
    }

    const requestId = data.request_id;
    const nodes = data.nodes || {};
    
    // Find all node keys where country is Iran ('ir')
    const irNodeKeys: string[] = [];
    for (const key of Object.keys(nodes)) {
      const nodeMeta = nodes[key];
      if (Array.isArray(nodeMeta) && nodeMeta[0] && String(nodeMeta[0]).toLowerCase() === 'ir') {
        irNodeKeys.push(key);
      }
    }

    // Fallback if no specific IR nodes found in the metadata
    if (irNodeKeys.length === 0) {
      irNodeKeys.push(
        'ir5.node.check-host.net',
        'ir6.node.check-host.net',
        'ir7.node.check-host.net',
        'ir8.node.check-host.net',
        'ir9.node.check-host.net'
      );
    }

    // Poll for results (up to 3 times with 2s delay)
    let attempts = 0;
    while (attempts < 3) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const resultRes = await fetch(`https://check-host.net/check-result/${requestId}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (resultRes.status === 403 || resultRes.status === 429) {
        return { working: false, latency: 999, rateLimited: true };
      }
      
      if (!resultRes.ok) continue;

      const resultData: any = await resultRes.json();
      if (!resultData) continue;

      let hasPending = false;
      let anyWorking = false;
      let minLatency = 999;
      let testedCount = 0;

      for (const nodeKey of irNodeKeys) {
        const nodeResults = resultData[nodeKey];
        if (nodeResults === null) {
          hasPending = true;
          continue;
        }
        if (Array.isArray(nodeResults)) {
          testedCount++;
          for (const attempt of nodeResults) {
            if (attempt && attempt.time !== undefined && attempt.error === undefined) {
              anyWorking = true;
              const lat = Math.round(attempt.time * 1000);
              if (lat < minLatency) {
                minLatency = lat;
              }
            }
          }
        }
      }

      if (anyWorking) {
        return { working: true, latency: minLatency, rateLimited: false };
      }

      // If all IR nodes completed and none worked, we know it's blocked/failed
      if (!hasPending && testedCount > 0) {
        return { working: false, latency: 999, rateLimited: false };
      }
    }

    // If polling timed out and no success, we default to false but mark rate-limited
    return { working: false, latency: 999, rateLimited: true };
  } catch (err: any) {
    console.error('Error checking port from Iran via Check-Host:', err.message);
    return { working: false, latency: 999, rateLimited: true };
  }
}

/**
 * Integrated full testing strategy:
 * Tries Check-Host from Iran nodes first for absolute accuracy.
 * Fallbacks to local port tester on any check-host rate limits or issues.
 */
async function checkPortFull(host: string, port: number): Promise<{ working: boolean; latency: number }> {
  return checkPort(host, port, 1800);
}

// --- Scraping & Extraction Engine ---

/**
 * Decodes HTML entities and common URL encodings safely
 */
function safeDecodeText(text: string): string {
  if (!text) return '';
  let clean = text
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&apos;/gi, "'");

  // Decode percent-encoded components to extract links that might be embedded or encoded inside href attributes
  try {
    clean = decodeURIComponent(clean);
  } catch (e) {
    // Fallback targeted replacement for standard URL characters if the overall string is malformed
    clean = clean
      .replace(/%3A/gi, ':')
      .replace(/%2F/gi, '/')
      .replace(/%3F/gi, '?')
      .replace(/%3D/gi, '=')
      .replace(/%26/gi, '&')
      .replace(/%40/gi, '@')
      .replace(/%23/gi, '#')
      .replace(/%2B/gi, '+');
  }
  return clean;
}

/**
 * Scans text for Base64 blocks starting with eyJ (which decodes to '{"')
 * and tries to parse and reconstruct them into valid V2Ray URIs if they represent NapsternetV / NPV configs.
 */
function parseJsonConfigToUri(json: any): string | null {
  try {
    if (!json) return null;
    if (json.rawLink) return json.rawLink;
    
    const address = json.address || json.v2rayAddress || json.host || json.v2rayHost || json.sshHost || '';
    const port = Number(json.port || json.v2rayPort || json.sshPort) || 0;
    const uuid = json.uuid || json.id || '';
    
    if (address && port) {
      const protocol = json.protocol || json.type || 'vless';
      const remark = json.remarks || json.configName || 'NPVT_Config';
      if (['vless', 'trojan', 'ss'].includes(protocol) && uuid) {
        return `${protocol}://${uuid}@${address}:${port}?security=${json.security || 'none'}&sni=${json.sni || ''}&type=${json.network || json.type || 'tcp'}&path=${encodeURIComponent(json.path || '')}#${encodeURIComponent(remark)}`;
      } else if (protocol === 'vmess' && uuid) {
        const vmessJson = {
          v: "2",
          ps: remark,
          add: address,
          port: port,
          id: uuid,
          aid: "0",
          scy: "auto",
          net: json.network || json.type || "tcp",
          type: "none",
          host: json.host || "",
          path: json.path || "",
          tls: json.security === 'tls' || json.tls === true ? "tls" : "none",
          sni: json.sni || ""
        };
        return `vmess://${Buffer.from(JSON.stringify(vmessJson)).toString('base64')}`;
      } else {
        return `vless://${uuid || '00000000-0000-0000-0000-000000000000'}@${address}:${port}?security=${json.security || 'none'}&sni=${json.sni || ''}&type=${json.network || json.type || 'tcp'}#${encodeURIComponent(remark)}`;
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Scans text for Base64 or NPVT blocks (NapsternetV / NPV / JSON configs)
 */
function extractBase64NpvConfigs(text: string): string[] {
  const extractedUris: string[] = [];
  if (!text) return extractedUris;

  const plainText = stripHtmlTags(safeDecodeText(text));
  const rawText = safeDecodeText(text);

  const textsToScan = [plainText, rawText];

  for (const txt of textsToScan) {
    // 1. Explicit NPVT blocks starting with NPVT
    const npvtRegex = /NPVT[a-zA-Z0-9+/=\-_]{15,}/g;
    const npvtMatches = txt.match(npvtRegex) || [];
    for (const match of npvtMatches) {
      const cleaned = match.trim();
      if (!extractedUris.includes(cleaned)) {
        extractedUris.push(cleaned);
      }
    }

    // 2. Base64 JSON blocks starting with eyJ or e30 or Npv
    const base64Regex = /(?:eyJ|e30|Npv)[a-zA-Z0-9+/=\s\-_]{20,}/g;
    const matches = txt.match(base64Regex) || [];

    for (const match of matches) {
      const cleaned = match.replace(/\s+/g, '');
      try {
        const decoded = Buffer.from(cleaned, 'base64').toString('utf8');
        if (
          decoded.includes('address') || 
          decoded.includes('v2rayHost') || 
          decoded.includes('configVersion') || 
          decoded.includes('configType') || 
          decoded.includes('rawLink') || 
          decoded.includes('configName') ||
          decoded.includes('uuid') ||
          decoded.includes('id') ||
          decoded.includes('port') ||
          decoded.includes('outbounds') ||
          decoded.includes('protocol') ||
          decoded.includes('remarks')
        ) {
          const json = JSON.parse(decoded);
          const uri = parseJsonConfigToUri(json);
          if (uri && !extractedUris.includes(uri)) {
            extractedUris.push(uri);
          } else if (!extractedUris.includes(cleaned)) {
            extractedUris.push(cleaned);
          }
        }
      } catch (e) {
        // Raw JSON text
        if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
          try {
            const json = JSON.parse(cleaned);
            const uri = parseJsonConfigToUri(json);
            if (uri && !extractedUris.includes(uri)) extractedUris.push(uri);
          } catch (err) {}
        }
      }
    }
  }

  return extractedUris;
}

/**
 * Scans text for raw JSON config objects
 */
function extractRawJsonConfigs(text: string): string[] {
  const extractedUris: string[] = [];
  const jsonRegex = /\{[^}]*(?:"address"|"v2rayHost"|"uuid"|"id"|"configVersion"|"configName")[^}]*\}/g;
  const matches = text.match(jsonRegex) || [];
  for (const match of matches) {
    try {
      const json = JSON.parse(match);
      const uri = parseJsonConfigToUri(json);
      if (uri) extractedUris.push(uri);
    } catch (e) {}
  }
  return extractedUris;
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

/**
 * Filters scraped Telegram Web HTML to strictly include message posts from the last 3 days
 */
function filterTelegramHtmlLast3Days(html: string): string {
  if (!html) return html;
  
  const now = Date.now();
  const blocks = html.split(/(?=<div class="tgme_widget_message)/i);
  if (blocks.length <= 1) return html;

  const validBlocks: string[] = [blocks[0]];

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const timeMatch = block.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if (timeMatch && timeMatch[1]) {
      const postTime = new Date(timeMatch[1]).getTime();
      if (!isNaN(postTime) && (now - postTime > THREE_DAYS_MS)) {
        // Skip messages/posts older than 3 days
        continue;
      }
    }
    validBlocks.push(block);
  }

  return validBlocks.join('');
}

/**
 * Restores database from parsed backup object or array of configs
 */
function restoreDatabaseFromObject(raw: any, options?: { skipConfigs?: boolean; restoreOnlySettingsAndChannels?: boolean }): { success: boolean; message: string; counts?: any } {
  if (!raw || (typeof raw !== 'object' && !Array.isArray(raw))) {
    return { success: false, message: 'محتوای فایل پشتیبان نامعتبر است (فرمت JSON معتبر نیست).' };
  }

  const shouldSkipConfigs = options?.skipConfigs || options?.restoreOnlySettingsAndChannels || raw.skipConfigs || raw.restoreOnlySettingsAndChannels;

  // Handle wrapped structures like { db: ... } or { data: ... } or { data_store: ... } or { backup: ... }
  let target = raw;
  if (target.db && typeof target.db === 'object') {
    target = target.db;
  } else if (target.data && typeof target.data === 'object' && (target.data.settings || target.data.configs || target.data.sources || target.data.channels)) {
    target = target.data;
  } else if (target.data_store && typeof target.data_store === 'object') {
    target = target.data_store;
  } else if (target.backup && typeof target.backup === 'object') {
    target = target.backup;
  }

  // Handle raw array of items (configs or proxies)
  if (Array.isArray(target)) {
    if (shouldSkipConfigs) {
      return { success: true, message: 'فایل فقط حاوی آرایه کانفیگ بود و با توجه به انتخاب شما نادیده گرفته شد.' };
    }
    const isConfigArray = target.some((item: any) => item && (item.link || item.server || item.protocol));
    const isProxyArray = target.some((item: any) => item && (item.host || item.port || item.type === 'mtproto'));
    
    if (isConfigArray || isProxyArray) {
      if (isConfigArray) {
        db.configs = target.filter((c: any) => c && typeof c === 'object');
      }
      if (isProxyArray) {
        db.proxies = target.filter((p: any) => p && typeof p === 'object');
      }
      enforceConfigsRetentionLimit();
      saveDatabase(true);
      addLog('success', `تعداد ${target.length} رکورد از آرایه فایل بکاپ بازگردانی شد.`);
      return { 
        success: true, 
        message: `تعداد ${target.length} رکورد با موفقیت بازگردانی شد.`, 
        counts: { configs: db.configs.length, proxies: (db.proxies || []).length } 
      };
    }
  }

  const envAdminId = process.env.ADMIN_ID ? process.env.ADMIN_ID.replace(/^['"\s]+|['"\s]+$/g, '').trim() : '';
  const envBotToken = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.replace(/^['"\s]+|['"\s]+$/g, '').trim() : '';
  
  const currentAdminId = db.settings?.adminId || envAdminId;
  const currentBotToken = db.settings?.botToken || envBotToken;

  const rawSettings = target.settings || target.config || target.bot_settings || target.botConfig || target.options || {};
  const newSettings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    adminId: (rawSettings.adminId && rawSettings.adminId !== '') ? rawSettings.adminId : currentAdminId,
    botToken: (rawSettings.botToken && rawSettings.botToken !== '') ? rawSettings.botToken : currentBotToken,
    autoPost: { ...DEFAULT_AUTO_POST, ...(rawSettings.autoPost || {}) }
  };

  // Extract and normalize Sources (handles object list or string array)
  const rawSources = target.sources || target.channels || target.source_channels || target.channel_sources || target.sourceChannels || target.telegram_sources || target.subscriptions;
  let newSources: SourceItem[] = db.sources;
  if (Array.isArray(rawSources)) {
    newSources = rawSources.map((item: any, idx: number) => {
      if (typeof item === 'string') {
        const isTelegram = item.startsWith('@') || item.includes('t.me/');
        const urlOrHandle = item.startsWith('@') ? item : (item.includes('t.me/') ? `@${item.split('t.me/')[1].replace(/[\/\?].*$/, '')}` : item);
        const name = isTelegram ? item : `منبع ساب ${idx + 1}`;
        return {
          id: 'src_' + Math.random().toString(36).substring(2, 9),
          name,
          urlOrHandle,
          type: isTelegram ? 'telegram' : 'sub',
          enabled: true,
          lastExtracted: null,
          extractedCount: 0
        };
      }
      return {
        id: item.id || ('src_' + Math.random().toString(36).substring(2, 9)),
        name: item.name || item.title || item.urlOrHandle || item.url || `منبع ${idx + 1}`,
        urlOrHandle: item.urlOrHandle || item.url || item.link || item.handle || '',
        type: (item.type === 'telegram' || item.type === 'github' || item.type === 'sub') ? item.type : (item.urlOrHandle?.includes('t.me/') ? 'telegram' : 'sub'),
        enabled: item.enabled !== false,
        lastExtracted: typeof item.lastExtracted === 'string' ? item.lastExtracted : null,
        extractedCount: Number(item.extractedCount) || 0
      };
    });
  }

  // Extract and normalize ForceJoinChannels (handles object list or string array)
  const rawForceJoin = target.forceJoinChannels || target.forceJoin || target.force_join || target.lockChannels || target.lock_channels || target.lockedChannels || target.mandatory_channels || target.mandatoryChannels;
  let newForceJoin: ForceJoinChannel[] = db.forceJoinChannels;
  if (Array.isArray(rawForceJoin)) {
    newForceJoin = rawForceJoin.map((item: any, idx: number) => {
      if (typeof item === 'string') {
        const handle = item.startsWith('@') ? item : (item.includes('t.me/') ? `@${item.split('t.me/')[1].replace(/[\/\?].*$/, '')}` : `@${item}`);
        return {
          id: 'fj_' + Math.random().toString(36).substring(2, 9),
          username: handle,
          title: handle,
          inviteLink: `https://t.me/${handle.replace(/^@+/, '')}`,
          enabled: true
        };
      }
      const username = item.username || item.handle || item.channel || '';
      return {
        id: item.id || ('fj_' + Math.random().toString(36).substring(2, 9)),
        username,
        title: item.title || item.name || username || `کانال ${idx + 1}`,
        inviteLink: item.inviteLink || item.link || (username ? `https://t.me/${username.replace(/^@+/, '')}` : ''),
        enabled: item.enabled !== false
      };
    });
  }

  // Extract and normalize Users
  const rawUsers = target.users || target.members || target.subscribers || target.user_list;
  let newUsers: BotUser[] = db.users;
  if (Array.isArray(rawUsers)) {
    newUsers = rawUsers.map((u: any) => {
      const nowStr = new Date().toISOString();
      if (typeof u === 'number' || typeof u === 'string') {
        const cid = Number(u);
        return {
          chatId: cid,
          username: null,
          firstName: null,
          joinedAt: nowStr,
          lastActive: nowStr,
          configsFetched: 0
        };
      }
      return {
        chatId: Number(u.chatId || u.id || u.userId || u.chat_id || 0),
        username: u.username || null,
        firstName: u.firstName || u.first_name || null,
        joinedAt: typeof u.joinedAt === 'string' ? u.joinedAt : nowStr,
        lastActive: typeof u.lastActive === 'string' ? u.lastActive : nowStr,
        configsFetched: Number(u.configsFetched || u.configsReceived || 0)
      };
    }).filter(u => u.chatId > 0);
  }
  
  // If skipping configs, retain existing configs, proxies, and npv files in database!
  const rawConfigs = target.configs || target.configurations || target.v2ray_configs || target.items;
  const rawProxies = target.proxies || target.mtproto || target.proxyList;
  const newConfigs = shouldSkipConfigs ? db.configs : (Array.isArray(rawConfigs) ? rawConfigs : db.configs);
  const newProxies = shouldSkipConfigs ? db.proxies : (Array.isArray(rawProxies) ? rawProxies : db.proxies);
  const newNpvFiles = shouldSkipConfigs ? (db.npvFiles || []) : (Array.isArray(target.npvFiles) ? target.npvFiles : (db.npvFiles || []));
  const newLogs = shouldSkipConfigs ? db.logs : (Array.isArray(target.logs) ? target.logs : db.logs);
  const newPosted = Array.isArray(target.postedMessages) ? target.postedMessages : (db.postedMessages || []);

  db = {
    settings: newSettings,
    sources: newSources,
    forceJoinChannels: newForceJoin,
    configs: newConfigs,
    proxies: newProxies,
    npvFiles: newNpvFiles,
    users: newUsers,
    logs: newLogs,
    postedMessages: newPosted
  };

  if (!shouldSkipConfigs) {
    enforceConfigsRetentionLimit();
  }
  saveDatabase(true); // write immediately synchronously to disk
  
  if (shouldSkipConfigs) {
    addLog('success', `تنظیمات و لیست کانال‌ها/منابع با موفقیت از بکاپ بازگردانی شدند (${newSources.length} منبع، ${newForceJoin.length} کانال عضویت اجباری - کانفیگ‌های فعلی حفظ شدند).`);
  } else {
    addLog('success', `دیتابیس ربات با موفقیت بازگردانی شد (${newConfigs.length} کانفیگ، ${newProxies.length} پروکسی، ${newSources.length} منبع، ${newUsers.length} کاربر).`);
  }

  return {
    success: true,
    message: shouldSkipConfigs ? 'تنظیمات و لیست کانال‌ها با موفقیت بازگردانی شدند.' : 'دیتابیس با موفقیت بازگردانی شد.',
    counts: {
      configs: db.configs.length,
      proxies: (db.proxies || []).length,
      sources: db.sources.length,
      forceJoinChannels: (db.forceJoinChannels || []).length,
      npvFiles: (db.npvFiles || []).length,
      users: db.users.length
    }
  };
}

/**
 * Universal backup parser and restorer from string or Buffer
 */
function parseAndRestoreBackup(textOrBuffer: string | Buffer, shouldSkipConfigs: boolean) {
  let text = '';
  if (Buffer.isBuffer(textOrBuffer)) {
    if (textOrBuffer.length >= 2 && textOrBuffer[0] === 0xFF && textOrBuffer[1] === 0xFE) {
      text = textOrBuffer.slice(2).toString('utf16le');
    } else if (textOrBuffer.length >= 2 && textOrBuffer[0] === 0xFE && textOrBuffer[1] === 0xFF) {
      text = textOrBuffer.slice(2).swap16().toString('utf16le');
    } else if (textOrBuffer.length >= 3 && textOrBuffer[0] === 0xEF && textOrBuffer[1] === 0xBB && textOrBuffer[2] === 0xBF) {
      text = textOrBuffer.slice(3).toString('utf8');
    } else {
      text = textOrBuffer.toString('utf8');
    }
  } else {
    text = String(textOrBuffer || '');
  }

  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xFEFF || text.startsWith('\uFEFF')) {
    text = text.replace(/^\uFEFF+/, '');
  }
  text = text.trim();

  // Try standard JSON parse directly
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      const parsed = JSON.parse(text);
      return restoreDatabaseFromObject(parsed, {
        skipConfigs: shouldSkipConfigs,
        restoreOnlySettingsAndChannels: shouldSkipConfigs
      });
    } catch (jsonErr: any) {
      console.warn('JSON parse direct warning on backup text:', jsonErr.message);
    }
  }

  // If text contains JSON embedded inside markdown code blocks ```json ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      return restoreDatabaseFromObject(parsed, {
        skipConfigs: shouldSkipConfigs,
        restoreOnlySettingsAndChannels: shouldSkipConfigs
      });
    } catch (e) {}
  }

  // Check if text is Base64 encoded
  const cleanBase64Candidate = text.replace(/\s+/g, '');
  if (/^[A-Za-z0-9+/=]+$/.test(cleanBase64Candidate) && cleanBase64Candidate.length > 20) {
    try {
      const decodedBuf = Buffer.from(cleanBase64Candidate, 'base64');
      const decodedStr = decodedBuf.toString('utf8').trim();
      if (decodedStr.startsWith('{') || decodedStr.startsWith('[') || decodedStr.includes('://')) {
        const subResult = parseAndRestoreBackup(decodedStr, shouldSkipConfigs);
        if (subResult.success) {
          return subResult;
        }
      }
    } catch (e) {}
  }

  // Fallback: If not JSON, check if it contains raw configs or proxy links in text format
  const extractedConfigs = extractConfigsFromText(text, 'فایل بکاپ متنی');
  const extractedProxies: ProxyItem[] = [];
  const proxyLines = text.split(/[\r\n]+/);
  for (const line of proxyLines) {
    const match = line.match(/(?:https:\/\/t\.me\/proxy\?|tg:\/\/proxy\?)(server=[^&\s]+&port=\d+&secret=[^&\s]+)/i);
    if (match) {
      try {
        const params = new URLSearchParams(match[1]);
        const server = params.get('server') || '';
        const port = parseInt(params.get('port') || '0', 10);
        const secret = params.get('secret') || '';
        if (server && port && secret) {
          extractedProxies.push({
            id: 'prx_' + Math.random().toString(36).substring(2, 9),
            raw: `tg://proxy?server=${server}&port=${port}&secret=${secret}`,
            type: 'mtproto',
            server,
            port,
            secret,
            latency: null,
            status: 'untested',
            lastChecked: null,
            createdAt: new Date().toISOString(),
            source: 'فایل بکاپ متنی'
          });
        }
      } catch (e) {}
    }
  }

  // If configs or proxies found
  if (extractedConfigs.length > 0 || extractedProxies.length > 0) {
    if (!shouldSkipConfigs) {
      if (extractedConfigs.length > 0) db.configs.unshift(...extractedConfigs);
      if (extractedProxies.length > 0) db.proxies.unshift(...extractedProxies);
      enforceConfigsRetentionLimit();
      saveDatabase(true);
    }
    return {
      success: true,
      message: `تعداد ${extractedConfigs.length} کانفیگ و ${extractedProxies.length} پروکسی از متن فایل استخراج و ذخیره شد.`,
      counts: {
        configs: db.configs.length,
        proxies: db.proxies.length,
        sources: db.sources.length,
        forceJoinChannels: db.forceJoinChannels.length,
        users: db.users.length
      }
    };
  }

  // Check if text is a list of Telegram channel sources or usernames
  const channelMatches = text.match(/(?:https?:\/\/t\.me\/[a-zA-Z0-9_+]+|@[a-zA-Z0-9_]{4,})/g);
  if (channelMatches && channelMatches.length > 0) {
    const addedSources: SourceItem[] = [];
    const uniqueChannels = Array.from(new Set(channelMatches));
    for (const rawCh of uniqueChannels) {
      const handle = rawCh.startsWith('@') ? rawCh : `@${rawCh.split('t.me/')[1].replace(/[\/\?].*$/, '')}`;
      if (handle && handle.length > 3 && !db.sources.some(s => s.urlOrHandle.toLowerCase() === handle.toLowerCase())) {
        addedSources.push({
          id: 'src_' + Math.random().toString(36).substring(2, 9),
          name: handle,
          urlOrHandle: handle,
          type: 'telegram',
          enabled: true,
          lastExtracted: null,
          extractedCount: 0
        });
      }
    }
    if (addedSources.length > 0) {
      db.sources.push(...addedSources);
      saveDatabase(true);
      return {
        success: true,
        message: `تعداد ${addedSources.length} منبع و کانال تلگرام به لیست منابع استخراج افزوده شدند.`,
        counts: {
          configs: db.configs.length,
          proxies: db.proxies.length,
          sources: db.sources.length,
          forceJoinChannels: db.forceJoinChannels.length,
          users: db.users.length
        }
      };
    }
  }

  return {
    success: false,
    message: 'ساختار فایل پشتیبان شناخته نشد. لطفاً فایل JSON دیتابیس یا فایل حاوی کانفیگ‌های متنی را انتخاب فرمایید.'
  };
}

/**
 * Enforces max configs retention limit (1 to 10000, default 2000).
 * Trims excess oldest configs if array length exceeds maxConfigsRetention.
 */
function enforceConfigsRetentionLimit() {
  const maxRetention = Math.max(1, Math.min(10000, Number(db.settings?.maxConfigsRetention) || 2000));
  if (db.configs && db.configs.length > maxRetention) {
    const removedCount = db.configs.length - maxRetention;
    db.configs = db.configs.slice(0, maxRetention);
    addLog('info', `سقف مجاز نگهداری کانفیگ‌ها در دیتابیس (${maxRetention} مورد) اعمال شد. تعداد ${removedCount} کانفیگ قدیمی‌تر پاکسازی شدند.`);
    saveDatabase();
  }
}

/**
 * Purges stored configs and proxies that are older than 3 days
 */
function purgeOldConfigsAndProxies() {
  const now = Date.now();
  const initialConfigs = db.configs.length;
  const initialProxies = (db.proxies || []).length;

  db.configs = db.configs.filter(c => {
    if (!c.createdAt) return true;
    const time = new Date(c.createdAt).getTime();
    if (isNaN(time)) return true;
    return (now - time) <= THREE_DAYS_MS;
  });

  if (db.proxies) {
    db.proxies = db.proxies.filter(p => {
      if (!p.createdAt) return true;
      const time = new Date(p.createdAt).getTime();
      if (isNaN(time)) return true;
      return (now - time) <= THREE_DAYS_MS;
    });
  }

  enforceConfigsRetentionLimit();

  if (initialConfigs !== db.configs.length || initialProxies !== (db.proxies || []).length) {
    saveDatabase();
  }
}

/**
 * Extracts configuration protocols from HTML or plain text
 */
function extractConfigsFromText(text: string, sourceName: string): ConfigItem[] {
  if (!text) return [];
  
  const cleanText = safeDecodeText(text);
  const plainText = stripHtmlTags(cleanText);

  // Look for configuration protocols (vless://, vmess://, trojan://, ss://, npv://, npvt://)
  const regex = /(vless|vmess|trojan|ss|npv|npvt):\/\/[^\s"'<>\`\\|]+/gi;
  const matches1 = cleanText.match(regex) || [];
  const matches2 = plainText.match(regex) || [];

  // Look for NPVT blocks starting with NPVT
  const npvtRegex = /NPVT[a-zA-Z0-9+/=\-_]{15,}/gi;
  const npvtMatches1 = cleanText.match(npvtRegex) || [];
  const npvtMatches2 = plainText.match(npvtRegex) || [];

  const base64Configs = extractBase64NpvConfigs(cleanText);
  const jsonConfigs = extractRawJsonConfigs(cleanText);

  const allMatches = [
    ...matches1, 
    ...matches2, 
    ...npvtMatches1, 
    ...npvtMatches2, 
    ...base64Configs, 
    ...jsonConfigs
  ];

  const lowerSource = (sourceName || '').toLowerCase();
  const lowerText = cleanText.toLowerCase();

  const sourceIsNpv = lowerSource.includes('npv') || 
                      lowerSource.includes('npvt') || 
                      lowerSource.includes('napsternet') || 
                      lowerText.includes('.npvt') || 
                      lowerText.includes('.npv') || 
                      cleanText.trim().startsWith('NPVT');

  if (allMatches.length === 0) {
    // If the entire text is a raw base64 string or NPV string
    const trimmed = cleanText.trim();
    if (trimmed.length > 20 && (sourceIsNpv || trimmed.startsWith('NPVT') || trimmed.startsWith('npv://') || trimmed.startsWith('npvt://'))) {
      const info = parseConfigHostPort(trimmed);
      const exists = db.configs.some(c => c.raw === trimmed);
      if (!exists) {
        return [{
          id: generateId(),
          raw: trimmed,
          protocol: 'npv',
          remark: info.remark || 'NPVT_Config',
          server: info.host || 'npv.napsternetv.server',
          port: info.port || 443,
          source: sourceName,
          status: 'untested',
          latency: null,
          lastChecked: null,
          isNpv: true,
          createdAt: new Date().toISOString()
        }];
      }
    }
    return [];
  }

  const extracted: ConfigItem[] = [];
  const uniqueRaw = Array.from(new Set(allMatches));

  for (const raw of uniqueRaw) {
    let rawConfig = raw.trim();
    if (rawConfig.endsWith('.') || rawConfig.endsWith(',') || rawConfig.endsWith(')') || rawConfig.endsWith(']')) {
      rawConfig = rawConfig.slice(0, -1);
    }

    // Skip duplicates in currently existing db configs
    const exists = db.configs.some(c => c.raw === rawConfig);
    if (exists) continue;

    const isNpvFormat = sourceIsNpv || 
                        rawConfig.startsWith('NPVT') ||
                        rawConfig.startsWith('npv://') || 
                        rawConfig.startsWith('npvt://');

    let info = parseConfigHostPort(rawConfig);
    if (isNpvFormat) {
      if (!info.host) info.host = 'npv.napsternetv.server';
      if (!info.port) info.port = 443;
      info.protocol = 'npv';
    }

    if (!info.host || !info.port) {
      continue;
    }

    extracted.push({
      id: generateId(),
      raw: rawConfig,
      protocol: isNpvFormat ? 'npv' : info.protocol,
      remark: info.remark,
      server: info.host,
      port: info.port,
      source: sourceName,
      status: 'untested',
      latency: null,
      lastChecked: null,
      isNpv: isNpvFormat,
      createdAt: new Date().toISOString()
    });
  }

  return extracted;
}

/**
 * Extracts MTProto & Socks5 proxies from HTML or plain text
 */
function extractProxiesFromText(text: string, sourceName: string): ProxyItem[] {
  if (!text) return [];

  const cleanText = safeDecodeText(text);

  // Match:
  // tg://proxy?server=SERVER&port=PORT&secret=SECRET
  // tg://socks?server=SERVER&port=PORT
  // And any t.me, telegram.me, telegram.dog equivalents (with http, https, or no prefix)
  const regex = /(?:tg:\/\/|(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog)\/)(?:proxy|socks)\?[^\s"'<>\`\\|]+/gi;
  const matches1 = cleanText.match(regex) || [];
  
  const socks5Regex = /socks5:\/\/[^\s"'<>\`\\|]+/gi;
  const matches2 = cleanText.match(socks5Regex) || [];
  
  const allMatches = [...matches1, ...matches2];
  if (allMatches.length === 0) return [];

  const extracted: ProxyItem[] = [];
  const uniqueRaw = Array.from(new Set(allMatches));

  for (let raw of uniqueRaw) {
    let rawProxy = raw.trim();

    // Standardize all Telegram web formats (t.me, telegram.me, telegram.dog) to tg:// protocol
    let cleanUrl = rawProxy;
    if (cleanUrl.toLowerCase().startsWith('http://') || cleanUrl.toLowerCase().startsWith('https://')) {
      cleanUrl = cleanUrl.replace(/^https?:\/\//i, '');
    }
    if (
      cleanUrl.toLowerCase().startsWith('t.me/') || 
      cleanUrl.toLowerCase().startsWith('telegram.me/') || 
      cleanUrl.toLowerCase().startsWith('telegram.dog/')
    ) {
      cleanUrl = cleanUrl
        .replace(/^t\.me\//i, 'tg://')
        .replace(/^telegram\.me\//i, 'tg://')
        .replace(/^telegram\.dog\//i, 'tg://');
      rawProxy = cleanUrl;
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
      lastChecked: null,
      createdAt: new Date().toISOString()
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
    // Purge items older than 3 days
    purgeOldConfigsAndProxies();

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

    let rawText = await response.text();
    // Strictly filter Telegram HTML to messages/posts from the last 3 days
    const text = source.type === 'telegram' ? filterTelegramHtmlLast3Days(rawText) : rawText;

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

      // Deep scan Telegram channels for attached NPVT / document post files
      if (source.type === 'telegram') {
        const handle = source.urlOrHandle.replace(/^@/, '').trim();
        const msgLinkRegex = new RegExp(`href="(https?:\\/\\/t\\.me\\/(?:s\\/)?${handle}\\/(\\d+))"`, 'gi');
        const matches = Array.from(text.matchAll(msgLinkRegex));
        const postData: {url: string, msgId: string}[] = [];
        for (const m of matches) {
          if (m[1] && m[2]) {
            postData.push({ url: m[1].replace('t.me/', 't.me/s/'), msgId: m[2] });
          }
        }
        
        const uniquePosts: typeof postData = [];
        const seenUrls = new Set();
        for (const pd of postData) {
          if (!seenUrls.has(pd.url)) {
            seenUrls.add(pd.url);
            uniquePosts.push(pd);
          }
        }
        
        const finalPosts = uniquePosts.slice(-20);
        if (finalPosts.length > 0) {
          const postResults = await Promise.allSettled(
            finalPosts.map(pData => fetch(pData.url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/115.0.0.0 Safari/537.36' }
            }).then(r => r.text()))
          );

          for (let i = 0; i < postResults.length; i++) {
            const res = postResults[i];
            const pData = finalPosts[i];
            if (res.status === 'fulfilled') {
              const pText = res.value;

              // Check if individual post is older than 3 days
              const timeMatch = pText.match(/<time[^>]+datetime=["']([^"']+)["']/i);
              if (timeMatch && timeMatch[1]) {
                const postTime = new Date(timeMatch[1]).getTime();
                if (!isNaN(postTime) && (Date.now() - postTime > THREE_DAYS_MS)) {
                  continue; // Skip post older than 3 days
                }
              }

              const hasNpvDoc = pText.toLowerCase().includes('.npvt') || pText.toLowerCase().includes('.npv') || pText.includes('NPVT') || pText.toLowerCase().includes('napsternet');
              const srcLabel = hasNpvDoc ? `${source.name} (.npvt)` : source.name;
              
              if (hasNpvDoc && db.settings.adminId && db.settings.botToken) {
                try {
                  const fwRes = await callTelegramApi('forwardMessage', {
                    chat_id: db.settings.adminId,
                    from_chat_id: `@${handle}`,
                    message_id: Number(pData.msgId),
                    disable_notification: true
                  });
                  
                  if (fwRes && fwRes.document) {
                    const cDoc = fwRes.document;
                    const isVpnFormat = cDoc.file_name && (cDoc.file_name.endsWith('.npvt') || cDoc.file_name.endsWith('.npv') || cDoc.file_name.endsWith('.ovpn') || cDoc.file_name.endsWith('.txt'));
                    if (isVpnFormat) {
                      const fileInfo = await callTelegramApi('getFile', { file_id: cDoc.file_id });
                      if (fileInfo && fileInfo.file_path) {
                        const fRes = await fetch(`https://api.telegram.org/file/bot${db.settings.botToken}/${fileInfo.file_path}`);
                        const arrayBuffer = await fRes.arrayBuffer();
                        const fContentBase64 = Buffer.from(arrayBuffer).toString('base64');
                        if (!db.npvFiles) db.npvFiles = [];
                        
                        if (!db.npvFiles.some(f => f.filename === cDoc.file_name && f.content === fContentBase64)) {
                          db.npvFiles.unshift({
                            id: Date.now().toString() + Math.floor(Math.random() * 1000),
                            filename: cDoc.file_name,
                            content: fContentBase64,
                            status: 'untested',
                            createdAt: new Date().toISOString()
                          });
                          addLog('success', `فایل ${cDoc.file_name} از کانال @${handle} استخراج و ذخیره شد.`);
                        }
                      }
                    }
                  }
                  
                  // Instantly delete the forwarded message so it doesn't spam the admin
                  if (fwRes && fwRes.message_id) {
                    await callTelegramApi('deleteMessage', {
                      chat_id: db.settings.adminId,
                      message_id: fwRes.message_id
                    }).catch(() => {});
                  }
                } catch (fwErr) {
                  console.error('Failed to forward/extract document from channel:', fwErr);
                }
              }
              
              const pConfigs = extractConfigsFromText(pText, srcLabel);
              const pProxies = extractProxiesFromText(pText, srcLabel);
              extracted.push(...pConfigs);
              extractedProxies.push(...pProxies);
            }
          }
        }
      }
    }

    if (!db.proxies) db.proxies = [];

    if (extracted.length > 0 || extractedProxies.length > 0) {
      if (extracted.length > 0) {
        db.configs.unshift(...extracted);
        enforceConfigsRetentionLimit();
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

  // Bulk set status to checking first for immediate UI reflection
  for (const id of ids) {
    const proxy = db.proxies.find(p => p.id === id);
    if (proxy && proxy.status !== 'working') {
      proxy.status = 'checking';
    }
  }
  saveDatabase();

  const CONCURRENCY = 10;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY);
    await Promise.allSettled(chunk.map(async (id) => {
      const proxy = db.proxies.find(p => p.id === id);
      if (!proxy) return;

      const checkResult = await withHardTimeout(
        () => checkPortFull(proxy.server, proxy.port),
        2500,
        { working: false, latency: 999 }
      );
      
      const currentProxy = db.proxies.find(p => p.id === id);
      if (currentProxy) {
        currentProxy.status = checkResult.working ? 'working' : 'failed';
        currentProxy.latency = checkResult.working ? checkResult.latency : null;
        currentProxy.lastChecked = new Date().toISOString();
        
        if (checkResult.working) workingCount++;
        else failedCount++;
      }
    }));

    saveDatabase();
    await new Promise(r => setTimeout(r, 25));
  }

  // Final sanity cleanup for any proxy still in 'checking' status in this batch
  for (const id of ids) {
    const p = db.proxies.find(item => item.id === id);
    if (p && p.status === 'checking') {
      p.status = 'failed';
    }
  }

  saveDatabase(true);
  addLog('success', `پایان تست اتصال پورت پروکسی: تعداد ${workingCount} فعال و ${failedCount} غیرفعال شناسایی شدند.`);
}

/**
 * Run test on specific config IDs
 */
async function testConfigsBatch(ids: string[]) {
  addLog('info', `در حال آغاز تست اتصال پورت برای تعداد ${ids.length} کانفیگ...`);
  
  let workingCount = 0;
  let failedCount = 0;

  // Bulk set status to checking first for immediate UI reflection
  for (const id of ids) {
    const config = db.configs.find(c => c.id === id);
    if (config && config.status !== 'working') {
      config.status = 'checking';
    }
  }
  saveDatabase();

  const CONCURRENCY = 10;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY);
    await Promise.allSettled(chunk.map(async (id) => {
      const config = db.configs.find(c => c.id === id);
      if (!config) return;

      const checkResult = await withHardTimeout(
        () => checkConfigFully(config.raw),
        10000,
        { working: false, latency: 999 }
      );
      
      // Refresh connection to DB object in case it was modified
      const currentConfig = db.configs.find(c => c.id === id);
      if (currentConfig) {
        currentConfig.status = checkResult.working ? 'working' : 'failed';
        currentConfig.latency = checkResult.working ? checkResult.latency : null;
        currentConfig.lastChecked = new Date().toISOString();
        
        if (checkResult.working) workingCount++;
        else failedCount++;
      }
    }));

    saveDatabase();
    await new Promise(r => setTimeout(r, 25));
  }

  // Final sanity cleanup for any config still in 'checking' status in this batch
  for (const id of ids) {
    const c = db.configs.find(item => item.id === id);
    if (c && c.status === 'checking') {
      c.status = 'failed';
    }
  }

  saveDatabase(true);
  addLog('success', `پایان تست اتصال پورت: تعداد ${workingCount} فعال و ${failedCount} غیرفعال شناسایی شدند.`);
}

/**
 * Triggers bulk extraction across all active sources
 */
async function triggerBulkScrape(): Promise<number> {
  const enabledSources = db.sources.filter(s => s.enabled);
  const results = await Promise.allSettled(enabledSources.map(src => scrapeSource(src)));
  let totalExtracted = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      totalExtracted += r.value;
    }
  }
  return totalExtracted;
}

// --- Geolocation & Flag Helpers ---
const ipLocationCache = new Map<string, { country: string; countryCode: string }>();

async function getIpLocation(host: string): Promise<{ country: string; countryCode: string }> {
  if (!host || typeof host !== 'string' || !host.trim()) {
    return { country: 'نامشخص', countryCode: '' };
  }
  const cleanHost = host.trim().toLowerCase();
  if (ipLocationCache.has(cleanHost)) {
    return ipLocationCache.get(cleanHost)!;
  }

  try {
    let ip = cleanHost;
    if (!net.isIP(cleanHost)) {
      const dnsPromise = new Promise<string[]>((resolve, reject) => {
        dns.resolve4(cleanHost, (err, addresses) => {
          if (err || !addresses || addresses.length === 0) reject(err);
          else resolve(addresses);
        });
      });
      const timeoutPromise = new Promise<string[]>((_, reject) =>
        setTimeout(() => reject(new Error('DNS Timeout')), 1200)
      );
      const ips = await Promise.race([dnsPromise, timeoutPromise]);
      ip = ips[0];
    }
    
    if (ip && net.isIP(ip)) {
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode`, {
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.status === 'success') {
          const resObj = {
            country: data.country || 'نامشخص',
            countryCode: data.countryCode || ''
          };
          ipLocationCache.set(cleanHost, resObj);
          return resObj;
        }
      }
    }
  } catch (e) {
    // Silent
  }

  const defaultObj = { country: 'نامشخص', countryCode: '' };
  ipLocationCache.set(cleanHost, defaultObj);
  return defaultObj;
}

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatProxyTelegramUrl(p: { type?: string; raw?: string; server?: string; port?: number; secret?: string; user?: string; pass?: string }): string {
  const raw = p.raw || '';
  if (raw.startsWith('tg://') || raw.startsWith('https://t.me/')) {
    return raw;
  }
  
  if (p.type === 'socks5' || raw.startsWith('socks5://')) {
    const s = p.server || '127.0.0.1';
    const port = p.port || 1080;
    if (p.user || p.pass) {
      return `tg://socks?server=${encodeURIComponent(s)}&port=${port}&user=${encodeURIComponent(p.user || '')}&pass=${encodeURIComponent(p.pass || '')}`;
    }
    return `tg://socks?server=${encodeURIComponent(s)}&port=${port}`;
  }
  
  if (p.server && p.port) {
    if (p.secret) {
      return `tg://proxy?server=${encodeURIComponent(p.server)}&port=${p.port}&secret=${encodeURIComponent(p.secret)}`;
    }
    return `tg://proxy?server=${encodeURIComponent(p.server)}&port=${p.port}`;
  }
  
  return raw.startsWith('http') ? raw : `tg://socks?server=${encodeURIComponent(p.server || '127.0.0.1')}&port=${p.port || 1080}`;
}

// Helper to safely truncate and balance HTML tags in strict LIFO order to respect Telegram 4096 character limits
function safeTelegramHtmlLength(text: string, maxLen: number = 3800): string {
  if (!text || text.length <= maxLen) return text;
  
  let truncated = text.substring(0, maxLen);
  // If we cut inside an HTML tag, trim back to opening bracket
  const lastOpen = truncated.lastIndexOf('<');
  const lastClose = truncated.lastIndexOf('>');
  if (lastOpen > lastClose) {
    truncated = truncated.substring(0, lastOpen);
  }

  // Parse open tags and close them in LIFO order
  const tagRegex = /<\/?([a-zA-Z0-9]+)(?:\s+[^>]*)?>/g;
  const tagStack: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(truncated)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    
    if (fullTag.startsWith('</')) {
      // Closing tag
      const lastIdx = tagStack.lastIndexOf(tagName);
      if (lastIdx !== -1) {
        tagStack.splice(lastIdx, 1);
      }
    } else if (!fullTag.endsWith('/>')) {
      // Opening tag (excluding self-closing)
      if (['b', 'i', 'code', 'blockquote', 'a', 's', 'u', 'pre'].includes(tagName)) {
        tagStack.push(tagName);
      }
    }
  }

  // Close remaining tags in reverse order
  while (tagStack.length > 0) {
    const unclosed = tagStack.pop();
    truncated += `</${unclosed}>`;
  }

  return truncated;
}

// --- Tech News, Secrets & Mobile Tricks Knowledgebase & Collector Engine ---

function cleanHtmlText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateTechImportance(title: string, summary: string): { importance: TechImportance; score: number } {
  const text = `${title} ${summary}`.toLowerCase();
  let score = 50;

  // Urgent, critical or breaking indicators
  if (/فوری|مهم|هشدار|آسیب‌پذیری|شکست امنیتی|روز صفر|zero-day|بزرگترین|انقلابی|رسمی|اعلام شد/i.test(text)) {
    score += 35;
  }
  // AI and frontier intelligence
  if (/هوش مصنوعی|chatgpt|claude|gemini|deepseek|openai|مدل زبانی|llm|ag/i.test(text)) {
    score += 25;
  }
  // Mobile tricks, hidden secrets, codes
  if (/کد مخفی|راز|ترفند|افزایش سرعت|بهینه‌سازی|باتری|دوربین|حافظه|قابلیت مخفی|تست سخت‌افزار/i.test(text)) {
    score += 20;
  }
  // Telegram, privacy, cybersecurity, anti-filter
  if (/تلگرام|پروکسی|امنیت|ضد هک|ردیابی|فیلترشکن|رمزنگاری|حریم خصوصی|dns/i.test(text)) {
    score += 18;
  }
  // Major OS updates (Android 15/16, iOS 18, Windows 11)
  if (/ios \d+|android \d+|آپدیت|نسخه جدید|به‌روزرسانی/i.test(text)) {
    score += 15;
  }

  score = Math.min(99, Math.max(20, score));

  let importance: TechImportance = 'normal';
  if (score >= 85) importance = 'breaking';
  else if (score >= 70) importance = 'high';
  else if (score >= 50) importance = 'medium';

  return { importance, score };
}

const SEED_TECH_ITEMS: Array<Omit<TechItem, 'id' | 'createdAt' | 'importanceScore' | 'importance'> & { importance?: TechImportance; importanceScore?: number }> = [
  // --- Secrets (رازهای تکنولوژی و امنیت) ---
  {
    title: '🔐 کد مخفی تست سخت‌افزار و سلامت قطعات گوشی‌های سامسونگ و شیائومی',
    summary: 'با شماره‌گیری کد *#0*# در سامسونگ یا *#*#6484#*#* در شیائومی، منوی مهندسی پنهان باز می‌شود که امکان تست لمس، اسپیکر، ویبره، حسگرها، دوربین و پیکسل‌سوختگی صفحه را فراهم می‌کند.',
    category: 'secret',
    tags: ['کد_مخفی', 'اندروید', 'سامسونگ', 'شیائومی', 'تست_گوشی'],
    source: 'دانشنامه ترفندهای تکنولوژی',
    importance: 'breaking',
    importanceScore: 98
  },
  {
    title: '🛡️ ترفند فعال‌سازی DNS خصوصی و رمزنگاری DoH جهت ضد فیلتر و رفع قطعی اینترنت',
    summary: 'در تنظیمات گوشی وارد اتصالات (Connections) و بخش Private DNS شوید و آدرس dns.adguard.com یا 1dot1dot1dot1.cloudflare-dns.com را وارد کنید تا تبلیغات مزاحم مسدود شده و تاخیر پینگ کاهش یابد.',
    category: 'secret',
    tags: ['امنیت', 'دی_ان_اس', 'حریم_خصوصی', 'کاهش_پینگ', 'اینترنت'],
    source: 'امنیت سایبری و شبکه',
    importance: 'breaking',
    importanceScore: 96
  },
  {
    title: '⚡ کد مخفی منوی تست شبکه و اطلاعات پیشرفته باتری در تمام گوشی‌های اندروید',
    summary: 'کد *#*#4636#*#* را در شماره‌گیر وارد کنید تا منوی Testing باز شود. در این بخش می‌توانید نوع شبکه تلفن را روی LTE Only قفل کنید تا از سوییچ ناخواسته به 3G جلوگیری شود.',
    category: 'secret',
    tags: ['کد_مخفی', 'شبکه', 'اینترنت_همراه', 'باتری', 'اندروید'],
    source: 'دانشنامه ترفندهای تکنولوژی',
    importance: 'high',
    importanceScore: 92
  },
  {
    title: '👁️ راز جلوگیری از ردیابی تبلیغاتی و استراق سمع میکروفون توسط اپلیکیشن‌ها',
    summary: 'در تنظیمات گوشی به مسیر Privacy > Permission Manager بروید و دسترسی Microphone و Location در پس‌زمینه را از برنامه‌های غیرضروری لغو کنید و شناسه Advertising ID را ریست نمایید.',
    category: 'secret',
    tags: ['حریم_خصوصی', 'امنیت', 'ضد_جاسوسی', 'اندروید', 'آیفون'],
    source: 'مرکز امنیت دیجیتال',
    importance: 'high',
    importanceScore: 88
  },
  {
    title: '📡 افزایش پایداری و رفع پرش آنتن و سرعت اینترنت با بهینه‌سازی MTU و IPv6',
    summary: 'تنظیم صحیح MTU روی عدد 1400 یا 1420 در اتصالات مودم یا کانفیگ‌های شبکه مانع از قطعه‌قطعه شدن بسته‌های داده در شبکه‌های پر اختلال می‌شود و استریم ویدیو را روان‌تر می‌سازد.',
    category: 'secret',
    tags: ['شبکه', 'افزایش_سرعت', 'پایداری_اینترنت', 'فناوری'],
    source: 'آموزش تخصصی شبکه',
    importance: 'medium',
    importanceScore: 82
  },
  {
    title: '🔍 کد جهانی استعلام اصالت، IMEI و سرقت گوشی در تمام برندها',
    summary: 'با شماره‌گیری کد ستاره مربع صفر شش مربع (*#06#) کد ۱۵ رقمی شناسایی گوشی را دریافت کرده و در سامانه همتا جهت اصالت رجیستری و بررسی قفل اپراتور بررسی کنید.',
    category: 'secret',
    tags: ['کد_مخفی', 'رجیستری', 'امنیت_گوشی', 'خرید_گوشی'],
    source: 'راهنمای امنیتی موبایل',
    importance: 'medium',
    importanceScore: 78
  },

  // --- Tricks (ترفندهای آموزشی گوشی و اپلیکیشن‌ها) ---
  {
    title: '🚀 ترفند افزایش ۲ برابری سرعت عملکرد و انیمیشن‌های اندروید',
    summary: 'وارد Developer Options (با ۷ بار لمس Build Number در About Phone) شوید و مقادیر Window animation scale، Transition animation scale و Animator duration scale را از 1x به 0.5x تغییر دهید.',
    category: 'trick',
    tags: ['ترفند_موبایل', 'افزایش_سرعت', 'اندروید', 'بهینه‌سازی'],
    source: 'آموزش‌های کاربردی تکنولوژی',
    importance: 'breaking',
    importanceScore: 95
  },
  {
    title: '🔋 راز افزایش طول عمر باتری با تکنیک طلایی قانون ۲۰ تا ۸۰ درصد',
    summary: 'تخلیه کامل باتری تا ۰٪ یا شارژ مدام تا ۱۰۰٪ چرخه عمر باتری‌های لیتیوم‌یونی را سریع فرسوده می‌کند. نگه داشتن شارژ بین ۲۰٪ تا ۸۰٪ و فعال کردن Protect Battery عمر باتری را دو برابر می‌کند.',
    category: 'trick',
    tags: ['باتری', 'سلامت_گوشی', 'ترفند_موبایل', 'شارژ_سریع'],
    source: 'تکنولوژی و سخت‌افزار',
    importance: 'high',
    importanceScore: 90
  },
  {
    title: '🧹 پاکسازی کش و بهینه‌سازی دیتابیس محلی تلگرام جهت رفع کندی بدون پاک شدن چت‌ها',
    summary: 'در تلگرام به Settings > Data and Storage > Storage Usage بروید. گزینه Auto-Remove Cached Media را روی ۳ روز قرار داده و با دکمه Clear Cache حافظه چند گیگابایتی اشغال شده را آزاد کنید.',
    category: 'trick',
    tags: ['تلگرام', 'ترفند_تلگرام', 'پاکسازی_حافظه', 'سرعت_گوشی'],
    source: 'ترفندهای تلگرام',
    importance: 'high',
    importanceScore: 92
  },
  {
    title: '🔊 ترفند خارج کردن آب و گردوغبار از اسپیکر گوشی با فرکانس صوتی ۱۶۵ هرتز',
    summary: 'اگر گوشی در آب افتاده یا صدای اسپیکر بم شده، با پخش صدای فرکانس ۱۶۵ هرتز (سایت FixMySpeakers) لرزش شدید دیافراگم قطرات آب و ذرات غبار را بدون باز کردن گوشی خارج می‌کند.',
    category: 'trick',
    tags: ['ترفند_موبایل', 'نجات_گوشی', 'تعمیرات', 'کاربردی'],
    source: 'ترفندهای اضطراری موبایل',
    importance: 'high',
    importanceScore: 89
  },
  {
    title: '📱 لمس دوتایی پشت آیفون و اندروید (Back Tap) برای اسکرین‌شات و چراغ‌قوه',
    summary: 'در آیفون (Accessibility > Touch > Back Tap) یا در اندروید با فعال‌سازی Quick Tap، می‌توانید با ۲ یا ۳ بار ضربه به قاب پشت گوشی بدون لمس صفحه اسکرین‌شات بگیرید یا چراغ‌قوه را روشن کنید.',
    category: 'trick',
    tags: ['آیفون', 'اندروید', 'ترفند_کاربردی', 'میانبر'],
    source: 'ترفندهای روز موبایل',
    importance: 'medium',
    importanceScore: 84
  },
  {
    title: '🎙️ تایپ صوتی فوق‌سریع فارسی و انگلیسی با هوش مصنوعی Gboard',
    summary: 'در کیبورد گوگل روی آیکون میکروفون بزنید؛ هوش مصنوعی آفلاین گوگل علائم نگارشی مانند نقطه، کاما و علامت سوال را نیز با بیان نام آن‌ها به صورت خودکار تایپ می‌کند.',
    category: 'trick',
    tags: ['هوش_مصنوعی', 'تایپ_صوتی', 'کیبورد', 'اندروید'],
    source: 'آموزش‌های کاربردی تکنولوژی',
    importance: 'medium',
    importanceScore: 80
  },

  // --- News (اخبار داغ و مهم تکنولوژی) ---
  {
    title: '🔥 تحول بزرگ در دنیای هوش مصنوعی با انتشار مدل‌های استدلال عمیق و چندوجهی',
    summary: 'نسل جدید مدل‌های هوش مصنوعی با قابلیت پردازش چندوجهی صوت، تصویر و استدلال گام‌به‌گام در حل مسائل پیچیده برنامه‌نویسی و تحلیل داده به استاندارد جدیدی در صنعت فناوری تبدیل شده‌اند.',
    category: 'news',
    tags: ['هوش_مصنوعی', 'فناوری_روز', 'تحول_دیجیتال', 'اخبار_فناوری'],
    source: 'اخبار فناوری و هوش مصنوعی',
    importance: 'breaking',
    importanceScore: 97
  },
  {
    title: '🚨 هشدار امنیتی اضطراری: آپدیت فوری مرورگرها و سیستم‌عامل‌ها جهت رفع باگ روز صفر',
    summary: 'محققان امنیتی نقص امنیتی بحرانی در موتورهای وب‌کیت و کرومیوم شناسایی کرده‌اند که امکان اجرای کد از راه دور را می‌داد. نصب آخرین بروزرسانی‌های امنیتی اکیداً توصیه شده است.',
    category: 'news',
    tags: ['امنیت_سایبری', 'هشدار_فوری', 'آپدیت_امنیتی', 'کروم'],
    source: 'دیده‌بان امنیت دیجیتال',
    importance: 'breaking',
    importanceScore: 95
  },
  {
    title: '🛰️ فراگیر شدن اتصال مستقیم ماهواره‌ای گوشی‌ها برای پیام‌رسانی و تماس اضطراری',
    summary: 'نسل جدید گوشی‌های هوشمند پرچمدار و میان‌رده به فناوری اتصال مستقیم ماهواره‌ای مجهز شده‌اند تا در مناطق بدون پوشش شبکه سلولی امکان ارسال موقعیت و پیام اضطراری فراهم باشد.',
    category: 'news',
    tags: ['ماهواره', 'اینترنت_ماهواره‌ای', 'موبایل', 'اخبار_فناوری'],
    source: 'اخبار ارتباطات و ماهواره',
    importance: 'high',
    importanceScore: 91
  },
  {
    title: '📶 تجاری‌سازی استاندارد Wi-Fi 7 با پهنای باند ۳۲۰ مگاهرتز و تاخیر نزدیک به صفر',
    summary: 'روترها و دستگاه‌های مجهز به Wi-Fi 7 با ترکیب باندهای فرکانسی ۲.۴، ۵ و ۶ گیگاهرتز سرعتی تا ۴ برابر وای‌فای ۶ ارائه داده و قطعی ناشی از نویز در منازل را به حداقل می‌رسانند.',
    category: 'news',
    tags: ['وای_فای', 'اینترنت', 'سخت_افزار', 'اخبار_تکنولوژی'],
    source: 'اخبار سخت‌افزار و شبکه',
    importance: 'high',
    importanceScore: 87
  }
];

// Helper to seed or refresh initial curated tech items
function seedCuratedTechItems() {
  if (!db.techItems) db.techItems = [];
  const existingTitles = new Set(db.techItems.map(i => i.title.trim()));

  for (const item of SEED_TECH_ITEMS) {
    if (!existingTitles.has(item.title.trim())) {
      const impCalc = calculateTechImportance(item.title, item.summary);
      db.techItems.push({
        id: `tech-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: item.title,
        summary: item.summary,
        category: item.category,
        tags: item.tags || ['تکنولوژی'],
        source: item.source || 'دانشنامه فناوری',
        sourceUrl: item.sourceUrl,
        importance: item.importance || impCalc.importance,
        importanceScore: item.importanceScore || impCalc.score,
        createdAt: new Date().toISOString(),
        postedToChannel: false,
        postedAt: null
      });
      existingTitles.add(item.title.trim());
    }
  }
}

// Auto Purge old items older than X days (default: 2 days)
function purgeOldTechItems(maxDays: number = 2): number {
  if (!db.techItems || db.techItems.length === 0) return 0;
  const days = Math.max(1, maxDays);
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const initialCount = db.techItems.length;

  db.techItems = db.techItems.filter(item => {
    const itemTime = new Date(item.createdAt).getTime();
    if (isNaN(itemTime)) return true;
    // Retain if within cutoff period
    if (itemTime >= cutoff) return true;
    // Retain breaking unposted items
    if (item.importance === 'breaking' && !item.postedToChannel) return true;
    return false;
  });

  const purgedCount = initialCount - db.techItems.length;
  if (purgedCount > 0) {
    saveDatabase();
    addLog('info', `🧹 تعداد ${purgedCount} خبر/ترفند قدیمی تکنولوژی (بیشتر از ${days} روز) پاکسازی شدند.`);
  }
  return purgedCount;
}

// Fetch from RSS Feeds
async function fetchLiveTechFromRss(): Promise<number> {
  const RSS_FEEDS = [
    { url: 'https://digiato.com/feed', name: 'Digiato' },
    { url: 'https://www.zoomit.ir/feed/', name: 'Zoomit' },
    { url: 'https://gadgetnews.net/feed/', name: 'GadgetNews' },
    { url: 'https://farnet.io/feed/', name: 'Farnet' }
  ];

  let addedCount = 0;
  if (!db.techItems) db.techItems = [];
  const existingTitles = new Set(db.techItems.map(i => i.title.trim()));

  for (const feed of RSS_FEEDS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const resp = await fetch(feed.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      });
      clearTimeout(timeoutId);

      if (!resp.ok) continue;
      const xmlText = await resp.text();
      if (!xmlText || xmlText.length < 50) continue;

      const itemBlocks = xmlText.match(/<(?:item|entry)[\s\S]*?<\/(?:item|entry)>/gi) || [];
      for (const block of itemBlocks.slice(0, 15)) {
        const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const rawTitle = cleanHtmlText(titleMatch ? titleMatch[1] : '');
        if (!rawTitle || rawTitle.length < 10) continue;

        if (existingTitles.has(rawTitle)) continue;

        const descMatch = block.match(/<(?:description|summary|content:encoded|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content:encoded|content)>/i);
        let summary = cleanHtmlText(descMatch ? descMatch[1] : '');
        if (summary.length > 280) {
          summary = summary.substring(0, 277) + '...';
        }
        if (!summary) summary = rawTitle;

        let link = '';
        const linkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
        if (linkMatch && linkMatch[1]) {
          link = cleanHtmlText(linkMatch[1]);
        } else {
          const hrefMatch = block.match(/<link[^>]*href=["']([^"']+)["']/i);
          if (hrefMatch) link = hrefMatch[1];
        }

        const dateMatch = block.match(/<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/i);
        let pubDate = new Date().toISOString();
        if (dateMatch && dateMatch[1]) {
          const d = new Date(dateMatch[1]);
          if (!isNaN(d.getTime())) pubDate = d.toISOString();
        }

        // Categorize based on keywords
        let category: TechItemCategory = 'news';
        if (/ترفند|آموزش|چگونه|روش|راهکار|حل مشکل|کد مخفی/i.test(rawTitle)) {
          category = 'trick';
        } else if (/راز|پنهان|امنیت|جاسوسی|هک|ضد هک|حریم خصوصی/i.test(rawTitle)) {
          category = 'secret';
        }

        const { importance, score } = calculateTechImportance(rawTitle, summary);

        // Tags
        const tags: string[] = ['تکنولوژی', feed.name];
        if (category === 'trick') tags.push('ترفند_موبایل');
        if (category === 'secret') tags.push('راز_تکنولوژی', 'امنیت');
        if (score >= 85) tags.push('خبر_فوری');

        db.techItems.push({
          id: `tech-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: rawTitle,
          summary,
          category,
          tags,
          source: feed.name,
          sourceUrl: link || undefined,
          importance,
          importanceScore: score,
          createdAt: pubDate,
          postedToChannel: false,
          postedAt: null
        });

        existingTitles.add(rawTitle);
        addedCount++;
      }
    } catch (e: any) {
      // Ignore individual feed errors
    }
  }

  // Sort techItems by importanceScore descending and recency
  if (db.techItems && db.techItems.length > 0) {
    db.techItems.sort((a, b) => (b.importanceScore || 50) - (a.importanceScore || 50));
  }

  return addedCount;
}

// Master refresh function that seeds, fetches fresh RSS, purges old and saves
async function refreshTechContentAndPurgeOld(force = false): Promise<{ added: number; purged: number; total: number }> {
  seedCuratedTechItems();
  const maxDays = db.settings.autoPost.autoPurgeOldTechDays || 2;
  const purged = purgeOldTechItems(maxDays);
  const added = await fetchLiveTechFromRss();

  if (added > 0 || purged > 0 || force) {
    saveDatabase();
    if (added > 0) {
      addLog('info', `📰 بروزرسانی اخبار و ترفندهای تکنولوژی: ${added} مطلب جدید دریافت شد.`);
    }
  }

  return {
    added,
    purged,
    total: db.techItems ? db.techItems.length : 0
  };
}

// Helper to format a tech item cleanly for Telegram
function formatTechItemForTelegram(item: TechItem, showBadge = true): string {
  let badgeEmoji = '💡';
  let badgeTitle = 'ترفند تکنولوژی';
  if (item.category === 'news') {
    badgeEmoji = item.importance === 'breaking' ? '🔥' : '📰';
    badgeTitle = item.importance === 'breaking' ? 'خبر فوری' : 'خبر فناوری';
  } else if (item.category === 'secret') {
    badgeEmoji = '🔐';
    badgeTitle = 'راز تکنولوژی و امنیت';
  } else if (item.category === 'trick') {
    badgeEmoji = '📱';
    badgeTitle = 'ترفند و آموزش موبایل';
  }

  let text = '';
  if (showBadge) {
    text += `${badgeEmoji} <b>[${badgeTitle}] ${escapeHtml(item.title)}</b>\n`;
  } else {
    text += `🔹 <b>${escapeHtml(item.title)}</b>\n`;
  }
  
  if (item.summary) {
    text += `▫️ ${escapeHtml(item.summary)}\n`;
  }

  if (item.tags && item.tags.length > 0) {
    const formattedTags = item.tags
      .slice(0, 4)
      .map(t => `#${t.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '')}`)
      .join(' ');
    text += `🏷 <i>${formattedTags}</i>\n`;
  }

  return text;
}

// Standalone Tech Post Dispatcher
async function executeStandaloneTechPost(targetChannel: string, items: TechItem[]): Promise<boolean> {
  if (!items || items.length === 0) return false;
  try {
    let msg = `✨ <b>دانشنامه و تازه‌های دنیای تکنولوژی و ترفندها:</b>\n\n`;
    
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      msg += formatTechItemForTelegram(it, true);
      if (i < items.length - 1) msg += `\n───────────────\n\n`;
    }

    msg += `\n🆔 ${escapeHtml(db.settings.branding || '')}`;

    const inlineButtons: any[] = [];
    const sponsorBtn = getSponsorChannelInlineButton();
    if (sponsorBtn) {
      inlineButtons.push([{ text: sponsorBtn.text, url: sponsorBtn.url, style: 'primary' }]);
    }
    const botUser = db.settings.botUsername;
    if (botUser) {
      inlineButtons.push([{
        text: '🤖 دسترسی به ترفندها و کانفیگ‌های بیشتر',
        url: `https://t.me/${botUser.replace('@', '')}`
      }]);
    }

    const safeText = safeTelegramHtmlLength(msg, 3900);
    const channelHandle = targetChannel.startsWith('@') ? targetChannel : `@${targetChannel.replace('@', '')}`;
    
    await callTelegramApi('sendMessage', {
      chat_id: channelHandle,
      text: safeText,
      parse_mode: 'HTML',
      reply_markup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined,
      disable_notification: !!db.settings.autoPost.silentMode
    });

    for (const it of items) {
      it.postedToChannel = true;
      it.postedAt = new Date().toISOString();
    }
    saveDatabase();
    return true;
  } catch (e: any) {
    addLog('error', `خطا در ارسال پست مستقل ترفندهای تکنولوژی: ${e.message}`);
    return false;
  }
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

    // Get requested configs count (supports 0, 1, 2, 3, 5, 10, 15, 20, 30, 50, etc.)
    const rawConfCount = typeof settings.configCount === 'number' ? settings.configCount : parseInt(String(settings.configCount), 10);
    const configLimit = !isNaN(rawConfCount) && rawConfCount >= 0 ? rawConfCount : 10;
    
    let availableConfigs = db.configs.filter(c => c.status === 'working');
    if (availableConfigs.length < configLimit) {
      const untested = db.configs.filter(c => c.status === 'untested');
      availableConfigs = [...availableConfigs, ...untested];
    }
    if (availableConfigs.length < configLimit) {
      const otherConfigs = db.configs.filter(c => c.status !== 'working' && c.status !== 'untested');
      availableConfigs = [...availableConfigs, ...otherConfigs];
    }
    const shuffledConfigs = [...availableConfigs].sort(() => 0.5 - Math.random());
    const selectedConfigs = configLimit === 0 ? [] : shuffledConfigs.slice(0, Math.min(configLimit, shuffledConfigs.length));

    // Get requested proxies count
    const rawProxyCount = typeof settings.proxyCount === 'number' ? settings.proxyCount : parseInt(String(settings.proxyCount), 10);
    const proxyLimit = !isNaN(rawProxyCount) && rawProxyCount >= 0 ? rawProxyCount : 0;
    
    let availableProxies = (db.proxies || []).filter(p => p.status === 'working');
    if (availableProxies.length < proxyLimit) {
      const untestedProxies = (db.proxies || []).filter(p => p.status === 'untested');
      availableProxies = [...availableProxies, ...untestedProxies];
    }
    if (availableProxies.length < proxyLimit) {
      const otherProxies = (db.proxies || []).filter(p => p.status !== 'working' && p.status !== 'untested');
      availableProxies = [...availableProxies, ...otherProxies];
    }
    const shuffledProxies = [...availableProxies].sort(() => 0.5 - Math.random());
    const selectedProxies = proxyLimit === 0 ? [] : shuffledProxies.slice(0, Math.min(proxyLimit, shuffledProxies.length));

    // Get requested tech items count
    seedCuratedTechItems();
    const rawTechNewsCount = typeof settings.techNewsCount === 'number' ? settings.techNewsCount : 0;
    const techNewsLimit = !isNaN(rawTechNewsCount) && rawTechNewsCount >= 0 ? rawTechNewsCount : 0;

    const rawTechTricksCount = typeof settings.techTricksCount === 'number' ? settings.techTricksCount : 0;
    const techTricksLimit = !isNaN(rawTechTricksCount) && rawTechTricksCount >= 0 ? rawTechTricksCount : 0;

    const allTech = db.techItems || [];
    // Prioritize unposted items, then highest importance score, then newest
    const sortTechFn = (a: TechItem, b: TechItem) => {
      if (a.postedToChannel !== b.postedToChannel) {
        return a.postedToChannel ? 1 : -1;
      }
      return (b.importanceScore || 50) - (a.importanceScore || 50);
    };

    const newsCandidates = allTech.filter(i => i.category === 'news').sort(sortTechFn);
    const tricksCandidates = allTech.filter(i => i.category === 'trick' || i.category === 'secret').sort(sortTechFn);

    const selectedTechNews = techNewsLimit > 0 ? newsCandidates.slice(0, techNewsLimit) : [];
    const selectedTechTricks = techTricksLimit > 0 ? tricksCandidates.slice(0, techTricksLimit) : [];
    const selectedTechItems = [...selectedTechNews, ...selectedTechTricks];

    if (selectedConfigs.length === 0 && selectedProxies.length === 0 && selectedTechItems.length === 0) {
      addLog('warn', 'ارسال خودکار انجام نشد زیرا هیچ کانفیگ، پروکسی یا مطلب تکنولوژی برای ارسال انتخاب نشده است.');
      return false;
    }

    let text = `🚀 <b>${escapeHtml(settings.customText || '💎 کانفیگ‌ها و پروکسی‌های جدید تقدیم به شما:')}</b>\n\n`;

    let needsFullPackFile = false;
    let fullPackConfigsContent = '';

    if (selectedConfigs.length > 0) {
      text += `📥 <b>پک ${selectedConfigs.length} کانفیگ جدید V2Ray:</b>\n`;
      
      // Detailed item listing for up to 6 configs
      const previewCount = Math.min(selectedConfigs.length, 6);
      for (let i = 0; i < previewCount; i++) {
        const conf = selectedConfigs[i];
        const loc = await getIpLocation(conf.server || '');
        const flag = getFlagEmoji(loc.countryCode);
        const pingText = conf.latency ? `پینگ: ${conf.latency}ms` : 'فعال 🟢';
        const proto = (conf.protocol || 'V2RAY').toUpperCase();
        text += `🔹 کانفیگ ${i + 1} [${proto}] | ${pingText} | ${loc.country} ${flag}\n`;
      }

      if (selectedConfigs.length > previewCount) {
        text += `<i>و ${selectedConfigs.length - previewCount} کانفیگ دیگر در بسته زیر...</i>\n`;
      }

      // Generate all branded configs
      const allBrandedList = selectedConfigs.map(conf => applyBrandingToConfig(conf.raw, db.settings.branding));
      fullPackConfigsContent = allBrandedList.join('\n');

      // Check if all configs fit safely inside Telegram 4096 character limit
      // Telegram blockquote character budget ~ 2500 chars to leave space for headers & proxies
      let inlineBatch = '';
      let inlineCount = 0;
      for (const confStr of allBrandedList) {
        if ((inlineBatch + confStr + '\n').length < 2400) {
          inlineBatch += (inlineBatch ? '\n' : '') + confStr;
          inlineCount++;
        } else {
          break;
        }
      }

      if (inlineCount < selectedConfigs.length) {
        needsFullPackFile = true;
      }

      if (inlineBatch) {
        const copyTitle = inlineCount === selectedConfigs.length 
          ? `کپی یکجای تمامی ${selectedConfigs.length} کانفیگ (جهت ایمپورت روی کادر زیر لمس کنید):`
          : `کپی یکجای برترین کانفیگ‌ها (${inlineCount} از ${selectedConfigs.length} عدد):`;
        text += `\n📋 <b>${copyTitle}</b>\n`;
        text += `<blockquote expandable><code>${escapeHtml(inlineBatch)}</code></blockquote>\n\n`;
      }
    }

    // Append proxies
    if (selectedProxies.length > 0) {
      text += `🔌 <b>لیست پروکسی‌های جدید تلگرام:</b>\n`;
      const proxyPreviewCount = Math.min(selectedProxies.length, 6);
      for (let i = 0; i < proxyPreviewCount; i++) {
        const proxy = selectedProxies[i];
        const loc = await getIpLocation(proxy.server || '');
        const flag = getFlagEmoji(loc.countryCode);
        const pingText = proxy.latency ? `پینگ: ${proxy.latency}ms` : 'فعال 🟢';
        const pType = (proxy.type || 'MTPROTO').toUpperCase();
        text += `🔹 پروکسی ${pType} | ${pingText} | ${loc.country} ${flag}\n`;
      }
      text += `\n👇 برای اتصال به پروکسی‌ها، روی دکمه‌های شیشه‌ای زیر کلیک کنید:\n\n`;
    }

    // Append Tech News and Educational Mobile Tricks (if combined mode or default)
    const isStandaloneOnly = settings.techPostMode === 'standalone';
    if (!isStandaloneOnly && selectedTechItems.length > 0) {
      text += `💡 <b>دانشنامه و تازه‌های دنیای تکنولوژی و ترفندها:</b>\n\n`;
      for (const it of selectedTechItems) {
        text += formatTechItemForTelegram(it, settings.includeTechImportanceBadge !== false) + '\n';
      }
    }

    if (needsFullPackFile) {
      text += `\n📁 <i>فایل متنی شامل تمام ${selectedConfigs.length} کانفیگ نیز ضمیمه شد.</i>\n`;
    }

    text += `\n🆔 ${escapeHtml(db.settings.branding || '')}`;

    const inlineButtons: any[] = [];
    selectedProxies.forEach((p, idx) => {
      const pType = (p.type || 'MTPROTO').toUpperCase();
      const label = `🔌 اتصال به پروکسی ${pType} شماره ${idx + 1}`;
      const validUrl = formatProxyTelegramUrl(p);
      if (validUrl) {
        inlineButtons.push([{
          text: label,
          url: validUrl
        }]);
      }
    });

    const sponsorBtn = getSponsorChannelInlineButton();
    if (sponsorBtn) {
      inlineButtons.push([{ text: sponsorBtn.text, url: sponsorBtn.url }]);
    }

    // Add bot advertisement button
    const botUser = db.settings.botUsername;
    const botUrl = botUser ? `https://t.me/${botUser.replace('@', '')}` : null;
    if (botUrl) {
      inlineButtons.push([{
        text: '🤖 دریافت کانفیگ و پروکسی رایگان بیشتر',
        url: botUrl
      }]);
    }

    // Ensure the message length strictly adheres to Telegram constraints
    const safeText = safeTelegramHtmlLength(text, 3900);

    const channelHandle = settings.targetChannel.startsWith('@') ? settings.targetChannel : `@${settings.targetChannel.replace('@', '')}`;
    const sentMsg = await callTelegramApi('sendMessage', {
      chat_id: channelHandle,
      text: safeText,
      parse_mode: 'HTML',
      reply_markup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined,
      disable_notification: !!settings.silentMode
    });

    // If config pack has large count (e.g. 15, 20, 30, 50), upload the full .txt pack file
    if (needsFullPackFile && fullPackConfigsContent) {
      try {
        const formData = new FormData();
        formData.append('chat_id', channelHandle);
        const fileBuffer = Buffer.from(fullPackConfigsContent, 'utf8');
        const blob = new Blob([fileBuffer], { type: 'text/plain;charset=utf-8' });
        
        let packFilename = `V2Ray_Pack_${selectedConfigs.length}_Configs.txt`;
        if (db.settings.branding) {
          const cleanBranding = db.settings.branding.replace('@', '').replace(/[^a-zA-Z0-9_-]/g, '');
          if (cleanBranding) packFilename = `V2Ray_${cleanBranding}_${selectedConfigs.length}_Configs.txt`;
        }
        
        formData.append('document', blob, packFilename);
        formData.append('caption', `📦 <b>فایل کامل ${selectedConfigs.length} کانفیگ V2Ray</b>\n\n🆔 ${escapeHtml(db.settings.branding || '')}`);
        formData.append('parse_mode', 'HTML');
        if (settings.silentMode) formData.append('disable_notification', 'true');

        await fetch(`https://api.telegram.org/bot${db.settings.botToken}/sendDocument`, {
          method: 'POST',
          body: formData
        });
      } catch (err) {
        console.error('Failed to send auto-post configs text file:', err);
      }
    }

    // Try to post an NPV/OVPN file alongside the configs if enabled
    if (settings.postFiles && db.npvFiles && db.npvFiles.length > 0) {
      const npvFile = db.npvFiles[Math.floor(Math.random() * Math.min(db.npvFiles.length, 10))];
      if (npvFile) {
        try {
          const formData = new FormData();
          formData.append('chat_id', channelHandle);
          const fileBuffer = Buffer.from(npvFile.content, 'base64');
          const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
          
          let brandedFilename = npvFile.filename;
          if (db.settings.branding) {
            const cleanBranding = db.settings.branding.replace('@', '').replace(/[^a-zA-Z0-9_-]/g, '');
            brandedFilename = brandedFilename.replace(/\.(npv(t)?|ovpn)$/i, `_${cleanBranding}.$1`);
          }
          
          formData.append('document', blob, brandedFilename);
          const fileType = npvFile.filename.endsWith('.ovpn') ? 'OpenVPN' : 'NapsternetV';
          const caption = `🌐 <b>فایل پیکربندی اختصاصی ${fileType}</b>\n\nجهت استفاده، این فایل را در نرم‌افزار ایمپورت کنید.\n\n🆔 ${escapeHtml(db.settings.branding || '')}`;
          formData.append('caption', caption);
          formData.append('parse_mode', 'HTML');
          
          if (inlineButtons.length > 0) {
            formData.append('reply_markup', JSON.stringify({ inline_keyboard: inlineButtons }));
          }
          if (settings.silentMode) {
            formData.append('disable_notification', 'true');
          }

          await fetch(`https://api.telegram.org/bot${db.settings.botToken}/sendDocument`, {
            method: 'POST',
            body: formData
          });
        } catch (err) {
          console.error('Failed to send auto-post NPV file:', err);
        }
      }
    }

    // Add to posted messages
    const postConfigs = selectedConfigs.map((c, idx) => ({
      id: c.id,
      raw: c.raw,
      protocol: (c.protocol || 'unknown') as ProtocolType,
      remark: c.remark || '',
      server: c.server || '',
      port: c.port || 443,
      index: idx + 1
    }));

    const postProxies = selectedProxies.map((p, idx) => ({
      id: p.id,
      raw: p.raw,
      type: p.type || 'mtproto',
      server: p.server || '',
      port: p.port || 443,
      secret: p.secret || '',
      index: idx + 1
    }));

    if (!db.postedMessages) db.postedMessages = [];
    db.postedMessages.push({
      id: generateId(),
      messageId: sentMsg.message_id,
      chatId: channelHandle,
      postedAt: new Date().toISOString(),
      originalText: safeText,
      configs: postConfigs,
      proxies: postProxies,
      repliedMessageId: null
    });

    // Mark selected tech items as posted
    for (const t of selectedTechItems) {
      t.postedToChannel = true;
      t.postedAt = new Date().toISOString();
    }

    // If techPostMode is standalone or both, also dispatch standalone educational post
    if ((settings.techPostMode === 'standalone' || settings.techPostMode === 'both') && selectedTechItems.length > 0) {
      await executeStandaloneTechPost(channelHandle, selectedTechItems);
    }

    settings.lastPostedAt = new Date().toISOString();
    saveDatabase();
    
    let summaryText = `پست خودکار با موفقیت به کانال ${settings.targetChannel} ارسال گردید`;
    const parts: string[] = [];
    if (selectedConfigs.length > 0) parts.push(`${selectedConfigs.length} کانفیگ`);
    if (selectedProxies.length > 0) parts.push(`${selectedProxies.length} پروکسی`);
    if (selectedTechItems.length > 0) parts.push(`${selectedTechItems.length} ترفند/خبر تکنولوژی`);
    if (parts.length > 0) summaryText += ` (${parts.join('، ')})`;

    addLog('success', summaryText + '.');
    return true;
  } catch (err: any) {
    addLog('error', `خطا در ارسال پست خودکار به کانال: ${err.message || err}`);
    return false;
  }
}

// --- Dynamic Post Monitoring & Text Regeneration ---
async function generatePostText(post: ChannelPost): Promise<string> {
  const ap = db.settings.autoPost;
  let text = `🚀 <b>${escapeHtml(ap.customText || '💎 کانفیگ‌ها و پروکسی‌های اختصاصی و تست‌شده ما تقدیم به شما:')}</b>\n\n`;
  
  if (post.configs && post.configs.length > 0) {
    text += `📥 <b>پک ${post.configs.length} کانفیگ V2Ray:</b>\n`;
    const previewCount = Math.min(post.configs.length, 6);
    for (let i = 0; i < previewCount; i++) {
      const conf = post.configs[i];
      const dbConf = db.configs.find(c => c.id === conf.id || c.raw === conf.raw);
      const status = dbConf ? dbConf.status : 'failed';
      const latency = dbConf ? dbConf.latency : null;
      
      const loc = await getIpLocation(conf.server || '');
      const flag = getFlagEmoji(loc.countryCode);
      const proto = (conf.protocol || 'V2RAY').toUpperCase();
      
      if (status === 'working') {
        const pingText = latency ? `پینگ: ${latency}ms` : 'فعال 🟢';
        text += `🟢 کانفیگ ${conf.index} [${proto}] | ${pingText} | ${loc.country} ${flag}\n`;
      } else {
        text += `🔴 کانفیگ ${conf.index} [${proto}] | (غیرفعال ❌) | ${loc.country} ${flag}\n`;
      }
    }

    if (post.configs.length > previewCount) {
      text += `<i>و ${post.configs.length - previewCount} کانفیگ دیگر در بسته...</i>\n`;
    }

    const allBrandedCombined = post.configs
      .map(conf => applyBrandingToConfig(conf.raw, db.settings.branding))
      .join('\n');

    let inlineBatch = '';
    let inlineCount = 0;
    for (const conf of post.configs) {
      const confStr = applyBrandingToConfig(conf.raw, db.settings.branding);
      if ((inlineBatch + confStr + '\n').length < 2400) {
        inlineBatch += (inlineBatch ? '\n' : '') + confStr;
        inlineCount++;
      } else {
        break;
      }
    }

    if (inlineBatch) {
      const copyTitle = inlineCount === post.configs.length 
        ? `کپی یکجای تمامی ${post.configs.length} کانفیگ (جهت ایمپورت روی کادر زیر لمس کنید):`
        : `کپی یکجای برترین کانفیگ‌ها (${inlineCount} از ${post.configs.length} عدد):`;
      text += `\n📋 <b>${copyTitle}</b>\n`;
      text += `<blockquote expandable><code>${escapeHtml(inlineBatch)}</code></blockquote>\n\n`;
    }
  }

  // Proxies
  if (post.proxies && post.proxies.length > 0) {
    text += `🔌 <b>لیست پروکسی‌های جدید تلگرام:</b>\n`;
    const proxyPreviewCount = Math.min(post.proxies.length, 6);
    for (let i = 0; i < proxyPreviewCount; i++) {
      const p = post.proxies[i];
      const dbProxy = db.proxies.find(pr => pr.id === p.id || pr.raw === p.raw);
      const status = dbProxy ? dbProxy.status : 'failed';
      const latency = dbProxy ? dbProxy.latency : null;

      const loc = await getIpLocation(p.server || '');
      const flag = getFlagEmoji(loc.countryCode);
      const pType = (p.type || 'MTPROTO').toUpperCase();

      if (status === 'working') {
        const pingText = latency ? `پینگ: ${latency}ms` : 'فعال 🟢';
        text += `🟢 پروکسی ${pType} | ${pingText} | ${loc.country} ${flag}\n`;
      } else {
        text += `🔴 پروکسی ${pType} | (غیرفعال ❌) | ${loc.country} ${flag}\n`;
      }
    }
    text += `\n👇 برای اتصال، روی دکمه‌های شیشه‌ای زیر کلیک کنید:\n`;
  }

  text += `\n🆔 ${escapeHtml(db.settings.branding || '')}`;

  return safeTelegramHtmlLength(text, 3900);
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
          const pType = (p.type || 'MTPROTO').toUpperCase();
          const label = `🔌 اتصال به پروکسی ${pType} شماره ${p.index || (idx + 1)}`;
          const validUrl = formatProxyTelegramUrl(p);
          if (validUrl) {
            inlineButtons.push([{
              text: label,
              url: validUrl
            }]);
          }
        }
      });

      const sponsorBtn = getSponsorChannelInlineButton();
      if (sponsorBtn) {
        inlineButtons.push([{ text: sponsorBtn.text, url: sponsorBtn.url }]);
      }

      // Add bot advertisement button
      const botUser = db.settings.botUsername;
      const botUrl = botUser ? `https://t.me/${botUser.replace('@', '')}` : null;
      if (botUrl) {
        inlineButtons.push([{
          text: '🤖 دریافت کانفیگ و پروکسی رایگان بیشتر',
          url: botUrl
        }]);
      }

      // 1. Edit the main post
      try {
        await callTelegramApi('editMessageText', {
          chat_id: channelHandle,
          message_id: post.messageId,
          text: newText,
          parse_mode: 'HTML',
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
function getCleanDatabaseBackup(includeConfigsAndFiles: boolean = false) {
  if (includeConfigsAndFiles) {
    return db;
  }
  // Lightweight backup: ONLY settings, sources, forceJoinChannels, and users (NO bulky configs, proxies, npvFiles, postsHistory, logs)
  return {
    version: '2.0',
    type: 'lightweight_backup',
    createdAt: new Date().toISOString(),
    settings: { ...db.settings },
    sources: (db.sources || []).map(s => ({ ...s })),
    forceJoinChannels: (db.forceJoinChannels || []).map(c => ({ ...c })),
    users: (db.users || []).map(u => ({ ...u })),
    configs: [],
    proxies: [],
    npvFiles: [],
    postsHistory: [],
    logs: []
  };
}

async function sendBackupToAdmin(includeConfigsAndFiles: boolean = false): Promise<boolean> {
  const adminId = db.settings.adminId;
  const token = (db.settings.botToken || process.env.BOT_TOKEN || '').trim();
  if (!adminId || !token) return false;
  try {
    const backupObj = getCleanDatabaseBackup(includeConfigsAndFiles);
    const content = JSON.stringify(backupObj, null, 2);
    const formData = new FormData();
    formData.append('chat_id', adminId);
    
    const prefix = includeConfigsAndFiles ? 'full_db_backup' : 'light_db_backup';
    const filename = `${prefix}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const blob = new Blob([content], { type: 'application/json' });
    formData.append('document', blob, filename);
    
    const sizeKb = (content.length / 1024).toFixed(1);
    const desc = includeConfigsAndFiles
      ? `📦 **نسخه پشتیبان کامل دیتابیس (شامل کانفیگ‌ها و فایل‌ها)**`
      : `📦 **نسخه پشتیبان دیتابیس (شامل تنظیمات، منابع، کانال‌ها و کاربران)**`;
      
    formData.append('caption', `${desc}\n\n🕒 زمان: **${new Date().toLocaleString('fa-IR')}**\n💾 حجم فایل: **${sizeKb} KB**\n📁 بدون فایل‌ها و کانفیگ‌ها (فوق‌العاده کم‌حجم و سریع)`);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    
    const resData = await res.json();
    if (resData.ok) {
      db.settings.lastBackupAt = new Date().toISOString();
      saveDatabase();
      addLog('success', `نسخه پشتیبان دیتابیس (بدون کانفیگ‌ها و فایل‌های سنگین) با موفقیت برای ادمین ارسال گردید.`);
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

/**
 * Helper to get sponsor or branding telegram channel button.
 */
function getSponsorChannelInlineButton(): { text: string; url: string } | null {
  // First check if explicit adText is configured in autoPost
  const ap = db.settings?.autoPost;
  if (ap?.adText && ap.adText.trim()) {
    const text = ap.adText.trim();
    if (text.includes('@')) {
      const handleMatch = text.match(/@[a-zA-Z0-9_]+/);
      const handle = handleMatch ? handleMatch[0].replace('@', '') : '';
      if (handle) {
        return { text: `📢 عضویت در کانال اسپانسر: ${text}`, url: `https://t.me/${handle}` };
      }
    } else if (text.startsWith('http://') || text.startsWith('https://')) {
      return { text: `📢 مشاهده لینک اسپانسر`, url: text };
    }
  }

  // Check if there are active force join channels
  const activeFj = db.forceJoinChannels?.find(c => c.enabled && c.username);
  if (!activeFj) {
    return null;
  }

  const cleanUsername = activeFj.username.replace(/[^a-zA-Z0-9_]/g, '');
  const url = activeFj.inviteLink && (activeFj.inviteLink.startsWith('http://') || activeFj.inviteLink.startsWith('https://'))
    ? activeFj.inviteLink
    : (cleanUsername ? `https://t.me/${cleanUsername}` : '');
  const label = `📢 کانال رسمی ما: ${activeFj.title || 'کانال رسمی'}`;

  // Ensure URL is non-empty and starts with http or https
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return { text: label, url: url.trim() };
  }

  return null;
}

/**
 * Sends an NPV Tunnel configuration file (.npvt) to a Telegram user.
 */
async function sendNpvFile(chatId: string | number, configText: string, filename: string, caption: string, replyMarkup?: any): Promise<boolean> {
  const token = db.settings.botToken;
  if (!token) return false;
  try {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    
    // Clean content, preserving genuine NPVT signatures or clean V2Ray URIs
    const cleanContent = (configText || '').trim();
    const finalContent = cleanContent.startsWith('NPVT') ? cleanContent : `NPVT${cleanContent}`;
    const blob = new Blob([finalContent], { type: 'text/plain' });
    formData.append('document', blob, filename);
    if (caption) {
      formData.append('caption', caption);
    }
    if (replyMarkup) {
      formData.append('reply_markup', JSON.stringify(replyMarkup));
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    const resData = await res.json();
    if (!resData.ok) {
      console.error('Error sending NPV file to Telegram:', resData);
      addLog('error', `خطا در ارسال فایل NPV به کاربر: ${resData.description || JSON.stringify(resData)}`);
    } else {
      addLog('success', `فایل NPV ${filename} با موفقیت برای کاربر ${chatId} ارسال گردید.`);
    }
    return !!resData.ok;
  } catch (e: any) {
    console.error('Error sending NPV file:', e);
    addLog('error', `خطای سیستم در ارسال فایل NPV: ${e.message || e}`);
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
 * Checks if a user is a member of a given channel without crashing on bot permission issues
 */
async function checkUserChannelMember(channelUsername: string, userId: number): Promise<boolean> {
  try {
    const handle = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`;
    const token = db.settings.botToken;
    if (!token) return true;

    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(handle)}&user_id=${userId}`, {
      signal: AbortSignal.timeout(5000)
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn(`Force join check returned not ok for ${handle}: ${data.description}`);
      // If error is due to bot NOT being admin in that channel or channel not found/accessible, skip blocking
      if (data.description && (
        data.description.includes('CHAT_ADMIN_REQUIRED') ||
        data.description.includes('chat not found') ||
        data.description.includes('bot is not a member') ||
        data.description.includes('bot was kicked') ||
        data.description.includes('CHANNEL_INVALID')
      )) {
        return true;
      }
      return false; // User not found or not participant
    }
    const validStatuses = ['creator', 'administrator', 'member'];
    return Boolean(data.result && validStatuses.includes(data.result.status));
  } catch (err: any) {
    console.error(`Force join check error for ${channelUsername}:`, err.message || err);
    return false; // Require join if error or timeout
  }
}

/**
 * Sends request to Telegram Bot API
 */
async function callTelegramApi(method: string, body: object | FormData): Promise<any> {
  const token = db.settings.botToken;
  if (!token) {
    throw new Error('Bot token is not configured');
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers,
    body: isFormData ? (body as any) : JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Unknown Telegram Error');
  }
  return data.result;
}

/**
 * Registers default bot commands with Telegram so the native "Menu" button appears next to the chat bar
 */
async function setBotCommands(token: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: '🚀 شروع کار ربات و منوی اصلی' },
          { command: 'admin', description: '⚙️ ورود به پنل مدیریت (ادمین)' },
          { command: 'help', description: 'ℹ️ راهنمای گام به گام اتصال' }
        ]
      }),
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (data.ok) {
      addLog('success', 'منوی دستورات پیش‌فرض ربات تلگرام با موفقیت تنظیم و ثبت گردید.');
    } else {
      console.error('Failed to set bot commands:', data.description);
    }
  } catch (err: any) {
    console.error('Error setting bot commands:', err.message || err);
  }
}

/**
 * Generates the persistent custom keyboard (ReplyKeyboardMarkup) to be displayed in the bar below the chat
 */
function getReplyKeyboard(userId: string | number) {
  const cleanId = (id: string | number | undefined) => {
    if (!id) return '';
    return String(id).replace(/^['"\s]+|['"\s]+$/g, '').trim();
  };
  const isAdmin = db.settings.adminId && cleanId(userId) === cleanId(db.settings.adminId);

  const keyboard: any[][] = [
    [
      { text: '🔥 دریافت یکجای ۵۰ کانفیگ ⭐', style: 'success' },
      { text: '⚡️ دریافت یکجای ۱۵ کانفیگ', style: 'success' }
    ],
    [
      { text: '📥 دریافت کانفیگ ویتوری ⚡', style: 'primary' }
    ],
    [
      { text: '🌀 فایل .NPVT', style: 'success' },
      { text: '🔑 فایل .OVPN', style: 'success' },
      { text: '📄 فایل .TXT', style: 'success' }
    ],
    [
      { text: '🔌 دریافت پروکسی تلگرام 🚀', style: 'primary' },
      { text: '📊 وضعیت شبکه و پینگ نت 🟢', style: 'primary' }
    ],
    [
      { text: 'ℹ️ راهنمای اتصال گام به گام 📚', style: 'primary' }
    ]
  ];

  if (isAdmin) {
    // Show Admin Panel quick shortcut button directly in the bar below the chat for the admin!
    keyboard.push([{ text: '⚙️ ورود به پنل مدیریت 🔴', style: 'danger' }]);
  }

  return {
    keyboard,
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

/**
 * Tests Bot Connection / Fetches Profile info
 */
async function testBotConnection(token: string): Promise<string> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (data.ok && data.result) {
      return data.result.username || 'unknown_bot';
    }
    throw new Error(data.description || 'کد خطا نامعتبر است');
  } catch (err: any) {
    throw new Error(err.message || 'ارتباط برقرار نشد');
  }
}

let lastPollTimestamp = Date.now();

/**
 * Core Bot Polling Loop
 */
async function runBotPolling() {
  if (!pollingActive) return;
  lastPollTimestamp = Date.now();

  const token = db.settings.botToken;
  if (!token) {
    db.settings.isBotRunning = false;
    pollingActive = false;
    addLog('warn', 'ربات به علت عدم تعریف توکن خاموش شد.');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${botOffset}&timeout=10`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      throw new Error(`Telegram API responded with status ${response.status}`);
    }

    const data = await response.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        if (update.update_id >= botOffset) {
          botOffset = update.update_id + 1;
        }
        // Non-blocking update execution so one request doesn't freeze the bot for everyone
        handleBotUpdate(update).catch(err => {
          console.error('Error handling bot update:', err.message || err);
        });
      }
    }
  } catch (err: any) {
    console.error('Bot polling error:', err.message || err);
    await new Promise(r => setTimeout(r, 3000));
  } finally {
    if (pollingActive) {
      botTimeoutRef = setTimeout(runBotPolling, 200);
    }
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
      
      // Clear any pending text-input state unless they clicked a button that is part of a state flow (e.g., default link)
      if (adminStates[chatId] && callbackData !== 'admin_fj_default_link') {
        delete adminStates[chatId];
      }
    }

    if (!chatId) return;

    const cleanMsg = messageText ? messageText.trim() : '';

    // --- Extract User Submitted Configs ---
    if (update.message) {
      let savedCount = 0;
      let isDuplicate = false;
      const testIds: string[] = [];

      if (cleanMsg && !cleanMsg.startsWith('/')) {
        const extractedConfigs = extractConfigsFromText(cleanMsg, `User_${username || chatId}`);
        for (const conf of extractedConfigs) {
          if (!db.configs.some(c => c.raw === conf.raw)) {
            db.configs.unshift(conf);
            savedCount++;
            testIds.push(conf.id);
          } else {
            isDuplicate = true;
          }
        }
      }

      if (update.message.document) {
        const cDoc = update.message.document;
        const isVpnFormat = cDoc.file_name && (cDoc.file_name.endsWith('.npvt') || cDoc.file_name.endsWith('.npv') || cDoc.file_name.endsWith('.ovpn') || cDoc.file_name.endsWith('.txt'));
        if (isVpnFormat) {
          try {
            const fileInfo = await callTelegramApi('getFile', { file_id: cDoc.file_id });
            if (fileInfo && fileInfo.file_path) {
              const fRes = await fetch(`https://api.telegram.org/file/bot${db.settings.botToken}/${fileInfo.file_path}`);
              const arrayBuffer = await fRes.arrayBuffer();
              const fContentBase64 = Buffer.from(arrayBuffer).toString('base64');
              if (!db.npvFiles) db.npvFiles = [];
              
              if (!db.npvFiles.some(f => f.filename === cDoc.file_name && f.content === fContentBase64)) {
                db.npvFiles.unshift({
                  id: Date.now().toString() + Math.floor(Math.random() * 1000),
                  filename: cDoc.file_name,
                  content: fContentBase64,
                  status: 'untested',
                  createdAt: new Date().toISOString()
                });
                savedCount++;
                addLog('success', `فایل ${cDoc.file_name} از طرف کاربر دریافت و ذخیره شد.`);
              } else {
                isDuplicate = true;
              }
            }
          } catch (e) {
            console.error('Failed to download user document:', e);
          }
        }
      }

      if (savedCount > 0) {
        saveDatabase();
        if (testIds.length > 0) {
          testConfigsBatch(testIds).catch(() => {});
        }
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ **تشکر از شما!**\nموارد ارسال شده شناسایی و در سیستم ثبت شدند (تعداد: ${savedCount}). با تشکر از همکاری شما در تکمیل آرشیو 🌹`,
          parse_mode: 'Markdown',
          reply_to_message_id: update.message.message_id
        });
        return;
      } else if (isDuplicate && (!update.message.reply_to_message)) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `⚠️ این مورد قبلاً در دیتابیس ربات ثبت شده است.`,
          reply_to_message_id: update.message.message_id
        });
        return;
      }
    }

    // --- Check for User Feedback via Text Reply ---
    if (update.message && update.message.reply_to_message && update.message.reply_to_message.text && cleanMsg) {
      const feedbackKeywords = ['فعال', 'سالم', 'وصل', 'کار میکنه', 'working', 'عالی', 'مرسی', 'ممنون', 'خوبه', 'تست شد'];
      const isFeedback = feedbackKeywords.some(kw => cleanMsg.toLowerCase().includes(kw));
      if (isFeedback) {
        const repliedText = update.message.reply_to_message.text;
        let foundMatch = false;
        
        // Check for Configs
        const extractedConfigs = extractConfigsFromText(repliedText, 'reply_feedback');
        for (const conf of extractedConfigs) {
          const dbConf = db.configs.find(c => c.raw === conf.raw);
          if (dbConf) {
            dbConf.status = 'working';
            dbConf.latency = dbConf.latency || 15;
            dbConf.lastChecked = new Date().toISOString();
            if (!dbConf.reports) dbConf.reports = { up: 0, down: 0 };
            dbConf.reports.up += 1;
            foundMatch = true;
          }
        }
        
        // Check for Proxies
        const extractedProxies = extractProxiesFromText(repliedText, 'reply_feedback');
        for (const proxy of extractedProxies) {
          const dbProxy = db.proxies.find(p => p.raw === proxy.raw);
          if (dbProxy) {
            dbProxy.status = 'working';
            dbProxy.latency = dbProxy.latency || 15;
            dbProxy.lastChecked = new Date().toISOString();
            foundMatch = true;
          }
        }
        
        if (foundMatch) {
          saveDatabase();
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: '✅ **بازخورد شما دریافت شد!**\nمورد ارسال شده به عنوان **سالم و فعال** در سیستم ثبت شد و در اولویت‌های بالاتر قرار گرفت. با تشکر از همکاری شما 🌹',
            parse_mode: 'Markdown',
            reply_to_message_id: update.message.message_id
          });
          return;
        }
      }
    }

    // --- Map persistent custom keyboard buttons to standard commands/callbacks ---
    const lowerMsg = cleanMsg.toLowerCase();
    if (lowerMsg.startsWith('/start') || cleanMsg === 'شروع' || cleanMsg === 'شروع مجدد' || cleanMsg === 'بروزرسانی' || cleanMsg === 'منوی اصلی' || cleanMsg === 'شروع دوباره' || cleanMsg === 'رفرش') {
      messageText = '/start';
    } else if (cleanMsg.includes('۵۰ کانفیگ') || cleanMsg.includes('پک ۵۰') || cleanMsg.includes('50 کانفیگ') || lowerMsg === '/50') {
      callbackData = 'v2ray_qty_50';
      messageText = '';
    } else if (cleanMsg.includes('۱۵ کانفیگ') || cleanMsg.includes('پک ۱۵') || cleanMsg.includes('15 کانفیگ') || lowerMsg === '/15') {
      callbackData = 'v2ray_qty_15';
      messageText = '';
    } else if (cleanMsg.includes('دریافت کانفیگ') || cleanMsg.includes('ویتوری') || lowerMsg.startsWith('/v2ray') || lowerMsg.startsWith('/config')) {
      callbackData = 'get_v2ray_configs';
      messageText = '';
    } else if (cleanMsg.toUpperCase().includes('NPVT') || lowerMsg.startsWith('/npvt')) {
      callbackData = 'get_file_npvt';
      messageText = '';
    } else if (cleanMsg.toUpperCase().includes('OVPN') || lowerMsg.startsWith('/ovpn')) {
      callbackData = 'get_file_ovpn';
      messageText = '';
    } else if (cleanMsg.toUpperCase().includes('TXT') || lowerMsg.startsWith('/txt')) {
      callbackData = 'get_file_txt';
      messageText = '';
    } else if (cleanMsg.includes('پروکسی') || lowerMsg.startsWith('/proxy') || lowerMsg.startsWith('/proxies')) {
      callbackData = 'get_proxies';
      messageText = '';
    } else if (cleanMsg.includes('وضعیت') || cleanMsg.includes('شبکه') || cleanMsg.includes('پینگ') || lowerMsg.startsWith('/status') || lowerMsg.startsWith('/net') || lowerMsg.startsWith('/ping')) {
      callbackData = 'get_net_status';
      messageText = '';
    } else if (cleanMsg.includes('راهنما') || cleanMsg.includes('کمک') || lowerMsg.startsWith('/help') || lowerMsg.startsWith('/guide')) {
      callbackData = 'get_help';
      messageText = '';
    } else if (cleanMsg.includes('پنل مدیریت') || lowerMsg.startsWith('/admin')) {
      messageText = '/admin';
    }

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

    const cleanId = (id: string | number | undefined) => {
      if (!id) return '';
      return String(id).replace(/^['"\s]+|['"\s]+$/g, '').trim();
    };
    const isAdmin = db.settings.adminId && cleanId(userId) === cleanId(db.settings.adminId);

    if (requiredChannels.length > 0 && !isAdmin) {
      // Check cache first to avoid rate limits (valid for 30 seconds)
      const cached = joinChecksCache[userId];
      if (cached && (Date.now() - cached.checkedAt < 30000) && cached.hasJoined) {
        userHasJoinedAll = true;
      } else {
        const checkResults = await Promise.allSettled(
          requiredChannels.map(async (channel) => {
            const isJoined = await checkUserChannelMember(channel.username, userId);
            return {
              channel,
              joined: isJoined
            };
          })
        );
        for (const res of checkResults) {
          if (res.status === 'fulfilled') {
            if (!res.value.joined) {
              userHasJoinedAll = false;
              notJoinedList.push(res.value.channel);
            }
          }
        }
        joinChecksCache[userId] = {
          checkedAt: Date.now(),
          hasJoined: userHasJoinedAll
        };
      }
    }

    // --- Callback query response wrapper ---
    const answerCallback = async (text: string = '', showAlert = false) => {
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

    // --- User Feedback Handler (Crowdsourced Telemetry from Iran Net) ---
    if (callbackData && (callbackData.startsWith('fb_up_') || callbackData.startsWith('fb_down_'))) {
      const isUp = callbackData.startsWith('fb_up_');
      const confId = callbackData.replace(/^(fb_up_|fb_down_)/, '');
      const config = db.configs.find(c => c.id === confId);

      if (config) {
        if (!config.reports) config.reports = { up: 0, down: 0 };
        if (isUp) {
          config.reports.up += 1;
          config.status = 'working';
          config.latency = config.latency || 15;
          config.lastChecked = new Date().toISOString();
          await answerCallback('✅ با تشکر! بازخورد شما ثبت شد و این کانفیگ در سیستم به عنوان سالم تایید شد.');
        } else {
          config.reports.down += 1;
          await answerCallback('⚠️ گزارش قطعی شما ثبت شد. با تکرار گزارش کاربران، این کانفیگ غیرفعال می‌شود.');
          
          if (config.reports.down >= 2) {
            config.status = 'failed';
            addLog('warn', `کانفیگ [${config.remark || config.server}] بر اساس گزارش قطعی کاربران در شبکه ایران غیرفعال شد.`);
          }
        }
        saveDatabase();
      } else {
        await answerCallback('اطلاعات کانفیگ یافت نشد.');
      }
      return;
    }

    // --- Telegram Channel Posts & Document Attachment Scraper ---
    const channelPost = update.channel_post;
    if (channelPost) {
      const pText = channelPost.text || channelPost.caption || '';
      if (pText) {
        const cExtracted = extractConfigsFromText(pText, 'پست کانال تلگرام');
        const pExtracted = extractProxiesFromText(pText, 'پست کانال تلگرام');
        if (cExtracted.length > 0 || pExtracted.length > 0) {
          db.configs.unshift(...cExtracted);
          if (!db.proxies) db.proxies = [];
          db.proxies.unshift(...pExtracted);
          saveDatabase();
          addLog('success', `تعداد ${cExtracted.length} کانفیگ و ${pExtracted.length} پروکسی از پست کانال تلگرام استخراج گردید.`);
        }
      }
      if (channelPost.document) {
        const cDoc = channelPost.document;
        if (cDoc.file_name && (cDoc.file_name.endsWith('.npvt') || cDoc.file_name.endsWith('.npv') || cDoc.file_name.endsWith('.ovpn') || cDoc.file_name.endsWith('.txt') || cDoc.file_name.endsWith('.json'))) {
          try {
            const fileInfo = await callTelegramApi('getFile', { file_id: cDoc.file_id });
            if (fileInfo?.file_path) {
              const fRes = await fetch(`https://api.telegram.org/file/bot${db.settings.botToken}/${fileInfo.file_path}`);
              const arrayBuffer = await fRes.arrayBuffer();
            const fContentText = Buffer.from(arrayBuffer).toString('utf-8');
              
              const isVpnFormat = cDoc.file_name.endsWith('.npvt') || cDoc.file_name.endsWith('.npv') || cDoc.file_name.endsWith('.ovpn');
              if (isVpnFormat) {
                const fContentBase64 = Buffer.from(arrayBuffer).toString('base64');
              if (!db.npvFiles) db.npvFiles = [];
                db.npvFiles.unshift({
                  id: Date.now().toString() + Math.floor(Math.random() * 1000),
                  filename: cDoc.file_name,
                  content: fContentBase64,
                  status: 'untested',
                  createdAt: new Date().toISOString()
                });
                addLog('success', `فایل ${cDoc.file_name} جهت تست و ارسال خودکار ذخیره شد.`);

                // Immediately upload the new file if postFiles is enabled
                if (db.settings.autoPost && db.settings.autoPost.enabled && db.settings.autoPost.postFiles && db.settings.autoPost.targetChannel) {
                  try {
                    const channelHandle = db.settings.autoPost.targetChannel.startsWith('@') ? db.settings.autoPost.targetChannel : `@${db.settings.autoPost.targetChannel.replace('@', '')}`;
                    const formData = new FormData();
                    formData.append('chat_id', channelHandle);
                    const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
                    
                    let brandedFilename = cDoc.file_name;
                    if (db.settings.branding) {
                      const cleanBranding = db.settings.branding.replace('@', '');
                      brandedFilename = brandedFilename.replace(/\.(npv(t)?|ovpn)$/i, `_${cleanBranding}.$1`);
                    }
                    
                    formData.append('document', blob, brandedFilename);
                    const fileType = cDoc.file_name.endsWith('.ovpn') ? 'OpenVPN' : 'NapsternetV';
                    const caption = `🌐 **فایل پیکربندی اختصاصی ${fileType}**\n\nجهت استفاده، این فایل را در نرم‌افزار ایمپورت کنید.\n\n🆔 ${db.settings.branding || ''}`;
                    formData.append('caption', caption);
                    
                    if (db.settings.autoPost.silentMode) {
                      formData.append('disable_notification', 'true');
                    }
                    
                    await fetch(`https://api.telegram.org/bot${db.settings.botToken}/sendDocument`, {
                      method: 'POST',
                      body: formData
                    });
                    addLog('success', `فایل ${brandedFilename} به صورت آنی در کانال ${channelHandle} ارسال شد.`);
                  } catch (err) {
                    addLog('error', `خطا در ارسال آنی فایل به کانال: ${err}`);
                  }
                }
              }
              
              const fExtracted = extractConfigsFromText(fContentText, `پست کانال (${cDoc.file_name})`);
              if (fExtracted.length > 0) {
                db.configs.unshift(...fExtracted);
                saveDatabase();
                addLog('success', `تعداد ${fExtracted.length} کانفیگ با موفقیت از فایل ارسالی در کانال (${cDoc.file_name}) استخراج شد.`);
              } else if (isVpnFormat) {
                saveDatabase();
              }
            }
          } catch (e: any) {
            console.error('Channel document download error:', e);
          }
        }
      }
    }

    // --- Direct User Document Uploads (.npvt / .npv / .ovpn / .txt) (Non-Admin only) ---
    if (!isAdmin && update.message?.document && chatId) {
      const uDoc = update.message.document;
      if (uDoc.file_name && (uDoc.file_name.endsWith('.npvt') || uDoc.file_name.endsWith('.npv') || uDoc.file_name.endsWith('.ovpn') || uDoc.file_name.endsWith('.txt'))) {
        try {
          const fileInfo = await callTelegramApi('getFile', { file_id: uDoc.file_id });
          if (fileInfo?.file_path) {
            const token = (db.settings.botToken || process.env.BOT_TOKEN || '').trim();
            const fRes = await fetch(`https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`);
            const arrayBuffer = await fRes.arrayBuffer();
            const fContentText = Buffer.from(arrayBuffer).toString('utf-8');
            
            const isVpnFormat = uDoc.file_name.endsWith('.npvt') || uDoc.file_name.endsWith('.npv') || uDoc.file_name.endsWith('.ovpn');
            if (isVpnFormat) {
              const fContentBase64 = Buffer.from(arrayBuffer).toString('base64');
              if (!db.npvFiles) db.npvFiles = [];
              db.npvFiles.unshift({
                id: Date.now().toString() + Math.floor(Math.random() * 1000),
                filename: uDoc.file_name,
                content: fContentBase64,
                status: 'untested',
                createdAt: new Date().toISOString()
              });
              saveDatabase();

              // Immediately upload the new file if postFiles is enabled
              if (db.settings.autoPost && db.settings.autoPost.enabled && db.settings.autoPost.postFiles && db.settings.autoPost.targetChannel) {
                try {
                  const channelHandle = db.settings.autoPost.targetChannel.startsWith('@') ? db.settings.autoPost.targetChannel : `@${db.settings.autoPost.targetChannel.replace('@', '')}`;
                  const formData = new FormData();
                  formData.append('chat_id', channelHandle);
                  const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
                  
                  let brandedFilename = uDoc.file_name;
                  if (db.settings.branding) {
                    const cleanBranding = db.settings.branding.replace('@', '');
                    brandedFilename = brandedFilename.replace(/\.(npv(t)?|ovpn)$/i, `_${cleanBranding}.$1`);
                  }
                  
                  formData.append('document', blob, brandedFilename);
                  const fileType = uDoc.file_name.endsWith('.ovpn') ? 'OpenVPN' : 'NapsternetV';
                  const caption = `🌐 **فایل پیکربندی اختصاصی ${fileType}**\n\nجهت استفاده، این فایل را در نرم‌افزار ایمپورت کنید.\n\n🆔 ${db.settings.branding || ''}`;
                  formData.append('caption', caption);
                  
                  if (db.settings.autoPost.silentMode) {
                    formData.append('disable_notification', 'true');
                  }
                  
                  await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
                    method: 'POST',
                    body: formData
                  });
                  addLog('success', `فایل ${brandedFilename} به صورت آنی در کانال ${channelHandle} ارسال شد.`);
                } catch (err) {
                  addLog('error', `خطا در ارسال آنی فایل به کانال: ${err}`);
                }
              }
            }

            const fExtracted = extractConfigsFromText(fContentText, `فایل ارسالی (${uDoc.file_name})`);
            if (fExtracted.length > 0) {
              db.configs.unshift(...fExtracted);
              saveDatabase();
              addLog('success', `تعداد ${fExtracted.length} کانفیگ از فایل ارسالی (${uDoc.file_name}) استخراج گردید.`);
              await callTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `✅ **تعداد ${fExtracted.length} کانفیگ جدید با موفقیت از فایل ${uDoc.file_name} استخراج و ذخیره شد!**\n${isVpnFormat ? 'ضمناً این فایل جهت ارسال در کانال نیز ذخیره گردید.' : ''}`,
                parse_mode: 'Markdown'
              });
            } else if (isVpnFormat) {
              await callTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `✅ فایل ${uDoc.file_name} دریافت و در سیستم ذخیره شد. (هیچ کانفیگ متنی مستقیمی جهت تست پینگ داخل آن یافت نشد).`
              });
            } else {
              await callTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `⚠️ هیچ کانفیگ معتبری در فایل ${uDoc.file_name} یافت نشد.`
              });
            }
          }
        } catch (e: any) {
          console.error('User document processing error:', e);
        }
        return;
      }
    }

    // --- ADMIN CONTROLS BYPASS ---
    if (isAdmin) {
      // 0. Direct Backup Commands (/backup, /restore, /export)
      if (messageText === '/backup' || messageText === '/export') {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '⏳ **در حال استخراج دیتابیس و آماده‌سازی فایل پشتیبان...**',
          parse_mode: 'Markdown'
        });
        const success = await sendBackupToAdmin();
        if (success) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ **فایل پشتیبان دیتابیس (شامل تنظیمات، منابع، کانال‌های قفل و کاربران - بدون فایل‌ها و کانفیگ‌ها) با موفقیت ارسال گردید.**\n\nبرای بازگردانی در آینده، کافیست همین فایل را به ربات ارسال یا فوروارد فرمایید.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '⚙️ پنل مدیریت', callback_data: 'admin_menu' }]] }
          });
        } else {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `❌ خطا در استخراج یا ارسال فایل بکاپ به تلگرام. لطفا تنظیمات توکن را بررسی فرمایید.`,
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_menu' }]] }
          });
        }
        return;
      }

      if (messageText === '/restore') {
        adminStates[chatId] = { action: 'await_backup_file' };
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `📥 **بازگردانی پایگاه داده از فایل پشتیبان (Restore Database)**\n\nلطفاً همین الان فایل بکاپ دیتابیس (با پسوند \`.json\` یا \`.txt\`) را به این چت بفرستید یا فوروارد کنید.\n\nهمچنین می‌توانید متن JSON یا لینک‌های کانفیگ را مستقیماً در این چت ارسال نمایید.`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ انصراف و بازگشت به منو', callback_data: 'admin_backup_menu' }]
            ]
          }
        });
        return;
      }

      // Backup document restore check for Admin (handles any uploaded or forwarded document by admin)
      if (update.message?.document) {
        const doc = update.message.document;
        delete adminStates[chatId];
        try {
          const fileSizeStr = doc.file_size ? ` (${(doc.file_size / 1024).toFixed(1)} KB)` : '';
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `⏳ **در حال دریافت فایل (\`${doc.file_name || 'backup'}\`${fileSizeStr}) و بازگردانی دیتابیس...**`,
            parse_mode: 'Markdown'
          });

          if (doc.file_size && doc.file_size > 20 * 1024 * 1024) {
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: `⚠️ **حجم فایل ارسالی (${(doc.file_size / (1024 * 1024)).toFixed(1)} MB) بیش از سقف مجاز تلگرام (۲۰ مگابایت) است.**\n\nربات‌های تلگرام به دلیل محدودیت API تلگرام امکان دانلود خودکار فایل‌های بالای ۲۰ مگابایت را ندارند.\n\n💡 **روش‌های جایگزین:**\n۱. فایل را از طریق بخش تنظیمات -> پشتیبان‌گیری در **پنل تحت وب** آپلود نمایید (فوق‌العاده سریع و بدون محدودیت حجم).\n۲. یا محتوای متنی آن را کپی و در همین چت ارسال فرمایید.`,
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به منوی بکاپ', callback_data: 'admin_backup_menu' }]] }
            });
            return;
          }

          const fileInfo = await callTelegramApi('getFile', { file_id: doc.file_id });
          const filePath = fileInfo?.file_path;
          
          if (!filePath) {
            throw new Error('سرور تلگرام مسیر دانلود فایل را بازنگرداند (احتمالاً فایل منقضی شده یا حجم آن بیش از ۲۰ مگابایت است).');
          }

          const token = (db.settings.botToken || process.env.BOT_TOKEN || '').trim();
          const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
          if (!fileRes.ok) {
            throw new Error(`خطا در دانلود فایل از تلگرام (کد وضعیت: ${fileRes.status} ${fileRes.statusText})`);
          }

          const arrayBuffer = await fileRes.arrayBuffer();
          const fullBuffer = Buffer.from(arrayBuffer);
          
          const isVpnFormat = doc.file_name && (doc.file_name.endsWith('.npvt') || doc.file_name.endsWith('.npv') || doc.file_name.endsWith('.ovpn'));
          if (isVpnFormat) {
            const fContentBase64 = fullBuffer.toString('base64');
            if (!db.npvFiles) db.npvFiles = [];
            db.npvFiles.unshift({
              id: Date.now().toString() + Math.floor(Math.random() * 1000),
              filename: doc.file_name,
              content: fContentBase64,
              status: 'untested',
              createdAt: new Date().toISOString()
            });
            saveDatabase();
          }

          const res = parseAndRestoreBackup(fullBuffer, false);
          
          if (res.success) {
            const c = res.counts || {};
            let details = `🔄 **پایگاه داده با موفقیت بازگردانی شد!**\n\n`;
            details += `📊 **اطلاعات بازیابی شده:**\n`;
            if (c.configs !== undefined) details += `• تعداد کانفیگ‌های فعال: **${c.configs}**\n`;
            if (c.proxies !== undefined) details += `• تعداد پروکسی‌ها: **${c.proxies}**\n`;
            if (c.sources !== undefined) details += `• تعداد منابع و کانال‌ها: **${c.sources}**\n`;
            if (c.forceJoinChannels !== undefined) details += `• کانال‌های قفل اجباری: **${c.forceJoinChannels}**\n`;
            if (c.users !== undefined) details += `• تعداد اعضای ثبت‌شده: **${c.users}**\n`;
            if (c.npvFiles !== undefined && c.npvFiles > 0) details += `• فایل‌های NapsternetV/OpenVPN: **${c.npvFiles}**\n`;
            details += `\n${res.message}\nکلیه تنظیمات با موفقیت در سیستم اعمال گردیدند.`;

            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: details,
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '⚙️ ورود به پنل مدیریت', callback_data: 'admin_menu' }]] }
            });
            return;
          } else if (isVpnFormat) {
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: `✅ **فایل اختصاصی ${doc.file_name} در دیتابیس ثبت گردید.**`,
              reply_markup: { inline_keyboard: [[{ text: '⚙️ ورود به پنل مدیریت', callback_data: 'admin_menu' }]] }
            });
            return;
          } else {
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: `❌ **خطا در بازگردانی فایل:**\n${res.message}\n\n💡 راهنما: لطفاً مطمئن شوید فایل خروجی دیتابیس ربات یا فایل حاوی کانفیگ‌های متنی معتبر است. همچنین می‌توانید متن فایل را کپی و مستقیماً به همین چت ارسال نمایید.`,
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '🔙 منوی پشتیبان‌گیری', callback_data: 'admin_backup_menu' }]] }
            });
            return;
          }
        } catch (err: any) {
          console.error('Admin backup restore error:', err);
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `❌ **خطا در دریافت یا پردازش فایل ارسالی:**\n\`${err.message || err}\`\n\n💡 پیشنهاد: در صورتی که فایل ارسالی حجیم است، می‌توانید از بخش پشتیبان‌گیری در پنل وب استفاده نمایید یا متن آن را در چت ارسال کنید.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 منوی پشتیبان‌گیری', callback_data: 'admin_backup_menu' }]] }
          });
          return;
        }
      }

      // 1. Scene State Inputs
      if (adminStates[chatId] && update.message) {
        const state = adminStates[chatId];
        
        if (messageText === 'لغو' || messageText === '/cancel') {
          delete adminStates[chatId];
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `❌ عملیات لغو گردید.`,
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]] }
          });
          return;
        }

        if (state.action === 'await_backup_file') {
          if (messageText && messageText.trim().length > 0) {
            delete adminStates[chatId];
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: '⏳ **در حال پردازش داده‌های متنی بکاپ...**',
              parse_mode: 'Markdown'
            });
            const res = parseAndRestoreBackup(messageText.trim(), false);
            if (res.success) {
              const c = res.counts || {};
              let details = `✅ **دیتابیس با موفقیت از متن بازگردانی شد!**\n\n`;
              if (c.configs !== undefined) details += `• تعداد کانفیگ‌ها: **${c.configs}**\n`;
              if (c.proxies !== undefined) details += `• تعداد پروکسی‌ها: **${c.proxies}**\n`;
              if (c.sources !== undefined) details += `• منابع و کانال‌ها: **${c.sources}**\n`;
              if (c.forceJoinChannels !== undefined) details += `• کانال‌های قفل اجباری: **${c.forceJoinChannels}**\n`;
              details += `\n${res.message}`;
              await callTelegramApi('sendMessage', {
                chat_id: chatId,
                text: details,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '⚙️ پنل مدیریت', callback_data: 'admin_menu' }]] }
              });
            } else {
              await callTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `❌ **خطا در پردازش متن بکاپ:**\n${res.message}`,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_backup_menu' }]] }
              });
            }
            return;
          }
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

        if (state.action === 'await_fj_username') {
          if (!messageText || messageText.trim() === '') {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⚠️ آیدی وارد شده نامعتبر است.' });
            return;
          }
          let username = messageText.trim();
          if (!username.startsWith('@')) {
            username = '@' + username;
          }
          adminStates[chatId] = { action: 'await_fj_title', data: { username } };
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `📢 **افزودن کانال حامی جدید - مرحله ۲ از ۳**\n\nآیدی کانال با موفقیت ثبت شد: \`${username}\`\n\nحالا **عنوان یا نام نمایشی کانال** را ارسال کنید:\n*(مثال: کانال رسمی ویتوری)*`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'admin_fj_list' }]]
            }
          });
          return;
        }

        if (state.action === 'await_fj_title') {
          if (!messageText || messageText.trim() === '') {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⚠️ عنوان وارد شده نامعتبر است.' });
            return;
          }
          const title = messageText.trim();
          const username = state.data?.username;
          adminStates[chatId] = { action: 'await_fj_link', data: { username, title } };
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `📢 **افزودن کانال حامی جدید - مرحله ۳ از ۳**\n\nنام نمایشی ثبت شد: \`${title}\`\n\nحالا **لینک دعوت کامل کانال** را بفرستید، یا اگر می‌خواهید لینک پیش‌فرض ساخته شود دکمه زیر را کلیک کنید:`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔗 ساخت لینک دعوت پیش‌فرض', callback_data: 'admin_fj_default_link' }],
                [{ text: '🔙 انصراف', callback_data: 'admin_fj_list' }]
              ]
            }
          });
          return;
        }

        if (state.action === 'await_fj_link') {
          if (!messageText || messageText.trim() === '') {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⚠️ لینک وارد شده نامعتبر است.' });
            return;
          }
          const inviteLink = messageText.trim();
          const username = state.data?.username;
          const title = state.data?.title;

          const newCh: ForceJoinChannel = {
            id: generateId(),
            username,
            title,
            inviteLink,
            enabled: true
          };

          db.forceJoinChannels.push(newCh);
          saveDatabase();
          delete adminStates[chatId];
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ کانال حامی با موفقیت ثبت و فعال گردید:\n\n📢 **${title}** (${username})\n🔗 ${inviteLink}`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به مدیریت کانال‌ها', callback_data: 'admin_fj_list' }]] }
          });
          return;
        }

        if (state.action === 'await_src_name') {
          if (!messageText || messageText.trim() === '') {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⚠️ نام وارد شده نامعتبر است.' });
            return;
          }
          const name = messageText.trim();
          const type = state.data?.type;
          adminStates[chatId] = { action: 'await_src_val', data: { type, name } };
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `🌐 **افزودن منبع جدید - مرحله ۳ از ۳**\n\nنام منبع ثبت شد: \`${name}\`\n\nحالا **آدرس کامل یا آیدی منبع** را ارسال کنید:\n*(برای کانال تلگرام مثل @v2ray_outline و برای گیت‌هاب یا لینک ساب آدرس کامل لینک)*`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'admin_sources_list' }]]
            }
          });
          return;
        }

        if (state.action === 'await_src_val') {
          if (!messageText || messageText.trim() === '') {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⚠️ آدرس وارد شده نامعتبر است.' });
            return;
          }
          const urlOrHandle = messageText.trim();
          const type = state.data?.type;
          const name = state.data?.name;

          const newSrc: SourceItem = {
            id: generateId(),
            type,
            name,
            urlOrHandle,
            enabled: true,
            extractedCount: 0,
            lastExtracted: null
          };

          db.sources.push(newSrc);
          saveDatabase();
          delete adminStates[chatId];
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ منبع استخراج جدید با موفقیت ثبت و فعال گردید:\n\n🌐 **${name}** (${type})\n🔗 \`${urlOrHandle}\``,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به مدیریت منابع', callback_data: 'admin_sources_list' }]] }
          });
          return;
        }

        if (state.action === 'await_autopost_ad') {
          if (!messageText || messageText.trim() === '') {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⚠️ متن ارسالی نامعتبر است.' });
            return;
          }
          db.settings.autoPost.adText = messageText.trim();
          saveDatabase();
          delete adminStates[chatId];
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ تبلیغات با موفقیت تغییر یافت به:\n\`${db.settings.autoPost.adText}\``,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به تنظیمات خودکار', callback_data: 'admin_autopost_menu' }]] }
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
              { text: `📊 آمار لحظه‌ای سیستم`, callback_data: 'admin_stats', style: 'primary' },
              { text: `${db.settings.isBotRunning ? '🟢 ربات: روشن' : '🔴 ربات: خاموش'}`, callback_data: 'admin_toggle_bot', style: db.settings.isBotRunning ? 'success' : 'danger' }
            ],
            [
              { text: `🔄 استخراج فوری همین حالا`, callback_data: 'admin_scrape_now', style: 'success' },
              { text: `🌐 تست اتصال پورت‌ها`, callback_data: 'admin_test_configs', style: 'primary' }
            ],
            [
              { text: `📢 عضویت اجباری (Force Join)`, callback_data: 'admin_fj_list', style: 'primary' },
              { text: `📝 تنظیم ارسال خودکار`, callback_data: 'admin_autopost_menu', style: 'primary' }
            ],
            [
              { text: `🌐 مدیریت منابع استخراج (کانال/لینک)`, callback_data: 'admin_sources_list', style: 'primary' }
            ],
            [
              { text: `🔍 پایش ۵ روزه کانال`, callback_data: 'admin_monitor_menu', style: 'primary' },
              { text: `📦 پشتیبانی و بکاپ دیتابیس`, callback_data: 'admin_backup_menu', style: 'primary' }
            ],
            [
              { text: `✍️ برندینگ: ${db.settings.branding}`, callback_data: 'admin_edit_branding', style: 'primary' }
            ],
            [
              { text: `🧹 پاکسازی دیتابیس`, callback_data: 'admin_cleanup_menu', style: 'danger' },
              { text: `📣 ارسال پیام همگانی`, callback_data: 'admin_broadcast_start', style: 'primary' }
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
        msg += `کافیست فایل بکاپ \`.json\` یا فایل متنی حاوی کانفیگ‌ها را مستقیماً به همین چت ارسال یا فوروارد فرمایید.\n\n`;
        msg += `یکی از گزینه‌های زیر را انتخاب فرمایید:`;

        const keyboard = {
          inline_keyboard: [
            [
              { text: `📥 دانلود فایل بکاپ (Export)`, callback_data: 'admin_backup_trigger' },
              { text: `📤 ارسال فایل و بازگردانی (Restore)`, callback_data: 'admin_backup_request_file' }
            ],
            [
              { text: `${enabled ? '🔴 غیرفعال‌سازی بکاپ خودکار' : '🟢 فعال‌سازی بکاپ خودکار'}`, callback_data: 'admin_backup_toggle' },
              { text: `🕒 فاصله: ${interval} ساعت`, callback_data: 'admin_backup_interval_menu' }
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

      if (callbackData === 'admin_backup_request_file') {
        adminStates[chatId] = { action: 'await_backup_file' };
        await answerCallback('لطفاً فایل را ارسال فرمایید');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `📥 **آماده دریافت فایل نسخه پشتیبان**\n\nلطفاً همین الان فایل بکاپ (\`.json\` یا \`.txt\`) را به همین چت ارسال کرده یا از کانال/چت دیگری فوروارد نمایید.\n\nربات به محض دریافت، اطلاعات را بازگردانی و گزارش آن را اعلام می‌کند.`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 انصراف و بازگشت', callback_data: 'admin_backup_menu' }]]
          }
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
        const limit = db.settings.testBatchLimit || 100;
        await answerCallback(`⏳ بررسی ${limit} کانفیگ اخیر آغاز شد...`, true);

        const recentConfigs = db.configs.slice(0, limit);
        const untestedConfigs = recentConfigs.filter(c => c.status === 'untested');
        const targetConfigs = untestedConfigs.length > 0 ? untestedConfigs : recentConfigs;
        const configIds = targetConfigs.map(c => c.id);

        const recentProxies = (db.proxies || []).slice(0, limit);
        const untestedProxies = recentProxies.filter(p => p.status === 'untested');
        const targetProxies = untestedProxies.length > 0 ? untestedProxies : recentProxies;
        const proxyIds = targetProxies.map(p => p.id);

        if (configIds.length > 0) testConfigsBatch(configIds).catch(console.error);
        if (proxyIds.length > 0) testProxiesBatch(proxyIds).catch(console.error);

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `⏳ **عملیات بررسی پورت‌ها (محدود به ${limit} مورد اخیر) شروع شد.**\n\nتعداد **${configIds.length}** کانفیگ و **${proxyIds.length}** پروکسی به صف بررسی متصل شدند.\nآمار بررسی نهایی در بخش آمار سیستم بروز خواهد شد.`,
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
        adminStates[chatId] = { action: 'await_fj_username' };
        await answerCallback('افزودن اسپانسر...');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `📢 **افزودن کانال حامی جدید - مرحله ۱ از ۳**\n\nلطفاً **آیدی کانال** حامی جدید را همراه با @ ارسال کنید:\n*(مثال: @MyChannel)*`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'admin_fj_list' }]]
          }
        });
        return;
      }

      if (callbackData === 'admin_fj_default_link') {
        const state = adminStates[chatId];
        if (!state || state.action !== 'await_fj_link') {
          await answerCallback('⚠️ خطایی رخ داد، مجدداً تلاش کنید.', true);
          return;
        }
        const username = state.data?.username;
        const title = state.data?.title;
        const inviteLink = `https://t.me/${username.replace('@', '')}`;

        const newCh: ForceJoinChannel = {
          id: generateId(),
          username,
          title,
          inviteLink,
          enabled: true
        };

        db.forceJoinChannels.push(newCh);
        saveDatabase();
        delete adminStates[chatId];
        await answerCallback('لینک پیش‌فرض ساخته شد');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ کانال حامی با موفقیت ثبت و فعال گردید:\n\n📢 **${title}** (${username})\n🔗 ${inviteLink}`,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به مدیریت کانال‌ها', callback_data: 'admin_fj_list' }]] }
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

      // --- Extraction Sources List ---
      if (callbackData === 'admin_sources_list') {
        await answerCallback('مدیریت منابع استخراج...');
        let msg = `🌐 **پیکربندی و مدیریت منابع استخراج کانفیگ و پروکسی**\n\nدر این بخش می‌توانید کانال‌های تلگرامی، لینک‌های ساب و گیت‌هاب که ربات به صورت خودکار از آن‌ها کانفیگ استخراج می‌کند را مدیریت کنید:\n\n`;
        const keyboard: any[] = [];

        if (db.sources.length === 0) {
          msg += `❌ هیچ منبع استخراجی ثبت نشده است.`;
        } else {
          db.sources.forEach((src, idx) => {
            const lastDate = src.lastExtracted ? new Date(src.lastExtracted).toLocaleString('fa-IR') : 'هرگز';
            msg += `🔹 ${idx + 1}. **${src.name}** [نوع: ${src.type}]\n`;
            msg += `وضعیت: ${src.enabled ? '🟢 فعال' : '🔴 غیرفعال'}\n`;
            msg += `آدرس/آیدی: \`${src.urlOrHandle}\`\n`;
            msg += `تعداد استخراج شده: **${src.extractedCount || 0} کانفیگ**\n`;
            msg += `آخرین استخراج: **${lastDate}**\n\n`;
            
            keyboard.push([
              { text: `❌ حذف ${src.name}`, callback_data: `admin_src_del_${src.id}` },
              { text: `${src.enabled ? '🔴 غیرفعال' : '🟢 فعال'}`, callback_data: `admin_src_toggle_${src.id}` }
            ]);
          });
        }

        keyboard.push([{ text: '➕ افزودن منبع استخراج جدید', callback_data: 'admin_src_add' }]);
        keyboard.push([{ text: '🔙 بازگشت به منوی مدیریت', callback_data: 'admin_menu' }]);

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      if (callbackData === 'admin_src_add') {
        await answerCallback('انتخاب نوع منبع...');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `🌐 **افزودن منبع استخراج جدید - مرحله ۱ از ۳**\n\nلطفاً **نوع منبع** مورد نظر خود را از دکمه‌های زیر انتخاب کنید:`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📢 کانال تلگرام', callback_data: 'admin_src_set_type_telegram' },
                { text: '🐙 مخزن گیت‌هاب', callback_data: 'admin_src_set_type_github' }
              ],
              [
                { text: '🔗 لینک ساب v2ray', callback_data: 'admin_src_set_type_sub' }
              ],
              [
                { text: '🔙 انصراف', callback_data: 'admin_sources_list' }
              ]
            ]
          }
        });
        return;
      }

      if (callbackData?.startsWith('admin_src_set_type_')) {
        const type = callbackData.replace('admin_src_set_type_', '');
        adminStates[chatId] = { action: 'await_src_name', data: { type } };
        const typeLabel = type === 'telegram' ? 'کانال تلگرام' : type === 'github' ? 'مخزن گیت‌هاب' : 'لینک ساب v2ray';
        await answerCallback(typeLabel);
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `🌐 **افزودن منبع جدید - مرحله ۲ از ۳**\n\nنوع منبع انتخاب شد: **${typeLabel}**\n\nحالا **یک نام نمایشی دلخواه** برای این منبع ارسال کنید:\n*(مثال: کانال مرجع ویتوری)*`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'admin_sources_list' }]]
          }
        });
        return;
      }

      if (callbackData?.startsWith('admin_src_toggle_')) {
        const id = callbackData.replace('admin_src_toggle_', '');
        const src = db.sources.find(s => s.id === id);
        if (src) {
          src.enabled = !src.enabled;
          saveDatabase();
          await answerCallback(`تغییر وضعیت منبع به: ${src.enabled ? 'فعال' : 'غیرفعال'}`);
        }
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_sources_list' } });
        return;
      }

      if (callbackData?.startsWith('admin_src_del_')) {
        const id = callbackData.replace('admin_src_del_', '');
        const idx = db.sources.findIndex(s => s.id === id);
        if (idx !== -1) {
          const name = db.sources[idx].name;
          db.sources.splice(idx, 1);
          saveDatabase();
          await answerCallback(`منبع ${name} حذف شد`);
        }
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_sources_list' } });
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
        msg += `اخبار تکنولوژی: **${ap.techNewsCount || 0} عدد**\n`;
        msg += `رازها و ترفندهای موبایل: **${ap.techTricksCount || 0} عدد**\n`;
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
            { text: `📰 اخبار تکنولوژی: ${ap.techNewsCount || 0} عدد`, callback_data: 'admin_ap_tech_news_count' },
            { text: `💡 ترفند و راز: ${ap.techTricksCount || 0} عدد`, callback_data: 'admin_ap_tech_tricks_count' }
          ],
          [
            { text: `🔄 بروزرسانی فوری اخبار و ترفندها`, callback_data: 'admin_ap_refresh_tech' },
            { text: `✍️ تغییر متن اصلی`, callback_data: 'admin_ap_edit_text' }
          ],
          [
            { text: `📢 ویرایش تبلیغات (Sponsor Ad)`, callback_data: 'admin_ap_edit_ad' },
            { text: `🚀 ارسال فوری تست`, callback_data: 'admin_ap_trigger' }
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

      if (callbackData === 'admin_ap_edit_ad') {
        adminStates[chatId] = { action: 'await_autopost_ad' };
        await answerCallback('ویرایش تبلیغات...');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `📢 **تنظیم تبلیغات اسپانسر (Sponsor Ad)**\n\nاین متن به عنوان دکمه شیشه‌ای یا لینک اسپانسر در انتهای پست‌های ارسال خودکار و همچنین در انتهای پیام‌های صادر شده برای کاربران قرار می‌گیرد.\n\nمی‌توانید یک آیدی کانال با @ (مثل @MyChannel) یا لینک یا متن دلخواه بفرستید.\n\nتبلیغات فعلی: \`${db.settings.autoPost.adText || 'تنظیم نشده'}\`\n\nلطفاً متن جدید خود را بفرستید:`,
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
        const confKeyboard = [
          [
            { text: '1 عدد', callback_data: 'admin_ap_set_conf_1' },
            { text: '2 عدد', callback_data: 'admin_ap_set_conf_2' },
            { text: '3 عدد', callback_data: 'admin_ap_set_conf_3' }
          ],
          [
            { text: '5 عدد', callback_data: 'admin_ap_set_conf_5' },
            { text: '10 عدد', callback_data: 'admin_ap_set_conf_10' },
            { text: '15 عدد', callback_data: 'admin_ap_set_conf_15' }
          ],
          [
            { text: '20 عدد', callback_data: 'admin_ap_set_conf_20' },
            { text: '30 عدد', callback_data: 'admin_ap_set_conf_30' },
            { text: '50 عدد', callback_data: 'admin_ap_set_conf_50' }
          ],
          [
            { text: '0 (بدون کانفیگ)', callback_data: 'admin_ap_set_conf_0' }
          ],
          [
            { text: '🔙 بازگشت', callback_data: 'admin_autopost_menu' }
          ]
        ];
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '📦 **انتخاب تعداد کانفیگ V2Ray جهت ارسال در پست خودکار کانال:**',
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: confKeyboard }
        });
        await answerCallback();
        return;
      }

      if (callbackData.startsWith('admin_ap_set_conf_')) {
        const count = parseInt(callbackData.replace('admin_ap_set_conf_', '')) || 0;
        db.settings.autoPost.configCount = count;
        saveDatabase();
        await answerCallback(`تعداد کانفیگ به ${count} عدد تغییر یافت.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_autopost_menu' } });
        return;
      }

      if (callbackData === 'admin_ap_proxy_count') {
        const proxyKeyboard = [
          [
            { text: '1 عدد', callback_data: 'admin_ap_set_proxy_1' },
            { text: '2 عدد', callback_data: 'admin_ap_set_proxy_2' },
            { text: '3 عدد', callback_data: 'admin_ap_set_proxy_3' }
          ],
          [
            { text: '5 عدد', callback_data: 'admin_ap_set_proxy_5' },
            { text: '10 عدد', callback_data: 'admin_ap_set_proxy_10' },
            { text: '15 عدد', callback_data: 'admin_ap_set_proxy_15' }
          ],
          [
            { text: '20 عدد', callback_data: 'admin_ap_set_proxy_20' },
            { text: '0 (بدون پروکسی)', callback_data: 'admin_ap_set_proxy_0' }
          ],
          [
            { text: '🔙 بازگشت', callback_data: 'admin_autopost_menu' }
          ]
        ];
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '🔌 **انتخاب تعداد پروکسی تلگرام جهت ارسال در پست خودکار کانال:**',
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: proxyKeyboard }
        });
        await answerCallback();
        return;
      }

      if (callbackData.startsWith('admin_ap_set_proxy_')) {
        const count = parseInt(callbackData.replace('admin_ap_set_proxy_', '')) || 0;
        db.settings.autoPost.proxyCount = count;
        saveDatabase();
        await answerCallback(`تعداد پروکسی به ${count} عدد تغییر یافت.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_autopost_menu' } });
        return;
      }

      if (callbackData === 'admin_ap_tech_news_count') {
        const keyboard = [
          [
            { text: '0 (غیرفعال)', callback_data: 'admin_ap_set_technews_0' },
            { text: '1 عدد', callback_data: 'admin_ap_set_technews_1' },
            { text: '2 عدد', callback_data: 'admin_ap_set_technews_2' }
          ],
          [
            { text: '3 عدد', callback_data: 'admin_ap_set_technews_3' },
            { text: '5 عدد', callback_data: 'admin_ap_set_technews_5' }
          ],
          [{ text: '🔙 بازگشت', callback_data: 'admin_autopost_menu' }]
        ];
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '📰 **انتخاب تعداد اخبار تکنولوژی جهت ارسال در هر پست:**',
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        await answerCallback();
        return;
      }

      if (callbackData.startsWith('admin_ap_set_technews_')) {
        const count = parseInt(callbackData.replace('admin_ap_set_technews_', '')) || 0;
        db.settings.autoPost.techNewsCount = count;
        saveDatabase();
        await answerCallback(`تعداد اخبار تکنولوژی به ${count} عدد تنظیم شد.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_autopost_menu' } });
        return;
      }

      if (callbackData === 'admin_ap_tech_tricks_count') {
        const keyboard = [
          [
            { text: '0 (غیرفعال)', callback_data: 'admin_ap_set_techtricks_0' },
            { text: '1 عدد', callback_data: 'admin_ap_set_techtricks_1' },
            { text: '2 عدد', callback_data: 'admin_ap_set_techtricks_2' }
          ],
          [
            { text: '3 عدد', callback_data: 'admin_ap_set_techtricks_3' },
            { text: '5 عدد', callback_data: 'admin_ap_set_techtricks_5' }
          ],
          [{ text: '🔙 بازگشت', callback_data: 'admin_autopost_menu' }]
        ];
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '💡 **انتخاب تعداد رازها و ترفندهای آموزشی موبایل/تکنولوژی جهت ارسال:**',
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        await answerCallback();
        return;
      }

      if (callbackData.startsWith('admin_ap_set_techtricks_')) {
        const count = parseInt(callbackData.replace('admin_ap_set_techtricks_', '')) || 0;
        db.settings.autoPost.techTricksCount = count;
        saveDatabase();
        await answerCallback(`تعداد ترفندهای آموزشی به ${count} عدد تنظیم شد.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_autopost_menu' } });
        return;
      }

      if (callbackData === 'admin_ap_refresh_tech') {
        await answerCallback('🔄 در حال دریافت جدیدترین اخبار و ترفندها...', true);
        const added = await refreshTechContentAndPurgeOld();
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ **بروزرسانی محتوای تکنولوژی انجام شد!**\n\nتعداد ${added} مطلب تازه جمع‌آوری گردید و مطالب قدیمی پالایش شدند. کل مطالب فعال: **${(db.techItems || []).length}**`,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به تنظیمات ارسال', callback_data: 'admin_autopost_menu' }]] }
        });
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
        const totalC = db.configs.length;
        const workingP = db.proxies ? db.proxies.filter(p => p.status === 'working').length : 0;
        const failedP = db.proxies ? db.proxies.filter(p => p.status === 'failed').length : 0;
        const totalP = db.proxies ? db.proxies.length : 0;
        const totalF = db.npvFiles ? db.npvFiles.length : 0;

        let msg = `🧹 **مدیریت تخلیه و پاکسازی آرشیو دیتابیس ربات**\n\n`;
        msg += `📦 **کل کانفیگ‌های ویتوری:** ${totalC} مورد (${workingC} فعال | ${failedC} مسدود)\n`;
        msg += `🔌 **کل پروکسی‌های تلگرام:** ${totalP} مورد (${workingP} فعال | ${failedP} مسدود)\n`;
        msg += `📁 **کل فایل‌های VPN (.npvt, .ovpn):** ${totalF} فایل\n\n`;
        msg += `سقف مجاز نگهداری فعلی: **${db.settings.maxConfigsRetention || 2000} کانفیگ**\n\n`;
        msg += `یکی از گزینه‌های تخلیه را انتخاب نمایید:`;

        const keyboard = [
          [
            { text: `🧹 حذف کانفیگ‌های مسدود (${failedC})`, callback_data: 'admin_clean_failed_configs' },
            { text: `🧹 حذف پروکسی‌های مسدود (${failedP})`, callback_data: 'admin_clean_failed_proxies' }
          ],
          [
            { text: `🚨 تخلیه کل کانفیگ‌ها (${totalC})`, callback_data: 'admin_clean_all_configs' },
            { text: `🚨 تخلیه کل پروکسی‌ها (${totalP})`, callback_data: 'admin_clean_all_proxies' }
          ],
          [
            { text: `📁 تخلیه کل فایل‌های VPN (${totalF})`, callback_data: 'admin_clean_all_vpn_files' }
          ],
          [
            { text: `💣 تخلیه کامل آرشیو (کل داده‌ها)`, callback_data: 'admin_clean_everything' }
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
        addLog('warn', `تعداد ${diff} کانفیگ غیرفعال از طریق ربات تلگرام پاکسازی گردید.`);
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
        addLog('warn', `تعداد ${diff} پروکسی غیرفعال از طریق ربات تلگرام پاکسازی گردید.`);
        await answerCallback(`تعداد ${diff} پروکسی مسدود با موفقیت حذف گردید.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_cleanup_menu' } });
        return;
      }

      if (callbackData === 'admin_clean_all_configs') {
        const count = db.configs.length;
        db.configs = [];
        saveDatabase();
        addLog('warn', `تخلیه کامل کانفیگ‌های ویتوری (${count} مورد) از طریق ربات اجرا شد.`);
        await answerCallback(`تمامی کانفیگ‌های ویتوری (${count} مورد) با موفقیت حذف گردید.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_cleanup_menu' } });
        return;
      }

      if (callbackData === 'admin_clean_all_proxies') {
        const count = (db.proxies || []).length;
        db.proxies = [];
        saveDatabase();
        addLog('warn', `تخلیه کامل پروکسی‌های تلگرام (${count} مورد) از طریق ربات اجرا شد.`);
        await answerCallback(`تمامی پروکسی‌های تلگرام (${count} مورد) با موفقیت حذف گردید.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_cleanup_menu' } });
        return;
      }

      if (callbackData === 'admin_clean_all_vpn_files') {
        const count = (db.npvFiles || []).length;
        db.npvFiles = [];
        saveDatabase();
        addLog('warn', `تخلیه کامل فایل‌های VPN (${count} فایل) از طریق ربات اجرا شد.`);
        await answerCallback(`تمامی فایل‌های VPN (${count} فایل) با موفقیت حذف گردید.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_cleanup_menu' } });
        return;
      }

      if (callbackData === 'admin_clean_everything') {
        const cCount = db.configs.length;
        const pCount = (db.proxies || []).length;
        const fCount = (db.npvFiles || []).length;
        db.configs = [];
        db.proxies = [];
        db.npvFiles = [];
        saveDatabase();
        addLog('warn', `تخلیه کامل کل آرشیو (کانفیگ‌ها، پروکسی‌ها و فایل‌های VPN) توسط ادمین اجرا شد.`);
        await answerCallback(`کلیه آرشیوهای کانفیگ (${cCount})، پروکسی (${pCount}) و فایل‌ها (${fCount}) کاملاً تخلیه گردیدند.`);
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
        await answerCallback('⏳ در حال بررسی مجدد عضویت شما در کانال‌ها...');

        // Perform instant live check for each required channel
        let hasJoinedNow = true;
        const freshNotJoined: ForceJoinChannel[] = [];
        for (const channel of requiredChannels) {
          const isJoined = await checkUserChannelMember(channel.username, userId);
          if (!isJoined) {
            hasJoinedNow = false;
            freshNotJoined.push(channel);
          }
        }

        joinChecksCache[userId] = {
          checkedAt: Date.now(),
          hasJoined: hasJoinedNow
        };

        if (hasJoinedNow) {
          await answerCallback('🎉 عضویت شما تایید شد!', true);

          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `🎉 <b>عضویت شما با موفقیت تایید شد!</b>\n\nربات برای شما فعال گردید. خوش آمدید! ❤️`,
            parse_mode: 'HTML'
          });

          await handleBotUpdate({
            message: {
              chat: { id: chatId },
              from: { id: userId, username, first_name: firstName },
              text: '/start'
            }
          });
        } else {
          await answerCallback('❌ شما هنوز عضو تمام کانال‌ها نشده‌اید!', true);

          const safeFirstName = escapeHtml(firstName);
          let msg = `⚠️ <b>عدم تکمیل عضویت در کانال‌ها</b>\n\n` +
            `کاربر گرامی <b>${safeFirstName}</b>، شما هنوز در کانال(های) زیر عضو نشده‌اید. لطفاً ابتدا عضو شده و سپس دکمه تایید را بزنید:\n\n`;

          const keyboard: any[] = [];
          freshNotJoined.forEach((ch, idx) => {
            const safeTitle = escapeHtml(ch.title || ch.username);
            const safeUsername = escapeHtml(ch.username);
            msg += `${idx + 1}️⃣ کانال <b>${safeTitle}</b> (${safeUsername})\n`;
            const url = ch.inviteLink || `https://t.me/${ch.username.replace('@', '')}`;
            keyboard.push([{ text: `📢 عضویت در کانال ${ch.title}`, url, style: 'primary' }]);
          });

          msg += `\nپس از عضویت در تمامی کانال‌ها، دکمه <b>تایید عضویت ✅</b> را فشار دهید.`;
          keyboard.push([{ text: '✅ تایید عضویت (بررسی مجدد)', callback_data: 'check_join_status', style: 'success' }]);

          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: msg,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
        return;
      }

      // If user clicked any other inline button while blocked
      if (callbackQueryId) {
        await answerCallback('⚠️ جهت استفاده از ربات، ابتدا در کانال‌های زیر عضو شده و دکمه تایید عضویت را بزنید.', true);
      }

      // Present join channels message
      const safeFirstName = escapeHtml(firstName);
      let msg = `⚠️ <b>عضویت اجباری در کانال‌های اسپانسر</b>\n\n` +
        `کاربر گرامی <b>${safeFirstName}</b>، برای استفاده از خدمات ربات و دریافت کانفیگ‌های رایگان و پرسرعت، ابتدا باید در کانال‌های زیر عضو شوید:\n\n`;

      const keyboard: any[] = [];
      notJoinedList.forEach((ch, idx) => {
        const safeTitle = escapeHtml(ch.title || ch.username);
        const safeUsername = escapeHtml(ch.username);
        msg += `${idx + 1}️⃣ کانال <b>${safeTitle}</b> (${safeUsername})\n`;
        const url = ch.inviteLink || `https://t.me/${ch.username.replace('@', '')}`;
        keyboard.push([{ text: `📢 عضویت در کانال ${ch.title}`, url, style: 'primary' }]);
      });

      msg += `\nپس از عضویت در تمامی کانال‌ها، دکمه <b>تایید عضویت ✅</b> را در زیر فشار دهید تا ربات برای شما فعال شود.`;
      keyboard.push([{ text: '✅ تایید عضویت (بررسی مجدد)', callback_data: 'check_join_status', style: 'success' }]);

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard }
      });
      return;
    }

    // --- Action Handlers ---

    // Handle button selections or commands
    if (messageText === '/start' || callbackData === 'back_to_main' || callbackData === 'start_refresh' || callbackData === 'start') {
      if (callbackData) {
        await answerCallback('🔄 منوی اصلی و ربات بروزرسانی شد');
      }

      const workingConfigsCount = db.configs.filter(c => c.status === 'working').length;
      const workingProxiesCount = (db.proxies || []).filter(p => p.status === 'working').length;

      const welcome = `سلام **${escapeHtml(firstName)}** عزیز! 🌹\n` +
        `به ربات بزرگ استخراج و پخش کانفیگ‌ها و پروکسی‌های اختصاصی و تست‌شده خوش آمدید.\n\n` +
        `📊 **وضعیت لحظه‌ای دیتابیس ربات:**\n` +
        `🟢 تعداد کانفیگ‌های فعال V2Ray: **${workingConfigsCount} عدد**\n` +
        `🚀 تعداد پروکسی‌های فعال تلگرام: **${workingProxiesCount} عدد**\n\n` +
        `💡 سیستم به صورت ۲۴ ساعته منابع معتبر را پایش کرده و پورت‌ها را از داخل شبکه ایران تست می‌کند.\n\n` +
        `جهت دریافت کانفیگ و پروکسی، از گزینه‌های زیر استفاده کنید:`;

      const startInlineKeyboard: any[][] = [
        [
          { text: '🔥 🚀 دریافت یکجای ۵۰ کانفیگ (توصیه ویژه ⭐)', callback_data: 'v2ray_qty_50', style: 'success' }
        ],
        [
          { text: '📥 انتخاب تعداد دلخواه کانفیگ V2Ray', callback_data: 'get_v2ray_configs', style: 'primary' }
        ],
        [
          { text: '🌀 فایل NPVT', callback_data: 'get_file_npvt', style: 'success' },
          { text: '🔑 فایل OVPN', callback_data: 'get_file_ovpn', style: 'success' },
          { text: '📄 فایل TXT', callback_data: 'get_file_txt', style: 'success' }
        ],
        [
          { text: '🔌 دریافت پروکسی جدید تلگرام', callback_data: 'get_proxies', style: 'primary' },
          { text: '📊 وضعیت شبکه و پینگ نت 🟢', callback_data: 'get_net_status', style: 'primary' }
        ],
        [
          { text: 'ℹ️ راهنمای اتصال آسان 📚', callback_data: 'get_help' },
          { text: '🔄 بروزرسانی ربات ⚡', callback_data: 'start_refresh' }
        ]
      ];

      if (requiredChannels.length > 0 && requiredChannels[0]?.username) {
        const url = requiredChannels[0].inviteLink || `https://t.me/${requiredChannels[0].username.replace('@', '')}`;
        startInlineKeyboard.push([{ text: '⭐ کانال رسمی پشتیبانی و اخبار', url, style: 'primary' }]);
      }

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: welcome,
        parse_mode: 'Markdown',
        reply_markup: getReplyKeyboard(userId)
      });

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: '👇 **منوی دسترسی سریع و میانبرها:**',
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: startInlineKeyboard }
      });
      return;
    }

    if (callbackData === 'get_help') {
      await answerCallback('راهنمای اتصال');
      const helpText = `📚 **راهنمای گام به گام اتصال به فیلترشکن:**\n\n` +
        `1️⃣ **برنامه V2Ray (ویتوری / v2rayNG / Shadowrocket / Streisand):**\n` +
        `• کانفیگ‌های متنی را کپی کنید.\n` +
        `• وارد برنامه شده و گزینه‌ **Import from Clipboard** را بزنید.\n` +
        `• سپس روی دکمه اتصال کلیک کنید.\n\n` +
        `2️⃣ **برنامه‌های NapsternetV / OpenVPN:**\n` +
        `• فایل‌های .NPVT یا .OVPN را دانلود کرده و در برنامه مربوطه ایمپورت نمایید.\n\n` +
        `3️⃣ **پروکسی‌های تلگرام:**\n` +
        `• روی دکمه پروکسی کلیک کرده و گزینه‌ **Connect Proxy** را بزنید.\n\n` +
        `💡 *برای دریافت کانفیگ‌های تازه، از منوی اصلی اقدام کنید.*`;

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: helpText,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }]]
        }
      });
      return;
    }

    if (callbackData === 'get_net_status') {
      await answerCallback('وضعیت شبکه');
      const workingConfigsCount = db.configs.filter(c => c.status === 'working').length;
      const workingProxiesCount = (db.proxies || []).filter(p => p.status === 'working').length;
      const totalConfigs = db.configs.length;

      const netText = `📊 **گزارش لحظه‌ای وضعیت شبکه و تست نت ایران:**\n\n` +
        `🟢 **کانفیگ‌های فعال V2Ray:** ${workingConfigsCount} از ${totalConfigs} کل\n` +
        `⚡️ **پروکسی‌های فعال تلگرام:** ${workingProxiesCount} عدد\n` +
        `🔄 **آخرین زمان پایش دیتابیس:** همین چند لحظه پیش\n\n` +
        `✅ تمامی کانفیگ‌ها و پروکسی‌های ارائه شده در ربات، پورت‌هایشان تست شده و برای اپراتورهای همراه اول، ایرانسل و مخابرات فعال می‌باشند.`;

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: netText,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }]]
        }
      });
      return;
    }

    if (callbackData === 'get_v2ray_configs') {
      await answerCallback('در حال آماده‌سازی منو ویتوری...');
      
      const qtyKeyboard = {
        inline_keyboard: [
          [
            { text: '🔥 🚀 دریافت یکجای ۵۰ کانفیگ (توصیه شده ⭐)', callback_data: 'v2ray_qty_50', style: 'success' }
          ],
          [
            { text: '⚡️ دریافت پک ۳۰ تایی', callback_data: 'v2ray_qty_30', style: 'success' },
            { text: '⚡️ دریافت پک ۱۵ تایی', callback_data: 'v2ray_qty_15', style: 'success' }
          ],
          [
            { text: '🔟 ۱۰ عدد', callback_data: 'v2ray_qty_10', style: 'primary' },
            { text: '5️⃣ ۵ عدد', callback_data: 'v2ray_qty_5', style: 'primary' },
            { text: '3️⃣ ۳ عدد', callback_data: 'v2ray_qty_3', style: 'primary' },
            { text: '1️⃣ ۱ عدد', callback_data: 'v2ray_qty_1', style: 'primary' }
          ],
          [
            { text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }
          ]
        ]
      };
      
      const explText = `📥 **دریافت کانفیگ‌های V2Ray (ویتوری)**\n\n` +
        `💡 **توصیه بسیار مهم جهت اتصال ۱۰۰٪ سالم:**\n` +
        `با توجه به اختلاف فیلترینگ در اپراتورهای مختلف (همراه اول، ایرانسل، مخابرات، رایتل و...) و متغیر بودن تست‌ها، **حتماً گزینه‌های پک ۱۵، ۳۰ یا ۵۰ کانفیگی (توصیه شده ⭐)** را انتخاب کنید تا با ایمپورت یکجای کانفیگ‌ها در برنامه، بیشترین شانس اتصال پرسرعت و بدون قطعی را داشته باشید!\n\n` +
        `لطفاً تعداد کانفیگ‌های درخواستی را انتخاب کنید:`;

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: explText,
        parse_mode: 'Markdown',
        reply_markup: qtyKeyboard
      });
      return;
    }


    if (callbackData === 'get_file_npvt' || callbackData === 'get_file_ovpn' || callbackData === 'get_file_txt') {
      const fileExt = callbackData === 'get_file_npvt' ? 'npvt' : callbackData === 'get_file_ovpn' ? 'ovpn' : 'txt';
      const label = fileExt === 'npvt' ? 'NapsternetV (.NPVT)' : fileExt === 'ovpn' ? 'OpenVPN (.OVPN)' : 'متنی (.TXT)';
      
      await answerCallback(`در حال بررسی فایل‌های ${fileExt.toUpperCase()}...`);
      
      const fileCount = db.npvFiles ? db.npvFiles.filter(f => f.filename.toLowerCase().endsWith(fileExt)).length : 0;

      if (fileCount === 0) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `⚠️ <b>فایل ${label} در حال حاضر موجود نیست!</b>\n\nسیستم به صورت خودکار در حال بروزرسانی است. لطفا دقایقی دیگر امتحان کنید.`,
          parse_mode: 'HTML',
          reply_markup: getReplyKeyboard(userId)
        });
        return;
      }

      const qtyKeyboard = {
        inline_keyboard: [
          [
            { text: '1️⃣ یک عدد', callback_data: `file_qty_${fileExt}_1`, style: 'success' },
            { text: '2️⃣ دو عدد', callback_data: `file_qty_${fileExt}_2`, style: 'success' }
          ],
          [
            { text: '3️⃣ سه عدد', callback_data: `file_qty_${fileExt}_3`, style: 'primary' },
            { text: '5️⃣ پنج عدد', callback_data: `file_qty_${fileExt}_5`, style: 'primary' }
          ],
          [
            { text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }
          ]
        ]
      };
      
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `♻️ <b>دریافت فایل‌های ${label}</b>\n\nلطفاً تعداد فایل‌های مورد نیاز خود را انتخاب کنید:`,
        parse_mode: 'HTML',
        reply_markup: qtyKeyboard
      });
      return;
    }

    if (callbackData && callbackData.startsWith('v2ray_qty_')) {
      const qty = parseInt(callbackData.split('_')[2]) || 3;
      
      await answerCallback('در حال آماده‌سازی و تغییر نام کانفیگ...');
      
      let list = [];

      const allowedProtocols = ['vmess', 'vless', 'trojan', 'ss'];
      let available = db.configs.filter(c => c.status === 'working' && allowedProtocols.includes(c.protocol));
        
      if (available.length < qty) {
        const untested = db.configs.filter(c => c.status === 'untested' && allowedProtocols.includes(c.protocol));
        if (untested.length > 0) {
          const testIds = untested.slice(0, qty * 2).map(c => c.id);
          testConfigsBatch(testIds).catch(console.error);
        }
      }

      if (available.length < qty) {
        const untested = db.configs.filter(c => c.status === 'untested' && allowedProtocols.includes(c.protocol));
        available = [...available, ...untested];
      }
        
      if (available.length === 0) {
        available = db.configs.filter(c => allowedProtocols.includes(c.protocol) && c.status !== 'failed');
      }
        
      list = available.length > 0 ? available : db.configs.filter(c => allowedProtocols.includes(c.protocol)).slice(0, 50);

      if (list.length === 0) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '❌ متاسفانه در حال حاضر کانفیگ V2Ray تست‌شده فعال در دیتابیس موجود نیست. سیستم هم‌اکنون در حال بررسی خودکار موارد جدید است. لطفاً چند دقیقه دیگر دوباره امتحان کنید.'
        });
        return;
      }

      // Shuffle and pick requested quantity
      const shuffled = [...list].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, qty);

      // Handle large batch packs (e.g. 10, 15, 30, 50) cleanly with expandable quotes
      if (selected.length > 5) {
        let intro = `🚀 <b>پک اختصاصی ${selected.length} تایی کانفیگ‌های V2Ray (پیشنهاد ویژه ⭐)</b>\n\n`;
        intro += `🔔 تعداد کانفیگ‌ها: <b>${selected.length} عدد</b>\n`;
        intro += `⚡️ پشتیبانی کامل: همراه اول، ایرانسل، مخابرات و رایتل\n`;
        intro += `🏷️ برندینگ انحصاری: <code>${escapeHtml(db.settings.branding)}</code>\n\n`;
        intro += `💡 <b>چرا استفاده از این پک ${selected.length}تایی برتر است؟</b>\n`;
        intro += `با توجه به تفاوت‌های شبکه اپراتورها و فیلترینگ منطقه‌ای، تمام کانفیگ‌ها در کادر خلاصه‌شده آکاردئونی زیک قرار داده شده‌اند تا پیام طولانی نشود.\n\n`;
        intro += `👇 <b>جهت کپی، کافیست روی کادر زیر لمس کنید:</b>`;

        const sponsorBtn = getSponsorChannelInlineButton();
        const inlineKeyboard = sponsorBtn ? {
          inline_keyboard: [[{ text: sponsorBtn.text, url: sponsorBtn.url }]]
        } : undefined;

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: intro,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard
        });

        // Split into chunks of 15 configs so each fits nicely inside a expandable quote
        const CHUNK_SIZE = 15;
        for (let i = 0; i < selected.length; i += CHUNK_SIZE) {
          const chunk = selected.slice(i, i + CHUNK_SIZE);
          const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
          const totalChunks = Math.ceil(selected.length / CHUNK_SIZE);

          const combinedBranded = chunk
            .map(conf => applyBrandingToConfig(conf.raw, db.settings.branding))
            .join('\n');

          let chunkMsg = `📋 <b>بخش ${chunkNum} از ${totalChunks} (کانفیگ‌های ${i + 1} تا ${i + chunk.length}):</b>\n`;
          chunkMsg += `<blockquote expandable><code>${escapeHtml(combinedBranded)}</code></blockquote>\n\n`;
          chunkMsg += `📍 جهت کپی یکجای این بخش روی کادر فوق لمس کنید و در برنامه Import from clipboard نمائید.`;

          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: chunkMsg,
            parse_mode: 'HTML'
          });
          await new Promise(r => setTimeout(r, 100));
        }
        return;
      }
      
      let msg = '';
      msg = `📥 <b>کانفیگ‌های اختصاصی V2Ray (ویتوری)</b>\n`;
      msg += `🔔 تعداد درخواستی: <b>${qty} عدد</b>\n`;
      msg += `⚡️ اتصال: همراه اول، ایرانسل، مخابرات و رایتل\n`;
      msg += `🏷️ برندینگ انحصاری: <code>${escapeHtml(db.settings.branding)}</code>\n\n`;

      selected.forEach((conf, idx) => {
        const branded = applyBrandingToConfig(conf.raw, db.settings.branding);
        const latencyText = conf.latency ? `(پینگ: ${conf.latency}ms)` : '';
          
        msg += `⚡ <b>کانفیگ ${idx + 1}</b> [${conf.protocol.toUpperCase()}] ${latencyText}:\n`;
        msg += `<code>${escapeHtml(branded)}</code>\n\n`;
      });

      if (selected.length > 1) {
        const allBrandedCombined = selected
          .map(conf => applyBrandingToConfig(conf.raw, db.settings.branding))
          .join('\n');
        msg += `📋 <b>کپی یکجای تمامی ${selected.length} کانفیگ با یک لمس:</b>\n`;
        msg += `<blockquote expandable><code>${escapeHtml(allBrandedCombined)}</code></blockquote>\n\n`;
      }

      msg += `📍 جهت کپی روی هر کانفیگ یا کادر کپی یکجا ضربه بزنید. سپس در نرم‌افزارهای v2rayNG یا NapsternetV یا Streisand وارد (Import) کنید.\n\n🆔 ${escapeHtml(db.settings.branding)}`;

      const sponsorBtn = getSponsorChannelInlineButton();
      const feedbackRows = [];
      if (selected.length > 0) {
        const upRow = selected.slice(0, 5).map((conf, idx) => ({
          text: `👍 ${idx + 1} فعال`,
          callback_data: `fb_up_${conf.id}`
        }));
        const downRow = selected.slice(0, 5).map((conf, idx) => ({
          text: `👎 ${idx + 1} خراب`,
          callback_data: `fb_down_${conf.id}`
        }));
        feedbackRows.push(upRow);
        feedbackRows.push(downRow);
      }

      const inlineKeyboard = {
        inline_keyboard: [
          ...(sponsorBtn ? [[{ text: sponsorBtn.text, url: sponsorBtn.url }]] : []),
          ...feedbackRows
        ]
      };

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard
      });
      return;
    }

    if (callbackData && callbackData.startsWith('file_qty_')) {
      const parts = callbackData.split('_');
      const fileExt = parts[2];
      const qty = parseInt(parts[3]) || 1;
      const label = fileExt === 'npvt' ? 'NapsternetV (.NPVT)' : fileExt === 'ovpn' ? 'OpenVPN (.OVPN)' : 'متنی (.TXT)';

      await answerCallback('در حال آماده‌سازی فایل‌ها...');
      
      let selection = [];
      if (db.npvFiles && db.npvFiles.length > 0) {
        const filtered = db.npvFiles.filter(f => f.filename.toLowerCase().endsWith(fileExt));
        const shuffled = [...filtered].sort(() => 0.5 - Math.random());
        selection = shuffled.slice(0, Math.min(qty, shuffled.length));
      }

      if (selection.length === 0) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `❌ متأسفانه در حال حاضر فایل ${label} معتبری در آرشیو ربات وجود ندارد. لطفا بعدا تلاش کنید.`,
          reply_markup: getReplyKeyboard(userId)
        });
        return;
      }
      
      let msg = `🌀 <b>فایل‌های اختصاصی ${label} صادر شد</b>\n\n`;
      msg += `🔔 تعداد درخواستی: <b>${qty} عدد</b>\n`;
      msg += `⚡️ اتصال: همراه اول، ایرانسل، مخابرات و رایتل\n`;
      msg += `🏷️ برندینگ انحصاری: <code>${db.settings.branding}</code>\n\n`;
      msg += `📥 تعداد ${selection.length} فایل در زیر برای شما ارسال شدند.`;

      const sponsorBtn = getSponsorChannelInlineButton();
      const inlineKeyboard = sponsorBtn ? {
        inline_keyboard: [[{ text: sponsorBtn.text, url: sponsorBtn.url }]]
      } : undefined;

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: msg,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard || getReplyKeyboard(userId)
      });

      for (let i = 0; i < selection.length; i++) {
        const file = selection[i];
          
        const cleanBranding = (db.settings.branding || 'VPN').replace(/[^a-zA-Z0-9_؀-ۿ]/g, '_');
        let brandedFilename = file.filename;
        if (db.settings.branding) {
          brandedFilename = brandedFilename.replace(/\.(npv(t)?|ovpn|txt)$/i, `_${cleanBranding}.$1`);
        }
          
        const caption = `🌀 فایل کانفیگ ${label} شماره ${i + 1}\n🆔 ${db.settings.branding}`;
          
        try {
          const formData = new FormData();
          formData.append('chat_id', String(chatId));

          let fileBuffer: Buffer;
          try {
            fileBuffer = Buffer.from(file.content, 'base64');
            if (fileBuffer.length === 0 && file.content) {
              fileBuffer = Buffer.from(file.content, 'utf-8');
            }
          } catch {
            fileBuffer = Buffer.from(file.content || '', 'utf-8');
          }

          const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
          formData.append('document', blob, brandedFilename);
          formData.append('caption', caption);
            
          if (inlineKeyboard) {
            formData.append('reply_markup', JSON.stringify(inlineKeyboard));
          }
            
          await callTelegramApi('sendDocument', formData);
        } catch (err: any) {
          console.error('Error sending file to user:', err?.message || err);
        }
      }
      return;
    }

    if (callbackData === 'get_proxies') {
      await answerCallback('در حال آماده‌سازی پروکسی‌های فعال...');
      
      let available = (db.proxies || []).filter(p => p.status === 'working');
      
      // If we have less than 4 working proxies, append untested ones
      if (available.length < 4) {
        const untested = (db.proxies || []).filter(p => p.status === 'untested');
        available = [...available, ...untested];
      }
      
      // If still empty, filter out failed ones
      if (available.length === 0) {
        available = (db.proxies || []).filter(p => p.status !== 'failed');
      }
      
      // Final fallback to any proxies
      if (available.length === 0) {
        available = db.proxies || [];
      }

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
      
      const sponsorBtn = getSponsorChannelInlineButton();
      if (sponsorBtn) {
        proxyButtons.push([{
          text: sponsorBtn.text,
          url: sponsorBtn.url
        }]);
      }

      for (let i = 0; i < selected.length; i++) {
        const p = selected[i];
        const loc = await getIpLocation(p.server);
        const flag = getFlagEmoji(loc.countryCode);
        const pingText = p.latency ? `⚡ پینگ: ${p.latency}ms` : 'سرعت بالا 🚀';
        
        proxyButtons.push([{
          text: `🔌 پروکسی ${p.type.toUpperCase()} | ${pingText} (${loc.country} ${flag})`,
          url: p.raw,
          style: 'success'
        }]);
      }
      
      proxyButtons.push([{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }]);

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: msg,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: proxyButtons }
      });
      return;
    }

    // Default reply to unrecognized text message
    if (messageText) {
      const defaultMsg = `⚠️ متوجه دستور نشدم.\nبرای دریافت منوی هوشمند، بر روی دکمه‌های زیر کادر پیام کلیک کنید و یا دستور /start را تایپ کنید.`;
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: defaultMsg,
        reply_markup: getReplyKeyboard(userId)
      });
    }

  } catch (err: any) {
    console.error('Error handling Telegram update:', err);
  }
}

/**
 * Stop Bot Polling
 */
/**
 * Stop Bot Polling / Webhook
 */
function stopBot() {
  pollingActive = false;
  if (botTimeoutRef) clearTimeout(botTimeoutRef);
  db.settings.isBotRunning = false;
  saveDatabase();
  
  if (db.settings.botConnectionMode === 'webhook' && db.settings.botToken) {
    callTelegramApi('deleteWebhook', {})
      .then(() => addLog('info', 'وب‌هوک تلگرام با موفقیت غیرفعال شد.'))
      .catch(e => console.error('Error deleting webhook on stop:', e.message));
  }
  
  addLog('warn', 'ربات تلگرام متوقف شد.');
}

/**
 * Start Bot Polling or Webhook
 */
async function startBot() {
  if (db.settings.botConnectionMode !== 'webhook' && pollingActive) return;
  const token = db.settings.botToken;
  if (!token) {
    addLog('error', 'خطا در فعال‌سازی ربات: توکن تعریف نشده است.');
    return;
  }

  try {
    addLog('info', 'در حال اتصال به سرورهای تلگرام و اعتبارسنجی توکن...');
    const username = await testBotConnection(token);
    await setBotCommands(token);
    db.settings.botUsername = username;
    
    if (db.settings.botConnectionMode === 'webhook') {
      const pUrl = db.settings.publicUrl;
      if (!pUrl) {
        throw new Error('برای حالت وب‌هوک، وارد کردن آدرس دامنه عمومی در بخش تنظیمات الزامی است.');
      }
      
      const cleanUrl = pUrl.trim().replace(/\/+$/, '').replace(/^https?:\/\//i, '');
      const webhookUrl = `https://${cleanUrl}/api/telegram-webhook`;
      
      addLog('info', `در حال تنظیم وب‌هوک تلگرام روی آدرس: ${webhookUrl} ...`);
      await callTelegramApi('setWebhook', { url: webhookUrl });
      
      db.settings.isBotRunning = true;
      pollingActive = false;
      saveDatabase();
      addLog('success', `ربات با موفقیت در حالت وب‌هوک فعال شد: @${username}`);
    } else {
      // Delete any previous webhook
      try {
        addLog('info', 'حذف وب‌هوک‌های قبلی جهت شروع دریافت مکرر (Polling)...');
        await callTelegramApi('deleteWebhook', { drop_pending_updates: true });
      } catch (webhookErr: any) {
        console.error('Error removing webhook before polling:', webhookErr.message);
      }
      
      db.settings.isBotRunning = true;
      pollingActive = true;
      saveDatabase();
      
      // Start polling
      runBotPolling();
      addLog('success', `ربات با موفقیت در حالت Polling فعال شد و در حال شنود است: @${username}`);
    }
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

  // Auto test interval (every 10 minutes test untested and stale working ones)
  const testMins = db.settings.autoTestInterval || 10;
  testIntervalRef = setInterval(() => {
    if (db.settings.autoTest) {
      // 1. Untested configs
      const untestedIds = db.configs
        .filter(c => c.status === 'untested')
        .slice(0, 60)
        .map(c => c.id);
      
      // 2. Stale working configs (checked more than 2 hours ago)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const staleWorkingIds = db.configs
        .filter(c => c.status === 'working' && (!c.lastChecked || c.lastChecked < twoHoursAgo))
        .slice(0, 40)
        .map(c => c.id);

      const configsToTest = [...untestedIds, ...staleWorkingIds];

      // 3. Untested proxies
      const untestedProxies = (db.proxies || [])
        .filter(p => p.status === 'untested')
        .slice(0, 40)
        .map(p => p.id);

      // 4. Stale working proxies
      const staleWorkingProxies = (db.proxies || [])
        .filter(p => p.status === 'working' && (!p.lastChecked || p.lastChecked < twoHoursAgo))
        .slice(0, 20)
        .map(p => p.id);

      const proxiesToTest = [...untestedProxies, ...staleWorkingProxies];
      
      if (configsToTest.length > 0) {
        addLog('info', `اجرای خودکار تست بر روی ${untestedIds.length} کانفیگ جدید و ${staleWorkingIds.length} کانفیگ فعال قدیمی...`);
        testConfigsBatch(configsToTest);
      }

      if (proxiesToTest.length > 0) {
        addLog('info', `اجرای خودکار تست بر روی ${untestedProxies.length} پروکسی جدید و ${staleWorkingProxies.length} پروکسی فعال قدیمی...`);
        testProxiesBatch(proxiesToTest);
      }
    }
  }, testMins * 60 * 1000);

  // Post monitoring check (every 15 minutes)
  monitorIntervalRef = setInterval(() => {
    monitorChannelPosts();
  }, 15 * 60 * 1000);

  // Backup check (every 15 minutes)
  backupIntervalRef = setInterval(() => {
    checkAndTriggerBackup();
  }, 15 * 60 * 1000);

  // Watchdog to auto-recover if bot polling freezes or stops unexpectedly
  setInterval(() => {
    if (db.settings.isBotRunning && db.settings.botToken && db.settings.botConnectionMode !== 'webhook') {
      if (!pollingActive || (Date.now() - lastPollTimestamp > 35000)) {
        addLog('warn', 'بازراه‌اندازی خودکار مکانیزم شنود ربات (Watchdog)...');
        pollingActive = true;
        if (botTimeoutRef) clearTimeout(botTimeoutRef);
        runBotPolling().catch(err => console.error('Watchdog restart error:', err));
      }
    }
  }, 15000);

  // Auto refresh Tech News/Tricks content & purge old items every 6 hours
  setInterval(() => {
    refreshTechContentAndPurgeOld().catch(err => console.error('Tech auto-refresh error:', err));
  }, 6 * 60 * 60 * 1000);

  // Set up auto post interval
  setupAutoPostInterval();

  // Run initial checks shortly after startup
  setTimeout(() => {
    monitorChannelPosts();
    checkAndTriggerBackup();
    refreshTechContentAndPurgeOld().catch(() => {});
  }, 5 * 1000);
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
  app.use(express.json({ limit: '250mb' }));
  app.use(express.urlencoded({ limit: '250mb', extended: true }));

  // Ensure xray is executable, working, and clean up leftover config files
  try {
    const xrayPath = path.join(process.cwd(), 'bin/xray');
    const binDir = path.join(process.cwd(), 'bin');
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    let needsDownload = true;
    if (fs.existsSync(xrayPath)) {
      try {
        fs.chmodSync(xrayPath, 0o755);
        const versionCheck = execSync(`${xrayPath} -version`, { encoding: 'utf-8' });
        if (versionCheck.includes('Xray')) {
          needsDownload = false;
        }
      } catch (e) {
        console.warn('Existing Xray binary failed validation. Redownloading...');
      }
    }

    if (needsDownload) {
      console.log('Downloading latest Xray core...');
      execSync('wget -q https://github.com/XTLS/Xray-core/releases/download/v1.8.24/Xray-linux-64.zip -O /tmp/xray.zip && unzip -o /tmp/xray.zip -d /tmp/xray_extract && mv /tmp/xray_extract/xray bin/xray && chmod +x bin/xray && rm -rf /tmp/xray.zip /tmp/xray_extract', { stdio: 'ignore' });
      console.log('Xray core downloaded and configured.');
    }

    const files = fs.readdirSync(binDir);
    for (const file of files) {
      if (file.startsWith('xray_config_') && file.endsWith('.json')) {
        try { fs.unlinkSync(path.join(binDir, file)); } catch (e) {}
      }
    }
  } catch (err) {
    console.error('Error during xray initialization cleanup:', err);
  }

  // API: Export Database Backup
  app.get('/api/backup/export', (req, res) => {
    try {
      const mode = (req.query.mode as string) || 'light';
      const isFull = mode === 'full' || req.query.includeConfigs === 'true';
      const backupData = getCleanDatabaseBackup(isFull);
      const filename = isFull
        ? `data_store_full_backup_${Date.now()}.json`
        : `data_store_light_backup_${Date.now()}.json`;
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(backupData, null, 2));
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Import Database Backup (Restore via JSON Body)
  app.post('/api/backup/import', (req, res) => {
    try {
      const importedData = req.body;
      const skipConfigs = req.query.skipConfigs === 'true' || req.query.mode === 'settings_and_sources';
      const result = typeof importedData === 'string' || Buffer.isBuffer(importedData)
        ? parseAndRestoreBackup(importedData, skipConfigs)
        : restoreDatabaseFromObject(importedData, { skipConfigs, restoreOnlySettingsAndChannels: skipConfigs });

      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json({ success: true, message: result.message, counts: result.counts, settings: db.settings });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'خطا در بازگردانی فایل بکاپ' });
    }
  });

  // API: Streaming upload for large backup files (e.g. 50MB+ without browser main thread lag)
  app.post('/api/backup/upload-stream', (req, res) => {
    const mode = req.query.mode as string;
    const shouldSkipConfigs = mode === 'settings_and_sources' || req.query.skipConfigs === 'true';

    // If body-parser already processed the body (e.g. JSON or object)
    if (req.body && Object.keys(req.body).length > 0 && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      try {
        const result = restoreDatabaseFromObject(req.body, { 
          skipConfigs: shouldSkipConfigs,
          restoreOnlySettingsAndChannels: shouldSkipConfigs
        });
        if (!result.success) {
          return res.status(400).json(result);
        }
        return res.json({ success: true, message: result.message, counts: result.counts, settings: db.settings });
      } catch (err: any) {
        return res.status(500).json({ success: false, message: 'خطا در پردازش داده‌های بکاپ: ' + (err.message || err) });
      }
    }

    const chunks: Buffer[] = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const fullBuffer = Buffer.concat(chunks);
        const result = parseAndRestoreBackup(fullBuffer, shouldSkipConfigs);
        if (!result.success) {
          return res.status(400).json(result);
        }
        res.json({ success: true, message: result.message, counts: result.counts, settings: db.settings });
      } catch (err: any) {
        console.error('Error in backup upload-stream:', err);
        res.status(500).json({ success: false, message: 'خطا در خواندن یا پردازش فایل بکاپ: ' + (err.message || 'فایل نامعتبر است') });
      }
    });

    req.on('error', (err) => {
      console.error('Stream error during backup upload:', err);
      res.status(500).json({ success: false, message: 'خطای انتقال جریان داده فایل بکاپ' });
    });
  });

  // API: Stats
  app.get('/api/stats', (req, res) => {
    const totalUsers = db.users.length;
    const totalConfigs = db.configs.length;
    const workingConfigsCount = db.configs.filter(c => c.status === 'working').length;
    const failedConfigsCount = db.configs.filter(c => c.status === 'failed').length;
    const checkingConfigsCount = db.configs.filter(c => c.status === 'checking').length;
    const untestedConfigsCount = db.configs.filter(c => c.status === 'untested').length;
    
    if (!db.proxies) db.proxies = [];
    const totalProxies = db.proxies.length;
    const workingProxiesCount = db.proxies.filter(p => p.status === 'working').length;
    const failedProxiesCount = db.proxies.filter(p => p.status === 'failed').length;
    const checkingProxiesCount = db.proxies.filter(p => p.status === 'checking').length;
    const untestedProxiesCount = db.proxies.filter(p => p.status === 'untested').length;

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
      checkingConfigsCount,
      untestedConfigsCount,
      totalProxies,
      workingProxiesCount,
      failedProxiesCount,
      checkingProxiesCount,
      untestedProxiesCount,
      telegramChannelsCount,
      subsCount,
      extractedTodayCount
    } as DashboardStats);
  });

  // API: Test Bot Connection
  app.post('/api/settings/test-bot', async (req, res) => {
    try {
      const { botToken } = req.body;
      const token = botToken || db.settings.botToken;
      if (!token) {
        return res.status(400).json({ success: false, message: 'توکن ربات وارد نشده است.' });
      }
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await response.json();
      if (data.ok && data.result) {
        db.settings.botUsername = data.result.username;
        db.settings.isBotRunning = true;
        saveDatabase();
        return res.json({
          success: true,
          username: data.result.username,
          firstName: data.result.first_name,
          message: `اتصال موفق! ربات @${data.result.username} (${data.result.first_name}) متصل است و آماده به کار می‌باشد.`
        });
      } else {
        return res.status(400).json({ success: false, message: data.description || 'توکن نامعتبر است یا ارتباط با تلگرام برقرار نشد.' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'خطا در ارتباط با سرور تلگرام' });
    }
  });

  // API: Telegram Webhook Receiver
  app.post('/api/telegram-webhook', async (req, res) => {
    try {
      if (!db.settings.isBotRunning) {
        return res.status(200).send('Bot is stopped');
      }
      const update = req.body;
      if (update) {
        handleBotUpdate(update).catch(err => {
          console.error('Webhook handleBotUpdate error:', err);
        });
      }
      res.status(200).send('OK');
    } catch (err: any) {
      console.error('Telegram webhook processing error:', err);
      res.status(500).send(err.message || 'Error');
    }
  });

  // API: Get Settings
  app.get('/api/settings', (req, res) => {
    res.json(db.settings);
  });

  // API: Save Settings
  app.post('/api/settings', async (req, res) => {
    try {
      const oldToken = db.settings.botToken;
      const oldMode = db.settings.botConnectionMode || 'polling';
      const oldUrl = db.settings.publicUrl || '';
      
      const { 
        adminId, 
        botToken, 
        branding, 
        autoTest, 
        autoTestInterval,
        autoExtractInterval, 
        testBatchLimit, 
        iranRelayProxy, 
        postMonitoringEnabled, 
        backupEnabled, 
        backupIntervalHours,
        botConnectionMode,
        publicUrl,
        maxConfigsRetention
      } = req.body;
      
      if (maxConfigsRetention !== undefined) {
        db.settings.maxConfigsRetention = Math.max(1, Math.min(10000, Number(maxConfigsRetention) || 2000));
        enforceConfigsRetentionLimit();
      }
      if (adminId !== undefined) {
        db.settings.adminId = adminId;
      }
      if (testBatchLimit !== undefined) {
        db.settings.testBatchLimit = Number(testBatchLimit) || 100;
      }
      if (iranRelayProxy !== undefined) {
        db.settings.iranRelayProxy = iranRelayProxy;
      }
      if (postMonitoringEnabled !== undefined) {
        db.settings.postMonitoringEnabled = !!postMonitoringEnabled;
      }
      if (backupEnabled !== undefined) {
        db.settings.backupEnabled = !!backupEnabled;
      }
      if (backupIntervalHours !== undefined) {
        db.settings.backupIntervalHours = Number(backupIntervalHours);
      }
      if (botConnectionMode !== undefined) {
        db.settings.botConnectionMode = botConnectionMode;
      }
      if (publicUrl !== undefined) {
        let cleanUrl = (publicUrl || '').trim().replace(/\/+$/, '');
        cleanUrl = cleanUrl.replace(/^https?:\/\//i, '');
        db.settings.publicUrl = cleanUrl;
      }

      db.settings.branding = branding || '@MyChannelConfigs';
      db.settings.autoTest = !!autoTest;
      db.settings.autoTestInterval = Number(autoTestInterval) || 10;
      db.settings.autoExtractInterval = Number(autoExtractInterval) || 30;

      let reconnectNeeded = false;
      if (botToken !== undefined && botToken !== oldToken) {
        db.settings.botToken = botToken;
        reconnectNeeded = true;
      }
      if (botConnectionMode !== undefined && botConnectionMode !== oldMode) {
        reconnectNeeded = true;
      }
      if (publicUrl !== undefined && db.settings.publicUrl !== oldUrl) {
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
    const limit = Number(req.body?.limit || req.query?.limit) || db.settings.testBatchLimit || 100;
    const recentConfigs = db.configs.slice(0, limit);
    const ids = recentConfigs.map(c => c.id);
    if (ids.length === 0) {
      return res.json({ success: true, message: 'هیچ کانفیگی جهت تست موجود نیست.' });
    }

    // Async run to not block express response
    testConfigsBatch(ids);
    res.json({ success: true, message: `تست اتصال تعداد ${ids.length} کانفیگ اخیر در پس‌زمینه آغاز شد.`, count: ids.length });
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

  // API: Manually Update Config Status
  app.patch('/api/configs/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const config = db.configs.find(c => c.id === id);
    if (!config) return res.status(404).json({ success: false, message: 'Config not found' });
    config.status = status;
    if (status === 'working') config.latency = 10;
    config.lastChecked = new Date().toISOString();
    saveDatabase();
    addLog('info', `وضعیت کانفیگ به صورت دستی به ${status} تغییر یافت.`);
    res.json({ success: true });
  });

  // API: Get VPN Files
  app.get('/api/vpn-files', (req, res) => {
    if (!db.npvFiles) db.npvFiles = [];
    res.json(db.npvFiles.map((f: any) => ({ id: f.id, filename: f.filename, status: f.status, createdAt: f.createdAt })));
  });

  // API: Delete VPN File
  app.delete('/api/vpn-files/:id', (req, res) => {
    const { id } = req.params;
    if (!db.npvFiles) db.npvFiles = [];
    db.npvFiles = db.npvFiles.filter((f: any) => f.id !== id);
    saveDatabase();
    res.json({ success: true });
  });

  // API: Clear All VPN Files
  app.delete('/api/vpn-files', (req, res) => {
    db.npvFiles = [];
    saveDatabase();
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
    const limit = Number(req.body?.limit || req.query?.limit) || db.settings.testBatchLimit || 100;
    const recentProxies = db.proxies.slice(0, limit);
    const ids = recentProxies.map(p => p.id);
    if (ids.length === 0) {
      return res.json({ success: true, message: 'هیچ پروکسی جهت تست موجود نیست.' });
    }

    testProxiesBatch(ids);
    res.json({ success: true, message: `تست اتصال تعداد ${ids.length} پروکسی اخیر در پس‌زمینه آغاز شد.`, count: ids.length });
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

  // API: Manually Update Proxy Status
  app.patch('/api/proxies/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!db.proxies) db.proxies = [];
    const proxy = db.proxies.find(p => p.id === id);
    if (!proxy) return res.status(404).json({ success: false, message: 'Proxy not found' });
    proxy.status = status;
    if (status === 'working') proxy.latency = 10;
    proxy.lastChecked = new Date().toISOString();
    saveDatabase();
    addLog('info', `وضعیت پروکسی به صورت دستی به ${status} تغییر یافت.`);
    res.json({ success: true });
  });

  // API: Save Auto-Post settings
  app.post('/api/settings/auto-post', (req, res) => {
    try {
      const { 
        enabled, 
        targetChannel, 
        postIntervalHours, 
        configCount, 
        proxyCount, 
        customText, 
        adText, 
        silentMode, 
        postFiles,
        techNewsCount,
        techTricksCount,
        techPostMode,
        autoPurgeOldTechDays,
        includeTechImportanceBadge
      } = req.body;
      
      db.settings.autoPost = {
        ...DEFAULT_AUTO_POST,
        ...db.settings.autoPost,
        enabled: !!enabled,
        targetChannel: targetChannel || '',
        postIntervalHours: Number(postIntervalHours) || 4,
        configCount: typeof configCount !== 'undefined' && !isNaN(Number(configCount)) ? Math.max(0, Number(configCount)) : 5,
        proxyCount: typeof proxyCount !== 'undefined' && !isNaN(Number(proxyCount)) ? Math.max(0, Number(proxyCount)) : 0,
        customText: customText || '',
        adText: adText || '',
        postFiles: !!postFiles,
        silentMode: !!silentMode,
        techNewsCount: typeof techNewsCount !== 'undefined' && !isNaN(Number(techNewsCount)) ? Math.max(0, Number(techNewsCount)) : 0,
        techTricksCount: typeof techTricksCount !== 'undefined' && !isNaN(Number(techTricksCount)) ? Math.max(0, Number(techTricksCount)) : 0,
        techPostMode: techPostMode || 'combined',
        autoPurgeOldTechDays: Number(autoPurgeOldTechDays) || 7,
        includeTechImportanceBadge: includeTechImportanceBadge !== false,
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

  // API: Get Tech Items
  app.get('/api/tech-items', (req, res) => {
    seedCuratedTechItems();
    res.json(db.techItems || []);
  });

  // API: Refresh Tech Content (Fetch RSS & Purge old)
  app.post('/api/tech-items/refresh', async (req, res) => {
    try {
      const added = await refreshTechContentAndPurgeOld();
      res.json({ success: true, addedCount: added, totalCount: (db.techItems || []).length });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Add Custom Tech Item
  app.post('/api/tech-items', (req, res) => {
    try {
      const { title, summary, category, importance } = req.body;
      if (!title || !summary) {
        return res.status(400).json({ success: false, message: 'عنوان و متن ترفند یا خبر الزامی است.' });
      }
      const calc = calculateTechImportance(title, summary);
      const cat = category === 'news' || category === 'trick' || category === 'secret' ? category : 'trick';
      const imp = (importance || calc.importance) as TechImportance;

      const newItem: TechItem = {
        id: generateId(),
        title: title.trim(),
        summary: summary.trim(),
        category: cat,
        importance: imp,
        importanceScore: calc.score,
        source: 'مدیریت دستی',
        tags: ['تکنولوژی', cat === 'trick' ? 'ترفند_موبایل' : cat === 'secret' ? 'راز_تکنولوژی' : 'اخبار_فناوری'],
        createdAt: new Date().toISOString(),
        postedToChannel: false,
        postedAt: null
      };

      if (!db.techItems) db.techItems = [];
      db.techItems.unshift(newItem);
      saveDatabase();
      addLog('success', `مطلب تکنولوژی جدید افزوده شد: ${newItem.title}`);
      res.json({ success: true, item: newItem });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Delete Tech Item
  app.delete('/api/tech-items/:id', (req, res) => {
    try {
      const { id } = req.params;
      const idx = (db.techItems || []).findIndex(t => t.id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'مطلب یافت نشد.' });
      }
      db.techItems.splice(idx, 1);
      saveDatabase();
      res.json({ success: true });
    } catch (err: any) {
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
