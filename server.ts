import express from 'express';
import path from 'path';
import fs from 'fs';
import net from 'net';
import dns from 'dns';
import tls from 'tls';
import os from 'os';
import { GoogleGenAI, Type } from '@google/genai';

// --- Local IP Helper ---
function getMachineIp(): string {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]!) {
        if (iface.family === 'IPv4' && !iface.internal) {
           return iface.address;
        }
      }
    }
  } catch (e) {}
  return '127.0.0.1';
}
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
  TechImportance,
  AiPrompt,
  AiPromptCategory,
  FunNewsItem,
  FunNewsSource,
  SecondaryChannelSettings,
  DigitalToolItem,
  DigitalToolCategory,
  PostedPromptRecord
} from './src/types';
import { DEFAULT_DIGITAL_TOOLS, EXTENDED_AI_PROMPTS } from './src/digitalToolsData';

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

export interface ChannelPostHistoryItem {
  id: string;
  channelTarget: 1 | 2;
  channelHandle: string;
  category: 'configs' | 'news' | 'tricks' | 'prompts' | 'fun' | 'tech' | 'digital_tools';
  postedAt: string; // ISO string
  tehranDate: string; // YYYY-MM-DD
  tehranHour: number; // 0 - 23
  messageId?: number;
  previewText?: string;
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
  channelPostHistory?: ChannelPostHistoryItem[];
  techItems?: TechItem[];
  aiPrompts?: AiPrompt[];
  funNewsItems?: FunNewsItem[];
  funSources?: FunNewsSource[];
  digitalTools?: DigitalToolItem[];
  postedPromptHistory?: PostedPromptRecord[];
}

// --- Pre-populated default sources ---
const DEFAULT_SOURCES: SourceItem[] = [
  {
    id: 'src-1',
    type: 'telegram',
    name: 'V2Ray Alpha Configs',
    urlOrHandle: '@v2ray_alpha',
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
    name: 'VPN Ocean (Configs & Proxies)',
    urlOrHandle: '@vpn_ocean',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'src-4',
    type: 'telegram',
    name: 'Private VPNs Channel',
    urlOrHandle: '@PrivateVPNs',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'src-5',
    type: 'telegram',
    name: 'Proxy MTProto Live',
    urlOrHandle: '@ProxyMTProto',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'src-6',
    type: 'sub',
    name: 'BarryFar All Configs Sub',
    urlOrHandle: 'https://raw.githubusercontent.com/barry-far/V2ray-config/main/All_Configs_Sub.txt',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'src-7',
    type: 'sub',
    name: 'MahdiBland V2Ray Aggregator',
    urlOrHandle: 'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'src-8',
    type: 'sub',
    name: 'Epodonios All Configs Sub',
    urlOrHandle: 'https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/All_Configs_Sub.txt',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'src-9',
    type: 'sub',
    name: 'Mineral Nodes Hub',
    urlOrHandle: 'https://raw.githubusercontent.com/LalatinaHub/Mineral/master/result/nodes',
    enabled: true,
    extractedCount: 0,
    lastExtracted: null
  }
];

const DEFAULT_AI_PROMPTS: AiPrompt[] = [
  // 1. Pixar & 3D Disney Character Styles
  {
    id: 'prompt-pixar-1',
    title: 'تبدیل عکس چهره به کاراکتر انیمیشنی ۳ بعدی پیکسار',
    category: 'image',
    styleCategory: 'pixar',
    description: 'ترند محبوب برای تبدیل چهره واقعی به کاراکتر انیمیشنی دوست‌داشتنی سبک پیکسار با چشمان درخشان و بافت خمیری لطیف.',
    promptText: '3D Pixar Disney style animated character of a person, expressive sparkling eyes, soft cinematic rim lighting, warm joyful colors, smooth claymation render, octane render, Unreal Engine 5, 8k --ar 9:16 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/9qbfr7mlnt8sn7yp01pw02z7ez1r-midjourney-6-close-up-of-a-stunning-fashion-model-ultra-realistic-portrait-shot-on-a-sony-a7iii-high-quality-ar-3564-stylize.png',
    tipsForPersonalPhoto: 'یک عکس سلفی یا پرتره با لبخند و نور ملایم از چهره خود انتخاب کنید.',
    tags: ['پیکسار', 'دیزنی', 'انیمیشن_۳بعدی', 'تبدیل_چهره'],
    importance: 'hot',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },
  {
    id: 'prompt-pixar-2',
    title: 'کودک خردسال با لباس فضانوردی سبک انیمیشن پیکسار',
    category: 'image',
    styleCategory: 'pixar',
    description: 'کاراکتر فانتزی کودک در لباس فضانوردی درخشان با بازتاب کهکشان و سیاره‌ها در کلاه ایمنی و طراحی بامزه دیزنی.',
    promptText: 'cute toddler astronaut floating in space, Pixar 3D animation style, oversized astronaut helmet reflecting colorful nebulae, chubby cheeks, wonder in eyes, cinematic volumetric lighting, 8k --ar 1:1 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/xjsos7jl5jltflxms50aa37a4bw5-midjourney-6-japanese-girl-18-21-years-old-brown-hair-high-quality-photo-portrait-shot-on-a-polaroid-camera-double-eyelid-ar.png',
    tipsForPersonalPhoto: 'عکس کودک یا پرتره نوزاد را به عنوان رفرنس چهره ارسال فرمایید.',
    tags: ['پیکسار', 'کودک', 'فضانورد', 'فانتزی'],
    importance: 'hot',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },
  {
    id: 'prompt-pixar-3',
    title: 'سگ وفادار خانگی در دنیای جادویی انیمیشن دیزنی',
    category: 'image',
    styleCategory: 'pixar',
    description: 'تبدیل عکس حیوان خانگی به شخصیت اصلی داستان‌های ماجراجویانه انیمیشنی با موهای پرپشت و چشمان زنده.',
    promptText: 'adorable golden retriever dog looking curiously, Pixar animation style, highly detailed fur shader, soft studio light, warm golden hour sunbeams, Disney character render --ar 4:5 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/7nqvhyrmf607ngkesub1l7kxc9j3-midjourney-6-chroma-portrait.png',
    tipsForPersonalPhoto: 'عکس نزدیک و باکیفیت از حیوان خانگی یا پرتره چهره خودتان در کنار پت آپلود کنید.',
    tags: ['پیکسار', 'پت', 'سگ', 'دیزنی_حیوانات'],
    importance: 'normal',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },

  // 2. Family, Kids & Parents Styles
  {
    id: 'prompt-family-1',
    title: 'پرتره گرم و صمیمی خانوادگی در کلبه چوبی پاییزی',
    category: 'image',
    styleCategory: 'family',
    description: 'عکاسی احساسی خانوادگی کنار شومینه با نور ملایم شمع، بافت‌های بافتنی گرم و لبخندهای طبیعی و دلنشین.',
    promptText: 'heartwarming family portrait, parents and children sitting together by a cozy stone fireplace in a wooden cabin, autumn afternoon glow, cinematic soft focus, authentic happy emotions, Hasselblad X2D 100C, 8k --ar 16:9 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/zgkq5uftglj1q0xkl07ycr2n839i-midjourney-6-model-portrait.png',
    tipsForPersonalPhoto: 'یک عکس دسته‌جمعی خانوادگی با کادربندی افقی را برای ترکیب ارسال کنید.',
    tags: ['خانوادگی', 'کلبه_چوبی', 'پاییز', 'پرتره_احساسی'],
    importance: 'hot',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },
  {
    id: 'prompt-family-2',
    title: 'پرتره مادر و فرزندی با تم فرشتگان و گل‌های بهاری',
    category: 'image',
    styleCategory: 'family',
    description: 'عکاسی هنری در آتلیه با هاله‌ای از گل‌های پیونی و رز ملایم، نورپردازی بهشتی و بافت رویایی.',
    promptText: 'fine art mother and baby portrait, ethereal pastel flower garland, heavenly soft halo lighting, gentle embrace, tender maternal love, painterly fine-art photography, 85mm f/1.2 lens, 8k --ar 4:5 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/9qbfr7mlnt8sn7yp01pw02z7ez1r-midjourney-6-close-up-of-a-stunning-fashion-model-ultra-realistic-portrait-shot-on-a-sony-a7iii-high-quality-ar-3564-stylize.png',
    tipsForPersonalPhoto: 'عکس آغوش مادر و فرزند با نگاه‌های آرام بهترین نتیجه را به همراه دارد.',
    tags: ['مادر_و_کودک', 'بهاری', 'هنری', 'پرتره_بهشتی'],
    importance: 'normal',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },

  // 3. Romantic Couple & Wedding Styles
  {
    id: 'prompt-couple-1',
    title: 'پرتره عاشقانه دونفره زیر باران پاریس با چتر شیشه‌ای',
    category: 'image',
    styleCategory: 'couple',
    description: 'شات سینمایی رمانتیک در خیابان‌های سنگفرش شبانه با انعکاس نور چراغ‌های کلاسیک شهری و قطرات معلق باران.',
    promptText: 'romantic cinematic couple portrait walking under a transparent umbrella on a rainy Paris cobblestone street, amber street lamp glow reflecting on wet pavement, loving eye contact, 35mm film still, masterpiece --ar 16:9 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/7nqvhyrmf607ngkesub1l7kxc9j3-midjourney-6-chroma-portrait.png',
    tipsForPersonalPhoto: 'یک عکس دونفره سلفی یا قدی با همسرتان آپلود کنید.',
    tags: ['عاشقانه', 'دونفره', 'باران_پاریس', 'سینمایی'],
    importance: 'hot',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },
  {
    id: 'prompt-couple-2',
    title: 'عکاسی نامزدی و فرمالیته ساحلی در ساعت طلایی غروب',
    category: 'image',
    styleCategory: 'couple',
    description: 'شات ادیتوریال عروسی و نامزدی با باد ملایم ساحلی، موهای مواج در باد و نور گرم و درخشان افق دریا.',
    promptText: 'editorial wedding couple photoshoot on a scenic coastal cliff at golden hour sunset, ocean breeze catching her flowing dress, romantic silhouette with warm rim backlight, shot on Leica SL2, 50mm Summilux --ar 9:16 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/xjsos7jl5jltflxms50aa37a4bw5-midjourney-6-japanese-girl-18-21-years-old-brown-hair-high-quality-photo-portrait-shot-on-a-polaroid-camera-double-eyelid-ar.png',
    tipsForPersonalPhoto: 'عکس دونفره در فضای باز با پس‌زمینه ساده بهترین هماهنگی را ایجاد می‌کند.',
    tags: ['فرمالیته', 'عروسی', 'ساحل', 'ساعت_طلایی'],
    importance: 'hot',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },

  // 4. Cyberpunk & Sci-Fi Styles
  {
    id: 'prompt-cyberpunk-1',
    title: 'پرتره سایبرپانک هکر مدرن با نورهای نئونی بارانی توکیو',
    category: 'image',
    styleCategory: 'cyberpunk',
    description: 'شات سایبرپانک با ژاکت فناوری بالا (Techwear)، بازتاب‌های رنگی نئون بنفش و فیروزه‌ای روی صورت و نمایشگر هولوگرافیک.',
    promptText: 'close-up portrait of a cyberpunk hacker in futuristic techwear jacket, rainy neo-Tokyo street backdrop, glowing cyan and magenta holographic HUD interface, moody atmosphere, blade runner vibe, 8k --ar 9:16 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/7nqvhyrmf607ngkesub1l7kxc9j3-midjourney-6-chroma-portrait.png',
    tipsForPersonalPhoto: 'یک عکس پرتره با نگاه جدی و نور با کنتراست بالا ارسال فرمایید.',
    tags: ['سایبرپانک', 'نئون', 'هکر', 'آینده_نگر'],
    importance: 'hot',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },
  {
    id: 'prompt-cyberpunk-2',
    title: 'پرتره رباتیک سایبورگ با اجزای فیبر کربن و طلا',
    category: 'image',
    styleCategory: 'cyberpunk',
    description: 'ترکیب اعجاب‌انگیز بافت پوست انسان با قطعات الکترومکانیکی فیبر کربن و رگه‌های طلای مایع متالیک.',
    promptText: 'haute-couture cyborg portrait, half human face blending seamlessly into polished obsidian carbon fiber and liquid gold circuitry, subtle bioluminescent LED accents, cinematic studio lighting, photorealistic --ar 4:5 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/zgkq5uftglj1q0xkl07ycr2n839i-midjourney-6-model-portrait.png',
    tipsForPersonalPhoto: 'پرتره مستقیم از روبرو با وضوح بالا برای بهترین تفکیک سایبورگ پیشنهاد می‌شود.',
    tags: ['سایبورگ', 'فیبر_کربن', 'مدرن', 'علمی_تخیلی'],
    importance: 'normal',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },

  // 5. Royal & Classical Oil Painting
  {
    id: 'prompt-royal-1',
    title: 'پرتره نقاشی رنگ‌روغن پادشاهی رنسانس با شنل مخمل و تاج زرین',
    category: 'image',
    styleCategory: 'royal',
    description: 'پرتره اشرافی سبک نقاشان بزرگ قرن هفدهم با قلم‌موهای بافت‌دار، شنل مخمل سرخ، جواهرات سلطنتی و کنتراست رامبراند.',
    promptText: 'magnificent royal renaissance oil painting portrait, wearing an ornate crimson velvet cape embroidered with golden filigree, antique jewel-encrusted crown, dramatic Rembrandt chiaroscuro lighting, textured canvas oil paint impasto --ar 3:4 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/9qbfr7mlnt8sn7yp01pw02z7ez1r-midjourney-6-close-up-of-a-stunning-fashion-model-ultra-realistic-portrait-shot-on-a-sony-a7iii-high-quality-ar-3564-stylize.png',
    tipsForPersonalPhoto: 'عکس رسمی با کت، پیراهن یقه دار یا استایل مجلسی بهترین جلوه را به تصویر می‌دهد.',
    tags: ['سلطنتی', 'رنگ_روغن', 'رنسانس', 'رامبراند'],
    importance: 'hot',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },
  {
    id: 'prompt-royal-2',
    title: 'پرتره ملکه ویکتوریایی با گردنبند زمرد و الماس در قصر اشرافی',
    category: 'image',
    styleCategory: 'royal',
    description: 'شکوه و جلال درباری با لباس تور گیپور دوزی شده دست‌ساز، تالار آینه‌های سلطنتی و نور ملایم چلچراغ‌های کریستالی.',
    promptText: 'Victorian aristocrat noblewoman portrait, standing in a grand palace ballroom with crystal chandeliers, wearing an emerald green silk ballgown with intricate lace, emerald tiara, oil on canvas masterpiece --ar 4:5 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/zgkq5uftglj1q0xkl07ycr2n839i-midjourney-6-model-portrait.png',
    tipsForPersonalPhoto: 'پرتره با نگاه مستقیم و موهای آراسته ایده‌آل است.',
    tags: ['ویکتوریایی', 'ملکه', 'زمرد', 'قصر'],
    importance: 'normal',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },

  // 6. Artistic, Anime & Studio Ghibli
  {
    id: 'prompt-artistic-1',
    title: 'نقاشی آبرنگی رویایی در دنیای جادویی انیمه استودیو جیبلی',
    category: 'image',
    styleCategory: 'artistic',
    description: 'ترکیب چهره در سبک تصویرسازی نوستالژیک هایائو میازاکی، دشت‌های سرسبز، گل‌های وحشی و آسمان آبی با ابرهای پف‌دار.',
    promptText: 'Studio Ghibli aesthetic anime portrait, surrounded by blowing wild meadow flowers, dramatic fluffy cumulus clouds in brilliant cyan sky, Hayao Miyazaki hand-painted watercolor art style, warm nostalgic sunshine, 8k --ar 16:9 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/xjsos7jl5jltflxms50aa37a4bw5-midjourney-6-japanese-girl-18-21-years-old-brown-hair-high-quality-photo-portrait-shot-on-a-polaroid-camera-double-eyelid-ar.png',
    tipsForPersonalPhoto: 'سلفی با لبخند طبیعی در فضای روشن روز بهترین هارمونی را ایجاد خواهد کرد.',
    tags: ['جیبلی', 'انیمه', 'آبرنگ', 'میازاکی'],
    importance: 'hot',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },
  {
    id: 'prompt-artistic-2',
    title: 'پرتره امپرسیونیستی سبک شب پرستاره وینسنت ون‌گوگ',
    category: 'image',
    styleCategory: 'artistic',
    description: 'ضربه قلم‌موهای ضخیم مواج، مارپیچ‌های چرخان زرد و آبی کبالت سبک نقاشی مشهور ون‌گوگ روی چهره.',
    promptText: 'Vincent van Gogh Starry Night oil painting portrait, swirling vibrant cobalt blue and cadmium yellow impasto brush strokes, expressive textured oil paint, starry night sky backdrop, post-impressionist masterpiece --ar 1:1 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/7nqvhyrmf607ngkesub1l7kxc9j3-midjourney-6-chroma-portrait.png',
    tipsForPersonalPhoto: 'عکس پرتره با وضوح بالا تا خطوط امپرسیونیستی روی صورت جلوه‌ای هنری پیدا کنند.',
    tags: ['ونگوگ', 'امپرسیونیسم', 'شب_پرستاره', 'رنگ_روغن'],
    importance: 'normal',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },

  // 7. Studio Fashion & Modeling
  {
    id: 'prompt-fashion-1',
    title: 'عکاسی مجله ووگ با دوربین مدیوم فرمت هاسلبلاد و نور سافت',
    category: 'image',
    styleCategory: 'fashion',
    description: 'شات فشن ادیتوریال مجلات بین‌المللی با رزولوشن میکروسکوپی، بافت طبیعی پوست، استایل مینیمال و نورپردازی حرفه‌ای استودیو.',
    promptText: 'high-fashion Vogue cover portrait, professional studio model, shot on Hasselblad H6D-100c, 100mm f/2.2 lens, ultra-sharp skin texture, soft diffused beauty dish lighting, elegant minimalist styling --ar 3:4 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/9qbfr7mlnt8sn7yp01pw02z7ez1r-midjourney-6-close-up-of-a-stunning-fashion-model-ultra-realistic-portrait-shot-on-a-sony-a7iii-high-quality-ar-3564-stylize.png',
    tipsForPersonalPhoto: 'سلفی یا عکس پرتره با زمینه تک‌رنگ و نور مستقیم برای بهترین رندر مجله‌ای.',
    tags: ['ووگ', 'مدلینگ', 'هاسلبلاد', 'فشن_استودیو'],
    importance: 'hot',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },
  {
    id: 'prompt-fashion-2',
    title: 'پرتره کلاسیک با دوربین پولاروید دهه ۹۰ و دانه‌بندی گرین نوستالژیک',
    category: 'image',
    styleCategory: 'fashion',
    description: 'حس نوستالژی فیلم‌های آنالوگ با رنگ‌های پاستلی گرم، خطای اپتیکی وینتیج و فوکوس نرم دوربین‌های فوری پولاروید.',
    promptText: '90s vintage Polaroid photo portrait, natural window lighting, candid expression, authentic film grain texture, faded pastel colors, double exposure aura, nostalgic retro aesthetic --ar 9:16 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/xjsos7jl5jltflxms50aa37a4bw5-midjourney-6-japanese-girl-18-21-years-old-brown-hair-high-quality-photo-portrait-shot-on-a-polaroid-camera-double-eyelid-ar.png',
    tipsForPersonalPhoto: 'یک عکس خودمانی و صمیمی بدون فیلتر مصنوعی جهت شبیه‌سازی پولاروید.',
    tags: ['پولاروید', 'وینتیج', 'دهه۹۰', 'عکاسی_آنالوگ'],
    importance: 'hot',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },
  ...EXTENDED_AI_PROMPTS
];

const DEFAULT_KNOWN_APP_URL = 'https://ais-dev-3wfduwtghl6fqrseyhtp5l-217900666396.europe-west2.run.app';

const DEFAULT_FUN_SOURCES: FunNewsSource[] = [
  {
    id: 'fun-src-1',
    name: 'آخرین خبر (اخبار روز و فوری)',
    urlOrHandle: '@akharinkhabar',
    enabled: true,
    category: 'news',
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'fun-src-2',
    name: 'جوک کده (بمب خنده و جوک تلگرام)',
    urlOrHandle: '@jokkadeh',
    enabled: true,
    category: 'fun',
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'fun-src-3',
    name: 'فارسی فان (شوخی و سرگرمی روز)',
    urlOrHandle: '@farsifun',
    enabled: true,
    category: 'fun',
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'fun-src-4',
    name: 'خنده‌آباد (طنز، میم و لبخند)',
    urlOrHandle: '@khandehabadd',
    enabled: true,
    category: 'fun',
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'fun-src-5',
    name: 'جوک‌دونی (طنز و سرگرمی تلگرام)',
    urlOrHandle: '@jokdoni',
    enabled: true,
    category: 'fun',
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'fun-src-6',
    name: 'خبر فوری (اخبار مهم روز)',
    urlOrHandle: '@khabar_fouri',
    enabled: true,
    category: 'news',
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'fun-src-7',
    name: 'خبرگزاری فارس (اخبار روز)',
    urlOrHandle: '@Farsna',
    enabled: true,
    category: 'news',
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'fun-src-8',
    name: 'دانستنی‌های جهان (دانستنی و اطلاعات جالب)',
    urlOrHandle: '@danestanihaye_jahan',
    enabled: true,
    category: 'fun',
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'fun-src-9',
    name: 'کانال گیزمیز (مطالب جالب و سرگرمی)',
    urlOrHandle: '@GizmizTel',
    enabled: true,
    category: 'fun',
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'fun-src-10',
    name: 'کافیه (مطالب خواندنی روز)',
    urlOrHandle: '@Kafiha',
    enabled: true,
    category: 'fun',
    extractedCount: 0,
    lastExtracted: null
  },
  {
    id: 'fun-src-11',
    name: 'زومیت (اخبار علم و فناوری)',
    urlOrHandle: '@zoomit',
    enabled: true,
    category: 'news',
    extractedCount: 0,
    lastExtracted: null
  }
];

const DEFAULT_FUN_NEWS_ITEMS: FunNewsItem[] = [];

const DEFAULT_CHANNEL2_SETTINGS: SecondaryChannelSettings = {
  enabled: false,
  targetChannel: '',
  adText: 'کانال دوم ما: @MyChannel2',
  silentMode: true,
  antiFloodDelayMinutes: 5,
  lastAnyPostAt: null,
  lastPostedAt: null,

  // Smart Channel Growth, Traffic & Anti-Churn Controls
  maxDailyPosts: 6, // Maximum 6 posts per day to prevent spam
  minPostSpacingMinutes: 120, // At least 2 hours between ANY post in Channel 2
  smartGoldenHours: true, // Prioritize peak Iranian hours (12:30-14:30, 18:00-20:30, 21:30-23:45)
  sleepHoursProtection: true, // Halt auto-posts during sleeping hours (00:30 - 08:30 Tehran time)
  singlePostMode: true, // Enforce strictly 1 telegram message per post

  // Dedicated Glass / Inline Button for Channel 2
  inlineButtonEnabled: true,
  inlineButtonText: '',
  inlineButtonUrl: '',

  // 1. Fun & General News Schedule for Channel 2 (Default Active for Channel 2)
  funNewsEnabled: true,
  funNewsIntervalHours: 2,
  funNewsIntervalMinutes: 120,
  funNewsCount: 1,
  lastFunNewsPostedAt: null,

  // Optional toggles for other content types
  configsEnabled: false,
  postIntervalHours: 4,
  configIntervalHours: 4,
  configIntervalMinutes: 240,
  configCount: 5,
  proxyCount: 1,
  customText: '💎 کانفیگ‌ها و پروکسی‌های اختصاصی تقدیم به شما:',
  lastConfigsPostedAt: null,

  techNewsEnabled: false,
  techNewsIntervalHours: 4,
  techNewsIntervalMinutes: 240,
  techNewsCount: 2,
  lastTechNewsPostedAt: null,

  techTricksEnabled: false,
  techTricksIntervalHours: 6,
  techTricksIntervalMinutes: 360,
  techTricksCount: 2,
  lastTechTricksPostedAt: null,

  aiPromptsEnabled: false,
  aiPromptsIntervalHours: 6,
  aiPromptsIntervalMinutes: 360,
  aiPromptsCount: 1,
  lastAiPromptsPostedAt: null,

  digitalToolsEnabled: false,
  digitalToolsIntervalHours: 6,
  digitalToolsIntervalMinutes: 360,
  digitalToolsCount: 1,
  digitalToolsCategories: ['ai_tools', 'cool_websites', 'mobile_hacks', 'cyber_security', 'must_apps'],
  lastDigitalToolsPostedAt: null
};

const DEFAULT_AUTO_POST: AutoPostSettings = {
  enabled: false,
  targetChannel: '',
  adText: 'Sponsor: @MyChannel',
  silentMode: true,
  postFiles: false,
  includeTechImportanceBadge: true,
  autoPurgeOldTechDays: 7,
  lastPostedAt: null,
  antiFloodDelayMinutes: 5,
  lastAnyPostAt: null,

  // Smart Channel Growth, Traffic & Anti-Churn Controls
  maxDailyPosts: 4, // Maximum 4 posts per day for Channel 1 (Tech & Configs)
  minPostSpacingMinutes: 180, // Minimum 3 hours between ANY post in Channel 1
  smartGoldenHours: true, // Prioritize peak Iranian hours
  sleepHoursProtection: true, // Halt auto-posts during sleeping hours (00:30 - 08:30 Tehran time)
  singlePostMode: true, // Strictly 1 telegram message per drop (no duplicate files/messages at the same minute)

  // 1. Configs & Proxies Schedule
  configsEnabled: true,
  postIntervalHours: 4,
  configIntervalHours: 4,
  configIntervalMinutes: 240,
  configCount: 5,
  proxyCount: 1,
  customText: '💎 کانفیگ‌ها و پروکسی‌های اختصاصی و تست‌شده ما تقدیم به شما:',
  lastConfigsPostedAt: null,

  // 2. Tech News Schedule
  techNewsEnabled: false,
  techNewsIntervalHours: 6,
  techNewsIntervalMinutes: 360,
  techNewsCount: 2,
  lastTechNewsPostedAt: null,

  // 3. Tech Tricks & Secrets Schedule
  techTricksEnabled: false,
  techTricksIntervalHours: 6,
  techTricksIntervalMinutes: 360,
  techTricksCount: 2,
  lastTechTricksPostedAt: null,

  // 4. AI Prompts Schedule
  aiPromptsEnabled: false,
  aiPromptsIntervalHours: 6,
  aiPromptsIntervalMinutes: 360,
  aiPromptsCount: 1,
  lastAiPromptsPostedAt: null,

  // 5. Fun & General News Schedule (Channel 1)
  funNewsEnabled: false,
  funNewsIntervalHours: 4,
  funNewsIntervalMinutes: 240,
  funNewsCount: 1,
  lastFunNewsPostedAt: null,

  // 6. Future-Proof Digital Tools & AI Toolbox (Channel 1 Independence from Filter/Proxy)
  digitalToolsEnabled: true,
  digitalToolsIntervalHours: 4,
  digitalToolsIntervalMinutes: 240,
  digitalToolsCount: 1,
  digitalToolsCategories: ['ai_tools', 'cool_websites', 'mobile_hacks', 'cyber_security', 'must_apps'],
  lastDigitalToolsPostedAt: null,

  // Dedicated Glass / Inline Button for Channel 1
  inlineButtonEnabled: true,
  inlineButtonText: '',
  inlineButtonUrl: '',

  techPostMode: 'combined',

  // Channel 2 Dedicated Auto-Post Settings
  channel2: DEFAULT_CHANNEL2_SETTINGS
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
  publicUrl: DEFAULT_KNOWN_APP_URL,
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
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
    const envAdminUsername = process.env.ADMIN_USERNAME ? process.env.ADMIN_USERNAME.replace(/^['"\s]+|['"\s]+$/g, '').trim() : '';
    const envAdminPassword = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.replace(/^['"\s]+|['"\s]+$/g, '').trim() : '';

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
      adminUsername: envAdminUsername || loadedSettings?.settings?.adminUsername || loadedDataStore?.settings?.adminUsername || 'admin',
      adminPassword: envAdminPassword || loadedSettings?.settings?.adminPassword || loadedDataStore?.settings?.adminPassword || 'admin',
      autoPost: { ...DEFAULT_AUTO_POST, ...(loadedSettings?.settings?.autoPost || loadedDataStore?.settings?.autoPost || {}) }
    };

    // Automatically resolve and set the correct public Web panel URL for Telegram WebApp (TWA)
    const detectedUrl = process.env.APP_URL || process.env.DEV_APP_URL || DEFAULT_KNOWN_APP_URL;
    if (!finalSettings.publicUrl || finalSettings.publicUrl.trim() === '' || finalSettings.publicUrl === 'https://ais-dev-3wfduwtghl6fqrseyhtp5l-217900666396.europe-west2.run.app') {
      finalSettings.publicUrl = detectedUrl;
    }

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
    const finalAiPrompts = Array.isArray(loadedDataStore?.aiPrompts)
      ? loadedDataStore.aiPrompts
      : (Array.isArray(loadedSettings?.aiPrompts) ? loadedSettings.aiPrompts : DEFAULT_AI_PROMPTS);

    // Merge new extended prompts if they don't exist yet
    for (const extP of EXTENDED_AI_PROMPTS) {
      if (!finalAiPrompts.some(p => p.id === extP.id || p.title === extP.title)) {
        finalAiPrompts.push({ ...extP });
      }
    }

    const finalDigitalTools = Array.isArray(loadedDataStore?.digitalTools) && loadedDataStore.digitalTools.length > 0
      ? loadedDataStore.digitalTools
      : [...DEFAULT_DIGITAL_TOOLS];

    // Merge any missing default digital tools
    for (const dt of DEFAULT_DIGITAL_TOOLS) {
      if (!finalDigitalTools.some(t => t.id === dt.id || t.title === dt.title)) {
        finalDigitalTools.push({ ...dt });
      }
    }

    const finalPostedPromptHistory = Array.isArray(loadedDataStore?.postedPromptHistory)
      ? loadedDataStore.postedPromptHistory
      : [];

    const finalFunSources = Array.isArray(loadedSettings?.funSources)
      ? loadedSettings.funSources
      : (Array.isArray(loadedDataStore?.funSources) ? loadedDataStore.funSources : DEFAULT_FUN_SOURCES);

    const finalFunNewsItems = Array.isArray(loadedDataStore?.funNewsItems)
      ? loadedDataStore.funNewsItems
      : DEFAULT_FUN_NEWS_ITEMS;

    const finalPostHistory = Array.isArray(loadedDataStore?.channelPostHistory)
      ? loadedDataStore.channelPostHistory
      : (Array.isArray(loadedSettings?.channelPostHistory) ? loadedSettings.channelPostHistory : []);

    if (!finalSettings.autoPost.channel2) {
      finalSettings.autoPost.channel2 = { ...DEFAULT_CHANNEL2_SETTINGS };
    }

    // Ensure Channel 1 growth & anti-flood guard settings
    if (typeof finalSettings.autoPost.maxDailyPosts === 'undefined' || finalSettings.autoPost.maxDailyPosts <= 0) {
      finalSettings.autoPost.maxDailyPosts = 4;
    }
    if (typeof finalSettings.autoPost.minPostSpacingMinutes === 'undefined' || finalSettings.autoPost.minPostSpacingMinutes < 60) {
      finalSettings.autoPost.minPostSpacingMinutes = 180;
    }
    if (typeof finalSettings.autoPost.smartGoldenHours === 'undefined') {
      finalSettings.autoPost.smartGoldenHours = true;
    }
    if (typeof finalSettings.autoPost.sleepHoursProtection === 'undefined') {
      finalSettings.autoPost.sleepHoursProtection = true;
    }
    if (typeof finalSettings.autoPost.singlePostMode === 'undefined') {
      finalSettings.autoPost.singlePostMode = true;
    }
    if (typeof finalSettings.autoPost.digitalToolsEnabled === 'undefined') {
      finalSettings.autoPost.digitalToolsEnabled = true;
    }
    if (typeof finalSettings.autoPost.digitalToolsCount === 'undefined') {
      finalSettings.autoPost.digitalToolsCount = 1;
    }
    if (typeof finalSettings.autoPost.digitalToolsIntervalHours === 'undefined') {
      finalSettings.autoPost.digitalToolsIntervalHours = 4;
    }
    if (typeof finalSettings.autoPost.digitalToolsIntervalMinutes === 'undefined') {
      finalSettings.autoPost.digitalToolsIntervalMinutes = 240;
    }

    // Ensure Channel 2 growth & anti-flood guard settings
    if (typeof finalSettings.autoPost.channel2.maxDailyPosts === 'undefined' || finalSettings.autoPost.channel2.maxDailyPosts <= 0) {
      finalSettings.autoPost.channel2.maxDailyPosts = 6;
    }
    if (typeof finalSettings.autoPost.channel2.minPostSpacingMinutes === 'undefined' || finalSettings.autoPost.channel2.minPostSpacingMinutes < 60) {
      finalSettings.autoPost.channel2.minPostSpacingMinutes = 120;
    }
    if (typeof finalSettings.autoPost.channel2.smartGoldenHours === 'undefined') {
      finalSettings.autoPost.channel2.smartGoldenHours = true;
    }
    if (typeof finalSettings.autoPost.channel2.sleepHoursProtection === 'undefined') {
      finalSettings.autoPost.channel2.sleepHoursProtection = true;
    }
    if (typeof finalSettings.autoPost.channel2.singlePostMode === 'undefined') {
      finalSettings.autoPost.channel2.singlePostMode = true;
    }
    if (typeof finalSettings.autoPost.channel2.digitalToolsEnabled === 'undefined') {
      finalSettings.autoPost.channel2.digitalToolsEnabled = false;
    }
    if (typeof finalSettings.autoPost.channel2.digitalToolsCount === 'undefined') {
      finalSettings.autoPost.channel2.digitalToolsCount = 1;
    }

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
      channelPostHistory: finalPostHistory,
      techItems: finalTechItems,
      aiPrompts: finalAiPrompts,
      funNewsItems: finalFunNewsItems,
      funSources: finalFunSources,
      digitalTools: finalDigitalTools,
      postedPromptHistory: finalPostedPromptHistory
    };

    // Migration: Update any stale or dead sources to modern active verified sources
    let sourcesMigrated = false;
    for (const s of db.sources) {
      if (s.urlOrHandle && (s.urlOrHandle.includes('yebekhe/TVC') || s.urlOrHandle.includes('yebekhe/TelegramV2rayCollector'))) {
        s.name = 'MahdiBland V2Ray Aggregator';
        s.urlOrHandle = 'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt';
        s.type = 'sub';
        sourcesMigrated = true;
      } else if (s.urlOrHandle === '@v2ray_outline') {
        s.name = 'V2Ray Alpha Configs';
        s.urlOrHandle = '@v2ray_alpha';
        sourcesMigrated = true;
      } else if (s.urlOrHandle === '@v2ray_configs_pool') {
        s.name = 'VPN Ocean (Configs & Proxies)';
        s.urlOrHandle = '@vpn_ocean';
        sourcesMigrated = true;
      }
    }

    let needsSave = false;

    if (sourcesMigrated) {
      needsSave = true;
    }

    // Correct stale/mismatched default prompt image URLs
    for (const p of db.aiPrompts) {
      if (p.id === 'prompt-2' && (p.imageUrl?.includes('photo-1509198397868') || p.title?.includes('تهران سایبرپانک'))) {
        p.imageUrl = 'https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?w=800&auto=format&fit=crop&q=60';
        needsSave = true;
      }
      if (p.id === 'prompt-1' && p.imageUrl?.includes('photo-1600861195091')) {
        p.imageUrl = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=60';
        needsSave = true;
      }
      if (p.id === 'prompt-4' && p.imageUrl?.includes('photo-1518531933037')) {
        p.imageUrl = 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=800&auto=format&fit=crop&q=60';
        needsSave = true;
      }
    }
    if (needsSave) {
      setTimeout(() => saveDatabase(true), 1000);
    }

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
      users: db.users,
      funSources: db.funSources || []
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
        users: db.users,
        funSources: db.funSources || []
      };
      writeJsonAtomic(SETTINGS_FILE, systemData);

      // 2. Save heavy data store (configs, proxies, npvFiles, techItems, logs, postedMessages)
      const storeData = {
        configs: db.configs,
        proxies: db.proxies,
        npvFiles: db.npvFiles,
        techItems: db.techItems || [],
        logs: db.logs,
        postedMessages: db.postedMessages,
        aiPrompts: db.aiPrompts || [],
        funNewsItems: db.funNewsItems || [],
        digitalTools: db.digitalTools || [],
        postedPromptHistory: db.postedPromptHistory || []
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

// --- Global VPS Auto-Detected IP/Host Cache ---
let detectedPublicIp: string | null = null;
let detectedPublicHost: string | null = null;

function detectPublicIp() {
  try {
    exec('curl -s https://api.ipify.org || curl -s https://ifconfig.me || curl -s https://icanhazip.com', (err, stdout) => {
      if (!err && stdout) {
        const ip = stdout.trim();
        const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        if (ipv4Regex.test(ip)) {
          detectedPublicIp = ip;
          console.log(`[IP Auto-Detect] Real VPS Public IP auto-detected: ${ip}`);
        }
      }
    });
  } catch (e) {}
}
detectPublicIp();

// --- Gemini Client Lazy Initializer ---
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      console.log('[Gemini Client] Initialized successfully server-side.');
    } catch (e) {
      console.error('Error initializing Gemini client:', e);
    }
  }
  return geminiClient;
}

// Global queue of recently served prompts to guarantee zero immediate repetitions
const recentlyServedPromptIds: string[] = [];

// --- Live Real-Time AI Prompt Extractor (Photo-styling & Face Combination) ---
async function fetchLiveTrendingAiPromptFromInternet(categoryKey?: string, chatId?: number): Promise<{
  id: string;
  title: string;
  category: 'image' | 'video' | 'chat' | 'other';
  styleCategory?: string;
  description: string;
  promptText: string;
  imageUrl?: string;
  tags: string[];
  tipsForPersonalPhoto?: string;
}> {
  // Ensure default curated prompts are present if database is low or empty
  if (!db.aiPrompts || db.aiPrompts.length < DEFAULT_AI_PROMPTS.length) {
    const existingIds = new Set((db.aiPrompts || []).map(p => p.id));
    const missingDefaults = DEFAULT_AI_PROMPTS.filter(p => !existingIds.has(p.id));
    db.aiPrompts = [...(db.aiPrompts || []), ...missingDefaults];
    saveDatabase();
  }

  const allPrompts = db.aiPrompts;
  let user = chatId ? db.users.find(u => u.chatId === chatId) : null;
  const userSeenIds = new Set(user?.seenPrompts || []);
  const recentQueueSet = new Set(recentlyServedPromptIds.slice(-20));

  // 1. Filter by category if requested
  let pool = allPrompts;
  if (categoryKey && categoryKey !== 'random') {
    const matched = allPrompts.filter(p => p.styleCategory === categoryKey || p.tags.some(t => t.toLowerCase().includes(categoryKey.toLowerCase())));
    if (matched.length > 0) pool = matched;
  }

  // 2. Filter out globally recent items and user-seen items
  let candidates = pool.filter(p => !userSeenIds.has(p.id) && !recentQueueSet.has(p.id));

  // If filtered too aggressively, relax user seen filter but keep recent queue filter
  if (candidates.length === 0) {
    candidates = pool.filter(p => !recentQueueSet.has(p.id));
  }

  // If still empty (e.g., category has very few items), use entire category pool
  if (candidates.length === 0) {
    candidates = pool;
    if (user) {
      user.seenPrompts = [];
      saveDatabase();
    }
  }

  // Pick a candidate (prefer random within the non-recently served candidates)
  const selectedPrompt = candidates[Math.floor(Math.random() * candidates.length)] || pool[0] || DEFAULT_AI_PROMPTS[0];

  // Track to recently served queue
  recentlyServedPromptIds.push(selectedPrompt.id);
  if (recentlyServedPromptIds.length > 50) {
    recentlyServedPromptIds.shift();
  }

  // Track to user's personal seen history
  if (user) {
    if (!user.seenPrompts) user.seenPrompts = [];
    if (!user.seenPrompts.includes(selectedPrompt.id)) {
      user.seenPrompts.push(selectedPrompt.id);
      if (user.seenPrompts.length > 100) user.seenPrompts.shift();
      saveDatabase();
    }
  }

  return {
    id: selectedPrompt.id,
    title: selectedPrompt.title,
    category: (selectedPrompt.category as any) || 'image',
    styleCategory: selectedPrompt.styleCategory || categoryKey,
    description: selectedPrompt.description,
    promptText: selectedPrompt.promptText,
    imageUrl: selectedPrompt.imageUrl,
    tags: selectedPrompt.tags,
    tipsForPersonalPhoto: selectedPrompt.tipsForPersonalPhoto || 'از یک عکس پرتره واضح با نور طبیعی استفاده کنید.'
  };
}

// --- Public Web Panel URL Helper ---
function getPublicAppUrl(req?: express.Request): string {
  // Check if we are running in AI Studio sandbox
  const isAIStudio = !!process.env.DEV_APP_URL;

  // 1. If we have active request context, use it immediately and update cached host
  if (req) {
    const host = req.get('x-forwarded-host') || req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      if (!isAIStudio && !host.includes('europe-west2.run.app')) {
        detectedPublicHost = host;
      }
      return `${proto}://${host}`;
    }
  }

  // 2. If we are NOT in AI Studio, prioritize on-the-fly detected real VPS server host/IP
  if (!isAIStudio) {
    if (detectedPublicHost) {
      return detectedPublicHost.startsWith('http') ? detectedPublicHost : `http://${detectedPublicHost}`;
    }
    if (detectedPublicIp) {
      return `http://${detectedPublicIp}:${PORT}`;
    }
  }

  // 3. Prioritize manually saved settings if it's not a sandbox URL (when outside sandbox)
  if (db.settings.publicUrl && db.settings.publicUrl.trim()) {
    const raw = db.settings.publicUrl.trim();
    const isSandboxUrl = raw.includes('ais-dev-') || raw.includes('ais-pre-') || raw.includes('europe-west2.run.app');
    
    // Only use the saved URL if we are in AI Studio, OR if it's not an AI Studio URL
    if (isAIStudio || !isSandboxUrl) {
      return raw.startsWith('http') ? raw : `http://${raw}`;
    }
  }

  // 4. Fallback to active HTTP request context (redundant check)
  if (req) {
    const host = req.get('x-forwarded-host') || req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      return `${proto}://${host}`;
    }
  }

  // 5. Environment variables (if explicitly set)
  if (process.env.APP_URL) return process.env.APP_URL;

  // 6. Auto-detect Linux server IP if we are NOT in the AI Studio environment
  if (!isAIStudio) {
    const ip = getMachineIp();
    if (ip && ip !== '127.0.0.1' && ip !== 'localhost') {
      const port = process.env.PORT || 3000;
      return `http://${ip}:${port}`;
    }
    // Final fallback for Linux
    return `http://localhost:${process.env.PORT || 3000}`;
  }

  // 7. Default Sandbox URL (only as last resort for AI Studio)
  if (process.env.DEV_APP_URL) return process.env.DEV_APP_URL;
  return DEFAULT_KNOWN_APP_URL;
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

let isRetentionCheckingActive = false;

/**
 * Enforces max configs retention limit (1 to 10000, default 2000).
 * Intelligently checks health of configs when the limit is exceeded:
 * 1. Checks untested or old configs to keep working ones and purge broken ones.
 * 2. If healthy configs still exceed the retention limit, trims oldest healthy configs to allow fresh ones.
 */
async function enforceConfigsRetentionLimit() {
  const maxRetention = Math.max(1, Math.min(10000, Number(db.settings?.maxConfigsRetention) || 2000));
  if (!db.configs || db.configs.length <= maxRetention) return;

  // Immediate fast cleanup of already confirmed failed configs if over limit
  const initialCount = db.configs.length;
  const failedCount = db.configs.filter(c => c.status === 'failed').length;
  if (failedCount > 0 && db.configs.length > maxRetention) {
    db.configs = db.configs.filter(c => c.status !== 'failed');
    const pruned = initialCount - db.configs.length;
    addLog('info', `🧹 پاکسازی اولیه: تعداد ${pruned} کانفیگ غیرفعال (failed) به منظور آزادسازی فضای ذخیره‌سازی از دیتابیس حذف شدند.`);
    saveDatabase();
  }

  // If still over retention limit and auto-check isn't already running in background
  if (db.configs.length > maxRetention && !isRetentionCheckingActive) {
    isRetentionCheckingActive = true;
    setTimeout(async () => {
      try {
        addLog('info', `🔍 ظرفیت دیتابیس به سقف مجاز (${maxRetention} کانفیگ) رسید. آغاز بررسی و پایش هوشمند سلامت کانفیگ‌ها جهت نگهداری موارد سالم و حذف موارد غیرفعال...`);
        
        // Prioritize testing untested or checking or older configs
        const configsToTest = db.configs.filter(c => c.status === 'untested' || c.status === 'checking' || !c.lastChecked);
        const idsToTest = configsToTest.map(c => c.id);
        
        if (idsToTest.length > 0) {
          await testConfigsBatch(idsToTest);
          // Purge newly identified failed configs
          const beforePurge = db.configs.length;
          db.configs = db.configs.filter(c => c.status !== 'failed');
          const purged = beforePurge - db.configs.length;
          if (purged > 0) {
            addLog('success', `🧹 پایش هوشمند: تعداد ${purged} کانفیگ غیرفعال پس از تست سلامت پاکسازی شدند.`);
            saveDatabase();
          }
        }

        // If even with only working/untested configs it exceeds maxRetention, trim oldest to make room for fresh incoming
        if (db.configs.length > maxRetention) {
          const excess = db.configs.length - maxRetention;
          db.configs = db.configs.slice(0, maxRetention);
          addLog('info', `سقف مجاز کانفیگ‌های سالم (${maxRetention} عدد) تکمیل شد. تعداد ${excess} کانفیگ قدیمی‌تر جهت جایگزینی با کانفیگ‌های تازه‌نفس حذف شدند.`);
          saveDatabase();
        }
      } catch (err: any) {
        addLog('error', `خطا در پایش هوشمند سقف کانفیگ‌ها: ${err?.message || err}`);
      } finally {
        isRetentionCheckingActive = false;
      }
    }, 100);
  } else if (db.configs.length > maxRetention) {
    // If check already active or synchronous slice needed
    const excess = db.configs.length - maxRetention;
    db.configs = db.configs.slice(0, maxRetention);
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

    let url = source.urlOrHandle.trim();
    addLog('info', `در حال استخراج کدهای کانفیگ و پروکسی از منبع: ${source.name}`);

    if (source.type === 'telegram') {
      // Remove @ prefix if provided
      const handle = url.startsWith('@') ? url.substring(1) : url;
      url = `https://t.me/s/${handle}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7'
        },
        signal: AbortSignal.timeout(15000)
      });
    } catch (fetchErr: any) {
      if (fetchErr.name === 'AbortError' || fetchErr.name === 'TimeoutError') {
        throw new Error('زمان انتظار به پایان رسید (Timeout)');
      }
      throw new Error(`خطای ارتباط شبکه: ${fetchErr.message || 'fetch failed'}`);
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`منبع یافت نشد (خطای 404) - لطفاً آدرس یا آیدی کانال را بررسی کنید`);
      }
      throw new Error(`خطای سرور منبع (HTTP ${response.status})`);
    }

    let rawText = await response.text();
    // Strictly filter Telegram HTML to messages/posts from the last 3 days
    const text = source.type === 'telegram' ? filterTelegramHtmlLast3Days(rawText) : rawText;

    let extracted: ConfigItem[] = [];
    let extractedProxies: ProxyItem[] = [];

    // Check if subscription body is base64 encoded (very common for V2Ray subscriptions)
    if (source.type === 'sub' && isBase64(text)) {
      try {
        const decoded = Buffer.from(text, 'base64').toString('utf8');
        extracted = extractConfigsFromText(decoded, source.name);
        extractedProxies = extractProxiesFromText(decoded, source.name);
      } catch {
        extracted = extractConfigsFromText(text, source.name);
        extractedProxies = extractProxiesFromText(text, source.name);
      }
    } else {
      extracted = extractConfigsFromText(text, source.name);
      extractedProxies = extractProxiesFromText(text, source.name);

      // Deep scan Telegram channels for attached NPVT / document post files safely
      if (source.type === 'telegram' && db.settings.adminId && db.settings.botToken) {
        const handle = source.urlOrHandle.replace(/^@/, '').trim();
        const msgLinkRegex = new RegExp(`href="(https?:\\/\\/t\\.me\\/(?:s\\/)?${handle}\\/(\\d+))"`, 'gi');
        const matches = Array.from(text.matchAll(msgLinkRegex));
        const postData: {url: string, msgId: string}[] = [];
        for (const m of matches) {
          if (m[1] && m[2]) {
            postData.push({ url: m[1].replace('t.me/', 't.me/s/'), msgId: m[2] });
          }
        }
        
        // Check top 3 newest posts for attached NPVT files if relevant keywords exist in text
        const hasNpvDocKeyword = text.toLowerCase().includes('.npvt') || text.toLowerCase().includes('.npv') || text.includes('NPVT') || text.toLowerCase().includes('napsternet');
        if (hasNpvDocKeyword && postData.length > 0) {
          const recentPosts = postData.slice(-3);
          for (const pData of recentPosts) {
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
                    const fRes = await fetch(`https://api.telegram.org/file/bot${db.settings.botToken}/${fileInfo.file_path}`, { signal: AbortSignal.timeout(10000) });
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
              // Silent skip for individual document forward errors
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

function extractVideoUrlFromXmlBlock(block: string): string | undefined {
  if (!block) return undefined;
  
  // 1. Check <enclosure url="..." type="video/..." />
  const enclosureMatch = block.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*>/i);
  if (enclosureMatch && enclosureMatch[1] && (/\.(mp4|mov|webm|mkv|m4v)/i.test(enclosureMatch[1]) || /video/i.test(enclosureMatch[0]))) {
    return enclosureMatch[1].trim();
  }

  // 2. Check <media:content type="video/..." url="..." />
  const mediaMatch = block.match(/<media:content[^>]*url=["']([^"']+)["'][^>]*>/i);
  if (mediaMatch && mediaMatch[1] && (/\.(mp4|webm|mov)/i.test(mediaMatch[1]) || /video/i.test(mediaMatch[0]))) {
    return mediaMatch[1].trim();
  }

  // 3. Check <video src="..." />
  const videoTagMatch = block.match(/<video[^>]+src=["']([^"']+)["']/i);
  if (videoTagMatch && videoTagMatch[1] && /^https?:\/\//i.test(videoTagMatch[1])) {
    return videoTagMatch[1].trim();
  }

  return undefined;
}

function extractImageUrlFromXmlBlock(block: string): string | undefined {
  if (!block) return undefined;
  
  // 1. Check <enclosure url="..." type="image/..." />
  const enclosureMatch = block.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*>/i);
  if (enclosureMatch && enclosureMatch[1] && (/\.(jpe?g|png|webp|gif)/i.test(enclosureMatch[1]) || /image/i.test(enclosureMatch[0]))) {
    return enclosureMatch[1].trim();
  }

  // 2. Check <media:content url="..." /> or <media:thumbnail url="..." />
  const mediaMatch = block.match(/<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["'][^>]*>/i);
  if (mediaMatch && mediaMatch[1]) {
    return mediaMatch[1].trim();
  }

  // 3. Check standard <img src="..." /> inside content or description
  const imgMatch = block.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1] && /^https?:\/\//i.test(imgMatch[1])) {
    return imgMatch[1].trim();
  }

  return undefined;
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
  },
  {
    title: '🔒 ترفند فعال‌سازی تایید دو مرحله‌ای (2FA) پیشرفته ابری در تلگرام جهت جلوگیری قطعی از هک',
    summary: 'در تلگرام به Settings > Privacy and Security > Two-Step Verification رفته و یک رمز قوی به همراه ایمیل ریکاوری معتبر تنظیم کنید تا حتی در صورت لو رفتن سیمکارت، امکان دسترسی به اکانت وجود نداشته باشد.',
    category: 'secret',
    tags: ['امنیت_تلگرام', 'ضد_هک', 'حریم_خصوصی', 'امنیت_سایبری'],
    source: 'مرکز امنیت دیجیتال',
    importance: 'breaking',
    importanceScore: 97
  },
  {
    title: '⚡ افزایش سرعت دانلود در ویندوز با حذف محدودیت پهنای باند رزرو شده (QoS)',
    summary: 'کلید Win+R را زده، gpedit.msc را باز کنید. به مسیر Computer Configuration > Administrative Templates > Network > QoS Packet Scheduler رفته و Limit reservable bandwidth را روی 0% تنظیم کنید.',
    category: 'trick',
    tags: ['ویندوز', 'افزایش_سرعت_اینترنت', 'ترفند_کامپیوتر', 'دانلود'],
    source: 'ترفندهای تخصصی کامپیوتر',
    importance: 'high',
    importanceScore: 91
  },
  {
    title: '🤖 یکپارچه‌سازی دستیارهای صوتی محلی هوش مصنوعی بدون نیاز به اینترنت در گوشی‌ها',
    summary: 'شرکت‌های مطرح پردازنده‌سازی مانند کوالکام و اپل، مدل‌های زبان بزرگ (On-Device LLM) را درون NPU پردازنده‌ها قرار داده‌اند تا پردازش‌های متنی و ترجمه بدون ارسال داده به سرور و کاملاً آفلاین انجام شود.',
    category: 'news',
    tags: ['هوش_مصنوعی', 'پردازنده', 'حریم_خصوصی', 'تکنولوژی_روز'],
    source: 'دنیای سخت‌افزار و پردازش',
    importance: 'high',
    importanceScore: 89
  },
  {
    title: '📷 ترفند عکاسی حرفه‌ای شبانه (Astrophotography) با فعال کردن فرمت RAW و تنظیم شاتر',
    summary: 'در تنظیمات دوربین گوشی حالت Pro را فعال کرده و فرمت ذخیره‌سازی را روی RAW/DNG بگذارید. با قرار دادن ISO بین ۱۰۰ تا ۲۰۰ و سرعت شاتر روی ۱۰ تا ۲۰ ثانیه با پایه ثابت، عکس‌هایی خیره‌کننده از آسمان شب ثبت کنید.',
    category: 'trick',
    tags: ['عکاسی_موبایل', 'ترفند_دوربین', 'آسمان_شب', 'آموزش_عکاسی'],
    source: 'آموزش عکاسی تخصصی',
    importance: 'medium',
    importanceScore: 83
  },
  {
    title: '💡 کلیدهای میانبر جادویی کیبورد ویندوز و مک برای افزایش ۳ برابری راندمان کار',
    summary: 'ترکیب Win+V برای باز کردن تاریخچه کلیپ‌بورد متنی و تصویری و Win+Shift+S برای اسکرین‌شات ناحیه‌ای در ویندوز، و Cmd+Space در مک سرعت کار با سیستم را به شدت افزایش می‌دهد.',
    category: 'trick',
    tags: ['میانبر_ویندوز', 'ترفند_کیبورد', 'افزایش_بهره_وری', 'ویندوز'],
    source: 'ترفندهای سیستم‌عامل',
    importance: 'medium',
    importanceScore: 79
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

        const videoUrl = extractVideoUrlFromXmlBlock(block);
        const imageUrl = extractImageUrlFromXmlBlock(block);
        let mediaType: 'photo' | 'video' | 'animation' | undefined = undefined;
        if (videoUrl) {
          mediaType = /\.gif(\?|$)/i.test(videoUrl) ? 'animation' : 'video';
        } else if (imageUrl) {
          mediaType = 'photo';
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
          imageUrl: imageUrl || undefined,
          videoUrl: videoUrl || undefined,
          mediaType: mediaType || undefined,
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


// --- Real AI Prompt Metadata Analyzer & Classifier ---
function parseRealAiPromptMeta(promptText: string, model = 'Midjourney'): {
  styleCategory: string;
  persianTitle: string;
  persianDesc: string;
  tips: string;
  tags: string[];
} {
  const text = promptText.toLowerCase();

  // Extract camera/lens info if mentioned
  let cameraTag = '';
  const camMatch = promptText.match(/(?:shot on|shot with|camera:?|lens:?)\s*([a-zA-Z0-9\s-]+(?:\bSony|\bCanon|\bNikon|\bHasselblad|\bPolaroid|\bLeica|\bFujifilm|\bKodak)[a-zA-Z0-9\s-]*)/i);
  if (camMatch) {
    cameraTag = camMatch[1].trim();
  }

  if (text.includes('disney') || text.includes('pixar') || text.includes('toy story') || text.includes('3d cartoon')) {
    return {
      styleCategory: 'pixar',
      persianTitle: `کاراکتر انیمیشنی سه‌بعدی دیزنی و پیکسار (${model})`,
      persianDesc: 'خلق کاراکترهای فوق‌العاده جذاب با استایل انیمیشن‌های سه بعدی مدرن دیزنی، چشمان درخشان و بافت‌های نرم.',
      tips: 'عکسی با نمای روبرو و لبخند شاد ارسال کنید تا پرتره کارتونی به زیبایی تولید شود.',
      tags: [model.replace(/\s+/g, '_'), 'پیکسار', 'دیزنی', 'انیمیشن_۳بعدی']
    };
  }

  if (text.includes('cyberpunk') || text.includes('futuristic') || text.includes('sci-fi') || text.includes('hologram')) {
    return {
      styleCategory: 'cyberpunk',
      persianTitle: `فضای سایبرپانک و نئونی آینده‌نگرانه (${model})`,
      persianDesc: 'شبیه‌سازی اتمسفر کلان‌شهرهای آینده با نورپردازی نئونی ارغوانی و آبی، باران‌های اسیدی و المان‌های سایبرنتیک.',
      tips: 'عکسی با زاویه مایل و ژست پرقدرت یا مرموز برای هماهنگی با تم سایبرپانک انتخاب نمایید.',
      tags: [model.replace(/\s+/g, '_'), 'سایبرپانک', 'آینده_نگرانه', 'نئونی']
    };
  }

  if (text.includes('polaroid') || text.includes('vintage') || text.includes('kodak') || text.includes('retro') || text.includes('analog')) {
    return {
      styleCategory: 'artistic',
      persianTitle: `عکاسی آنالوگ و پولاروید نوستالژیک (${model})`,
      persianDesc: 'ثبت تصویر با حس و حال خاطره‌انگیز دوربین‌های آنالوگ، گرین طبیعی فیلم و رنگ‌های گرم رترو.',
      tips: 'از عکس‌های با نور طبیعی و حالت‌های صمیمی استفاده کنید تا حس نوستالژی بهتر منتقل شود.',
      tags: [model.replace(/\s+/g, '_'), 'پولاروید', 'عکاسی_آنالوگ', 'نوستالژی']
    };
  }

  if (text.includes('royal') || text.includes('king') || text.includes('queen') || text.includes('renaissance') || text.includes('oil painting') || text.includes('baroque')) {
    return {
      styleCategory: 'royal',
      persianTitle: `پرتره کلاسیک سلطنتی و رنگ روغن رنسانس (${model})`,
      persianDesc: 'نقاشی فاخر به سبک اشراف‌زادگان رنسانس با بافت مجلل بوم، لباس‌های طلاکوب مخمل و نورپردازی کلاسیک رامبراند.',
      tips: 'عکس بدون عینک و کلاه مدرن، با چهره باوقار و نگاه به افق ارسال کنید.',
      tags: [model.replace(/\s+/g, '_'), 'سلطنتی', 'نقاشی_کلاسیک', 'رنگ_روغن']
    };
  }

  if (text.includes('ghibli') || text.includes('anime') || text.includes('manga') || text.includes('illustration') || text.includes('watercolor')) {
    return {
      styleCategory: 'artistic',
      persianTitle: `تصویرسازی هنری رویایی به سبک انیمه (${model})`,
      persianDesc: 'نقاشی هنری چشم‌نواز با رنگ‌آمیزی لطیف، خطوط روان و حس رویایی شبیه شاهکارهای انیمیشن‌های ژاپنی.',
      tips: 'یک عکس با پس‌زمینه ساده و چهره کاملاً شفاف برای انتقال به سبک انیمه آپلود فرمایید.',
      tags: [model.replace(/\s+/g, '_'), 'انیمه', 'تصویرسازی', 'هنری']
    };
  }

  if (text.includes('fashion') || text.includes('editorial') || text.includes('vogue') || text.includes('model') || text.includes('portrait') || text.includes('beauty') || text.includes('woman') || text.includes('girl') || text.includes('man')) {
    const titleSuffix = cameraTag ? ` (${cameraTag})` : ` (${model})`;
    return {
      styleCategory: 'fashion',
      persianTitle: `عکاسی فشن پرتره مدلینگ ادیتوریال${titleSuffix}`,
      persianDesc: 'عکاسی حرفه‌ای مد با وضوح فوق‌العاده، ثبت دقیق ریزترین منافذ پوست، نورپردازی جهت‌دار سافت‌باکس و بوکه چشم‌نواز.',
      tips: 'یک عکس پرتره یا سه‌چهارم واضح با نور کافی از چهره خود آپلود نمایید.',
      tags: [model.replace(/\s+/g, '_'), 'عکاسی_مدلینگ', 'پرتره', 'های_فشن', ...(cameraTag ? [cameraTag.replace(/\s+/g, '_')] : [])]
    };
  }

  if (text.includes('landscape') || text.includes('nature') || text.includes('mountain') || text.includes('ocean') || text.includes('forest') || text.includes('sunset')) {
    return {
      styleCategory: 'random',
      persianTitle: `منظره طبیعی و افق سینمایی (${model})`,
      persianDesc: 'خلق چشم‌اندازهای بیکران و مسحورکننده طبیعت با پرسپکتیو عمیق، بازی نور خورشید و جزئیات محیطی شگفت‌انگیز.',
      tips: 'مناسب برای پس‌زمینه‌های دسکتاپ و والپیپرهای باکیفیت فوق‌العاده 8K.',
      tags: [model.replace(/\s+/g, '_'), 'طبیعت', 'سینمایی', 'منظره']
    };
  }

  if (text.includes('macro') || text.includes('close-up') || text.includes('texture')) {
    return {
      styleCategory: 'random',
      persianTitle: `عکاسی ماکرو کلوزآپ با جزئیات میکروسکوپی (${model})`,
      persianDesc: 'نمای نزدیک خارق‌العاده از بافت‌ها، انعکاس‌ها و ریزترین الگوهای نوری با فوکوس عمقی باریک.',
      tips: 'برای تولید تکسچرهای انتزاعی و والپیپرهای هنری بسیار ایده‌آل است.',
      tags: [model.replace(/\s+/g, '_'), 'ماکرو', 'کلوزآپ', 'هنری']
    };
  }

  // General fallback
  return {
    styleCategory: 'random',
    persianTitle: `پرامپت ترند و فوق‌العاده ساخت تصویر (${model})`,
    persianDesc: 'دستور متنی استاندارد و مهندسی‌شده برای خلق آرت‌ورک‌های خیره‌کننده با بالاترین جزئیات رندر.',
    tips: 'این پرامپت را مستقیماً در میدجرنی یا هوش مصنوعی تصویرساز دلخواه خود کپی و اجرا نمایید.',
    tags: [model.replace(/\s+/g, '_'), 'هوش_مصنوعی', 'پرامپت_تصویر', 'گرافیک']
  };
}

// --- Live Real-Time AI Prompt Extractor with Matching Source CDN Images ---
async function fetchLiveAiPromptsFromWeb(): Promise<number> {
  let addedCount = 0;
  if (!db.aiPrompts) db.aiPrompts = [];

  const existingTexts = new Set(db.aiPrompts.map(p => p.promptText.trim().toLowerCase()));
  const existingUrls = new Set(db.aiPrompts.map(p => p.imageUrl ? p.imageUrl.trim() : ''));

  // 1. SCRAPE PROMPTHERO (Midjourney, Stable Diffusion, DALL-E)
  const promptHeroSources = [
    { url: 'https://prompthero.com/midjourney-prompts', model: 'Midjourney v6' },
    { url: 'https://prompthero.com/stable-diffusion-prompts', model: 'Stable Diffusion' }
  ];

  for (const src of promptHeroSources) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const resp = await fetch(src.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      clearTimeout(timeoutId);

      if (!resp.ok) continue;
      const html = await resp.text();
      const cardRegex = /<a[^>]+href="(\/prompt\/[^"]+)"[^>]*aria-label="([^"]*)"[\s\S]*?<img[^>]+srcSet="([^"]*)"/gi;
      let match;
      let count = 0;

      while ((match = cardRegex.exec(html)) !== null && count < 8) {
        count++;
        const href = match[1];
        const ariaPrompt = match[2];
        const srcSet = match[3];

        const cdnMatch = srcSet.match(/https%3A%2F%2Fcdn\.prompthero\.com%2F([a-zA-Z0-9_-]+)/i);
        if (!cdnMatch) continue;
        const cdnUrl = `https://cdn.prompthero.com/${cdnMatch[1]}`;

        let fullPrompt = ariaPrompt ? ariaPrompt.trim() : '';
        let matchedImage = cdnUrl;

        // Fetch detail page to get the full un-truncated prompt and og:image
        try {
          const detailRes = await fetch(`https://prompthero.com${href}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (detailRes.ok) {
            const detailHtml = await detailRes.text();
            const pMatch = detailHtml.match(/\\?"prompt\\?":\\?"([^"\\]*(?:\\.[^"\\]*)*)\\?"/i) || detailHtml.match(/\\"prompt\\":\\"([^"\\]*(?:\\.[^"\\]*)*)\\"/i);
            const ogMatch = detailHtml.match(/<meta property="og:image" content="([^"]+)"/i)?.[1];
            if (ogMatch && ogMatch.startsWith('https://cdn.prompthero.com/')) {
              matchedImage = ogMatch;
            }
            if (pMatch) {
              let cleaned = pMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
              if (cleaned.includes('","slug"')) cleaned = cleaned.split('","slug"')[0];
              if (cleaned.length > 10) fullPrompt = cleaned;
            }
          }
        } catch (_) {}

        if (!fullPrompt || fullPrompt.length < 10) continue;
        if (!matchedImage || existingUrls.has(matchedImage.trim())) continue;
        if (existingTexts.has(fullPrompt.toLowerCase())) continue;

        const meta = parseRealAiPromptMeta(fullPrompt, src.model);

        db.aiPrompts.unshift({
          id: 'prompt-hero-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          title: meta.persianTitle,
          category: 'image',
          styleCategory: meta.styleCategory,
          description: meta.persianDesc,
          promptText: fullPrompt,
          tipsForPersonalPhoto: meta.tips,
          imageUrl: matchedImage,
          tags: meta.tags,
          createdAt: new Date().toISOString()
        });

        existingTexts.add(fullPrompt.toLowerCase());
        existingUrls.add(matchedImage.trim());
        addedCount++;
      }
    } catch (err: any) {
      console.error(`Error scraping PromptHero (${src.model}):`, err.message || err);
    }
  }

  // 2. SCRAPE OPENART (Trending real prompts with actual generated image URLs)
  try {
    const oaRes = await fetch('https://openart.ai/api/search?query=trending&limit=12', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (oaRes.ok) {
      const oaData = await oaRes.json();
      if (Array.isArray(oaData.items)) {
        for (const item of oaData.items) {
          const imgUrl = item.image_url || item.url;
          const prompt = item.prompt;
          if (!imgUrl || !prompt || prompt.length < 10) continue;
          if (existingUrls.has(imgUrl.trim())) continue;
          if (existingTexts.has(prompt.trim().toLowerCase())) continue;

          const meta = parseRealAiPromptMeta(prompt.trim(), 'Flux / OpenArt');

          db.aiPrompts.unshift({
            id: 'prompt-openart-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            title: meta.persianTitle,
            category: 'image',
            styleCategory: meta.styleCategory,
            description: meta.persianDesc,
            promptText: prompt.trim(),
            tipsForPersonalPhoto: meta.tips,
            imageUrl: imgUrl.trim(),
            tags: meta.tags,
            createdAt: new Date().toISOString()
          });

          existingTexts.add(prompt.trim().toLowerCase());
          existingUrls.add(imgUrl.trim());
          addedCount++;
        }
      }
    }
  } catch (oaErr: any) {
    console.error('Error fetching OpenArt prompts:', oaErr.message || oaErr);
  }

  return addedCount;
}

function purgeOldAiPrompts(maxDays = 7): number {
  if (!db.aiPrompts || db.aiPrompts.length === 0) return 0;
  
  const initialCount = db.aiPrompts.length;
  const cutoffTime = Date.now() - (maxDays * 24 * 60 * 60 * 1000);
  
  db.aiPrompts = db.aiPrompts.filter(item => {
    // Purge any legacy prompts with fake stock images or synthetic placeholders
    if (item.imageUrl && (item.imageUrl.includes('unsplash.com') || item.imageUrl.includes('redd.it'))) {
      return false;
    }
    if (item.promptText && item.promptText.includes('[your description/photo]')) {
      return false;
    }
    if (!item.imageUrl) {
      return false;
    }

    if (!item.postedToChannel) return true;
    if (item.id.startsWith('prompt-') && item.id.length < 10) return true;
    
    if (item.postedAt) {
      const postedTime = new Date(item.postedAt).getTime();
      return postedTime > cutoffTime;
    }
    
    const createdTime = new Date(item.createdAt).getTime();
    return createdTime > cutoffTime;
  });
  
  // If all were purged, re-seed with fresh authentic defaults
  if (db.aiPrompts.length === 0) {
    db.aiPrompts = [...DEFAULT_AI_PROMPTS];
  }

  if (db.aiPrompts.length > 50) {
    db.aiPrompts = db.aiPrompts.slice(0, 50);
  }
  
  return initialCount - db.aiPrompts.length;
}

async function refreshAiPromptsAndPurgeOld(force = false): Promise<{ added: number; purged: number; total: number }> {
  const maxDays = 7;
  const purged = purgeOldAiPrompts(maxDays);
  const added = await fetchLiveAiPromptsFromWeb();
  
  if (added > 0 || purged > 0 || force) {
    saveDatabase();
    if (added > 0) {
      addLog('info', `🎨 بروزرسانی پرامپت‌های هوش مصنوعی: ${added} پرامپت جدید از وب دریافت شد.`);
    }
  }
  
  return {
    added,
    purged,
    total: db.aiPrompts ? db.aiPrompts.length : 0
  };
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

// Helper to format a tech item cleanly and beautifully for Telegram
function formatTechItemForTelegram(item: TechItem, showBadge = true): string {
  let badgeEmoji = '💡';
  let badgeTitle = 'ترفند تکنولوژی';
  let headerBorder = '━━━━━━━━━━━━━━━━━━━━';
  if (item.category === 'news') {
    badgeEmoji = item.importance === 'breaking' ? '🚨' : '📰';
    badgeTitle = item.importance === 'breaking' ? 'خبر داغ و فوری' : 'تازه‌های فناوری و هوش مصنوعی';
  } else if (item.category === 'secret') {
    badgeEmoji = '🔐';
    badgeTitle = 'راز و کد مخفی امنیتی';
  } else if (item.category === 'trick') {
    badgeEmoji = '🚀';
    badgeTitle = 'ترفند طلایی و کاربردی موبایل';
  }

  let text = '';
  if (showBadge) {
    text += `${badgeEmoji} <b>« ${badgeTitle} »</b>\n`;
    text += `📌 <b>${escapeHtml(item.title)}</b>\n\n`;
  } else {
    text += `🔹 <b>${escapeHtml(item.title)}</b>\n\n`;
  }
  
  if (item.summary) {
    text += `<blockquote>${escapeHtml(item.summary)}</blockquote>\n\n`;
  }

  if (item.source) {
    text += `🔍 منبع: <i>${escapeHtml(item.source)}</i>\n`;
  }

  if (item.tags && item.tags.length > 0) {
    const formattedTags = item.tags
      .slice(0, 5)
      .map(t => `#${t.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '')}`)
      .join(' ');
    text += `🏷 <i>${formattedTags}</i>\n`;
  }

  return text;
}

/**
 * Helper: Downloads remote media (photo/video/gif) to a Blob buffer with browser headers
 * so Telegram API receives the binary data directly rather than failing on remote URL scrapers.
 */
async function downloadMediaToBlob(url: string, timeoutMs = 12000): Promise<{ blob: Blob; filename: string; contentType: string } | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/*,video/*,*/*',
        'Referer': 'https://t.me/'
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0 || buffer.length > 50 * 1024 * 1024) return null;

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    let ext = 'jpg';
    if (contentType.includes('video') || url.includes('.mp4')) ext = 'mp4';
    else if (contentType.includes('gif') || url.includes('.gif')) ext = 'gif';
    else if (contentType.includes('png') || url.includes('.png')) ext = 'png';
    else if (contentType.includes('webp') || url.includes('.webp')) ext = 'webp';

    const blob = new Blob([buffer], { type: contentType });
    return { blob, filename: `media_${Date.now()}.${ext}`, contentType };
  } catch (err) {
    return null;
  }
}

/**
 * Unified Telegram Media Post Sender:
 * Automatically dispatches Videos (sendVideo), Animations/GIFs (sendAnimation),
 * Photos (sendPhoto), or Text (sendMessage) with automatic HTML caption length
 * protection (1024 chars for media, 3900 for text) and multi-stage fallback.
 * Employs direct buffer download + FormData upload to bypass CDN hotlink protections.
 */
async function sendTelegramPostWithMedia(params: {
  chatId: string | number;
  text: string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  mediaType?: 'photo' | 'video' | 'animation' | null;
  replyMarkup?: any;
  silent?: boolean;
}): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const { chatId, text, videoUrl, imageUrl, mediaType, replyMarkup, silent } = params;
  const safeFullText = safeTelegramHtmlLength(text, 3900);
  const caption = safeTelegramHtmlLength(text, 1024);

  // 1. Try sending video or animation/gif if videoUrl is available
  if (videoUrl && /^https?:\/\//i.test(videoUrl)) {
    const isAnim = mediaType === 'animation' || /\.gif(\?|$)/i.test(videoUrl);
    const method = isAnim ? 'sendAnimation' : 'sendVideo';
    const payloadKey = isAnim ? 'animation' : 'video';

    // Step 1a: Attempt direct binary buffer download and upload via FormData
    try {
      const mediaData = await downloadMediaToBlob(videoUrl, 15000);
      if (mediaData) {
        const formData = new FormData();
        formData.append('chat_id', String(chatId));
        formData.append(payloadKey, mediaData.blob, mediaData.filename);
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
        if (replyMarkup) {
          formData.append('reply_markup', typeof replyMarkup === 'string' ? replyMarkup : JSON.stringify(replyMarkup));
        }
        if (silent) formData.append('disable_notification', 'true');
        if (!isAnim) formData.append('supports_streaming', 'true');

        const result = await callTelegramApi(method, formData);
        return { success: true, messageId: result?.message_id };
      }
    } catch (buffErr: any) {
      console.warn(`Buffer video upload failed (${buffErr?.message || buffErr}), attempting URL fallback...`);
    }

    // Step 1b: Fallback to remote URL JSON payload
    try {
      const result = await callTelegramApi(method, {
        chat_id: chatId,
        [payloadKey]: videoUrl,
        caption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
        disable_notification: !!silent,
        supports_streaming: true
      });
      return { success: true, messageId: result?.message_id };
    } catch (videoErr: any) {
      addLog('warn', `ارسال ویدیوی پست به ${chatId} با خطا مواجه شد (${videoErr?.message || videoErr})، در حال تلاش برای ارسال با تصویر/متن...`);
    }
  }

  // 2. Try sending photo if imageUrl is available
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
    // Step 2a: Attempt direct binary buffer download and upload via FormData
    try {
      const mediaData = await downloadMediaToBlob(imageUrl, 12000);
      if (mediaData) {
        const formData = new FormData();
        formData.append('chat_id', String(chatId));
        formData.append('photo', mediaData.blob, mediaData.filename);
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
        if (replyMarkup) {
          formData.append('reply_markup', typeof replyMarkup === 'string' ? replyMarkup : JSON.stringify(replyMarkup));
        }
        if (silent) formData.append('disable_notification', 'true');

        const result = await callTelegramApi('sendPhoto', formData);
        return { success: true, messageId: result?.message_id };
      }
    } catch (buffErr: any) {
      console.warn(`Buffer photo upload failed (${buffErr?.message || buffErr}), attempting URL fallback...`);
    }

    // Step 2b: Fallback to remote URL JSON payload
    try {
      const result = await callTelegramApi('sendPhoto', {
        chat_id: chatId,
        photo: imageUrl,
        caption,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
        disable_notification: !!silent
      });
      return { success: true, messageId: result?.message_id };
    } catch (photoErr: any) {
      addLog('warn', `ارسال تصویر پست به ${chatId} با خطا مواجه شد (${photoErr?.message || photoErr})، در حال ارسال متنی...`);
    }
  }

  // 3. Fallback to sendMessage (Text)
  try {
    const result = await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: safeFullText,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
      disable_notification: !!silent
    });
    return { success: true, messageId: result?.message_id };
  } catch (textErr: any) {
    addLog('error', `ارسال پیام متنی به ${chatId} با خطا مواجه شد: ${textErr?.message || textErr}`);
    return { success: false, error: textErr?.message || String(textErr) };
  }
}

// ==========================================================
// INTELLIGENT CHANNEL TRAFFIC GUARD & GROWTH ENGINE
// ==========================================================
function getTehranTimeInfo(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const getP = (t: string) => parts.find(p => p.type === t)?.value || '00';
    const year = getP('year');
    const month = getP('month');
    const day = getP('day');
    const hour = parseInt(getP('hour'), 10);
    const minute = parseInt(getP('minute'), 10);
    // Sleep hours in Iran: 00:30 to 08:30
    const isSleepHours = (hour === 0 && minute >= 30) || (hour >= 1 && hour < 8) || (hour === 8 && minute < 30);
    // Golden engagement hours in Iran (Noon lunch, Evening commute, Night prime-time):
    const isGoldenHour = (hour >= 12 && hour <= 14) || (hour >= 17 && hour <= 20) || (hour >= 21 && hour <= 23);
    return {
      dateStr: `${year}-${month}-${day}`,
      hour,
      minute,
      timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      isSleepHours,
      isGoldenHour
    };
  } catch (err) {
    const utcMs = date.getTime() + (date.getTimezoneOffset() * 60000);
    const tehranDate = new Date(utcMs + (3.5 * 3600000));
    const year = tehranDate.getUTCFullYear();
    const month = String(tehranDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(tehranDate.getUTCDate()).padStart(2, '0');
    const hour = tehranDate.getUTCHours();
    const minute = tehranDate.getUTCMinutes();
    const isSleepHours = (hour === 0 && minute >= 30) || (hour >= 1 && hour < 8) || (hour === 8 && minute < 30);
    const isGoldenHour = (hour >= 12 && hour <= 14) || (hour >= 17 && hour <= 20) || (hour >= 21 && hour <= 23);
    return {
      dateStr: `${year}-${month}-${day}`,
      hour,
      minute,
      timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      isSleepHours,
      isGoldenHour
    };
  }
}

interface TelegramChannelCache {
  title?: string;
  memberCount?: number;
  lastChecked: number;
}
const channelStatsCache: Record<string, TelegramChannelCache> = {};

async function fetchTelegramChannelStats(channelHandle: string): Promise<{ title?: string; memberCount?: number }> {
  if (!channelHandle || !db.settings.botToken) return {};
  const cleanHandle = channelHandle.startsWith('@') ? channelHandle : `@${channelHandle.replace('@', '')}`;
  const now = Date.now();
  if (channelStatsCache[cleanHandle] && (now - channelStatsCache[cleanHandle].lastChecked) < 5 * 60 * 1000) {
    return {
      title: channelStatsCache[cleanHandle].title,
      memberCount: channelStatsCache[cleanHandle].memberCount
    };
  }

  let title: string | undefined;
  let memberCount: number | undefined;

  try {
    const chatRes = await callTelegramApi('getChat', { chat_id: cleanHandle });
    if (chatRes && chatRes.title) {
      title = chatRes.title;
    }
  } catch (e) {}

  try {
    const countRes = await callTelegramApi('getChatMemberCount', { chat_id: cleanHandle });
    if (typeof countRes === 'number') {
      memberCount = countRes;
    }
  } catch (e) {}

  channelStatsCache[cleanHandle] = {
    title,
    memberCount,
    lastChecked: now
  };

  return { title, memberCount };
}

function recordChannelPostEvent(
  channelNum: 1 | 2, 
  channelHandle: string, 
  category: 'configs' | 'news' | 'tricks' | 'prompts' | 'fun' | 'tech' | 'digital_tools', 
  messageId?: number,
  previewText?: string
) {
  if (!db.channelPostHistory) db.channelPostHistory = [];
  const now = new Date();
  const tehran = getTehranTimeInfo(now);
  db.channelPostHistory.push({
    id: generateId(),
    channelTarget: channelNum,
    channelHandle: channelHandle.startsWith('@') ? channelHandle : `@${channelHandle.replace('@', '')}`,
    category,
    postedAt: now.toISOString(),
    tehranDate: tehran.dateStr,
    tehranHour: tehran.hour,
    messageId,
    previewText
  });
  if (db.channelPostHistory.length > 300) {
    db.channelPostHistory = db.channelPostHistory.slice(-300);
  }
}

async function evaluateChannelPostingAllowance(channelNum: 1 | 2, bypassTimeChecks = false) {
  const isCh2 = channelNum === 2;
  const settings = isCh2 ? (db.settings.autoPost?.channel2 || DEFAULT_CHANNEL2_SETTINGS) : db.settings.autoPost;

  if (!settings || !settings.enabled) {
    return {
      allowed: false,
      reason: `ارسال خودکار برای کانال ${channelNum} در پنل غیرفعال است.`,
      statusLevel: 'paused' as const,
      postsToday: 0,
      maxDailyPosts: settings?.maxDailyPosts || (isCh2 ? 6 : 4),
      minutesSinceLastPost: 9999,
      inCooldown: false,
      cooldownRemainingMinutes: 0,
      isSleepHours: false,
      isGoldenHour: false,
      channelHandle: settings?.targetChannel || ''
    };
  }

  const targetChannel = settings.targetChannel?.trim();
  if (!targetChannel) {
    return {
      allowed: false,
      reason: `آیدی کانال ${channelNum} مشخص نشده است.`,
      statusLevel: 'blocked' as const,
      postsToday: 0,
      maxDailyPosts: settings.maxDailyPosts || (isCh2 ? 6 : 4),
      minutesSinceLastPost: 9999,
      inCooldown: false,
      cooldownRemainingMinutes: 0,
      isSleepHours: false,
      isGoldenHour: false,
      channelHandle: ''
    };
  }

  const tehran = getTehranTimeInfo();
  const maxDaily = settings.maxDailyPosts || (isCh2 ? 6 : 4);
  const minSpacingMin = settings.minPostSpacingMinutes || (isCh2 ? 120 : 180);

  // 1. Calculate posts today in Tehran date
  if (!db.channelPostHistory) db.channelPostHistory = [];
  const postsToday = db.channelPostHistory.filter(h => h.channelTarget === channelNum && h.tehranDate === tehran.dateStr).length;

  // 2. Calculate time since last post
  const lastPostIso = settings.lastAnyPostAt || settings.lastPostedAt;
  const minutesSinceLastPost = lastPostIso ? Math.floor((Date.now() - new Date(lastPostIso).getTime()) / 60000) : 9999;
  const inCooldown = minutesSinceLastPost < minSpacingMin;
  const cooldownRemainingMinutes = inCooldown ? Math.max(1, minSpacingMin - minutesSinceLastPost) : 0;

  // Fetch live stats (cached)
  const liveStats = await fetchTelegramChannelStats(targetChannel);

  // Check: Bypass allowed for manual triggers from admin
  if (bypassTimeChecks) {
    return {
      allowed: true,
      reason: 'ارسال دستی با تایید مدیر سیستم انجام شد.',
      statusLevel: 'optimal' as const,
      postsToday,
      maxDailyPosts: maxDaily,
      minutesSinceLastPost,
      inCooldown: false,
      cooldownRemainingMinutes: 0,
      isSleepHours: tehran.isSleepHours,
      isGoldenHour: tehran.isGoldenHour,
      memberCount: liveStats.memberCount,
      title: liveStats.title,
      channelHandle: targetChannel
    };
  }

  // 3. Sleep Hours Check
  if (settings.sleepHoursProtection !== false && tehran.isSleepHours) {
    return {
      allowed: false,
      reason: `ساعات استراحت و سکوت شبانه تلگرام (۰۰:۳۰ الی ۰۸:۳۰ به وقت تهران) - زمان فعلی: ${tehran.timeStr}. جهت جلوگیری از ریزش ممبرها، ارسال خودکار متوقف است.`,
      statusLevel: 'paused' as const,
      postsToday,
      maxDailyPosts: maxDaily,
      minutesSinceLastPost,
      inCooldown,
      cooldownRemainingMinutes,
      isSleepHours: true,
      isGoldenHour: false,
      memberCount: liveStats.memberCount,
      title: liveStats.title,
      channelHandle: targetChannel
    };
  }

  // 4. Daily Cap Check
  if (postsToday >= maxDaily) {
    return {
      allowed: false,
      reason: `سقف مجاز پست‌های امروز (${postsToday} از ${maxDaily} پست) تکمیل شده است. کانال نباید بیش از حد بمباران شود تا ویوها حفظ شوند و ممبرها لفت ندهند.`,
      statusLevel: 'blocked' as const,
      postsToday,
      maxDailyPosts: maxDaily,
      minutesSinceLastPost,
      inCooldown,
      cooldownRemainingMinutes,
      isSleepHours: tehran.isSleepHours,
      isGoldenHour: tehran.isGoldenHour,
      memberCount: liveStats.memberCount,
      title: liveStats.title,
      channelHandle: targetChannel
    };
  }

  // 5. Minimum Spacing / Cooldown Check
  if (inCooldown) {
    return {
      allowed: false,
      reason: `فاصله ایمن بین دو پست رعایت نشده است. آخرین پست ${minutesSinceLastPost} دقیقه پیش ارسال شده و ${cooldownRemainingMinutes} دقیقه از فاصله ${minSpacingMin} دقیقه‌ای باقی مانده است.`,
      statusLevel: 'warning' as const,
      postsToday,
      maxDailyPosts: maxDaily,
      minutesSinceLastPost,
      inCooldown: true,
      cooldownRemainingMinutes,
      isSleepHours: tehran.isSleepHours,
      isGoldenHour: tehran.isGoldenHour,
      memberCount: liveStats.memberCount,
      title: liveStats.title,
      channelHandle: targetChannel
    };
  }

  return {
    allowed: true,
    reason: `کانال آماده دریافت پست بعدی است (${postsToday}/${maxDaily} پست امروز). زمان فعلی تهران: ${tehran.timeStr}${tehran.isGoldenHour ? ' (ساعت طلایی جذب ویو)' : ''}`,
    statusLevel: 'optimal' as const,
    postsToday,
    maxDailyPosts: maxDaily,
    minutesSinceLastPost,
    inCooldown: false,
    cooldownRemainingMinutes: 0,
    isSleepHours: tehran.isSleepHours,
    isGoldenHour: tehran.isGoldenHour,
    memberCount: liveStats.memberCount,
    title: liveStats.title,
    channelHandle: targetChannel
  };
}

// Standalone Tech Post Dispatcher (General)
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

    const channelHandle = targetChannel.startsWith('@') ? targetChannel : `@${targetChannel.replace('@', '')}`;
    const itemWithVideo = items.find(n => !!n.videoUrl);
    const itemWithImage = items.find(n => !!n.imageUrl);

    const postResult = await sendTelegramPostWithMedia({
      chatId: channelHandle,
      text: msg,
      videoUrl: itemWithVideo?.videoUrl,
      imageUrl: itemWithImage?.imageUrl,
      mediaType: itemWithVideo?.mediaType || itemWithImage?.mediaType,
      replyMarkup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined,
      silent: !!db.settings.autoPost.silentMode
    });

    if (!postResult.success) {
      return false;
    }

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

// Helper: format interval text for display
function formatIntervalText(minutes?: number, hours?: number): string {
  if (minutes && minutes > 0) {
    if (minutes < 60) {
      return `هر ${minutes} دقیقه`;
    }
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `هر ${h} ساعت`;
    return `هر ${h} ساعت و ${m} دقیقه`;
  }
  if (hours && hours > 0) {
    return `هر ${hours} ساعت`;
  }
  return 'هر ۴ ساعت';
}

// Helper: parse custom user interval text (e.g. "15m", "30 دقیقه", "2 ساعت", "1.5h", "90")
function parseCustomIntervalText(text: string): number | null {
  if (!text) return null;
  const clean = text.trim().toLowerCase()
    .replace(/۰/g, '0').replace(/۱/g, '1').replace(/۲/g, '2').replace(/۳/g, '3').replace(/۴/g, '4')
    .replace(/۵/g, '5').replace(/۶/g, '6').replace(/۷/g, '7').replace(/۸/g, '8').replace(/۹/g, '9');

  // Check for hours: e.g. "2 ساعت", "2h", "1.5 ساعت", "1.5h", "2 hour"
  const hourMatch = clean.match(/^([\d\.]+)\s*(ساعت|hour|hours|h|hr|hrs)$/);
  if (hourMatch) {
    const hrs = parseFloat(hourMatch[1]);
    if (!isNaN(hrs) && hrs > 0) {
      return Math.round(hrs * 60);
    }
  }

  // Check for minutes: e.g. "30 دقیقه", "30m", "45 min", "45"
  const minMatch = clean.match(/^([\d\.]+)\s*(دقیقه|min|minute|minutes|m)?$/);
  if (minMatch) {
    const mins = parseFloat(minMatch[1]);
    if (!isNaN(mins) && mins >= 1) {
      return Math.round(mins);
    }
  }

  return null;
}

// ----------------------------------------------------
// 1. DEDICATED EXECUTOR: CONFIGS & PROXIES AUTO-POST
// ----------------------------------------------------
async function executeConfigsAutoPost(channelTargetNum: 1 | 2 = 1, customTargetChannel?: string): Promise<boolean> {
  const isCh2 = channelTargetNum === 2;
  const settings = isCh2 ? (db.settings.autoPost.channel2 || DEFAULT_CHANNEL2_SETTINGS) : db.settings.autoPost;
  const targetChannel = customTargetChannel || settings?.targetChannel;
  if (!targetChannel) {
    addLog('warn', `ارسال کانفیگ‌ها به کانال ${channelTargetNum} انجام نشد: کانال مقصد تنظیم نشده است.`);
    return false;
  }
  if (!db.settings.botToken) {
    addLog('warn', 'ارسال کانفیگ‌ها انجام نشد: توکن ربات فعال نیست.');
    return false;
  }

  try {
    addLog('info', `در حال آماده‌سازی و ارسال پست کانفیگ‌ها و پروکسی‌ها به کانال ${channelTargetNum} (${targetChannel})...`);

    // Get requested configs count
    const rawConfCount = typeof settings.configCount === 'number' ? settings.configCount : parseInt(String(settings.configCount), 10);
    const configLimit = !isNaN(rawConfCount) && rawConfCount >= 0 ? rawConfCount : 5;
    
    // Anti-duplicate config selection: prioritize unposted configs for target channel
    const targetChannelKey = isCh2 ? 'postedToChannel2' : 'postedToChannel1';
    let selectedConfigs: ConfigItem[] = [];

    if (configLimit > 0) {
      // 1. Unposted working configs
      let unpostedWorking = db.configs.filter(c => c.status === 'working' && !c[targetChannelKey]);
      // 2. Unposted untested configs
      let unpostedUntested = db.configs.filter(c => c.status === 'untested' && !c[targetChannelKey]);
      let allUnposted = [...unpostedWorking, ...unpostedUntested];

      // If available unposted configs are low, scrape fresh configs immediately from all sources
      if (allUnposted.length < configLimit) {
        addLog('info', `موجودی کانفیگ‌های جدید و منتشرنشده برای کانال ${channelTargetNum} اندک است (${allUnposted.length} عدد). در حال استخراج و دریافت کانفیگ‌های تازه از ساب‌ها و منابع...`);
        try {
          await triggerBulkScrape();
        } catch (scrapeErr) {
          console.error('Auto scrape on low unposted configs error:', scrapeErr);
        }
        unpostedWorking = db.configs.filter(c => c.status === 'working' && !c[targetChannelKey]);
        unpostedUntested = db.configs.filter(c => c.status === 'untested' && !c[targetChannelKey]);
        allUnposted = [...unpostedWorking, ...unpostedUntested];
      }

      if (allUnposted.length > 0) {
        // STRICT DUPLICATE PREVENTION: Pick ONLY fresh unposted configs (NEVER pick previously posted items)
        const shuffled = [...allUnposted].sort(() => 0.5 - Math.random());
        selectedConfigs = shuffled.slice(0, Math.min(configLimit, shuffled.length));
      }
    }

    // Get requested proxies count
    const rawProxyCount = typeof settings.proxyCount === 'number' ? settings.proxyCount : parseInt(String(settings.proxyCount), 10);
    const proxyLimit = !isNaN(rawProxyCount) && rawProxyCount >= 0 ? rawProxyCount : 1;
    
    let selectedProxies: ProxyItem[] = [];

    if (proxyLimit > 0) {
      const allProxies = db.proxies || [];
      const unpostedWorkingProxies = allProxies.filter(p => p.status === 'working' && !p[targetChannelKey]);
      const unpostedUntestedProxies = allProxies.filter(p => p.status === 'untested' && !p[targetChannelKey]);
      const allUnpostedProxies = [...unpostedWorkingProxies, ...unpostedUntestedProxies];

      if (allUnpostedProxies.length > 0) {
        // STRICT DUPLICATE PREVENTION: Pick ONLY fresh unposted proxies
        const shuffled = [...allUnpostedProxies].sort(() => 0.5 - Math.random());
        selectedProxies = shuffled.slice(0, Math.min(proxyLimit, shuffled.length));
      }
    }

    if (selectedConfigs.length === 0 && selectedProxies.length === 0) {
      addLog('warn', `ارسال کانفیگ‌ها به کانال ${channelTargetNum} انجام نشد: هیچ کانفیگ یا پروکسی جدید و منتشرنشده‌ای یافت نشد (جهت رعایت اکید قانون عدم ارسال تکراری، ارسال متوقف گردید).`);
      return false;
    }

    let channelBranding = '';
    if (isCh2) {
      let rawCh2Ad = (settings.adText || '').trim();
      const ch1Handle = (db.settings.autoPost?.targetChannel || '').replace(/^@/, '').toLowerCase().trim();
      const ch1Branding = (db.settings.branding || '').toLowerCase().trim();
      if (ch1Handle && rawCh2Ad.toLowerCase().includes(ch1Handle)) rawCh2Ad = '';
      if (ch1Branding && rawCh2Ad.toLowerCase().includes(ch1Branding)) rawCh2Ad = '';
      channelBranding = rawCh2Ad;
    } else {
      channelBranding = settings.adText || db.settings.branding || '';
    }

    let text = `⚡ <b>${escapeHtml(settings.customText || '💎 پک اختصاصی کانفیگ‌های پرسرعت و پروکسی‌های جدید')}</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    let needsFullPackFile = false;
    let fullPackConfigsContent = '';

    if (selectedConfigs.length > 0) {
      text += `🚀 <b>پک ${selectedConfigs.length} کانفیگ پرسرعت V2Ray (تست شده):</b>\n\n`;
      
      const previewCount = Math.min(selectedConfigs.length, 6);
      for (let i = 0; i < previewCount; i++) {
        const conf = selectedConfigs[i];
        const loc = await getIpLocation(conf.server || '');
        const flag = getFlagEmoji(loc.countryCode);
        const pingText = conf.latency ? `⚡ <code>${conf.latency}ms</code>` : '🟢 فعال';
        const proto = (conf.protocol || 'V2RAY').toUpperCase();
        text += `▫️ <b>[${proto}]</b> ${loc.country} ${flag} ╶─╴ ${pingText}\n`;
      }

      if (selectedConfigs.length > previewCount) {
        text += `\n<i>▫️ و ${selectedConfigs.length - previewCount} کانفیگ دیگر در کادر زیر...</i>\n`;
      }

      // Generate all branded configs
      const allBrandedList = selectedConfigs.map(conf => applyBrandingToConfig(conf.raw, channelBranding || db.settings.branding));
      fullPackConfigsContent = allBrandedList.join('\n');

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
          ? `📋 <b>کپی یکجای تمامی ${selectedConfigs.length} کانفیگ (روی کادر زیر لمس کنید):</b>`
          : `📋 <b>کپی یکجای کانفیگ‌ها (${inlineCount} از ${selectedConfigs.length} عدد):</b>`;
        text += `\n${copyTitle}\n`;
        text += `<blockquote expandable><code>${escapeHtml(inlineBatch)}</code></blockquote>\n\n`;
      }
    }

    // Append proxies
    if (selectedProxies.length > 0) {
      text += `🔌 <b>پروکسی‌های فعال و بدون قطعی تلگرام:</b>\n\n`;
      const proxyPreviewCount = Math.min(selectedProxies.length, 6);
      for (let i = 0; i < proxyPreviewCount; i++) {
        const proxy = selectedProxies[i];
        const loc = await getIpLocation(proxy.server || '');
        const flag = getFlagEmoji(loc.countryCode);
        const pingText = proxy.latency ? `⚡ <code>${proxy.latency}ms</code>` : '🟢 فعال';
        const pType = (proxy.type || 'MTPROTO').toUpperCase();
        text += `▫️ <b>[${pType}]</b> ${loc.country} ${flag} ╶─╴ ${pingText}\n`;
      }
      text += `\n<i>👇 جهت اتصال به پروکسی‌ها دکمه‌های زیر را لمس نمایید:</i>\n\n`;
    }

    if (needsFullPackFile) {
      text += `\n📁 <i>فایل متنی شامل تمام ${selectedConfigs.length} کانفیگ نیز ضمیمه شد.</i>\n`;
    }

    text += `\n❤️ <i>با فوروارد کردن این پست برای دوستانتان، از ما حمایت کنید.</i>\n`;

    if (channelBranding) {
      text += `\n🆔 ${escapeHtml(channelBranding)}`;
    }

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

    const channelBtn = getChannelInlineButton(channelTargetNum, targetChannel);
    if (channelBtn) {
      inlineButtons.push([{ text: channelBtn.text, url: channelBtn.url }]);
    }

    if (!isCh2) {
      const botUser = db.settings.botUsername;
      const botUrl = botUser ? `https://t.me/${botUser.replace('@', '')}` : null;
      if (botUrl) {
        inlineButtons.push([{
          text: '🤖 دریافت کانفیگ و پروکسی رایگان بیشتر',
          url: botUrl
        }]);
      }
    }

    const safeText = safeTelegramHtmlLength(text, 3900);
    const channelHandle = targetChannel.startsWith('@') ? targetChannel : `@${targetChannel.replace('@', '')}`;
    const sentMsg = await callTelegramApi('sendMessage', {
      chat_id: channelHandle,
      text: safeText,
      parse_mode: 'HTML',
      reply_markup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined,
      disable_notification: !!settings.silentMode
    });

    recordChannelPostEvent(channelTargetNum, channelHandle, 'configs', sentMsg?.message_id);

    // If singlePostMode is explicitly disabled AND config pack has large count, upload full .txt pack file
    if (settings.singlePostMode === false && needsFullPackFile && fullPackConfigsContent) {
      try {
        const formData = new FormData();
        formData.append('chat_id', channelHandle);
        const fileBuffer = Buffer.from(fullPackConfigsContent, 'utf8');
        const blob = new Blob([fileBuffer], { type: 'text/plain;charset=utf-8' });
        
        let packFilename = `V2Ray_Pack_${selectedConfigs.length}_Configs.txt`;
        const brandingTag = channelBranding || db.settings.branding;
        if (brandingTag) {
          const cleanBranding = brandingTag.replace('@', '').replace(/[^a-zA-Z0-9_-]/g, '');
          if (cleanBranding) packFilename = `V2Ray_${cleanBranding}_${selectedConfigs.length}_Configs.txt`;
        }
        
        formData.append('document', blob, packFilename);
        formData.append('caption', `📦 <b>فایل کامل ${selectedConfigs.length} کانفیگ V2Ray</b>\n\n🆔 ${escapeHtml(brandingTag || '')}`);
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

    // Try to post an NPV/OVPN file alongside only if singlePostMode is disabled and postFiles is enabled
    if (settings.singlePostMode === false && settings.postFiles && db.npvFiles && db.npvFiles.length > 0) {
      const npvFile = db.npvFiles[Math.floor(Math.random() * Math.min(db.npvFiles.length, 10))];
      if (npvFile) {
        try {
          const formData = new FormData();
          formData.append('chat_id', channelHandle);
          const fileBuffer = Buffer.from(npvFile.content, 'base64');
          const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
          
          let brandedFilename = npvFile.filename;
          const brandingTag = channelBranding || db.settings.branding;
          if (brandingTag) {
            const cleanBranding = brandingTag.replace('@', '').replace(/[^a-zA-Z0-9_-]/g, '');
            brandedFilename = brandedFilename.replace(/\.(npv(t)?|ovpn)$/i, `_${cleanBranding}.$1`);
          }
          
          formData.append('document', blob, brandedFilename);
          const fileType = npvFile.filename.endsWith('.ovpn') ? 'OpenVPN' : 'NapsternetV';
          const caption = `🌐 <b>فایل پیکربندی اختصاصی ${fileType}</b>\n\nجهت استفاده، این فایل را در نرم‌افزار ایمپورت کنید.\n\n🆔 ${escapeHtml(brandingTag || '')}`;
          formData.append('caption', caption);
          formData.append('parse_mode', 'HTML');
          
          if (inlineButtons.length > 0) {
            formData.append('reply_markup', JSON.stringify({ inline_keyboard: inlineButtons }));
          }
          if (settings.silentMode) formData.append('disable_notification', 'true');

          await fetch(`https://api.telegram.org/bot${db.settings.botToken}/sendDocument`, {
            method: 'POST',
            body: formData
          });
        } catch (err) {
          console.error('Failed to send auto-post NPV file:', err);
        }
      }
    }

    // Track in posted messages for 5-day monitoring
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

    const nowIso = new Date().toISOString();
    for (const c of selectedConfigs) {
      const dbConf = db.configs.find(item => item.id === c.id || item.raw === c.raw);
      if (dbConf) {
        if (isCh2) {
          dbConf.postedToChannel2 = true;
          dbConf.lastPostedAtCh2 = nowIso;
        } else {
          dbConf.postedToChannel1 = true;
          dbConf.lastPostedAtCh1 = nowIso;
        }
        dbConf.postedToChannel = true;
        dbConf.lastPostedAt = nowIso;
        dbConf.postCount = (dbConf.postCount || 0) + 1;
      }
    }
    for (const p of selectedProxies) {
      const dbProxy = db.proxies.find(item => item.id === p.id || item.raw === p.raw);
      if (dbProxy) {
        if (isCh2) {
          dbProxy.postedToChannel2 = true;
          dbProxy.lastPostedAtCh2 = nowIso;
        } else {
          dbProxy.postedToChannel1 = true;
          dbProxy.lastPostedAtCh1 = nowIso;
        }
        dbProxy.postedToChannel = true;
        dbProxy.lastPostedAt = nowIso;
        dbProxy.postCount = (dbProxy.postCount || 0) + 1;
      }
    }

    if (isCh2) {
      if (!db.settings.autoPost.channel2) db.settings.autoPost.channel2 = { ...DEFAULT_CHANNEL2_SETTINGS };
      db.settings.autoPost.channel2.lastConfigsPostedAt = nowIso;
      db.settings.autoPost.channel2.lastPostedAt = nowIso;
      db.settings.autoPost.channel2.lastAnyPostAt = nowIso;
    } else {
      db.settings.autoPost.lastConfigsPostedAt = nowIso;
      db.settings.autoPost.lastPostedAt = nowIso;
      db.settings.autoPost.lastAnyPostAt = nowIso;
    }
    saveDatabase();
    
    addLog('success', `پست کانفیگ‌ها (${selectedConfigs.length} کانفیگ، ${selectedProxies.length} پروکسی) با موفقیت به کانال ${channelTargetNum} (${targetChannel}) ارسال گردید.`);
    return true;
  } catch (err: any) {
    addLog('error', `خطا در ارسال پست کانفیگ‌ها به کانال ${channelTargetNum}: ${err.message || err}`);
    return false;
  }
}

// ----------------------------------------------------
// 2. DEDICATED EXECUTOR: TECH & AI NEWS AUTO-POST
// ----------------------------------------------------
async function executeTechNewsAutoPost(channelTargetNum: 1 | 2 = 1, customTargetChannel?: string): Promise<boolean> {
  const isCh2 = channelTargetNum === 2;
  const settings = isCh2 ? (db.settings.autoPost.channel2 || DEFAULT_CHANNEL2_SETTINGS) : db.settings.autoPost;
  const targetChannel = customTargetChannel || settings?.targetChannel;
  if (!targetChannel) {
    addLog('warn', `ارسال اخبار به کانال ${channelTargetNum} انجام نشد: کانال مقصد تنظیم نشده است.`);
    return false;
  }
  if (!db.settings.botToken) {
    addLog('warn', 'ارسال اخبار انجام نشد: توکن ربات فعال نیست.');
    return false;
  }

  try {
    addLog('info', `در حال آماده‌سازی و ارسال پست اخبار روز تکنولوژی به کانال ${channelTargetNum} (${targetChannel})...`);

    seedCuratedTechItems();
    const count = settings.techNewsCount && settings.techNewsCount > 0 ? settings.techNewsCount : 2;
    const allTech = db.techItems || [];

    // Filter news items that have NEVER been posted to this specific channel
    const targetChannelKey = isCh2 ? 'postedToChannel2' : 'postedToChannel1';
    const eligibleNews = allTech.filter(i => i.category === 'news' && !i[targetChannelKey]);

    if (eligibleNews.length === 0) {
      addLog('warn', `تمامی اخبار تکنولوژی موجود قبلاً به کانال ${channelTargetNum} ارسال شده‌اند. جهت پیشگیری قاطع از ارسال تکراری، ارسال متوقف گردید.`);
      return false;
    }

    // Sort eligible: highest score first, then newest
    eligibleNews.sort((a, b) => {
      return (b.importanceScore || 50) - (a.importanceScore || 50);
    });

    const selectedNews = eligibleNews.slice(0, count);

    let text = `🔥 <b>تازه‌ترین اخبار دنیای تکنولوژی و هوش مصنوعی:</b>\n\n`;

    for (let i = 0; i < selectedNews.length; i++) {
      const it = selectedNews[i];
      text += formatTechItemForTelegram(it, settings.includeTechImportanceBadge !== false);
      if (i < selectedNews.length - 1) text += `\n───────────────\n\n`;
    }

    let channelBranding = '';
    if (isCh2) {
      let rawCh2Ad = (settings.adText || '').trim();
      const ch1Handle = (db.settings.autoPost?.targetChannel || '').replace(/^@/, '').toLowerCase().trim();
      const ch1Branding = (db.settings.branding || '').toLowerCase().trim();
      if (ch1Handle && rawCh2Ad.toLowerCase().includes(ch1Handle)) rawCh2Ad = '';
      if (ch1Branding && rawCh2Ad.toLowerCase().includes(ch1Branding)) rawCh2Ad = '';
      channelBranding = rawCh2Ad;
    } else {
      channelBranding = settings.adText || db.settings.branding || '';
    }

    if (channelBranding) {
      text += `\n🆔 ${escapeHtml(channelBranding)}`;
    }

    const inlineButtons: any[] = [];
    const channelBtn = getChannelInlineButton(channelTargetNum, targetChannel);
    if (channelBtn) {
      inlineButtons.push([{ text: channelBtn.text, url: channelBtn.url }]);
    }

    if (!isCh2) {
      const botUser = db.settings.botUsername;
      if (botUser) {
        inlineButtons.push([{
          text: '🤖 دسترسی به اخبار و کانفیگ‌های بیشتر',
          url: `https://t.me/${botUser.replace('@', '')}`
        }]);
      }
    }

    const channelHandle = targetChannel.startsWith('@') ? targetChannel : `@${targetChannel.replace('@', '')}`;
    
    // Check if any selected news item has a video or image to attach
    const itemWithVideo = selectedNews.find(n => !!n.videoUrl);
    const itemWithImage = selectedNews.find(n => !!n.imageUrl);

    const postResult = await sendTelegramPostWithMedia({
      chatId: channelHandle,
      text,
      videoUrl: itemWithVideo?.videoUrl,
      imageUrl: itemWithImage?.imageUrl,
      mediaType: itemWithVideo?.mediaType || itemWithImage?.mediaType,
      replyMarkup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined,
      silent: !!settings.silentMode
    });

    if (!postResult.success) {
      return false;
    }

    const nowIso = new Date().toISOString();
    for (const it of selectedNews) {
      const dbRef = db.techItems.find(t => t.id === it.id);
      if (dbRef) {
        if (isCh2) {
          dbRef.postedToChannel2 = true;
          dbRef.lastPostedAtCh2 = nowIso;
        } else {
          dbRef.postedToChannel1 = true;
          dbRef.lastPostedAtCh1 = nowIso;
        }
        dbRef.postedToChannel = true;
        dbRef.postedAt = nowIso;
        dbRef.postCount = (dbRef.postCount || 0) + 1;
      }
    }
    if (isCh2) {
      if (!db.settings.autoPost.channel2) db.settings.autoPost.channel2 = { ...DEFAULT_CHANNEL2_SETTINGS };
      db.settings.autoPost.channel2.lastTechNewsPostedAt = nowIso;
      db.settings.autoPost.channel2.lastPostedAt = nowIso;
      db.settings.autoPost.channel2.lastAnyPostAt = nowIso;
    } else {
      db.settings.autoPost.lastTechNewsPostedAt = nowIso;
      db.settings.autoPost.lastPostedAt = nowIso;
      db.settings.autoPost.lastAnyPostAt = nowIso;
    }
    recordChannelPostEvent(channelTargetNum, targetChannel, 'news');
    saveDatabase();

    addLog('success', `پست اخبار روز تکنولوژی (${selectedNews.length} خبر) با موفقیت به کانال ${channelTargetNum} (${targetChannel}) ارسال گردید.`);
    return true;
  } catch (err: any) {
    addLog('error', `خطا در ارسال اخبار روز به کانال ${channelTargetNum}: ${err.message || err}`);
    return false;
  }
}

// ----------------------------------------------------
// 3. DEDICATED EXECUTOR: TECH TRICKS & SECRETS AUTO-POST
// ----------------------------------------------------
async function executeTechTricksAutoPost(channelTargetNum: 1 | 2 = 1, customTargetChannel?: string): Promise<boolean> {
  const isCh2 = channelTargetNum === 2;
  const settings = isCh2 ? (db.settings.autoPost.channel2 || DEFAULT_CHANNEL2_SETTINGS) : db.settings.autoPost;
  const targetChannel = customTargetChannel || settings?.targetChannel;
  if (!targetChannel) {
    addLog('warn', `ارسال ترفندها به کانال ${channelTargetNum} انجام نشد: کانال مقصد تنظیم نشده است.`);
    return false;
  }
  if (!db.settings.botToken) {
    addLog('warn', 'ارسال ترفندها انجام نشد: توکن ربات فعال نیست.');
    return false;
  }

  try {
    addLog('info', `در حال آماده‌سازی و ارسال پست رازها و ترفندهای موبایل به کانال ${channelTargetNum} (${targetChannel})...`);

    seedCuratedTechItems();
    const count = settings.techTricksCount && settings.techTricksCount > 0 ? settings.techTricksCount : 2;
    const allTech = db.techItems || [];

    // Filter tricks & secrets that have NEVER been posted to this specific channel
    const targetChannelKey = isCh2 ? 'postedToChannel2' : 'postedToChannel1';
    const eligibleTricks = allTech.filter(i => (i.category === 'trick' || i.category === 'secret') && !i[targetChannelKey]);

    if (eligibleTricks.length === 0) {
      addLog('warn', `تمامی ترفندها و رازهای تکنولوژی موجود قبلاً به کانال ${channelTargetNum} ارسال شده‌اند. جهت پیشگیری قاطع از ارسال تکراری، ارسال متوقف گردید.`);
      return false;
    }

    // Sort: highest score first, then newest
    eligibleTricks.sort((a, b) => {
      return (b.importanceScore || 50) - (a.importanceScore || 50);
    });

    const selectedTricks = eligibleTricks.slice(0, count);

    let text = `💡 <b>ترفندها، رازها و آموزش‌های کاربردی موبایل و امنیت:</b>\n\n`;

    for (let i = 0; i < selectedTricks.length; i++) {
      const it = selectedTricks[i];
      text += formatTechItemForTelegram(it, settings.includeTechImportanceBadge !== false);
      if (i < selectedTricks.length - 1) text += `\n───────────────\n\n`;
    }

    let channelBranding = '';
    if (isCh2) {
      let rawCh2Ad = (settings.adText || '').trim();
      const ch1Handle = (db.settings.autoPost?.targetChannel || '').replace(/^@/, '').toLowerCase().trim();
      const ch1Branding = (db.settings.branding || '').toLowerCase().trim();
      if (ch1Handle && rawCh2Ad.toLowerCase().includes(ch1Handle)) rawCh2Ad = '';
      if (ch1Branding && rawCh2Ad.toLowerCase().includes(ch1Branding)) rawCh2Ad = '';
      channelBranding = rawCh2Ad;
    } else {
      channelBranding = settings.adText || db.settings.branding || '';
    }

    if (channelBranding) {
      text += `\n🆔 ${escapeHtml(channelBranding)}`;
    }

    const inlineButtons: any[] = [];
    const channelBtn = getChannelInlineButton(channelTargetNum, targetChannel);
    if (channelBtn) {
      inlineButtons.push([{ text: channelBtn.text, url: channelBtn.url }]);
    }

    if (!isCh2) {
      const botUser = db.settings.botUsername;
      if (botUser) {
        inlineButtons.push([{
          text: '🤖 دسترسی به ترفندها و آموزش‌های بیشتر',
          url: `https://t.me/${botUser.replace('@', '')}`
        }]);
      }
    }

    const channelHandle = targetChannel.startsWith('@') ? targetChannel : `@${targetChannel.replace('@', '')}`;
    
    // Check if any selected trick item has a video or image to attach
    const itemWithVideo = selectedTricks.find(n => !!n.videoUrl);
    const itemWithImage = selectedTricks.find(n => !!n.imageUrl);

    const postResult = await sendTelegramPostWithMedia({
      chatId: channelHandle,
      text,
      videoUrl: itemWithVideo?.videoUrl,
      imageUrl: itemWithImage?.imageUrl,
      mediaType: itemWithVideo?.mediaType || itemWithImage?.mediaType,
      replyMarkup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined,
      silent: !!settings.silentMode
    });

    if (!postResult.success) {
      return false;
    }

    const nowIso = new Date().toISOString();
    for (const it of selectedTricks) {
      const dbRef = db.techItems.find(t => t.id === it.id);
      if (dbRef) {
        if (isCh2) {
          dbRef.postedToChannel2 = true;
          dbRef.lastPostedAtCh2 = nowIso;
        } else {
          dbRef.postedToChannel1 = true;
          dbRef.lastPostedAtCh1 = nowIso;
        }
        dbRef.postedToChannel = true;
        dbRef.postedAt = nowIso;
        dbRef.postCount = (dbRef.postCount || 0) + 1;
      }
    }
    if (isCh2) {
      if (!db.settings.autoPost.channel2) db.settings.autoPost.channel2 = { ...DEFAULT_CHANNEL2_SETTINGS };
      db.settings.autoPost.channel2.lastTechTricksPostedAt = nowIso;
      db.settings.autoPost.channel2.lastPostedAt = nowIso;
      db.settings.autoPost.channel2.lastAnyPostAt = nowIso;
    } else {
      db.settings.autoPost.lastTechTricksPostedAt = nowIso;
      db.settings.autoPost.lastPostedAt = nowIso;
      db.settings.autoPost.lastAnyPostAt = nowIso;
    }
    recordChannelPostEvent(channelTargetNum, targetChannel, 'tricks');
    saveDatabase();

    addLog('success', `پست ترفندها و رازهای موبایل (${selectedTricks.length} ترفند) با موفقیت به کانال ${channelTargetNum} (${targetChannel}) ارسال گردید.`);
    return true;
  } catch (err: any) {
    addLog('error', `خطا در ارسال ترفندها به کانال ${channelTargetNum}: ${err.message || err}`);
    return false;
  }
}

// ----------------------------------------------------
// 4. DEDICATED EXECUTOR: AI PROMPTS HUB AUTO-POST (WITH ANTI-DUPLICATE GUARD)
// ----------------------------------------------------
function normalizePromptFingerprint(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF]/g, '')
    .slice(0, 80);
}

function isPromptAlreadyPostedToChannel(prompt: AiPrompt, channelNum: 1 | 2): boolean {
  // 1. Check direct object flags
  if (channelNum === 2 && prompt.postedToChannel2) return true;
  if (channelNum === 1 && prompt.postedToChannel1) return true;

  // 2. Check persistent posted history by ID or text fingerprint
  if (!db.postedPromptHistory) db.postedPromptHistory = [];
  const pFp = normalizePromptFingerprint(prompt.promptText);
  const tFp = normalizePromptFingerprint(prompt.title);

  for (const hist of db.postedPromptHistory) {
    if (hist.channelTarget === channelNum) {
      if (hist.promptId === prompt.id) return true;
      if (hist.promptNormalized && pFp && hist.promptNormalized === pFp) return true;
      if (hist.titleNormalized && tFp && hist.titleNormalized === tFp) return true;
    }
  }

  // 3. Check recent channel post history previews
  if (Array.isArray(db.channelPostHistory)) {
    for (const ch of db.channelPostHistory) {
      if (ch.channelTarget === channelNum && ch.category === 'prompts') {
        const previewNorm = normalizePromptFingerprint(ch.previewText || '');
        if (previewNorm && tFp && (previewNorm.includes(tFp.slice(0, 30)) || tFp.includes(previewNorm.slice(0, 30)))) {
          return true;
        }
      }
    }
  }

  return false;
}

function recordPromptPostSuccess(prompt: AiPrompt, channelNum: 1 | 2) {
  if (!db.postedPromptHistory) db.postedPromptHistory = [];
  const nowIso = new Date().toISOString();
  db.postedPromptHistory.unshift({
    id: `p-hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    promptId: prompt.id,
    titleNormalized: normalizePromptFingerprint(prompt.title),
    promptNormalized: normalizePromptFingerprint(prompt.promptText),
    channelTarget: channelNum,
    postedAt: nowIso
  });
  if (db.postedPromptHistory.length > 500) {
    db.postedPromptHistory = db.postedPromptHistory.slice(0, 500);
  }
}

function formatAiPromptForTelegram(prompt: AiPrompt): string {
  let badgeEmoji = '🔮';
  let badgeTitle = 'پرامپت هوش مصنوعی';
  if (prompt.category === 'image') {
    badgeEmoji = '🖼';
    badgeTitle = 'پرامپت ترند ساخت عکس';
  } else if (prompt.category === 'video') {
    badgeEmoji = '🎬';
    badgeTitle = 'پرامپت خلاقانه ساخت ویدیو';
  } else if (prompt.category === 'chat') {
    badgeEmoji = '💬';
    badgeTitle = 'پرامپت کاربردی متنی و دستیار';
  }

  let text = '';
  text += `${badgeEmoji} <b>« ${badgeTitle} »</b>\n`;
  text += `📌 <b>${escapeHtml(prompt.title)}</b>\n\n`;

  if (prompt.description) {
    text += `🔹 <b>توضیحات و نتیجه:</b>\n<i>${escapeHtml(prompt.description)}</i>\n\n`;
  }

  text += `📋 <b>متن پرامپت (جهت کپی آسان لمس کنید):</b>\n`;
  text += `<blockquote expandable><code>${escapeHtml(prompt.promptText)}</code></blockquote>\n\n`;

  if (prompt.tags && prompt.tags.length > 0) {
    const formattedTags = prompt.tags
      .slice(0, 5)
      .map(t => `#${t.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '')}`)
      .join(' ');
    text += `🏷 <i>${formattedTags}</i>\n`;
  }

  return text;
}

async function executeAiPromptsAutoPost(channelTargetNum: 1 | 2 = 1, customTargetChannel?: string): Promise<boolean> {
  const isCh2 = channelTargetNum === 2;
  const settings = isCh2 ? (db.settings.autoPost.channel2 || DEFAULT_CHANNEL2_SETTINGS) : db.settings.autoPost;
  const targetChannel = customTargetChannel || settings?.targetChannel;
  if (!targetChannel) {
    addLog('warn', `ارسال پرامپت‌های هوش مصنوعی به کانال ${channelTargetNum} انجام نشد: کانال مقصد تنظیم نشده است.`);
    return false;
  }
  if (!db.settings.botToken) {
    addLog('warn', 'ارسال پرامپت‌های هوش مصنوعی انجام نشد: توکن ربات فعال نیست.');
    return false;
  }

  try {
    addLog('info', `در حال آماده‌سازی و ارسال پست پرامپت‌های ترند هوش مصنوعی به کانال ${channelTargetNum} (${targetChannel})...`);

    if (!db.aiPrompts || db.aiPrompts.length === 0) {
      db.aiPrompts = [...DEFAULT_AI_PROMPTS];
      saveDatabase();
    }

    const count = settings.aiPromptsCount && settings.aiPromptsCount > 0 ? settings.aiPromptsCount : 1;
    const allPrompts = db.aiPrompts || [];

    // Filter prompts that have NEVER been posted to this specific channel using strict deduplication
    const eligiblePrompts = allPrompts.filter(p => !isPromptAlreadyPostedToChannel(p, channelTargetNum));

    if (eligiblePrompts.length === 0) {
      addLog('warn', `تمامی پرامپت‌های هوش مصنوعی موجود قبلاً به کانال ${channelTargetNum} ارسال شده‌اند. جهت پیشگیری قاطع از ارسال تکراری، ارسال متوقف گردید.`);
      return false;
    }

    // Sort eligible: hot first, then newest
    eligiblePrompts.sort((a, b) => {
      if (a.importance !== b.importance) {
        return a.importance === 'hot' ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const selectedPrompts = eligiblePrompts.slice(0, count);

    let text = `🔮 <b>پک اختصاصی پرامپت‌های ترند و برتر هوش مصنوعی:</b>\n\n`;

    for (let i = 0; i < selectedPrompts.length; i++) {
      const it = selectedPrompts[i];
      text += formatAiPromptForTelegram(it);
      if (i < selectedPrompts.length - 1) text += `\n───────────────\n\n`;
    }

    let channelBranding = '';
    if (isCh2) {
      let rawCh2Ad = (settings.adText || '').trim();
      const ch1Handle = (db.settings.autoPost?.targetChannel || '').replace(/^@/, '').toLowerCase().trim();
      const ch1Branding = (db.settings.branding || '').toLowerCase().trim();
      if (ch1Handle && rawCh2Ad.toLowerCase().includes(ch1Handle)) rawCh2Ad = '';
      if (ch1Branding && rawCh2Ad.toLowerCase().includes(ch1Branding)) rawCh2Ad = '';
      channelBranding = rawCh2Ad;
    } else {
      channelBranding = settings.adText || db.settings.branding || '';
    }

    if (channelBranding) {
      text += `\n🆔 ${escapeHtml(channelBranding)}`;
    }

    const inlineButtons: any[] = [];
    const channelBtn = getChannelInlineButton(channelTargetNum, targetChannel);
    if (channelBtn) {
      inlineButtons.push([{ text: channelBtn.text, url: channelBtn.url }]);
    }

    if (!isCh2) {
      const botUser = db.settings.botUsername;
      if (botUser) {
        inlineButtons.push([{
          text: '🤖 دریافت پرامپت‌های طلایی بیشتر',
          url: `https://t.me/${botUser.replace('@', '')}`
        }]);
      }
    }

    const channelHandle = targetChannel.startsWith('@') ? targetChannel : `@${targetChannel.replace('@', '')}`;
    
    // Check if any selected prompt item has a video or image to attach
    const itemWithVideo = selectedPrompts.find(n => !!n.videoUrl);
    const itemWithImage = selectedPrompts.find(n => !!n.imageUrl);

    const postResult = await sendTelegramPostWithMedia({
      chatId: channelHandle,
      text,
      videoUrl: itemWithVideo?.videoUrl,
      imageUrl: itemWithImage?.imageUrl,
      mediaType: itemWithVideo?.mediaType || itemWithImage?.mediaType,
      replyMarkup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined,
      silent: !!settings.silentMode
    });

    if (!postResult.success) {
      return false;
    }

    const nowIso = new Date().toISOString();
    for (const it of selectedPrompts) {
      const dbRef = db.aiPrompts.find(p => p.id === it.id);
      if (dbRef) {
        if (isCh2) {
          dbRef.postedToChannel2 = true;
          dbRef.lastPostedAtCh2 = nowIso;
        } else {
          dbRef.postedToChannel1 = true;
          dbRef.lastPostedAtCh1 = nowIso;
        }
        dbRef.postedToChannel = true;
        dbRef.postedAt = nowIso;
        dbRef.postCount = (dbRef.postCount || 0) + 1;
      }
      recordPromptPostSuccess(it, channelTargetNum);
    }
    if (isCh2) {
      if (!db.settings.autoPost.channel2) db.settings.autoPost.channel2 = { ...DEFAULT_CHANNEL2_SETTINGS };
      db.settings.autoPost.channel2.lastAiPromptsPostedAt = nowIso;
      db.settings.autoPost.channel2.lastPostedAt = nowIso;
      db.settings.autoPost.channel2.lastAnyPostAt = nowIso;
    } else {
      db.settings.autoPost.lastAiPromptsPostedAt = nowIso;
      db.settings.autoPost.lastPostedAt = nowIso;
      db.settings.autoPost.lastAnyPostAt = nowIso;
    }
    recordChannelPostEvent(channelTargetNum, targetChannel, 'prompts');
    saveDatabase();

    addLog('success', `پست پرامپت‌های طلایی هوش مصنوعی (${selectedPrompts.length} پرامپت) با موفقیت به کانال ${channelTargetNum} (${targetChannel}) ارسال گردید.`);
    return true;
  } catch (err: any) {
    addLog('error', `خطا در ارسال پرامپت‌های هوش مصنوعی به کانال ${channelTargetNum}: ${err.message || err}`);
    return false;
  }
}

// ----------------------------------------------------
// 5. DEDICATED EXECUTOR: DIGITAL TOOLS & FUTURE-PROOF TECH HUB AUTO-POST
// (استراتژی رشد کانال ۱ و عدم وابستگی به پروکسی و فیلترینگ)
// ----------------------------------------------------
function formatDigitalToolForTelegram(item: DigitalToolItem): string {
  let badgeEmoji = '🛠️';
  let catTitle = 'جعبه ابزار دیجیتال و کاربردی';
  if (item.category === 'ai_tools') {
    badgeEmoji = '🤖';
    catTitle = 'ابزار هوش مصنوعی کاربردی';
  } else if (item.category === 'cool_websites') {
    badgeEmoji = '🌐';
    catTitle = 'سایت‌های شگفت‌انگیز و ناب اینترنت';
  } else if (item.category === 'mobile_hacks') {
    badgeEmoji = '💡';
    catTitle = 'ترفندهای طلایی موبایل و سیستم‌عامل';
  } else if (item.category === 'cyber_security') {
    badgeEmoji = '🔐';
    catTitle = 'امنیت سایبری و راهنمای ضد هک';
  } else if (item.category === 'must_apps') {
    badgeEmoji = '📱';
    catTitle = 'اپلیکیشن‌های شاهکار و ضروری';
  }

  let text = '';
  text += `${badgeEmoji} <b>« ${catTitle} »</b>\n`;
  text += `📌 <b>${escapeHtml(item.title)}</b>\n\n`;

  if (item.summary) {
    text += `<blockquote>${escapeHtml(item.summary)}</blockquote>\n\n`;
  }

  if (item.howToUse) {
    text += `📝 <b>راهنما و ترفند استفاده:</b>\n<i>${escapeHtml(item.howToUse)}</i>\n\n`;
  }

  if (item.tags && item.tags.length > 0) {
    const formattedTags = item.tags
      .slice(0, 5)
      .map(t => `#${t.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '')}`)
      .join(' ');
    text += `🏷 <i>${formattedTags}</i>\n`;
  }

  return text;
}

async function executeDigitalToolsAutoPost(channelTargetNum: 1 | 2 = 1, customTargetChannel?: string): Promise<boolean> {
  const isCh2 = channelTargetNum === 2;
  const settings = isCh2 ? (db.settings.autoPost.channel2 || DEFAULT_CHANNEL2_SETTINGS) : db.settings.autoPost;
  const targetChannel = customTargetChannel || settings?.targetChannel;
  if (!targetChannel) {
    addLog('warn', `ارسال ابزارها و ترفندهای دیجیتال به کانال ${channelTargetNum} انجام نشد: کانال مقصد تنظیم نشده است.`);
    return false;
  }
  if (!db.settings.botToken) {
    addLog('warn', 'ارسال ابزارها و ترفندهای دیجیتال انجام نشد: توکن ربات فعال نیست.');
    return false;
  }

  try {
    addLog('info', `در حال آماده‌سازی و ارسال ابزارها و ترفندهای کاربردی به کانال ${channelTargetNum} (${targetChannel})...`);

    if (!db.digitalTools || db.digitalTools.length === 0) {
      db.digitalTools = [...DEFAULT_DIGITAL_TOOLS];
      saveDatabase();
    }

    const count = settings.digitalToolsCount && settings.digitalToolsCount > 0 ? settings.digitalToolsCount : 1;
    const allTools = db.digitalTools || [];

    // Filter tools based on enabled categories (if configured)
    const allowedCategories = settings.digitalToolsCategories && settings.digitalToolsCategories.length > 0
      ? settings.digitalToolsCategories
      : ['ai_tools', 'cool_websites', 'mobile_hacks', 'cyber_security', 'must_apps'];

    const targetChannelKey = isCh2 ? 'postedToChannel2' : 'postedToChannel1';

    let eligibleTools = allTools.filter(t => {
      const matchCat = allowedCategories.includes(t.category);
      const notPosted = !t[targetChannelKey];
      return matchCat && notPosted;
    });

    if (eligibleTools.length === 0) {
      // If all tools in selected categories were posted, reset posted flag for oldest posted tools to maintain rotation
      addLog('info', `تمامی ابزارهای دسته‌بندی انتخابی به کانال ${channelTargetNum} ارسال شده‌اند. بازنشانی هوشمند نوبتی برای محتوای مفید...`);
      for (const t of allTools) {
        if (allowedCategories.includes(t.category)) {
          if (isCh2) t.postedToChannel2 = false;
          else t.postedToChannel1 = false;
        }
      }
      eligibleTools = allTools.filter(t => allowedCategories.includes(t.category));
    }

    if (eligibleTools.length === 0) {
      addLog('warn', `هیچ ابزار دیجیتالی در دسته‌بندی‌های انتخابی یافت نشد.`);
      return false;
    }

    // Sort: essential/trending first, then newest
    eligibleTools.sort((a, b) => {
      const score = (item: DigitalToolItem) => {
        if (item.importance === 'essential') return 3;
        if (item.importance === 'trending') return 2;
        return 1;
      };
      if (score(b) !== score(a)) return score(b) - score(a);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const selectedTools = eligibleTools.slice(0, count);

    let text = `🚀 <b>محتوای کاربردی و جعبه‌ابزار دیجیتال:</b>\n\n`;

    for (let i = 0; i < selectedTools.length; i++) {
      const it = selectedTools[i];
      text += formatDigitalToolForTelegram(it);
      if (i < selectedTools.length - 1) text += `\n───────────────\n\n`;
    }

    let channelBranding = '';
    if (isCh2) {
      let rawCh2Ad = (settings.adText || '').trim();
      const ch1Handle = (db.settings.autoPost?.targetChannel || '').replace(/^@/, '').toLowerCase().trim();
      const ch1Branding = (db.settings.branding || '').toLowerCase().trim();
      if (ch1Handle && rawCh2Ad.toLowerCase().includes(ch1Handle)) rawCh2Ad = '';
      if (ch1Branding && rawCh2Ad.toLowerCase().includes(ch1Branding)) rawCh2Ad = '';
      channelBranding = rawCh2Ad;
    } else {
      channelBranding = settings.adText || db.settings.branding || '';
    }

    if (channelBranding) {
      text += `\n🆔 ${escapeHtml(channelBranding)}`;
    }

    const inlineButtons: any[] = [];
    
    // Add direct access button if tool has linkUrl
    const toolWithLink = selectedTools.find(t => !!t.linkUrl);
    if (toolWithLink && toolWithLink.linkUrl) {
      inlineButtons.push([{
        text: toolWithLink.buttonLabel || '🌐 ورود به سایت / دریافت ابزار',
        url: toolWithLink.linkUrl
      }]);
    }

    const channelBtn = getChannelInlineButton(channelTargetNum, targetChannel);
    if (channelBtn) {
      inlineButtons.push([{ text: channelBtn.text, url: channelBtn.url }]);
    }

    const channelHandle = targetChannel.startsWith('@') ? targetChannel : `@${targetChannel.replace('@', '')}`;

    const postResult = await sendTelegramPostWithMedia({
      chatId: channelHandle,
      text,
      replyMarkup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined,
      silent: !!settings.silentMode
    });

    if (!postResult.success) {
      return false;
    }

    const nowIso = new Date().toISOString();
    for (const it of selectedTools) {
      const dbRef = db.digitalTools?.find(t => t.id === it.id);
      if (dbRef) {
        if (isCh2) {
          dbRef.postedToChannel2 = true;
          dbRef.lastPostedAtCh2 = nowIso;
        } else {
          dbRef.postedToChannel1 = true;
          dbRef.lastPostedAtCh1 = nowIso;
        }
        dbRef.postedAt = nowIso;
        dbRef.postCount = (dbRef.postCount || 0) + 1;
      }
    }

    if (isCh2) {
      if (!db.settings.autoPost.channel2) db.settings.autoPost.channel2 = { ...DEFAULT_CHANNEL2_SETTINGS };
      db.settings.autoPost.channel2.lastDigitalToolsPostedAt = nowIso;
      db.settings.autoPost.channel2.lastPostedAt = nowIso;
      db.settings.autoPost.channel2.lastAnyPostAt = nowIso;
    } else {
      db.settings.autoPost.lastDigitalToolsPostedAt = nowIso;
      db.settings.autoPost.lastPostedAt = nowIso;
      db.settings.autoPost.lastAnyPostAt = nowIso;
    }

    recordChannelPostEvent(channelTargetNum, targetChannel, 'digital_tools', undefined, selectedTools[0]?.title);
    saveDatabase();

    addLog('success', `پست جعبه‌ابزار دیجیتال و محتوای کاربردی (${selectedTools.length} مورد) با موفقیت به کانال ${channelTargetNum} (${targetChannel}) ارسال شد.`);
    return true;
  } catch (err: any) {
    addLog('error', `خطا در ارسال ابزارهای دیجیتال به کانال ${channelTargetNum}: ${err.message || err}`);
    return false;
  }
}

// ----------------------------------------------------
// 5. DEDICATED EXECUTOR: FUN & GENERAL NEWS AUTO-POST
// ----------------------------------------------------
// ----------------------------------------------------
// CONTENT SANITIZATION HELPERS (STRIP SOURCE GROUP/CHANNEL IDS & ADS)
// ----------------------------------------------------
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips all configured source group IDs, channel usernames, invite links, cross-promotions, and foreign handles
 * from text before posting to Telegram channels (Channel 1, Channel 2, or Bot).
 */
function sanitizeContentForTelegramPost(
  content: string,
  targetChannelHandle?: string,
  knownSources?: string[]
): string {
  if (!content) return '';

  let text = content;

  // 1. Collect all known source channel/group handles to eliminate
  const allSourceHandles = new Set<string>();
  if (db.funSources) {
    db.funSources.forEach(s => {
      const h = (s.urlOrHandle || '').replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/(s\/)?/i, '').replace(/^@+/, '').trim().toLowerCase();
      if (h) allSourceHandles.add(h);
      if (s.name) {
        const cleanN = s.name.replace(/[@#]/g, '').trim().toLowerCase();
        if (cleanN.length >= 3) allSourceHandles.add(cleanN);
      }
    });
  }
  if (db.sources) {
    db.sources.forEach(s => {
      const h = (s.urlOrHandle || '').replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/(s\/)?/i, '').replace(/^@+/, '').trim().toLowerCase();
      if (h) allSourceHandles.add(h);
    });
  }
  if (db.forceJoinChannels) {
    db.forceJoinChannels.forEach(c => {
      const h = (c.username || '').replace(/^@+/, '').trim().toLowerCase();
      if (h) allSourceHandles.add(h);
    });
  }
  if (knownSources) {
    knownSources.forEach(s => {
      const h = s.replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/(s\/)?/i, '').replace(/^@+/, '').trim().toLowerCase();
      if (h) allSourceHandles.add(h);
    });
  }

  const cleanTarget = (targetChannelHandle || '').replace(/^@+/, '').toLowerCase().trim();

  // 2. Filter lines
  const lines = text.split('\n');
  const keptLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (keptLines.length > 0 && keptLines[keptLines.length - 1] !== '') {
        keptLines.push('');
      }
      continue;
    }

    const lower = trimmed.toLowerCase();

    // Check for ad/promotional patterns
    if (
      lower.includes('سفارش تبلیغ') ||
      lower.includes('تبلیغات') ||
      lower.includes('تعرفه تبلیغ') ||
      lower.includes('هزینه تبلیغ') ||
      lower.includes('ثبت نام در سایت') ||
      lower.includes('پیش بینی فوتبال') ||
      lower.includes('بازی انفجار') ||
      lower.includes('وان ایکس') ||
      lower.includes('۱xbet') ||
      lower.includes('1xbet') ||
      lower.includes('کانال ما را دنبال کنید') ||
      lower.includes('عضویت در کانال') ||
      lower.includes('عضویت در گروه') ||
      lower.includes('پیوستن به کانال') ||
      lower.includes('پیوستن به گروه') ||
      lower.includes('لینک کانال') ||
      lower.includes('لینک گروه') ||
      lower.includes('آیدی گروه') ||
      lower.includes('آیدی کانال') ||
      lower.includes('گروه چت') ||
      lower.includes('لینک چت') ||
      lower.includes('join group') ||
      lower.includes('join channel') ||
      lower.includes('instagram.com') ||
      lower.includes('اینستاگرام:') ||
      lower.includes('اینستاگرام ما') ||
      lower.includes('پیج اینستا') ||
      lower.includes('rubika.ir') ||
      lower.includes('eitaa.com') ||
      lower.includes('ble.ir') ||
      lower.includes('akharinkhabarads')
    ) {
      continue;
    }

    // Lines that are just IDs, links, or channel/group references
    if (/^[🆔📢🔗📡👉📍👈🔹🔺🔻▪️▫️•\-\*\s]*(منبع\s*:|کانال\s*:|گروه\s*:|channel\s*:|source\s*:)?\s*(@[\w\d_]+|https?:\/\/(t\.me|telegram\.me)\/[^\s]+)\s*$/i.test(trimmed)) {
      continue;
    }

    // Line containing source references
    let isSourceCreditLine = false;
    for (const src of allSourceHandles) {
      if (src.length >= 3 && lower.includes(src) && src !== cleanTarget) {
        if (
          lower.startsWith('منبع') ||
          lower.startsWith('source') ||
          lower.startsWith('کانال') ||
          lower.startsWith('گروه') ||
          lower.includes('@' + src) ||
          lower.includes('t.me/' + src)
        ) {
          isSourceCreditLine = true;
          break;
        }
      }
    }
    if (isSourceCreditLine) continue;

    // Process line content
    let processedLine = line;

    // Remove Telegram links unless they match targetChannelHandle
    processedLine = processedLine.replace(/https?:\/\/(www\.)?(t\.me|telegram\.me|telegram\.dog)\/(joinchat\/|\+)?([\w\d_\-]+)/gi, (match, _, _2, _3, handle) => {
      if (cleanTarget && handle && handle.toLowerCase() === cleanTarget) {
        return match;
      }
      return '';
    });

    // Remove @mentions unless they match targetChannelHandle
    processedLine = processedLine.replace(/@([a-zA-Z0-9_]{3,32})/g, (match, uname) => {
      if (cleanTarget && uname.toLowerCase() === cleanTarget) {
        return match;
      }
      return '';
    });

    // Remove all known source names or handles if remaining in text
    for (const src of allSourceHandles) {
      if (src.length >= 4 && src !== cleanTarget) {
        const regex = new RegExp(`@?${escapeRegex(src)}`, 'gi');
        processedLine = processedLine.replace(regex, '');
      }
    }

    // Strip dangling ID/link icons left behind
    processedLine = processedLine
      .replace(/^[🆔📢🔗📡👉📍👈🔹🔺🔻▪️▫️•\-:\s]+$/g, '')
      .replace(/([🆔📢🔗📡👉📍👈🔹🔺🔻▪️▫️•\-:\s])\s*$/g, (m, icon) => {
        return icon === '🆔' || icon === '🔗' || icon === '👉' || icon === '👈' ? '' : m;
      })
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (processedLine) {
      keptLines.push(processedLine);
    }
  }

  return keptLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizePostTitle(title: string, targetChannelHandle?: string): string {
  if (!title) return 'مطلب و خبر روز';
  let t = title;
  t = t.replace(/https?:\/\/[^\s]+/g, '');
  t = t.replace(/@[\w\d_]+/g, '');
  t = t.replace(/(تصویر جدید از|مطلب سرگرمی از|پست جدید از|خبر جدید از)\s*(@?[\w\d_\u0600-\u06FF]+)/gi, 'مطلب منتخب طنز و روز');
  t = t.replace(/^[🆔📢🔗📡👉📍👈🔹🔺🔻▪️▫️•\-:\s]+/g, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t || 'مطلب و خبر روز';
}

function cleanAllFunNewsItemsInDb(): void {
  if (!db.funNewsItems || db.funNewsItems.length === 0) return;
  let changed = false;
  for (const item of db.funNewsItems) {
    const cleanT = sanitizeContentForTelegramPost(item.text);
    const cleanTitle = sanitizePostTitle(item.title);
    if (cleanT !== item.text || cleanTitle !== item.title) {
      item.text = cleanT || item.text;
      item.title = cleanTitle || item.title;
      changed = true;
    }
  }
  if (changed) {
    saveDatabase();
  }
}

async function executeFunNewsAutoPost(channelTargetNum: 1 | 2 = 2, customTargetChannel?: string): Promise<boolean> {
  const isCh2 = channelTargetNum === 2;
  const ap = isCh2 ? (db.settings.autoPost.channel2 || db.settings.autoPost) : db.settings.autoPost;
  const targetChannel = customTargetChannel || ap?.targetChannel;

  if (!targetChannel) {
    addLog('warn', `ارسال فان و اخبار به کانال ${channelTargetNum} انجام نشد: کانال مقصد تنظیم نشده است.`);
    return false;
  }
  if (!db.settings.botToken) {
    addLog('warn', 'ارسال فان و اخبار انجام نشد: توکن ربات فعال نیست.');
    return false;
  }

  try {
    addLog('info', `در حال آماده‌سازی و ارسال پست فان و اخبار به کانال ${channelTargetNum} (${targetChannel})...`);

    if (!db.funNewsItems) {
      db.funNewsItems = [];
    }

    const activeHandles = db.funSources
      .filter(s => s.enabled)
      .map(s => s.urlOrHandle.replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/(s\/)?/i, '').replace(/^@+/, '').toLowerCase().trim());

    // Filter unposted items for this specific channel
    let eligible = (db.funNewsItems || []).filter(item => {
      if (isCh2 ? item.postedToChannel2 : item.postedToChannel1) return false;
      if (item.sourceChannel) {
        const handle = item.sourceChannel.replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/(s\/)?/i, '').replace(/^@+/, '').toLowerCase().trim();
        if (activeHandles.length > 0 && !activeHandles.includes(handle)) return false;
      }
      return true;
    });

    // If available unposted items are low (< 5), automatically scrape fresh items from live channels
    if (eligible.length < 5) {
      addLog('info', `موجودی مطالب منتشرنشده فان و اخبار اندک است (${eligible.length} عدد). در حال استخراج و دریافت مطالب تازه از کانال‌های منبع...`);
      await extractFunNewsFromSources();
      
      eligible = (db.funNewsItems || []).filter(item => {
        if (isCh2 ? item.postedToChannel2 : item.postedToChannel1) return false;
        if (item.sourceChannel) {
          const handle = item.sourceChannel.replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/(s\/)?/i, '').replace(/^@+/, '').toLowerCase().trim();
          if (activeHandles.length > 0 && !activeHandles.includes(handle)) return false;
        }
        return true;
      });
    }

    if (eligible.length === 0) {
      addLog('warn', `هیچ مطلب جدید و منتشرنشده‌ای برای کانال ${channelTargetNum} در منابع یافت نشد. جهت پیشگیری از ارسال پست تکراری، ارسال متوقف گردید.`);
      return false;
    }

    const countToPost = Math.max(1, ap?.funNewsCount || 1);
    const selected = eligible.slice(0, countToPost);

    const channelHandle = targetChannel.startsWith('@') ? targetChannel : `@${targetChannel.replace('@', '')}`;
    
    // Channel 2 must NEVER inherit Channel 1's branding or handle
    let adText = '';
    if (isCh2) {
      let rawCh2Ad = (ap?.adText || '').trim();
      const ch1Handle = (db.settings.autoPost?.targetChannel || '').replace(/^@/, '').toLowerCase().trim();
      const ch1Branding = (db.settings.branding || '').toLowerCase().trim();
      if (ch1Handle && rawCh2Ad.toLowerCase().includes(ch1Handle)) rawCh2Ad = '';
      if (ch1Branding && rawCh2Ad.toLowerCase().includes(ch1Branding)) rawCh2Ad = '';
      adText = rawCh2Ad;
    } else {
      adText = ap?.adText || db.settings.branding || '';
    }

    const nowIso = new Date().toISOString();

    let anySuccess = false;
    for (const item of selected) {
      const isFun = item.category === 'fun';
      const categoryEmoji = isFun ? '🎭' : '📰';
      const categoryName = isFun ? 'طنز و سرگرمی تلگرام' : 'اخبار عمومی و مهم روز';

      // Thoroughly sanitize title and body text so NO source group/channel handles appear
      const sanitizedText = sanitizeContentForTelegramPost(item.text, channelHandle);
      const sanitizedTitle = sanitizePostTitle(item.title, channelHandle);

      let text = `${categoryEmoji} <b>« ${categoryName} »</b>\n`;
      text += `📌 <b>${escapeHtml(sanitizedTitle)}</b>\n\n`;
      text += `${escapeHtml(sanitizedText)}\n\n`;

      if (item.tags && item.tags.length > 0) {
        const formattedTags = item.tags
          .slice(0, 5)
          .map(t => `#${t.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '')}`)
          .join(' ');
        text += `🏷 <i>${formattedTags}</i>\n`;
      }

      if (adText) {
        text += `\n📢 <i>${escapeHtml(adText)}</i>\n`;
      }
      text += `🆔 ${escapeHtml(channelHandle)}`;

      const inlineButtons: any[] = [];
      const channelBtn = getChannelInlineButton(isCh2 ? 2 : 1, channelHandle);
      if (channelBtn) {
        inlineButtons.push([{ text: channelBtn.text, url: channelBtn.url }]);
      }

      const postResult = await sendTelegramPostWithMedia({
        chatId: channelHandle,
        text,
        videoUrl: item.videoUrl,
        imageUrl: item.imageUrl,
        mediaType: item.mediaType,
        replyMarkup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined,
        silent: !!ap.silentMode
      });

      if (postResult.success) {
        if (isCh2) {
          item.postedToChannel2 = true;
        } else {
          item.postedToChannel1 = true;
        }
        item.postedAt = nowIso;
        anySuccess = true;
      }

      if (selected.length > 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (isCh2 && db.settings.autoPost.channel2) {
      db.settings.autoPost.channel2.lastFunNewsPostedAt = nowIso;
      db.settings.autoPost.channel2.lastAnyPostAt = nowIso;
      db.settings.autoPost.channel2.lastPostedAt = nowIso;
    } else if (db.settings.autoPost) {
      db.settings.autoPost.lastFunNewsPostedAt = nowIso;
      db.settings.autoPost.lastAnyPostAt = nowIso;
      db.settings.autoPost.lastPostedAt = nowIso;
    }
    if (anySuccess) {
      recordChannelPostEvent(channelTargetNum, channelHandle, 'fun');
    }
    saveDatabase();

    if (anySuccess) {
      addLog('success', `پست فان و اخبار (${selected.length} مطلب) با موفقیت به کانال ${channelTargetNum} (${channelHandle}) ارسال گردید.`);
      return true;
    }
    return false;
  } catch (err: any) {
    addLog('error', `خطا در ارسال پست فان و اخبار به کانال ${channelTargetNum}: ${err.message || err}`);
    return false;
  }
}

// ----------------------------------------------------
// DEDICATED CRAWLER: FUN & NEWS TELEGRAM SOURCES
// ----------------------------------------------------
function cleanTelegramFunText(rawHtml: string): string {
  let text = rawHtml
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<a[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  text = text.replace(/Forwarded from[^\n]*\n?/gi, '').trim();

  return sanitizeContentForTelegramPost(text);
}

async function extractFunNewsFromSources(specificSourceId?: string): Promise<{ added: number; total: number; skipped: number }> {
  if (!Array.isArray(db.funSources)) {
    db.funSources = [];
  }
  if (!Array.isArray(db.funNewsItems)) {
    db.funNewsItems = [];
  }

  // Clean all existing items in database
  cleanAllFunNewsItemsInDb();

  const validSpecificId = (typeof specificSourceId === 'string' && specificSourceId.trim().length > 0 && specificSourceId !== '[object Object]')
    ? specificSourceId.trim()
    : undefined;

  const sourcesToScrape = validSpecificId 
    ? db.funSources.filter(s => s.id === validSpecificId)
    : db.funSources.filter(s => s.enabled);

  if (sourcesToScrape.length === 0) {
    addLog('warn', 'هیچ کانال تلگرامی فعالی برای استخراج فان و اخبار یافت نشد. لطفاً در تب فان و اخبار یک کانال فعال تعریف کنید.');
    return { added: 0, total: (db.funNewsItems || []).length, skipped: 0 };
  }

  addLog('info', `شروع استخراج دقیق مطالب طنز و اخبار از ${sourcesToScrape.length} کانال منبع...`);
  let addedCount = 0;
  let skippedCount = 0;

  // Process sources in parallel with strict timeout
  const scrapePromises = sourcesToScrape.map(async (source) => {
    const cleanHandle = source.urlOrHandle
      .replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/(s\/)?/i, '')
      .replace(/^@+/, '')
      .trim()
      .replace(/[/?#].*$/, '');

    if (!cleanHandle) return { source, added: 0, skipped: 0 };

    try {
      const url = `https://t.me/s/${cleanHandle}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (!response.ok) {
        addLog('warn', `کانال منبع ${source.name} (@${cleanHandle}) در دسترس نبود (وضعیت: ${response.status}).`);
        return { source, added: 0, skipped: 0 };
      }

      const html = await response.text();
      const messageBlockRegex = /<div[^>]*class="[^"]*tgme_widget_message\b[^"]*"[^>]*data-post="([^"]+)"[\s\S]*?(?=<div[^>]*class="[^"]*tgme_widget_message\b[^"]*"[^>]*data-post=|$)/gi;
      const matches = Array.from(html.matchAll(messageBlockRegex));

      let sourceAdded = 0;
      let sourceSkipped = 0;

      for (const match of matches) {
        const fullBlock = match[0];
        const postAttr = match[1] || ''; // e.g. "jokkadeh/4523"
        const msgIdParts = postAttr.split('/');
        const msgId = msgIdParts.length > 1 ? parseInt(msgIdParts[1], 10) : undefined;

        // Extract video URL if present (MP4, round video, telesco.pe CDN, webm, etc.)
        let videoUrl: string | undefined = undefined;
        let isAnimation = false;
        const videoMatch = fullBlock.match(/<video[^>]*\bsrc=["'](https?:\/\/[^"']+)["']/i)
          || fullBlock.match(/<source[^>]*\bsrc=["'](https?:\/\/[^"']+)["']/i)
          || fullBlock.match(/class=["'][^"']*tgme_widget_message_video_player[^"']*["'][^>]*href=["'](https?:\/\/[^"']+)["']/i);
        
        if (videoMatch && videoMatch[1]) {
          videoUrl = videoMatch[1].trim();
          if (fullBlock.includes('autoplay') || fullBlock.includes('tgme_widget_message_video_thumb') || /\.gif(\?|$)/i.test(videoUrl)) {
            isAnimation = true;
          }
        }

        // Extract image url or video thumbnail if present
        let imageUrl: string | undefined = undefined;
        const imgMatch = fullBlock.match(/class=["'][^"']*tgme_widget_message_photo(?:_wrap)?[^"']*["'][^>]*style=["'][^"']*background-image:\s*url\(['"]?(https?:\/\/[^'"\)]+)['"]?\)/i)
          || fullBlock.match(/background-image:\s*url\(['"]?(https?:\/\/[^'"\)]+)['"]?\)/i)
          || fullBlock.match(/<img[^>]*class=["'][^"']*tgme_widget_message_photo[^"']*["'][^>]*src=["'](https?:\/\/[^"']+)["']/i)
          || fullBlock.match(/<video[^>]*\bposter=["'](https?:\/\/[^"']+)["']/i)
          || fullBlock.match(/src="(https?:\/\/[^"]+)"/i);

        if (imgMatch && imgMatch[1] && !imgMatch[1].includes('favicon') && !imgMatch[1].includes('avatar')) {
          imageUrl = imgMatch[1].trim();
        }

        let mediaType: 'photo' | 'video' | 'animation' | undefined = undefined;
        if (videoUrl) {
          mediaType = isAnimation ? 'animation' : 'video';
        } else if (imageUrl) {
          mediaType = 'photo';
        }

        // Extract and thoroughly clean text
        const textMatch = fullBlock.match(/<div[^>]*class="[^"]*tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (!textMatch && !imageUrl && !videoUrl) continue;

        const rawHtmlText = textMatch ? textMatch[1] : '';
        const cleanText = cleanTelegramFunText(rawHtmlText);

        if (!cleanText && !imageUrl && !videoUrl) continue;
        if (cleanText.length < 10 && !imageUrl && !videoUrl) continue;

        // Check for duplicates
        const isDuplicate = db.funNewsItems.some(item => {
          if (msgId && item.sourceChannel === `@${cleanHandle}` && item.sourceMessageId === msgId) return true;
          if (cleanText && cleanText.length > 20 && item.text === cleanText) return true;
          if (videoUrl && item.videoUrl === videoUrl) return true;
          if (imageUrl && !videoUrl && item.imageUrl === imageUrl) return true;
          return false;
        });

        if (isDuplicate) {
          sourceSkipped++;
          continue;
        }

        // Generate clean title without source handles
        const firstLine = cleanText.split('\n')[0].trim();
        const title = sanitizePostTitle(
          firstLine.length > 0
            ? (firstLine.length > 65 ? firstLine.substring(0, 62) + '...' : firstLine)
            : (videoUrl ? 'ویدیوی منتخب سرگرمی و روز' : (imageUrl ? 'تصویر منتخب سرگرمی و جذاب' : 'مطلب منتخب طنز و روز'))
        );

        // Classify into 'fun' or 'news'
        const isNewsSource = cleanHandle.toLowerCase().includes('khabar') || source.name.includes('خبر') || source.category === 'news';
        const lower = (cleanText + ' ' + source.name).toLowerCase();
        const isFun = !isNewsSource || lower.includes('طنز') || lower.includes('جوک') || lower.includes('خنده') || 
                      lower.includes('fun') || lower.includes('شوخی') || lower.includes('😂') || lower.includes('🤣');

        const category: 'fun' | 'news' = isFun ? 'fun' : 'news';

        const tagMatches = cleanText.match(/#([\w\u0600-\u06FF]+)/g);
        const tags = tagMatches 
          ? tagMatches.map(t => t.replace('#', '')) 
          : (isFun ? ['سرگرمی', 'طنز', 'لبخند'] : ['اخبار_فوری', 'خبر_روز']);

        const newItem: FunNewsItem = {
          id: generateId(),
          title,
          text: cleanText,
          imageUrl,
          videoUrl,
          mediaType,
          sourceChannel: `@${cleanHandle}`,
          sourceMessageId: msgId,
          category,
          tags: tags.slice(0, 5),
          createdAt: new Date().toISOString(),
          postedToChannel1: false,
          postedToChannel2: false
        };

        db.funNewsItems.unshift(newItem);
        sourceAdded++;
      }

      source.extractedCount = (source.extractedCount || 0) + sourceAdded;
      source.lastExtracted = new Date().toISOString();
      return { source, added: sourceAdded, skipped: sourceSkipped };
    } catch (err: any) {
      addLog('warn', `خطا در استخراج از کانال ${source.name} (@${cleanHandle}): ${err.message || err}`);
      return { source, added: 0, skipped: 0 };
    }
  });

  const results = await Promise.allSettled(scrapePromises);
  for (const res of results) {
    if (res.status === 'fulfilled') {
      addedCount += res.value.added;
      skippedCount += res.value.skipped;
    }
  }

  if (db.funNewsItems.length > 1000) {
    db.funNewsItems = db.funNewsItems.slice(0, 1000);
  }

  saveDatabase();
  addLog('success', `استخراج مطالب پایان یافت: ${addedCount} مطلب باکیفیت و بدون تبلیغ جدید اضافه شد (${skippedCount} مورد تکراری فیلتر گردید).`);
  return { added: addedCount, total: db.funNewsItems.length, skipped: skippedCount };
}

// Master Auto-Post Dispatcher
async function executeAutoPost(mode: 'all' | 'configs' | 'news' | 'tricks' | 'prompts' | 'fun' | 'tools' = 'all', channelTarget: 1 | 2 = 1): Promise<boolean> {
  const isCh2 = channelTarget === 2;
  const settings = isCh2 ? (db.settings.autoPost.channel2 || DEFAULT_CHANNEL2_SETTINGS) : db.settings.autoPost;

  if (!settings || !settings.enabled || !settings.targetChannel) {
    addLog('warn', `ارسال خودکار به کانال ${channelTarget} انجام نشد: غیرفعال است یا کانال هدف تنظیم نشده است.`);
    return false;
  }
  if (!db.settings.botToken) {
    addLog('warn', 'ارسال خودکار انجام نشد: توکن ربات فعال نیست.');
    return false;
  }

  if (mode === 'configs') {
    return await executeConfigsAutoPost(channelTarget, settings.targetChannel);
  }
  if (mode === 'news') {
    return await executeTechNewsAutoPost(channelTarget, settings.targetChannel);
  }
  if (mode === 'tricks') {
    return await executeTechTricksAutoPost(channelTarget, settings.targetChannel);
  }
  if (mode === 'prompts') {
    return await executeAiPromptsAutoPost(channelTarget, settings.targetChannel);
  }
  if (mode === 'fun') {
    return await executeFunNewsAutoPost(channelTarget, settings.targetChannel);
  }
  if (mode === 'tools') {
    return await executeDigitalToolsAutoPost(channelTarget, settings.targetChannel);
  }

  // mode === 'all'
  let anySuccess = false;
  if (settings.configsEnabled !== false && ((settings.configCount || 0) > 0 || (settings.proxyCount || 0) > 0)) {
    const res = await executeConfigsAutoPost(channelTarget, settings.targetChannel);
    if (res) anySuccess = true;
  }
  if (settings.techNewsEnabled !== false && (settings.techNewsCount || 0) > 0) {
    const res = await executeTechNewsAutoPost(channelTarget, settings.targetChannel);
    if (res) anySuccess = true;
  }
  if (settings.techTricksEnabled !== false && (settings.techTricksCount || 0) > 0) {
    const res = await executeTechTricksAutoPost(channelTarget, settings.targetChannel);
    if (res) anySuccess = true;
  }
  if (settings.aiPromptsEnabled !== false && (settings.aiPromptsCount || 0) > 0) {
    const res = await executeAiPromptsAutoPost(channelTarget, settings.targetChannel);
    if (res) anySuccess = true;
  }
  if (settings.funNewsEnabled === true && (settings.funNewsCount || 0) > 0) {
    const res = await executeFunNewsAutoPost(channelTarget, settings.targetChannel);
    if (res) anySuccess = true;
  }
  if (settings.digitalToolsEnabled !== false && (settings.digitalToolsCount || 0) > 0) {
    const res = await executeDigitalToolsAutoPost(channelTarget, settings.targetChannel);
    if (res) anySuccess = true;
  }

  if (!anySuccess) {
    if (isCh2) {
      anySuccess = await executeFunNewsAutoPost(2, settings.targetChannel);
    } else {
      anySuccess = await executeConfigsAutoPost(1, settings.targetChannel);
    }
  }

  return anySuccess;
}

// --- Granular Auto-Post Scheduler ---
let autoPostCheckIntervalRef: NodeJS.Timeout | null = null;

function setupAutoPostInterval() {
  if (autoPostCheckIntervalRef) {
    clearInterval(autoPostCheckIntervalRef);
    autoPostCheckIntervalRef = null;
  }

  // Check every 1 minute for accurate cron timing
  autoPostCheckIntervalRef = setInterval(() => {
    checkAndTriggerAutoPost().catch(err => {
      console.error('Error during auto-post schedule check:', err);
    });
  }, 60 * 1000);
}

async function checkAndTriggerAutoPost() {
  const now = Date.now();

  // ==========================================
  // 1. CHECK CHANNEL 1 SCHEDULE (Independent)
  // ==========================================
  const ch1Allowance = await evaluateChannelPostingAllowance(1);
  if (ch1Allowance.allowed) {
    const ap = db.settings.autoPost;
    const tehran = getTehranTimeInfo();

    interface PostCandidate {
      category: 'configs' | 'tricks' | 'news' | 'prompts' | 'fun' | 'tools';
      isDue: boolean;
      timeSinceDueMs: number;
      goldenPriority: number;
      run: () => Promise<boolean>;
    }

    const candidates: PostCandidate[] = [];

    // 1. Configs & Proxies Schedule Check
    if (ap.configsEnabled !== false && ((ap.configCount || 0) > 0 || (ap.proxyCount || 0) > 0)) {
      const configMinutes = Number(ap.configIntervalMinutes) || (Number(ap.configIntervalHours) ? Number(ap.configIntervalHours) * 60 : (Number(ap.postIntervalHours) ? Number(ap.postIntervalHours) * 60 : 240));
      const intervalMs = Math.max(30, configMinutes) * 60 * 1000;
      const lastTime = ap.lastConfigsPostedAt || ap.lastPostedAt;
      const elapsed = lastTime ? (now - new Date(lastTime).getTime()) : Infinity;
      if (elapsed >= intervalMs) {
        const p = (tehran.hour >= 12 && tehran.hour <= 14) || (tehran.hour >= 20 && tehran.hour <= 23) ? 10 : 5;
        candidates.push({
          category: 'configs',
          isDue: true,
          timeSinceDueMs: elapsed - intervalMs,
          goldenPriority: p,
          run: () => executeConfigsAutoPost(1, ap.targetChannel)
        });
      }
    }

    // 2. Tech News Schedule Check
    if (ap.techNewsEnabled !== false && (ap.techNewsCount || 0) > 0) {
      const newsMinutes = Number(ap.techNewsIntervalMinutes) || (Number(ap.techNewsIntervalHours) ? Number(ap.techNewsIntervalHours) * 60 : 240);
      const intervalMs = Math.max(30, newsMinutes) * 60 * 1000;
      const lastTime = ap.lastTechNewsPostedAt;
      const elapsed = lastTime ? (now - new Date(lastTime).getTime()) : Infinity;
      if (elapsed >= intervalMs) {
        candidates.push({
          category: 'news',
          isDue: true,
          timeSinceDueMs: elapsed - intervalMs,
          goldenPriority: 4,
          run: () => executeTechNewsAutoPost(1, ap.targetChannel)
        });
      }
    }

    // 3. Tech Tricks & Secrets Schedule Check
    if (ap.techTricksEnabled !== false && (ap.techTricksCount || 0) > 0) {
      const tricksMinutes = Number(ap.techTricksIntervalMinutes) || (Number(ap.techTricksIntervalHours) ? Number(ap.techTricksIntervalHours) * 60 : 360);
      const intervalMs = Math.max(30, tricksMinutes) * 60 * 1000;
      const lastTime = ap.lastTechTricksPostedAt;
      const elapsed = lastTime ? (now - new Date(lastTime).getTime()) : Infinity;
      if (elapsed >= intervalMs) {
        const p = (tehran.hour >= 15 && tehran.hour <= 20) ? 9 : 6;
        candidates.push({
          category: 'tricks',
          isDue: true,
          timeSinceDueMs: elapsed - intervalMs,
          goldenPriority: p,
          run: () => executeTechTricksAutoPost(1, ap.targetChannel)
        });
      }
    }

    // 4. AI Prompts Schedule Check
    if (ap.aiPromptsEnabled !== false && (ap.aiPromptsCount || 0) > 0) {
      const promptsMinutes = Number(ap.aiPromptsIntervalMinutes) || (Number(ap.aiPromptsIntervalHours) ? Number(ap.aiPromptsIntervalHours) * 60 : 360);
      const intervalMs = Math.max(30, promptsMinutes) * 60 * 1000;
      const lastTime = ap.lastAiPromptsPostedAt;
      const elapsed = lastTime ? (now - new Date(lastTime).getTime()) : Infinity;
      if (elapsed >= intervalMs) {
        const p = (tehran.hour >= 18 && tehran.hour <= 22) ? 8 : 4;
        candidates.push({
          category: 'prompts',
          isDue: true,
          timeSinceDueMs: elapsed - intervalMs,
          goldenPriority: p,
          run: () => executeAiPromptsAutoPost(1, ap.targetChannel)
        });
      }
    }

    // 5. Fun & General News Schedule Check (Channel 1)
    if (ap.funNewsEnabled === true && (ap.funNewsCount || 0) > 0) {
      const funMinutes = Number(ap.funNewsIntervalMinutes) || (Number(ap.funNewsIntervalHours) ? Number(ap.funNewsIntervalHours) * 60 : 180);
      const intervalMs = Math.max(30, funMinutes) * 60 * 1000;
      const lastTime = ap.lastFunNewsPostedAt;
      const elapsed = lastTime ? (now - new Date(lastTime).getTime()) : Infinity;
      if (elapsed >= intervalMs) {
        candidates.push({
          category: 'fun',
          isDue: true,
          timeSinceDueMs: elapsed - intervalMs,
          goldenPriority: 3,
          run: () => executeFunNewsAutoPost(1, ap.targetChannel)
        });
      }
    }

    // 6. Digital Tools & Future-Proof Tech Schedule (Channel 1 Independence from Filter)
    if (ap.digitalToolsEnabled !== false && (ap.digitalToolsCount || 0) > 0) {
      const toolsMinutes = Number(ap.digitalToolsIntervalMinutes) || (Number(ap.digitalToolsIntervalHours) ? Number(ap.digitalToolsIntervalHours) * 60 : 240);
      const intervalMs = Math.max(30, toolsMinutes) * 60 * 1000;
      const lastTime = ap.lastDigitalToolsPostedAt;
      const elapsed = lastTime ? (now - new Date(lastTime).getTime()) : Infinity;
      if (elapsed >= intervalMs) {
        const p = (tehran.hour >= 16 && tehran.hour <= 22) ? 9 : 6;
        candidates.push({
          category: 'tools',
          isDue: true,
          timeSinceDueMs: elapsed - intervalMs,
          goldenPriority: p,
          run: () => executeDigitalToolsAutoPost(1, ap.targetChannel)
        });
      }
    }

    // If candidates are ready, pick the single highest priority / longest waiting one
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        if (ap.smartGoldenHours !== false && tehran.isGoldenHour && a.goldenPriority !== b.goldenPriority) {
          return b.goldenPriority - a.goldenPriority;
        }
        return b.timeSinceDueMs - a.timeSinceDueMs;
      });
      await candidates[0].run();
    }
  }

  // ==========================================
  // 2. CHECK CHANNEL 2 SCHEDULE (Independent)
  // ==========================================
  const ch2Allowance = await evaluateChannelPostingAllowance(2);
  if (ch2Allowance.allowed) {
    const ap2 = db.settings.autoPost.channel2;
    const tehran = getTehranTimeInfo();

    interface PostCandidate2 {
      category: string;
      timeSinceDueMs: number;
      priority: number;
      run: () => Promise<boolean>;
    }
    const candidates2: PostCandidate2[] = [];

    // 1. Fun & General News for Channel 2 (Primary role for Channel 2)
    if (ap2.funNewsEnabled !== false && (ap2.funNewsCount || 0) > 0) {
      const funMinutes2 = Number(ap2.funNewsIntervalMinutes) || (Number(ap2.funNewsIntervalHours) ? Number(ap2.funNewsIntervalHours) * 60 : 120);
      const intervalMs2 = Math.max(30, funMinutes2) * 60 * 1000;
      const lastTime2 = ap2.lastFunNewsPostedAt;
      const elapsed2 = lastTime2 ? (now - new Date(lastTime2).getTime()) : Infinity;
      if (elapsed2 >= intervalMs2) {
        candidates2.push({
          category: 'fun',
          timeSinceDueMs: elapsed2 - intervalMs2,
          priority: 10,
          run: () => executeFunNewsAutoPost(2, ap2.targetChannel)
        });
      }
    }

    // 2. Configs for Channel 2
    if (ap2.configsEnabled === true && ((ap2.configCount || 0) > 0 || (ap2.proxyCount || 0) > 0)) {
      const configMinutes2 = Number(ap2.configIntervalMinutes) || (Number(ap2.configIntervalHours) ? Number(ap2.configIntervalHours) * 60 : 240);
      const intervalMs2 = Math.max(30, configMinutes2) * 60 * 1000;
      const lastTime2 = ap2.lastConfigsPostedAt;
      const elapsed2 = lastTime2 ? (now - new Date(lastTime2).getTime()) : Infinity;
      if (elapsed2 >= intervalMs2) {
        candidates2.push({
          category: 'configs',
          timeSinceDueMs: elapsed2 - intervalMs2,
          priority: 5,
          run: () => executeConfigsAutoPost(2, ap2.targetChannel)
        });
      }
    }

    // 3. Tech News for Channel 2
    if (ap2.techNewsEnabled === true && (ap2.techNewsCount || 0) > 0) {
      const newsMinutes2 = Number(ap2.techNewsIntervalMinutes) || (Number(ap2.techNewsIntervalHours) ? Number(ap2.techNewsIntervalHours) * 60 : 240);
      const intervalMs2 = Math.max(30, newsMinutes2) * 60 * 1000;
      const lastTime2 = ap2.lastTechNewsPostedAt;
      const elapsed2 = lastTime2 ? (now - new Date(lastTime2).getTime()) : Infinity;
      if (elapsed2 >= intervalMs2) {
        candidates2.push({
          category: 'news',
          timeSinceDueMs: elapsed2 - intervalMs2,
          priority: 4,
          run: () => executeTechNewsAutoPost(2, ap2.targetChannel)
        });
      }
    }

    // 4. Tech Tricks for Channel 2
    if (ap2.techTricksEnabled === true && (ap2.techTricksCount || 0) > 0) {
      const tricksMinutes2 = Number(ap2.techTricksIntervalMinutes) || (Number(ap2.techTricksIntervalHours) ? Number(ap2.techTricksIntervalHours) * 60 : 360);
      const intervalMs2 = Math.max(30, tricksMinutes2) * 60 * 1000;
      const lastTime2 = ap2.lastTechTricksPostedAt;
      const elapsed2 = lastTime2 ? (now - new Date(lastTime2).getTime()) : Infinity;
      if (elapsed2 >= intervalMs2) {
        candidates2.push({
          category: 'tricks',
          timeSinceDueMs: elapsed2 - intervalMs2,
          priority: 4,
          run: () => executeTechTricksAutoPost(2, ap2.targetChannel)
        });
      }
    }

    // 5. AI Prompts for Channel 2
    if (ap2.aiPromptsEnabled === true && (ap2.aiPromptsCount || 0) > 0) {
      const promptsMinutes2 = Number(ap2.aiPromptsIntervalMinutes) || (Number(ap2.aiPromptsIntervalHours) ? Number(ap2.aiPromptsIntervalHours) * 60 : 360);
      const intervalMs2 = Math.max(30, promptsMinutes2) * 60 * 1000;
      const lastTime2 = ap2.lastAiPromptsPostedAt;
      const elapsed2 = lastTime2 ? (now - new Date(lastTime2).getTime()) : Infinity;
      if (elapsed2 >= intervalMs2) {
        candidates2.push({
          category: 'prompts',
          timeSinceDueMs: elapsed2 - intervalMs2,
          priority: 4,
          run: () => executeAiPromptsAutoPost(2, ap2.targetChannel)
        });
      }
    }

    // 6. Digital Tools & AI Toolbox for Channel 2
    if (ap2.digitalToolsEnabled === true && (ap2.digitalToolsCount || 0) > 0) {
      const toolsMinutes2 = Number(ap2.digitalToolsIntervalMinutes) || (Number(ap2.digitalToolsIntervalHours) ? Number(ap2.digitalToolsIntervalHours) * 60 : 360);
      const intervalMs2 = Math.max(30, toolsMinutes2) * 60 * 1000;
      const lastTime2 = ap2.lastDigitalToolsPostedAt;
      const elapsed2 = lastTime2 ? (now - new Date(lastTime2).getTime()) : Infinity;
      if (elapsed2 >= intervalMs2) {
        candidates2.push({
          category: 'tools',
          timeSinceDueMs: elapsed2 - intervalMs2,
          priority: 5,
          run: () => executeDigitalToolsAutoPost(2, ap2.targetChannel)
        });
      }
    }

    if (candidates2.length > 0) {
      candidates2.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority;
        return b.timeSinceDueMs - a.timeSinceDueMs;
      });
      await candidates2[0].run();
    }
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
 * Helper to get the inline glass button for a given channel (Channel 1 or Channel 2).
 * Each channel has completely independent button text, URL, and toggle settings.
 */
function getChannelInlineButton(channelNum: 1 | 2, targetChannelHandle?: string): { text: string; url: string } | null {
  const isCh2 = channelNum === 2;
  const ap = db.settings?.autoPost;
  const c2 = ap?.channel2;

  if (isCh2) {
    // --- Channel 2 Inline Glass Button ---
    if (c2?.inlineButtonEnabled === false) {
      return null;
    }

    // 1. Explicit custom text and URL for Channel 2
    if (c2?.inlineButtonText && c2.inlineButtonText.trim() && c2?.inlineButtonUrl && c2.inlineButtonUrl.trim()) {
      let url = c2.inlineButtonUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        const cleanHandle = url.replace(/^@/, '');
        url = `https://t.me/${cleanHandle}`;
      }
      return { text: c2.inlineButtonText.trim(), url };
    }

    // 2. If Channel 2 has custom adText that is a valid link or handle
    if (c2?.adText && c2.adText.trim()) {
      const text = c2.adText.trim();
      if (text.startsWith('http://') || text.startsWith('https://')) {
        const label = c2.inlineButtonText?.trim() || '📢 مشاهده کانال / لینک';
        return { text: label, url: text };
      }
      const match = text.match(/@[a-zA-Z0-9_]+/);
      if (match) {
        const handle = match[0].replace('@', '');
        const label = c2.inlineButtonText?.trim() || `📢 عضویت در کانال: @${handle}`;
        return { text: label, url: `https://t.me/${handle}` };
      }
    }

    // 3. Fallback for Channel 2: Use Channel 2's own targetChannel! (NEVER Channel 1)
    const ch2Target = targetChannelHandle || c2?.targetChannel;
    if (ch2Target) {
      const clean = ch2Target.replace(/^@/, '').trim();
      if (clean) {
        const label = c2?.inlineButtonText?.trim() || `📢 عضویت در کانال: @${clean}`;
        return { text: label, url: `https://t.me/${clean}` };
      }
    }

    // Never return Channel 1 sponsor or force join for Channel 2
    return null;
  }

  // --- Channel 1 Inline Glass Button ---
  if (ap?.inlineButtonEnabled === false) {
    return null;
  }

  // 1. Explicit custom text and URL for Channel 1
  if (ap?.inlineButtonText && ap.inlineButtonText.trim() && ap?.inlineButtonUrl && ap.inlineButtonUrl.trim()) {
    let url = ap.inlineButtonUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const cleanHandle = url.replace(/^@/, '');
      url = `https://t.me/${cleanHandle}`;
    }
    return { text: ap.inlineButtonText.trim(), url };
  }

  // 2. Check if explicit adText is configured in autoPost
  if (ap?.adText && ap.adText.trim()) {
    const text = ap.adText.trim();
    if (text.includes('@')) {
      const handleMatch = text.match(/@[a-zA-Z0-9_]+/);
      const handle = handleMatch ? handleMatch[0].replace('@', '') : '';
      if (handle) {
        const label = ap.inlineButtonText?.trim() || `📢 عضویت در کانال: ${text}`;
        return { text: label, url: `https://t.me/${handle}` };
      }
    } else if (text.startsWith('http://') || text.startsWith('https://')) {
      const label = ap.inlineButtonText?.trim() || `📢 مشاهده لینک اسپانسر`;
      return { text: label, url: text };
    }
  }

  // 3. Check if there are active force join channels for Channel 1
  const activeFj = db.forceJoinChannels?.find(c => c.enabled && c.username);
  if (activeFj) {
    const cleanUsername = activeFj.username.replace(/[^a-zA-Z0-9_]/g, '');
    const url = activeFj.inviteLink && (activeFj.inviteLink.startsWith('http://') || activeFj.inviteLink.startsWith('https://'))
      ? activeFj.inviteLink
      : (cleanUsername ? `https://t.me/${cleanUsername}` : '');
    const label = ap?.inlineButtonText?.trim() || `📢 کانال رسمی ما: ${activeFj.title || 'کانال رسمی'}`;
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      return { text: label, url: url.trim() };
    }
  }

  // 4. Fallback to Channel 1's target channel
  const ch1Target = targetChannelHandle || ap?.targetChannel;
  if (ch1Target) {
    const clean = ch1Target.replace(/^@/, '').trim();
    if (clean) {
      const label = ap?.inlineButtonText?.trim() || `📢 کانال رسمی ما: @${clean}`;
      return { text: label, url: `https://t.me/${clean}` };
    }
  }

  // 5. Fallback to global Branding if it points to a channel or link
  if (db.settings.branding && db.settings.branding.trim()) {
    const branding = db.settings.branding.trim();
    if (branding.includes('@')) {
      const handleMatch = branding.match(/@[a-zA-Z0-9_]+/);
      const handle = handleMatch ? handleMatch[0].replace('@', '') : '';
      if (handle) {
        const label = ap?.inlineButtonText?.trim() || `📢 کانال رسمی: @${handle}`;
        return { text: label, url: `https://t.me/${handle}` };
      }
    } else if (branding.startsWith('http://') || branding.startsWith('https://')) {
      return { text: ap?.inlineButtonText?.trim() || `📢 کانال رسمی و پشتیبانی`, url: branding };
    } else {
      const cleanHandle = branding.replace(/[^a-zA-Z0-9_]/g, '');
      if (cleanHandle) {
        return { text: ap?.inlineButtonText?.trim() || `📢 کانال رسمی: @${cleanHandle}`, url: `https://t.me/${cleanHandle}` };
      }
    }
  }

  return null;
}

/**
 * Backward-compatible helper for existing code
 */
function getSponsorChannelInlineButton(channelNum: 1 | 2 = 1, targetChannelHandle?: string): { text: string; url: string } | null {
  return getChannelInlineButton(channelNum, targetChannelHandle);
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
 * Sends request to Telegram Bot API with automatic error recovery for formatting and keyboard errors
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
    const errorDesc = String(data.description || '');

    // Fallback 1: If Markdown/HTML parsing failed (e.g. unescaped character), retry without parse_mode
    if (!isFormData && typeof body === 'object' && (body as any).parse_mode && (
      errorDesc.includes("can't parse entities") || 
      errorDesc.includes("character '") || 
      errorDesc.includes("tag")
    )) {
      try {
        const cleanBody = { ...(body as any) };
        delete cleanBody.parse_mode;
        const retryRes = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cleanBody),
          signal: AbortSignal.timeout(15000)
        });
        const retryData = await retryRes.json();
        if (retryData.ok) return retryData.result;
      } catch (_) {}
    }

    // Fallback 2: If reply_markup was rejected (e.g. invalid URL, unsupported button type or style property)
    if (!isFormData && typeof body === 'object' && (body as any).reply_markup) {
      const isMarkupError = 
        errorDesc.includes("reply keyboard") || 
        errorDesc.includes("BUTTON_") || 
        errorDesc.includes("URL") ||
        errorDesc.includes("can't parse") ||
        errorDesc.includes("style") ||
        errorDesc.includes("markup");

      if (isMarkupError) {
        console.warn(`[Telegram API] Markup error on ${method}: ${errorDesc}. Attempting intelligent repair...`);
        // Step 2a: Try sanitizing keyboard (remove style attribute if rejected, validate URLs)
        try {
          const sanitizedBody = JSON.parse(JSON.stringify(body));
          if (sanitizedBody.reply_markup?.keyboard) {
            sanitizedBody.reply_markup.keyboard = sanitizedBody.reply_markup.keyboard.map((row: any[]) =>
              row.map((btn: any) => {
                const cBtn = { ...btn };
                delete cBtn.style; // Remove style in case Telegram client/server rejects custom style
                return cBtn;
              })
            );
          }
          if (sanitizedBody.reply_markup?.inline_keyboard) {
            sanitizedBody.reply_markup.inline_keyboard = sanitizedBody.reply_markup.inline_keyboard.map((row: any[]) =>
              row.filter((btn: any) => {
                if (btn.url && !btn.url.startsWith('http://') && !btn.url.startsWith('https://')) return false;
                if (btn.web_app && (!btn.web_app.url || !btn.web_app.url.startsWith('https://'))) return false;
                return true;
              }).map((btn: any) => {
                const cBtn = { ...btn };
                delete cBtn.style;
                return cBtn;
              })
            ).filter((row: any[]) => row.length > 0);
          }

          const retryRes1 = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sanitizedBody),
            signal: AbortSignal.timeout(15000)
          });
          const retryData1 = await retryRes1.json();
          if (retryData1.ok) return retryData1.result;
        } catch (_) {}

        // Step 2b: Fallback to removing reply_markup completely so message delivery never fails
        try {
          const cleanBody = { ...(body as any) };
          delete cleanBody.reply_markup;
          const retryRes2 = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanBody),
            signal: AbortSignal.timeout(15000)
          });
          const retryData2 = await retryRes2.json();
          if (retryData2.ok) return retryData2.result;
        } catch (_) {}
      }
    }

    console.error(`[Telegram API Error] Method: ${method} - Description: ${errorDesc}`);
    throw new Error(data.description || 'Unknown Telegram Error');
  }
  return data.result;
}

/**
 * Checks if a user is the configured admin (supports numeric chat ID and @username, single or comma-separated)
 */
function checkIsAdmin(userId?: string | number, username?: string | null): boolean {
  if (!db.settings.adminId) return false;
  const adminSetting = String(db.settings.adminId).trim();
  if (!adminSetting) return false;
  
  const adminTokens = adminSetting
    .split(/[,;\s\n]+/)
    .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);

  let cleanUser = username ? username.replace(/^@/, '').toLowerCase().trim() : '';
  const strUserId = userId !== undefined ? String(userId).trim() : '';

  // Auto-resolve username from database if not explicitly passed
  if (!cleanUser && strUserId) {
    const existing = db.users.find(u => String(u.chatId) === strUserId);
    if (existing?.username) {
      cleanUser = existing.username.replace(/^@/, '').toLowerCase().trim();
    }
  }

  for (const token of adminTokens) {
    if (strUserId && token === strUserId) return true;
    const cleanToken = token.replace(/^@/, '').toLowerCase().trim();
    if (cleanUser && cleanToken && cleanUser === cleanToken) return true;
  }
  
  return false;
}

/**
 * Automatically sets the native Telegram Chat Menu button to launch the Web App (TWA)
 */
async function setupBotMenuButton(token?: string, req?: express.Request): Promise<{ success: boolean; message: string }> {
  const botToken = token || db.settings.botToken;
  if (!botToken) {
    return { success: false, message: 'توکن ربات تنظیم نشده است.' };
  }
  const appUrl = getPublicAppUrl(req);
  if (!appUrl) {
    return { success: false, message: 'آدرس دامنه پنل مشخص نیست.' };
  }

  try {
    // Set clean standard command menu (type: 'commands') for all users
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'commands'
        }
      }),
      signal: AbortSignal.timeout(10000)
    });
    const data = await res.json();
    
    if (data.ok) {
      addLog('success', 'دکمه منوی ربات به منوی استاندارد دستورات تلگرام تغییر یافت.');
      return { success: true, message: 'منوی ربات به منوی استاندارد دستورات تغییر یافت ✅' };
    } else {
      return { success: false, message: data.description || 'خطا در ثبت دکمه منو در تلگرام.' };
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'خطا در ارتباط با سرور تلگرام' };
  }
}

/**
 * Registers default bot commands with Telegram so the native "Menu" button appears next to the chat bar
 */
async function setBotCommands(token: string) {
  try {
    // 1. Default commands for all users
    await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: '🚀 شروع کار ربات، رفرش و منوی اصلی' },
          { command: 'v2ray', description: '⚡️ دریافت کانفیگ‌های فعال ویتوری' },
          { command: 'proxy', description: '🔌 دریافت پروکسی‌های جدید تلگرام' },
          { command: 'help', description: 'ℹ️ راهنمای گام به گام اتصال' }
        ],
        scope: { type: 'default' }
      }),
      signal: AbortSignal.timeout(10000)
    });

    // 2. Admin specific commands if adminId is configured
    if (db.settings.adminId) {
      const adminIdNum = Number(String(db.settings.adminId).replace(/[^0-9]/g, ''));
      if (adminIdNum) {
        await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commands: [
              { command: 'start', description: '🔄 شروع مجدد، رفرش و وضعیت ربات' },
              { command: 'admin', description: '⚙️ پنل مدیریت تلگرامی و تنظیمات' },
              { command: 'panel', description: '🌐 باز کردن وب‌اپلیکیشن مدیریت' },
              { command: 'scrape', description: '🔄 استخراج و اسکن فوری کانفیگ‌ها' },
              { command: 'test', description: '🌐 تست اتصال پورت‌ها و پینگ نت' },
              { command: 'cron', description: '⏰ زمان‌بندی و تنظیمات ارسال خودکار' },
              { command: 'backup', description: '📦 دانلود فوری فایل بکاپ دیتابیس' },
              { command: 'restore', description: '📥 بازگردانی دیتابیس از بکاپ' },
              { command: 'status', description: '📊 مشاهده آمار و وضعیت سرور' },
              { command: 'help', description: 'ℹ️ راهنمای جامع سیستم' }
            ],
            scope: { type: 'chat', chat_id: adminIdNum }
          }),
          signal: AbortSignal.timeout(10000)
        });
      }
    }

    addLog('success', 'منوی دستورات پیش‌فرض و دسترسی‌های مدیریت در تلگرام با موفقیت ثبت گردید.');
  } catch (err: any) {
    console.error('Error setting bot commands:', err.message || err);
  }
}

/**
 * Generates the clean standard custom keyboard (ReplyKeyboardMarkup) to be displayed in the bar below the chat.
 * Removed web_app buttons to eliminate glass/ring backgrounds and ensure smooth opening/closing.
 */
function getReplyKeyboard(userId: string | number, username?: string | null) {
  const isAdmin = checkIsAdmin(userId, username);

  const keyboard: any[][] = [
    [
      { text: '🔥 دریافت یکجای ۵۰ کانفیگ ⭐', style: 'success' },
      { text: '⚡️ دریافت یکجای ۱۵ کانفیگ', style: 'success' }
    ],
    [
      { text: '⚡ دریافت کانفیگ ویتوری 📥', style: 'primary' }
    ],
    [
      { text: '🌀 فایل .NPVT', style: 'success' },
      { text: '🔑 فایل .OVPN', style: 'success' },
      { text: '📄 فایل .TXT', style: 'success' }
    ],
    [
      { text: '🚀 دریافت پروکسی تلگرام 🛰️', style: 'primary' },
      { text: '📊 وضعیت شبکه و پینگ نت 🟢', style: 'primary' }
    ],
    [
      { text: '💡 ترفندها 📱', style: 'primary' },
      { text: '📰 اخبار روز تکنولوژی 🌐', style: 'primary' }
    ],
    [
      { text: '🎨 پرامپت‌های طلایی هوش مصنوعی ✨', style: 'primary' }
    ],
    [
      { text: 'ℹ️ راهنمای اتصال گام به گام 📚', style: 'primary' },
      { text: '❌ بستن منو', style: 'danger' }
    ]
  ];

  if (isAdmin) {
    keyboard.push([
      { text: '🔴 ورود به پنل مدیریت در تلگرام ⚙️', style: 'danger' },
      { text: '⚡ استخراج سریع کانفیگ‌ها 🔄', style: 'success' }
    ]);
  }

  return {
    keyboard,
    resize_keyboard: true,
    is_persistent: false, // Allows users to easily toggle/minimize or hide the keyboard in Telegram
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

    // Auto-clear stuck admin states if clicking any menu navigation or standard button
    if (
      lowerMsg.startsWith('/') ||
      cleanMsg === 'لغو' ||
      cleanMsg === 'انصراف' ||
      cleanMsg.includes('شروع') ||
      cleanMsg.includes('استارت') ||
      cleanMsg.includes('منو') ||
      cleanMsg.includes('بستن') ||
      cleanMsg.includes('کانفیگ') ||
      cleanMsg.includes('پروکسی') ||
      cleanMsg.includes('ترفند') ||
      cleanMsg.includes('اخبار') ||
      cleanMsg.includes('پرامپت') ||
      cleanMsg.includes('هوش مصنوعی') ||
      cleanMsg.includes('راهنما') ||
      cleanMsg.includes('وضعیت') ||
      cleanMsg.includes('مدیریت') ||
      cleanMsg.includes('استخراج') ||
      cleanMsg.includes('npvt') ||
      cleanMsg.includes('ovpn') ||
      cleanMsg.includes('txt')
    ) {
      delete adminStates[chatId];
    }

    if (
      lowerMsg.startsWith('/start') ||
      cleanMsg === 'شروع' ||
      cleanMsg === 'شروع مجدد' ||
      cleanMsg === 'بروزرسانی' ||
      cleanMsg === 'منوی اصلی' ||
      cleanMsg === 'شروع دوباره' ||
      cleanMsg === 'رفرش' ||
      cleanMsg.includes('بروزرسانی و استارت')
    ) {
      messageText = '/start';
      delete adminStates[chatId];
      if (userId) delete joinChecksCache[userId];
    } else if (cleanMsg.includes('بستن') || cleanMsg.includes('مخفی کردن') || lowerMsg === '/close' || lowerMsg === '/hide' || lowerMsg === '/hide_menu') {
      callbackData = 'hide_reply_keyboard';
      messageText = '';
    } else if (cleanMsg.includes('باز کردن منو') || cleanMsg.includes('نمایش منو') || cleanMsg === 'منو' || lowerMsg === '/menu') {
      callbackData = 'open_reply_menu';
      messageText = '';
    } else if (cleanMsg.includes('۵۰') || cleanMsg.includes('50') || lowerMsg === '/50') {
      callbackData = 'v2ray_qty_50';
      messageText = '';
    } else if (cleanMsg.includes('۱۵') || cleanMsg.includes('15') || lowerMsg === '/15') {
      callbackData = 'v2ray_qty_15';
      messageText = '';
    } else if (cleanMsg.includes('ویتوری') || (cleanMsg.includes('دریافت کانفیگ') && !cleanMsg.includes('استخراج')) || lowerMsg.startsWith('/v2ray') || lowerMsg.startsWith('/config')) {
      callbackData = 'get_v2ray_configs';
      messageText = '';
    } else if (cleanMsg.toUpperCase().includes('NPVT') || lowerMsg.startsWith('/npvt')) {
      callbackData = 'get_file_npvt';
      messageText = '';
    } else if (cleanMsg.toUpperCase().includes('OVPN') || lowerMsg.startsWith('/ovpn')) {
      callbackData = 'get_file_ovpn';
      messageText = '';
    } else if (cleanMsg.toUpperCase().includes('TXT') || cleanMsg.includes('متنی') || lowerMsg.startsWith('/txt')) {
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
    } else if (cleanMsg.includes('ترفند') || lowerMsg.startsWith('/trick')) {
      callbackData = 'get_tech_tricks';
      messageText = '';
    } else if (cleanMsg.includes('اخبار') || lowerMsg.startsWith('/news')) {
      callbackData = 'get_tech_news';
      messageText = '';
    } else if (cleanMsg.includes('پرامپت') || cleanMsg.includes('هوش مصنوعی') || lowerMsg.startsWith('/prompt')) {
      callbackData = 'get_ai_prompts';
      messageText = '';
    } else if (cleanMsg.includes('استخراج') || lowerMsg.startsWith('/scrape')) {
      callbackData = 'admin_scrape_now';
      messageText = '/scrape';
      delete adminStates[chatId];
    } else if (cleanMsg.includes('مدیریت') || lowerMsg.startsWith('/admin')) {
      messageText = '/admin';
      callbackData = 'admin_menu';
      delete adminStates[chatId];
    } else if (lowerMsg.startsWith('/panel') || lowerMsg.startsWith('/webapp') || cleanMsg.includes('وب‌ویو') || cleanMsg.includes('وبویو') || cleanMsg.includes('پنل وب')) {
      messageText = '/panel';
      delete adminStates[chatId];
    }

    if (messageText.startsWith('/') || messageText === 'لغو' || messageText === '/cancel') {
      delete adminStates[chatId];
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

    const isAdmin = checkIsAdmin(userId, username);

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

      // Direct Cron Job / Auto-Post command
      if (messageText === '/cron' || messageText === '/autopost' || messageText === '/schedule' || messageText === 'ارسال خودکار' || messageText === 'کرون جاب') {
        await handleBotUpdate({ callback_query: { id: '', message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_autopost_menu' } });
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

        if (state.action === 'await_custom_cron_time') {
          const type = state.data?.type || 'configs'; // 'configs' | 'news' | 'tricks' | 'prompts'
          if (!messageText || messageText.trim() === '' || messageText.trim() === 'لغو' || messageText.trim() === 'انصراف') {
            delete adminStates[chatId];
            const backMenu = type === 'news' ? 'admin_ap_menu_news' : type === 'tricks' ? 'admin_ap_menu_tricks' : type === 'prompts' ? 'admin_ap_menu_prompts' : 'admin_ap_menu_configs';
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: '❌ عملیات لغو شد.',
              reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: backMenu }]] }
            });
            return;
          }

          const parsedMinutes = parseCustomIntervalText(messageText.trim());
          if (parsedMinutes <= 0) {
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: `⚠️ **فرمت وارد شده نامعتبر است!**\n\nلطفاً یک عدد به دقیقه یا ساعت وارد فرمایید.\n\n*مثال‌های معتبر:*\n• \`45 دقیقه\` یا \`45m\`\n• \`2 ساعت\` یا \`2h\`\n• \`90\` (به معنی ۹۰ دقیقه)\n• \`1.5 ساعت\`\n\nبرای انصراف کلمه **لغو** را بفرستید.`,
              parse_mode: 'Markdown'
            });
            return;
          }

          delete adminStates[chatId];
          let typeTitle = 'کانفیگ و پروکسی';
          let returnCallback = 'admin_ap_menu_configs';

          if (type === 'news') {
            typeTitle = 'اخبار تکنولوژی';
            returnCallback = 'admin_ap_menu_news';
            db.settings.autoPost.techNewsIntervalMinutes = parsedMinutes;
            db.settings.autoPost.techNewsIntervalHours = Math.max(1, Math.round(parsedMinutes / 60));
          } else if (type === 'tricks') {
            typeTitle = 'ترفندها و رازها';
            returnCallback = 'admin_ap_menu_tricks';
            db.settings.autoPost.techTricksIntervalMinutes = parsedMinutes;
            db.settings.autoPost.techTricksIntervalHours = Math.max(1, Math.round(parsedMinutes / 60));
          } else if (type === 'prompts') {
            typeTitle = 'پرامپت‌های هوش مصنوعی';
            returnCallback = 'admin_ap_menu_prompts';
            db.settings.autoPost.aiPromptsIntervalMinutes = parsedMinutes;
            db.settings.autoPost.aiPromptsIntervalHours = Math.max(1, Math.round(parsedMinutes / 60));
          } else {
            typeTitle = 'کانفیگ و پروکسی';
            returnCallback = 'admin_ap_menu_configs';
            db.settings.autoPost.configIntervalMinutes = parsedMinutes;
            db.settings.autoPost.configIntervalHours = Math.max(1, Math.round(parsedMinutes / 60));
            db.settings.autoPost.postIntervalHours = Math.max(1, Math.round(parsedMinutes / 60));
          }

          saveDatabase();
          setupAutoPostInterval();

          const formattedStr = formatIntervalText(parsedMinutes);
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ **زمان‌بندی کرون جاب با موفقیت تنظیم گردید!**\n\n🎯 بخش: **${typeTitle}**\n⏱ بازه زمانی جدید: **${formattedStr}**\n\nربات از این پس به صورت خودکار و بدون رگباری شدن، طبق این زمان‌بندی مطالب را به کانال ارسال خواهد نمود.`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: `⚙️ بازگشت به تنظیمات ${typeTitle}`, callback_data: returnCallback }],
                [{ text: '📋 منوی اصلی کرون جاب', callback_data: 'admin_autopost_menu' }]
              ]
            }
          });
          return;
        }

        if (state.action === 'await_custom_antiflood') {
          if (!messageText || messageText.trim() === '' || messageText.trim() === 'لغو' || messageText.trim() === 'انصراف') {
            delete adminStates[chatId];
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: '❌ عملیات لغو شد.',
              reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_autopost_menu' }]] }
            });
            return;
          }

          const parsedMinutes = parseCustomIntervalText(messageText.trim());
          if (parsedMinutes <= 0 || parsedMinutes > 120) {
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: `⚠️ **مقدار وارد شده نامعتبر است!**\n\nلطفاً یک عدد بین ۱ تا ۱۲۰ دقیقه وارد فرمایید (مثلاً \`3 دقیقه\` یا \`5\`).\n\nبرای انصراف کلمه **لغو** را بفرستید.`,
              parse_mode: 'Markdown'
            });
            return;
          }

          delete adminStates[chatId];
          db.settings.autoPost.antiFloodDelayMinutes = parsedMinutes;
          saveDatabase();
          setupAutoPostInterval();

          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ **فاصله ایمن ضد رگباری با موفقیت به ${parsedMinutes} دقیقه تغییر یافت.**\n\nدر صورتی که چند تسک کرون همزمان آماده ارسال باشند، حداقل ${parsedMinutes} دقیقه بین هر پست فاصله خواهد افتاد تا کانال اسپم نشود.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به تنظیمات کرون جاب', callback_data: 'admin_autopost_menu' }]] }
          });
          return;
        }
      }

      // 2. Admin Menus & Direct Command Handlers
      if (messageText === '/scrape' || messageText === '🔄 استخراج سریع کانفیگ‌ها ⚡' || callbackData === 'admin_scrape_now') {
        if (callbackQueryId) await answerCallback('استخراج و اسکن منابع... 🔄');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '⏳ **در حال استخراج خودکار و اسکن تمامی کانال‌ها و سابسکریپشن‌ها...**\nاین فرآیند ممکن است چند ثانیه زمان ببرد.',
          parse_mode: 'Markdown'
        });
        const count = await triggerBulkScrape();
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✅ **استخراج منابع با موفقیت انجام شد!**\n\n🟢 کانفیگ‌ها و پروکسی‌های جدید استخراج و ذخیره شدند: **${count} عدد**\n\nتست خودکار پینگ پورت‌ها در پس‌زمینه آغاز گردید.`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 مشاهده آمار سیستم', callback_data: 'admin_stats' }],
              [{ text: '⚙️ پنل مدیریت', callback_data: 'admin_menu' }]
            ]
          }
        });
        return;
      }

      if (messageText === '/test' || callbackData === 'admin_test_configs') {
        if (callbackQueryId) await answerCallback('شروع تست پینگ... 🌐');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '⏳ **تست اتصال و پینگ پورت‌های کانفیگ‌ها در پس‌زمینه آغاز گردید.**\nنتایج به صورت زنده در دیتابیس بروزرسانی می‌شود.',
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به پنل مدیریت', callback_data: 'admin_menu' }]] }
        });
        const batchIds = db.configs.slice(0, 100).map(c => c.id);
        if (batchIds.length > 0) {
          testConfigsBatch(batchIds);
        }
        return;
      }

      if (messageText === '/status' || messageText === '/stats' || callbackData === 'admin_stats') {
        if (callbackQueryId) await answerCallback('آمار سیستم 📊');
        const workingConfigs = db.configs.filter(c => c.status === 'working').length;
        const workingProxies = (db.proxies || []).filter(p => p.status === 'working').length;
        const totalUsers = db.users.length;
        const activeSources = db.sources.filter(s => s.enabled).length;
        const ch1 = db.settings.autoPost?.targetChannel || 'تنظیم نشده';
        const ch2 = db.settings.autoPost?.channel2?.targetChannel || 'تنظیم نشده';
        const funCount = (db.funNewsItems || []).length;
        const unpostedFunCh2 = (db.funNewsItems || []).filter(i => !i.postedToChannel2).length;

        const statsText = `📊 **آمار جامع وضعیت ربات و سرور:**\n\n` +
          `🟢 **کانفیگ‌های فعال V2Ray:** ${workingConfigs} از ${db.configs.length}\n` +
          `🔌 **پروکسی‌های فعال تلگرام:** ${workingProxies} از ${(db.proxies || []).length}\n` +
          `👥 **تعداد کل کاربران ربات:** ${totalUsers} نفر\n` +
          `🌐 **منابع استخراج فعال:** ${activeSources} از ${db.sources.length}\n` +
          `🎭 **مطالب فان و اخبار در آرشیو:** ${funCount} عدد (${unpostedFunCh2} منتشرنشده در کانال ۲)\n` +
          `📢 **کانال اصلی ۱:** \`${ch1}\`\n` +
          `🎭 **کانال دوم:** \`${ch2}\`\n` +
          `⚡ **وضعیت سرور:** آنلاین و در حال کار`;

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: statsText,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 استخراج و اسکن منابع', callback_data: 'admin_scrape_now' }],
              [{ text: '⚙️ پنل مدیریت', callback_data: 'admin_menu' }]
            ]
          }
        });
        return;
      }

      if (messageText === '/panel' || callbackData === 'admin_webapp') {
        if (callbackQueryId) await answerCallback('پنل وب‌ویو 🌐');
        const appUrl = getPublicAppUrl();
        const isHttps = appUrl.startsWith('https://');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `🌐 **پنل تحت وب و وب‌اپلیکیشن مدیریت (Telegram WebApp)**\n\n` +
            `👑 **مدیر گرامی**، برای باز کردن و مدیریت کلیه تنظیمات، آمار، استخراج و تست، روی دکمه زیر کلیک فرمایید:\n\n` +
            `🔗 **آدرس مستقیم پنل:** \`${appUrl}\``,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              isHttps ? [{ text: '🌐 باز کردن وب‌ویو پنل مدیریت (Web App) 🚀', web_app: { url: appUrl } }] : [],
              [{ text: '🔗 باز کردن در مرورگر اینترنت 🌍', url: appUrl }],
              [{ text: '⚙️ منوی مدیریت در تلگرام', callback_data: 'admin_menu' }]
            ].filter(row => row.length > 0)
          }
        });
        return;
      }

      if (messageText === '/admin' || callbackData === 'admin_menu') {
        if (callbackQueryId) await answerCallback('پنل مدیریت ⚙️');
        
        const appUrl = getPublicAppUrl();
        const isHttps = appUrl.startsWith('https://');
        const welcome = `⚙️ **پنل فوق‌پیشرفته مدیریت ربات** ⚙️\n\n` +
          `👑 **مدیر گرامی، به مرکز کنترل خوش آمدید.**\n` +
          `برای استفاده از رابط کاربری گرافیکی، دکمه **«🌐 باز کردن وب‌ویو پنل مدیریت»** را بزنید یا از گزینه‌های تلگرامی زیر استفاده کنید:\n\n` +
          `🔗 **آدرس پنل تحت وب:** \`${appUrl}\``;
        
        const keyboard = {
          inline_keyboard: [
            isHttps ? [
              { text: `🌐 باز کردن وب‌ویو پنل مدیریت (Web App) 🚀`, web_app: { url: appUrl } }
            ] : [],
            [
              { text: `🔗 باز کردن پنل در مرورگر خارجی 🌍`, url: appUrl }
            ],
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
              { text: `⏰ زمان‌بندی و کرون جاب (Cron Job)`, callback_data: 'admin_autopost_menu', style: 'primary' }
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

        keyboard.inline_keyboard = keyboard.inline_keyboard.filter(row => row.length > 0);

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

      // --- Auto Post / Cron Job Master Menu ---
      if (callbackData === 'admin_autopost_menu') {
        await answerCallback('زمان‌بندی و کرون جاب...');
        const ap = db.settings.autoPost;
        const configMin = ap.configIntervalMinutes || (ap.configIntervalHours ? ap.configIntervalHours * 60 : (ap.postIntervalHours ? ap.postIntervalHours * 60 : 240));
        const newsMin = ap.techNewsIntervalMinutes || (ap.techNewsIntervalHours ? ap.techNewsIntervalHours * 60 : 240);
        const tricksMin = ap.techTricksIntervalMinutes || (ap.techTricksIntervalHours ? ap.techTricksIntervalHours * 60 : 360);
        const promptsMin = ap.aiPromptsIntervalMinutes || (ap.aiPromptsIntervalHours ? ap.aiPromptsIntervalHours * 60 : 360);
        const afMin = ap.antiFloodDelayMinutes || 3;

        let msg = `⏰ **سیستم پیشرفته کرون جاب و ارسال خودکار (Auto-Post & Cron)**\n\n`;
        msg += `🎯 **وضعیت کل سیستم:** ${ap.enabled ? '🟢 فعال و اتوماتیک' : '🔴 خاموش'}\n`;
        msg += `📢 **کانال هدف:** \`${ap.targetChannel || 'تنظیم نشده'}\`\n`;
        msg += `🛡 **فاصله ایمن ضد رگباری:** **${afMin} دقیقه**\n`;
        msg += `🔇 **ارسال بدون صدا (Silent):** ${ap.silentMode ? '🟢 فعال' : '🔴 غیرفعال'}\n\n`;

        msg += `➖➖➖➖➖➖➖➖➖➖\n`;
        msg += `⚡️ **کرون کانفیگ و پروکسی:**\n`;
        msg += `• وضعیت: ${ap.configsEnabled !== false ? '🟢 روشن' : '🔴 خاموش'}\n`;
        msg += `• زمان‌بندی: **هر ${formatIntervalText(configMin)}**\n`;
        msg += `• محتوا: **${ap.configCount} کانفیگ** + **${ap.proxyCount} پروکسی**\n`;
        msg += `• آخرین ارسال: ${ap.lastConfigsPostedAt || ap.lastPostedAt ? new Date(ap.lastConfigsPostedAt || ap.lastPostedAt!).toLocaleString('fa-IR') : 'ثبت نشده'}\n\n`;

        msg += `📰 **کرون اخبار روز تکنولوژی:**\n`;
        msg += `• وضعیت: ${ap.techNewsEnabled !== false ? '🟢 روشن' : '🔴 خاموش'}\n`;
        msg += `• زمان‌بندی: **هر ${formatIntervalText(newsMin)}**\n`;
        msg += `• محتوا: **${ap.techNewsCount || 0} خبر فناوری**\n`;
        msg += `• آخرین ارسال: ${ap.lastTechNewsPostedAt ? new Date(ap.lastTechNewsPostedAt).toLocaleString('fa-IR') : 'ثبت نشده'}\n\n`;

        msg += `💡 **کرون ترفندها و رازهای موبایل:**\n`;
        msg += `• وضعیت: ${ap.techTricksEnabled !== false ? '🟢 روشن' : '🔴 خاموش'}\n`;
        msg += `• زمان‌بندی: **هر ${formatIntervalText(tricksMin)}**\n`;
        msg += `• محتوا: **${ap.techTricksCount || 0} ترفند آموزشی**\n`;
        msg += `• آخرین ارسال: ${ap.lastTechTricksPostedAt ? new Date(ap.lastTechTricksPostedAt).toLocaleString('fa-IR') : 'ثبت نشده'}\n\n`;

        msg += `🎨 **کرون پرامپت‌های طلایی هوش مصنوعی:**\n`;
        msg += `• وضعیت: ${ap.aiPromptsEnabled !== false ? '🟢 روشن' : '🔴 خاموش'}\n`;
        msg += `• زمان‌بندی: **هر ${formatIntervalText(promptsMin)}**\n`;
        msg += `• محتوا: **${ap.aiPromptsCount || 1} پرامپت ترند (تصویری)**\n`;
        msg += `• آخرین ارسال: ${ap.lastAiPromptsPostedAt ? new Date(ap.lastAiPromptsPostedAt).toLocaleString('fa-IR') : 'ثبت نشده'}\n`;
        msg += `➖➖➖➖➖➖➖➖➖➖\n\n`;
        msg += `جهت تنظیم زمان‌بندی یا خاموش/روشن کردن هر بخش، روی دکمه‌های زیر کلیک فرمایید:`;

        const keyboard = [
          [
            { text: `${ap.enabled ? '🔴 خاموش کردن کل ارسال' : '🟢 روشن کردن کل ارسال'}`, callback_data: 'admin_ap_toggle' },
            { text: `${ap.silentMode ? '🔔 نوتیفیکیشن‌دار' : '🔇 ارسال بدون صدا'}`, callback_data: 'admin_ap_silent' }
          ],
          [
            { text: `⚡️ کرون کانفیگ (${ap.configsEnabled !== false ? '🟢' : '🔴'})`, callback_data: 'admin_ap_menu_configs' },
            { text: `📰 کرون اخبار (${ap.techNewsEnabled !== false ? '🟢' : '🔴'})`, callback_data: 'admin_ap_menu_news' }
          ],
          [
            { text: `💡 کرون ترفندها (${ap.techTricksEnabled !== false ? '🟢' : '🔴'})`, callback_data: 'admin_ap_menu_tricks' },
            { text: `🎨 کرون پرامپت‌ها (${ap.aiPromptsEnabled !== false ? '🟢' : '🔴'})`, callback_data: 'admin_ap_menu_prompts' }
          ],
          [
            { text: `🛡 فاصله ضد رگباری (${afMin} دقیقه)`, callback_data: 'admin_ap_antiflood_menu' },
            { text: `📢 کانال: ${ap.targetChannel || 'تنظیم نشده'}`, callback_data: 'admin_ap_channel' }
          ],
          [
            { text: `✍️ ویرایش متن سربرگ`, callback_data: 'admin_ap_edit_text' },
            { text: `📢 ویرایش تبلیغات اسپانسر`, callback_data: 'admin_ap_edit_ad' }
          ],
          [
            { text: `🔄 دریافت اخبار و ترفندهای تازه`, callback_data: 'admin_ap_refresh_tech' }
          ],
          [
            { text: `🚀 تست ارسال کانفیگ`, callback_data: 'admin_ap_trigger_c' },
            { text: `🚀 تست ارسال اخبار`, callback_data: 'admin_ap_trigger_n' }
          ],
          [
            { text: `🚀 تست ارسال ترفند`, callback_data: 'admin_ap_trigger_t' },
            { text: `🚀 تست ارسال پرامپت`, callback_data: 'admin_ap_trigger_p' }
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
        await answerCallback(`کل ارسال خودکار: ${db.settings.autoPost.enabled ? 'روشن' : 'خاموش'}`);
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

      // --- Submenu: Configs & Proxies Cron ---
      if (callbackData === 'admin_ap_menu_configs') {
        await answerCallback('کرون کانفیگ');
        const ap = db.settings.autoPost;
        const configMin = ap.configIntervalMinutes || (ap.configIntervalHours ? ap.configIntervalHours * 60 : (ap.postIntervalHours ? ap.postIntervalHours * 60 : 240));
        let msg = `⚡️ **تنظیمات کرون جاب کانفیگ و پروکسی (Configs & Proxies Cron)**\n\n`;
        msg += `• وضعیت: ${ap.configsEnabled !== false ? '🟢 روشن و فعال' : '🔴 خاموش'}\n`;
        msg += `• زمان‌بندی ارسال: **هر ${formatIntervalText(configMin)}**\n`;
        msg += `• تعداد کانفیگ در هر پست: **${ap.configCount} عدد**\n`;
        msg += `• تعداد پروکسی در هر پست: **${ap.proxyCount} عدد**\n`;
        msg += `• آخرین ارسال موفق: ${ap.lastConfigsPostedAt || ap.lastPostedAt ? new Date(ap.lastConfigsPostedAt || ap.lastPostedAt!).toLocaleString('fa-IR') : 'هنوز ارسالی ثبت نشده'}\n\n`;
        msg += `گزینه مورد نظر را جهت تغییر انتخاب فرمایید:`;

        const keyboard = [
          [
            { text: `${ap.configsEnabled !== false ? '🔴 خاموش کردن این کرون' : '🟢 روشن کردن این کرون'}`, callback_data: 'admin_ap_toggle_configs' }
          ],
          [
            { text: `⏱ تنظیم زمان‌بندی (${formatIntervalText(configMin)})`, callback_data: 'admin_ap_setint_menu_c' }
          ],
          [
            { text: `📦 تعداد کانفیگ: ${ap.configCount} عدد`, callback_data: 'admin_ap_conf_count' },
            { text: `🔌 تعداد پروکسی: ${ap.proxyCount} عدد`, callback_data: 'admin_ap_proxy_count' }
          ],
          [
            { text: `🚀 ارسال فوری تست به کانال`, callback_data: 'admin_ap_trigger_c' }
          ],
          [
            { text: '🔙 بازگشت به منوی کرون جاب', callback_data: 'admin_autopost_menu' }
          ]
        ];

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      if (callbackData === 'admin_ap_toggle_configs') {
        db.settings.autoPost.configsEnabled = db.settings.autoPost.configsEnabled === false ? true : false;
        saveDatabase();
        setupAutoPostInterval();
        await answerCallback(`کرون کانفیگ: ${db.settings.autoPost.configsEnabled ? 'روشن' : 'خاموش'}`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_ap_menu_configs' } });
        return;
      }

      // --- Submenu: Tech News Cron ---
      if (callbackData === 'admin_ap_menu_news') {
        await answerCallback('کرون اخبار');
        const ap = db.settings.autoPost;
        const newsMin = ap.techNewsIntervalMinutes || (ap.techNewsIntervalHours ? ap.techNewsIntervalHours * 60 : 240);
        let msg = `📰 **تنظیمات کرون جاب اخبار روز تکنولوژی (Tech News Cron)**\n\n`;
        msg += `• وضعیت: ${ap.techNewsEnabled !== false ? '🟢 روشن و فعال' : '🔴 خاموش'}\n`;
        msg += `• زمان‌بندی ارسال: **هر ${formatIntervalText(newsMin)}**\n`;
        msg += `• تعداد اخبار در هر پست: **${ap.techNewsCount || 0} عدد**\n`;
        msg += `• کل اخبار در دیتابیس: **${(db.techItems || []).filter(t => t.category === 'news').length} عدد**\n`;
        msg += `• آخرین ارسال موفق: ${ap.lastTechNewsPostedAt ? new Date(ap.lastTechNewsPostedAt).toLocaleString('fa-IR') : 'هنوز ارسالی ثبت نشده'}\n\n`;
        msg += `گزینه مورد نظر را جهت تغییر انتخاب فرمایید:`;

        const keyboard = [
          [
            { text: `${ap.techNewsEnabled !== false ? '🔴 خاموش کردن این کرون' : '🟢 روشن کردن این کرون'}`, callback_data: 'admin_ap_toggle_news' }
          ],
          [
            { text: `⏱ تنظیم زمان‌بندی (${formatIntervalText(newsMin)})`, callback_data: 'admin_ap_setint_menu_n' }
          ],
          [
            { text: `📰 تعداد اخبار: ${ap.techNewsCount || 0} عدد`, callback_data: 'admin_ap_tech_news_count' },
            { text: `🔄 دریافت اخبار تازه`, callback_data: 'admin_ap_refresh_tech' }
          ],
          [
            { text: `🚀 ارسال فوری تست به کانال`, callback_data: 'admin_ap_trigger_n' }
          ],
          [
            { text: '🔙 بازگشت به منوی کرون جاب', callback_data: 'admin_autopost_menu' }
          ]
        ];

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      if (callbackData === 'admin_ap_toggle_news') {
        db.settings.autoPost.techNewsEnabled = db.settings.autoPost.techNewsEnabled === false ? true : false;
        saveDatabase();
        setupAutoPostInterval();
        await answerCallback(`کرون اخبار: ${db.settings.autoPost.techNewsEnabled ? 'روشن' : 'خاموش'}`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_ap_menu_news' } });
        return;
      }

      // --- Submenu: Tech Tricks Cron ---
      if (callbackData === 'admin_ap_menu_tricks') {
        await answerCallback('کرون ترفندها');
        const ap = db.settings.autoPost;
        const tricksMin = ap.techTricksIntervalMinutes || (ap.techTricksIntervalHours ? ap.techTricksIntervalHours * 60 : 360);
        let msg = `💡 **تنظیمات کرون جاب ترفندها و رازهای موبایل (Tech Tricks Cron)**\n\n`;
        msg += `• وضعیت: ${ap.techTricksEnabled !== false ? '🟢 روشن و فعال' : '🔴 خاموش'}\n`;
        msg += `• زمان‌بندی ارسال: **هر ${formatIntervalText(tricksMin)}**\n`;
        msg += `• تعداد ترفند در هر پست: **${ap.techTricksCount || 0} عدد**\n`;
        msg += `• کل ترفندها در دیتابیس: **${(db.techItems || []).filter(t => t.category !== 'news').length} عدد**\n`;
        msg += `• آخرین ارسال موفق: ${ap.lastTechTricksPostedAt ? new Date(ap.lastTechTricksPostedAt).toLocaleString('fa-IR') : 'هنوز ارسالی ثبت نشده'}\n\n`;
        msg += `گزینه مورد نظر را جهت تغییر انتخاب فرمایید:`;

        const keyboard = [
          [
            { text: `${ap.techTricksEnabled !== false ? '🔴 خاموش کردن این کرون' : '🟢 روشن کردن این کرون'}`, callback_data: 'admin_ap_toggle_tricks' }
          ],
          [
            { text: `⏱ تنظیم زمان‌بندی (${formatIntervalText(tricksMin)})`, callback_data: 'admin_ap_setint_menu_t' }
          ],
          [
            { text: `💡 تعداد ترفندها: ${ap.techTricksCount || 0} عدد`, callback_data: 'admin_ap_tech_tricks_count' },
            { text: `🔄 دریافت ترفندهای تازه`, callback_data: 'admin_ap_refresh_tech' }
          ],
          [
            { text: `🚀 ارسال فوری تست به کانال`, callback_data: 'admin_ap_trigger_t' }
          ],
          [
            { text: '🔙 بازگشت به منوی کرون جاب', callback_data: 'admin_autopost_menu' }
          ]
        ];

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      if (callbackData === 'admin_ap_toggle_tricks') {
        db.settings.autoPost.techTricksEnabled = db.settings.autoPost.techTricksEnabled === false ? true : false;
        saveDatabase();
        setupAutoPostInterval();
        await answerCallback(`کرون ترفندها: ${db.settings.autoPost.techTricksEnabled ? 'روشن' : 'خاموش'}`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_ap_menu_tricks' } });
        return;
      }

      // --- Submenu: AI Prompts Cron ---
      if (callbackData === 'admin_ap_menu_prompts') {
        await answerCallback('کرون پرامپت‌ها');
        const ap = db.settings.autoPost;
        const promptsMin = ap.aiPromptsIntervalMinutes || (ap.aiPromptsIntervalHours ? ap.aiPromptsIntervalHours * 60 : 360);
        let msg = `🎨 **تنظیمات کرون جاب پرامپت‌های طلایی هوش مصنوعی (AI Prompts Cron)**\n\n`;
        msg += `• وضعیت: ${ap.aiPromptsEnabled !== false ? '🟢 روشن و فعال' : '🔴 خاموش'}\n`;
        msg += `• زمان‌بندی ارسال: **هر ${formatIntervalText(promptsMin)}**\n`;
        msg += `• تعداد پرامپت در هر پست: **${ap.aiPromptsCount || 1} عدد**\n`;
        msg += `• کل پرامپت‌ها در دیتابیس: **${(db.aiPrompts || []).length} عدد**\n`;
        msg += `• آخرین ارسال موفق: ${ap.lastAiPromptsPostedAt ? new Date(ap.lastAiPromptsPostedAt).toLocaleString('fa-IR') : 'هنوز ارسالی ثبت نشده'}\n\n`;
        msg += `گزینه مورد نظر را جهت تغییر انتخاب فرمایید:`;

        const keyboard = [
          [
            { text: `${ap.aiPromptsEnabled !== false ? '🔴 خاموش کردن این کرون' : '🟢 روشن کردن این کرون'}`, callback_data: 'admin_ap_toggle_prompts' }
          ],
          [
            { text: `⏱ تنظیم زمان‌بندی (${formatIntervalText(promptsMin)})`, callback_data: 'admin_ap_setint_menu_p' }
          ],
          [
            { text: `🎨 تعداد پرامپت‌ها: ${ap.aiPromptsCount || 1} عدد`, callback_data: 'admin_ap_prompts_count' }
          ],
          [
            { text: `🚀 ارسال فوری تست به کانال`, callback_data: 'admin_ap_trigger_p' }
          ],
          [
            { text: '🔙 بازگشت به منوی کرون جاب', callback_data: 'admin_autopost_menu' }
          ]
        ];

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      if (callbackData === 'admin_ap_toggle_prompts') {
        db.settings.autoPost.aiPromptsEnabled = db.settings.autoPost.aiPromptsEnabled === false ? true : false;
        saveDatabase();
        setupAutoPostInterval();
        await answerCallback(`کرون پرامپت‌ها: ${db.settings.autoPost.aiPromptsEnabled ? 'روشن' : 'خاموش'}`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_ap_menu_prompts' } });
        return;
      }

      if (callbackData === 'admin_ap_prompts_count') {
        const keyboard = [
          [
            { text: '0 (غیرفعال)', callback_data: 'admin_ap_set_prompts_0' },
            { text: '1 عدد', callback_data: 'admin_ap_set_prompts_1' },
            { text: '2 عدد', callback_data: 'admin_ap_set_prompts_2' }
          ],
          [
            { text: '3 عدد', callback_data: 'admin_ap_set_prompts_3' },
            { text: '5 عدد', callback_data: 'admin_ap_set_prompts_5' }
          ],
          [{ text: '🔙 بازگشت', callback_data: 'admin_ap_menu_prompts' }]
        ];
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '🎨 **انتخاب تعداد پرامپت‌های طلایی جهت ارسال در هر پست خودکار:**',
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        await answerCallback();
        return;
      }

      if (callbackData.startsWith('admin_ap_set_prompts_')) {
        const count = parseInt(callbackData.replace('admin_ap_set_prompts_', '')) || 0;
        db.settings.autoPost.aiPromptsCount = count;
        saveDatabase();
        await answerCallback(`تعداد پرامپت‌ها به ${count} عدد تنظیم شد.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_ap_menu_prompts' } });
        return;
      }

      // --- Anti-Flood Protection Menu ---
      if (callbackData === 'admin_ap_antiflood_menu') {
        await answerCallback('ضد رگباری');
        const afMin = db.settings.autoPost.antiFloodDelayMinutes || 3;
        let msg = `🛡 **تنظیمات سیستم هوشمند ضد رگباری (Anti-Flood Protection)**\n\n`;
        msg += `این سیستم مانع از این می‌شود که چندین پست (مثلاً کانفیگ، اخبار و ترفند) به صورت همزمان یا رگباری پشت سر هم در کانال شما ارسال شوند و کانال را اسپم کنند.\n\n`;
        msg += `فاصله ایمن فعلی بین هر ارسال: **${afMin} دقیقه**\n\n`;
        msg += `یک بازه زمانی آماده را انتخاب کنید یا زمان دلخواه خود را تایپ نمایید:`;

        const keyboard = [
          [
            { text: '۱ دقیقه', callback_data: 'admin_ap_set_af_1' },
            { text: '۲ دقیقه', callback_data: 'admin_ap_set_af_2' },
            { text: '۳ دقیقه (پیشنهادی)', callback_data: 'admin_ap_set_af_3' }
          ],
          [
            { text: '۵ دقیقه', callback_data: 'admin_ap_set_af_5' },
            { text: '۱۰ دقیقه', callback_data: 'admin_ap_set_af_10' },
            { text: '۱۵ دقیقه', callback_data: 'admin_ap_set_af_15' }
          ],
          [
            { text: '✍️ تایپ زمان دلخواه با پیام', callback_data: 'admin_ap_custom_af' }
          ],
          [
            { text: '🔙 بازگشت به منوی کرون جاب', callback_data: 'admin_autopost_menu' }
          ]
        ];

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      if (callbackData?.startsWith('admin_ap_set_af_')) {
        const mins = parseInt(callbackData.replace('admin_ap_set_af_', '')) || 3;
        db.settings.autoPost.antiFloodDelayMinutes = mins;
        saveDatabase();
        setupAutoPostInterval();
        await answerCallback(`فاصله ضد رگباری به ${mins} دقیقه تنظیم شد.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_ap_antiflood_menu' } });
        return;
      }

      if (callbackData === 'admin_ap_custom_af') {
        adminStates[chatId] = { action: 'await_custom_antiflood' };
        await answerCallback('تایپ زمان ضد رگباری...');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✍️ **تنظیم زمان دلخواه ضد رگباری**\n\nلطفاً حداقل فاصله زمانی بین دو پست متوالی را به دقیقه ارسال فرمایید (بین ۱ تا ۱۲۰ دقیقه):\n\n*(مثال: \`5\` یا \`10 دقیقه\`)*\n\nبرای انصراف کلمه **لغو** را بفرستید.`,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'admin_ap_antiflood_menu' }]] }
        });
        return;
      }

      // --- Granular Interval Selection Menus (Configs, News, Tricks, Prompts) ---
      if (callbackData === 'admin_ap_setint_menu_c' || callbackData === 'admin_ap_setint_menu_n' || callbackData === 'admin_ap_setint_menu_t' || callbackData === 'admin_ap_setint_menu_p') {
        await answerCallback('انتخاب بازه...');
        let prefix = 'c';
        let currentMinutes = db.settings.autoPost.configIntervalMinutes || 240;
        let title = 'کانفیگ و پروکسی';
        let backMenu = 'admin_ap_menu_configs';
        
        if (callbackData === 'admin_ap_setint_menu_n') {
          prefix = 'n';
          currentMinutes = db.settings.autoPost.techNewsIntervalMinutes || 240;
          title = 'اخبار تکنولوژی';
          backMenu = 'admin_ap_menu_news';
        } else if (callbackData === 'admin_ap_setint_menu_t') {
          prefix = 't';
          currentMinutes = db.settings.autoPost.techTricksIntervalMinutes || 360;
          title = 'ترفندها و رازها';
          backMenu = 'admin_ap_menu_tricks';
        } else if (callbackData === 'admin_ap_setint_menu_p') {
          prefix = 'p';
          currentMinutes = db.settings.autoPost.aiPromptsIntervalMinutes || 360;
          title = 'پرامپت‌های هوش مصنوعی';
          backMenu = 'admin_ap_menu_prompts';
        }

        const keyboard = [
          [
            { text: '⏱ ۱۵ دقیقه', callback_data: `admin_ap_setint_${prefix}_15` },
            { text: '⏱ ۳۰ دقیقه', callback_data: `admin_ap_setint_${prefix}_30` },
            { text: '⏱ ۴۵ دقیقه', callback_data: `admin_ap_setint_${prefix}_45` }
          ],
          [
            { text: '⏱ ۱ ساعت', callback_data: `admin_ap_setint_${prefix}_60` },
            { text: '⏱ ۲ ساعت', callback_data: `admin_ap_setint_${prefix}_120` },
            { text: '⏱ ۳ ساعت', callback_data: `admin_ap_setint_${prefix}_180` }
          ],
          [
            { text: '⏱ ۴ ساعت', callback_data: `admin_ap_setint_${prefix}_240` },
            { text: '⏱ ۶ ساعت', callback_data: `admin_ap_setint_${prefix}_360` },
            { text: '⏱ ۸ ساعت', callback_data: `admin_ap_setint_${prefix}_480` }
          ],
          [
            { text: '⏱ ۱۲ ساعت', callback_data: `admin_ap_setint_${prefix}_720` },
            { text: '⏱ ۲۴ ساعت', callback_data: `admin_ap_setint_${prefix}_1440` }
          ],
          [
            { text: '✍️ وارد کردن زمان دلخواه با پیام (متنی)', callback_data: `admin_ap_int_custom_${prefix}` }
          ],
          [{ text: '🔙 بازگشت', callback_data: backMenu }]
        ];

        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `⏱ **تنظیم زمان‌بندی کرون جاب (${title})**\n\nفاصله زمانی فعلی: **هر ${formatIntervalText(currentMinutes)}**\n\nمی‌توانید یکی از بازه‌های پیشنهادی زیر را انتخاب نمایید یا روی دکمه تایپ زمان دلخواه بزنید:`,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
        return;
      }

      if (callbackData?.startsWith('admin_ap_int_custom_')) {
        const prefix = callbackData.replace('admin_ap_int_custom_', '');
        const type = prefix === 'n' ? 'news' : prefix === 't' ? 'tricks' : prefix === 'p' ? 'prompts' : 'configs';
        const typeTitle = prefix === 'n' ? 'اخبار تکنولوژی' : prefix === 't' ? 'ترفندها و رازها' : prefix === 'p' ? 'پرامپت‌های هوش مصنوعی' : 'کانفیگ و پروکسی';
        const backMenu = prefix === 'n' ? 'admin_ap_menu_news' : prefix === 't' ? 'admin_ap_menu_tricks' : prefix === 'p' ? 'admin_ap_menu_prompts' : 'admin_ap_menu_configs';

        adminStates[chatId] = { action: 'await_custom_cron_time', data: { type } };
        await answerCallback('تایپ زمان دلخواه...');
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `✍️ **تعیین زمان دلخواه کرون جاب (${typeTitle})**\n\nلطفاً فاصله زمانی مورد نظر خود را ارسال فرمایید.\n\n*مثال‌های قابل قبول:*\n• \`45 دقیقه\` یا \`45m\`\n• \`2 ساعت\` یا \`2h\`\n• \`90\` (به معنی ۹۰ دقیقه)\n• \`1.5 ساعت\` (به معنی ۹۰ دقیقه)\n\nبرای انصراف کلمه **لغو** را بفرستید.`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 انصراف و بازگشت', callback_data: backMenu }]]
          }
        });
        return;
      }

      if (callbackData?.startsWith('admin_ap_setint_')) {
        const parts = callbackData.replace('admin_ap_setint_', '').split('_');
        const prefix = parts[0];
        const minutes = parseInt(parts[1]) || 240;
        
        let title = 'کانفیگ و پروکسی';
        let backMenu = 'admin_ap_menu_configs';

        if (prefix === 'c') {
          db.settings.autoPost.configIntervalMinutes = minutes;
          db.settings.autoPost.configIntervalHours = Math.max(1, Math.round(minutes / 60));
          db.settings.autoPost.postIntervalHours = Math.max(1, Math.round(minutes / 60));
          title = 'کانفیگ و پروکسی';
          backMenu = 'admin_ap_menu_configs';
        } else if (prefix === 'n') {
          db.settings.autoPost.techNewsIntervalMinutes = minutes;
          db.settings.autoPost.techNewsIntervalHours = Math.max(1, Math.round(minutes / 60));
          title = 'اخبار تکنولوژی';
          backMenu = 'admin_ap_menu_news';
        } else if (prefix === 't') {
          db.settings.autoPost.techTricksIntervalMinutes = minutes;
          db.settings.autoPost.techTricksIntervalHours = Math.max(1, Math.round(minutes / 60));
          title = 'ترفندها و رازها';
          backMenu = 'admin_ap_menu_tricks';
        } else if (prefix === 'p') {
          db.settings.autoPost.aiPromptsIntervalMinutes = minutes;
          db.settings.autoPost.aiPromptsIntervalHours = Math.max(1, Math.round(minutes / 60));
          title = 'پرامپت‌های هوش مصنوعی';
          backMenu = 'admin_ap_menu_prompts';
        }
        
        saveDatabase();
        setupAutoPostInterval();
        const formattedStr = formatIntervalText(minutes);
        await answerCallback(`زمان‌بندی ${title} به ${formattedStr} تغییر یافت.`);
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: backMenu } });
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
            { text: '🔙 بازگشت', callback_data: 'admin_ap_menu_configs' }
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
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_ap_menu_configs' } });
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
            { text: '🔙 بازگشت', callback_data: 'admin_ap_menu_configs' }
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
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_ap_menu_configs' } });
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
          [{ text: '🔙 بازگشت', callback_data: 'admin_ap_menu_news' }]
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
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_ap_menu_news' } });
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
          [{ text: '🔙 بازگشت', callback_data: 'admin_ap_menu_tricks' }]
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
        await handleBotUpdate({ callback_query: { id: callbackQueryId, message: { chat: { id: chatId } }, from: { id: userId }, data: 'admin_ap_menu_tricks' } });
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

      // --- Manual Triggers ---
      if (callbackData === 'admin_ap_trigger' || callbackData === 'admin_ap_trigger_c') {
        await answerCallback('⏳ در حال تلاش برای ارسال کانفیگ‌ها به کانال...', true);
        const ok = await executeConfigsAutoPost();
        if (ok) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ **پست کانفیگ و پروکسی با موفقیت به کانال ارسال گردید!**\n\nلطفاً کانال خود (\`${db.settings.autoPost.targetChannel}\`) را بررسی نمایید.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_ap_menu_configs' }]] }
          });
        } else {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `❌ **ارسال پست تست ناموفق بود.**\n\nمطمئن شوید که ربات ادمین کانال با دسترسی ارسال مطلب است یا کانفیگ سالمی در دیتابیس وجود دارد.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_ap_menu_configs' }]] }
          });
        }
        return;
      }

      if (callbackData === 'admin_ap_trigger_n') {
        await answerCallback('⏳ در حال تلاش برای ارسال اخبار به کانال...', true);
        const ok = await executeTechNewsAutoPost();
        if (ok) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ **پست اخبار تکنولوژی با موفقیت به کانال ارسال گردید!**\n\nلطفاً کانال خود (\`${db.settings.autoPost.targetChannel}\`) را بررسی نمایید.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_ap_menu_news' }]] }
          });
        } else {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `❌ **ارسال اخبار با خطا مواجه شد.**\n\nمطمئن شوید که ربات ادمین کانال است و اخباری در دیتابیس وجود دارد.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_ap_menu_news' }]] }
          });
        }
        return;
      }

      if (callbackData === 'admin_ap_trigger_t') {
        await answerCallback('⏳ در حال تلاش برای ارسال ترفندها به کانال...', true);
        const ok = await executeTechTricksAutoPost();
        if (ok) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ **پست ترفندها و رازهای تکنولوژی با موفقیت به کانال ارسال گردید!**\n\nلطفاً کانال خود (\`${db.settings.autoPost.targetChannel}\`) را بررسی نمایید.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_ap_menu_tricks' }]] }
          });
        } else {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `❌ **ارسال ترفندها با خطا مواجه شد.**\n\nمطمئن شوید که ربات ادمین کانال است و ترفندی در دیتابیس وجود دارد.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_ap_menu_tricks' }]] }
          });
        }
        return;
      }

      if (callbackData === 'admin_ap_trigger_p') {
        await answerCallback('⏳ در حال تلاش برای ارسال پرامپت‌های طلایی هوش مصنوعی به کانال...', true);
        const ok = await executeAiPromptsAutoPost();
        if (ok) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `✅ **پست پرامپت‌های طلایی هوش مصنوعی با موفقیت به کانال ارسال گردید!**\n\nلطفاً کانال خود (\`${db.settings.autoPost.targetChannel}\`) را بررسی نمایید.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_ap_menu_prompts' }]] }
          });
        } else {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `❌ **ارسال پرامپت‌های هوش مصنوعی با خطا مواجه شد یا پرامپت جدیدی یافت نشد.**\n\nمطمئن شوید که ربات ادمین کانال است و پرامپت معتبری در دیتابیس وجود دارد.`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'admin_ap_menu_prompts' }]] }
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
    if (messageText) {
      if (messageText.includes('دریافت یکجای ۵۰ کانفیگ')) callbackData = 'v2ray_qty_50';
      else if (messageText.includes('دریافت یکجای ۱۵ کانفیگ')) callbackData = 'v2ray_qty_15';
      else if (messageText.includes('دریافت کانفیگ ویتوری')) callbackData = 'get_v2ray_configs';
      else if (messageText.includes('فایل .NPVT')) callbackData = 'get_file_npvt';
      else if (messageText.includes('فایل .OVPN')) callbackData = 'get_file_ovpn';
      else if (messageText.includes('فایل .TXT')) callbackData = 'get_file_txt';
      else if (messageText.includes('دریافت پروکسی')) callbackData = 'get_proxies';
      else if (messageText.includes('وضعیت شبکه و پینگ نت')) callbackData = 'get_net_status';
      else if (messageText.includes('راهنمای اتصال')) callbackData = 'get_help';
      else if (messageText.includes('ترفند')) callbackData = 'get_tech_tricks';
      else if (messageText.includes('اخبار')) callbackData = 'get_tech_news';
      else if (messageText.includes('پرامپت') || messageText.includes('هوش مصنوعی')) callbackData = 'get_ai_prompts';
    }

    if (callbackData === 'hide_reply_keyboard') {
      if (callbackQueryId) await answerCallback('منوی زیر چت بسته شد');
      const sponsorBtn = getSponsorChannelInlineButton();
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `🔽 <b>منوی زیر چت با موفقیت بسته شد.</b>\n\nهر زمان مایل بودید منو دوباره در نوار پایین ظاهر شود، روی دکمه شیشه‌ای <b>«📋 باز کردن منوی زیر چت»</b> کلیک کنید یا دستور <code>/menu</code> یا <code>/start</code> را ارسال نمایید.`,
        parse_mode: 'HTML',
        reply_markup: {
          remove_keyboard: true
        }
      });
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `👇 <b>دسترسی سریع به امکانات ربات (دکمه‌های شیشه‌ای):</b>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 باز کردن منوی زیر چت 🚀', callback_data: 'open_reply_menu' }],
            [{ text: '🔥 دریافت یکجای ۵۰ کانفیگ ⭐', callback_data: 'v2ray_qty_50' }],
            [{ text: '🔌 دریافت پروکسی تلگرام 🚀', callback_data: 'get_proxies' }],
            ...(sponsorBtn ? [[{ text: sponsorBtn.text, url: sponsorBtn.url }]] : [])
          ]
        }
      });
      return;
    }

    if (callbackData === 'open_reply_menu' || messageText === '/menu') {
      if (callbackQueryId) await answerCallback('منوی زیر چت فعال شد');
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `📋 <b>منوی زیر کادر چت برای شما فعال گردید.</b>\nبرای استفاده، گزینه‌های زیر را لمس نمایید:`,
        parse_mode: 'HTML',
        reply_markup: getReplyKeyboard(userId, username)
      });
      return;
    }

    if (messageText === '/start' || callbackData === 'back_to_main' || callbackData === 'start_refresh' || callbackData === 'start') {
      delete adminStates[chatId];
      if (userId) delete joinChecksCache[userId];

      if (callbackData) {
        await answerCallback(isAdmin ? '👑 🔄 ربات و دسترسی مدیریت با موفقیت بروزرسانی شد' : '🔄 منوی اصلی و ربات بروزرسانی شد');
      }

      // If admin, trigger background refresh of Telegram commands & menu button
      if (isAdmin && db.settings.botToken) {
        setupBotMenuButton(db.settings.botToken).catch(() => {});
        setBotCommands(db.settings.botToken).catch(() => {});
      }

      const workingConfigsCount = db.configs.filter(c => c.status === 'working').length;
      const workingProxiesCount = (db.proxies || []).filter(p => p.status === 'working').length;

      let welcome = `سلام <b>${escapeHtml(firstName)}</b> عزیز! 🌹\n` +
        `به ربات بزرگ استخراج و پخش کانفیگ‌ها و پروکسی‌های اختصاصی و تست‌شده خوش آمدید.\n\n` +
        `📊 <b>وضعیت لحظه‌ای دیتابیس ربات:</b>\n` +
        `🟢 تعداد کانفیگ‌های فعال V2Ray: <b>${workingConfigsCount} عدد</b>\n` +
        `🚀 تعداد پروکسی‌های فعال تلگرام: <b>${workingProxiesCount} عدد</b>\n\n` +
        `💡 سیستم به صورت ۲۴ ساعته منابع معتبر را پایش کرده و پورت‌ها را از داخل شبکه ایران تست می‌کند.\n\n` +
        `جهت دریافت کانفیگ و پروکسی، از گزینه‌های زیر استفاده کنید:`;

      if (isAdmin) {
        const ch1 = db.settings.autoPost?.targetChannel || 'تنظیم نشده';
        const ch2 = db.settings.autoPost?.channel2?.targetChannel || 'تنظیم نشده';
        const cronStatus = db.settings.autoPost?.enabled ? '🟢 فعال' : '🔴 غیرفعال';
        welcome = `👑 <b>پنل وضعیت و مدیریت ربات (مدیر سیستم):</b>\n\n` +
          `🟢 <b>وضعیت هسته ربات:</b> متصل و آنلاین ⚡\n` +
          `🚀 <b>کانفیگ‌های فعال V2Ray:</b> ${workingConfigsCount} عدد (کل: ${db.configs.length})\n` +
          `🔌 <b>پروکسی‌های فعال تلگرام:</b> ${workingProxiesCount} عدد (کل: ${(db.proxies || []).length})\n` +
          `📢 <b>کانال ۱ (اصلی):</b> <code>${escapeHtml(ch1)}</code>\n` +
          `🎭 <b>کانال ۲ (فان و اخبار):</b> <code>${escapeHtml(ch2)}</code>\n` +
          `⏱ <b>وضعیت ارسال خودکار (کرون):</b> ${cronStatus}\n` +
          `👥 <b>تعداد کل کاربران:</b> ${db.users.length} نفر\n\n` +
          `🔄 تمامی حافظه‌های موقت و وضعیت‌های ورودی پاکسازی و ربات به طور کامل <b>بروزرسانی</b> شد.\n` +
          `جهت مدیریت یا دریافت کانفیگ، از دکمه‌های زیر استفاده کنید:`;
      }

      const startInlineKeyboard: any[][] = [];

      if (isAdmin) {
        const appUrl = getPublicAppUrl();
        const isHttps = appUrl.startsWith('https://');
        startInlineKeyboard.push(
          isHttps 
            ? [{ text: '👑 🌐 باز کردن وب‌ویو پنل مدیریت (WebApp) 🚀', web_app: { url: appUrl } }]
            : [{ text: '🔗 👑 باز کردن پنل مدیریت در مرورگر 🚀', url: appUrl }]
        );
        startInlineKeyboard.push([
          { text: '⚙️ ورود به منوی مدیریت در تلگرام', callback_data: 'admin_menu' },
          { text: '🔄 اسکن و استخراج سریع منابع', callback_data: 'admin_scrape_now' }
        ]);
      }

      startInlineKeyboard.push(
        [
          { text: '🔥 🚀 دریافت یکجای ۵۰ کانفیگ (توصیه ویژه ⭐)', callback_data: 'v2ray_qty_50' }
        ],
        [
          { text: '📥 انتخاب تعداد دلخواه کانفیگ V2Ray', callback_data: 'get_v2ray_configs' }
        ],
        [
          { text: '🌀 فایل NPVT', callback_data: 'get_file_npvt' },
          { text: '🔑 فایل OVPN', callback_data: 'get_file_ovpn' },
          { text: '📄 فایل TXT', callback_data: 'get_file_txt' }
        ],
        [
          { text: '🔌 دریافت پروکسی جدید تلگرام', callback_data: 'get_proxies' },
          { text: '📊 وضعیت شبکه و پینگ نت 🟢', callback_data: 'get_net_status' }
        ],
        [
          { text: '💡 ترفندها 📱', callback_data: 'get_tech_tricks' },
          { text: '📰 اخبار روز تکنولوژی 🌐', callback_data: 'get_tech_news' }
        ],
        [
          { text: '🎨 پرامپت‌های طلایی هوش مصنوعی ✨', callback_data: 'get_ai_prompts' }
        ],
        [
          { text: 'ℹ️ راهنمای اتصال آسان 📚', callback_data: 'get_help' },
          { text: '🔄 بروزرسانی ربات ⚡', callback_data: 'start_refresh' }
        ],
        [
          { text: '🔽 بستن منوی پایین چت', callback_data: 'hide_reply_keyboard' }
        ]
      );

      const sponsorBtn = getSponsorChannelInlineButton();
      if (sponsorBtn) {
        startInlineKeyboard.push([{ text: sponsorBtn.text, url: sponsorBtn.url }]);
      } else if (requiredChannels.length > 0 && requiredChannels[0]?.username) {
        const url = requiredChannels[0].inviteLink || `https://t.me/${requiredChannels[0].username.replace('@', '')}`;
        startInlineKeyboard.push([{ text: '⭐ کانال رسمی پشتیبانی و اخبار', url }]);
      }

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: welcome,
        parse_mode: 'HTML',
        reply_markup: getReplyKeyboard(userId, username)
      });

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: isAdmin ? '👇 <b>منوی دسترسی سریع مدیریت و امکانات ربات:</b>' : '👇 <b>منوی دسترسی سریع و میانبرها:</b>',
        parse_mode: 'HTML',
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

      const sponsorBtn = getSponsorChannelInlineButton();
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: helpText,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            ...(sponsorBtn ? [[{ text: sponsorBtn.text, url: sponsorBtn.url }]] : []),
            [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }]
          ]
        }
      });
      return;
    }

    if (callbackData === 'get_tech_news' || callbackData === 'get_tech_tricks') {
      const isNews = callbackData === 'get_tech_news';
      await answerCallback(isNews ? 'دریافت اخبار...' : 'دریافت ترفندها...');
      
      seedCuratedTechItems();
      const allTech = db.techItems || [];
      const filtered = allTech.filter(t => t.category === (isNews ? 'news' : 'trick'));
      const sponsorBtn = getSponsorChannelInlineButton();
      
      if (filtered.length === 0) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `⚠️ **هیچ ${isNews ? 'خبری' : 'ترفندی'} در حال حاضر موجود نیست!**\nلطفاً بعداً تلاش کنید.`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              ...(sponsorBtn ? [[{ text: sponsorBtn.text, url: sponsorBtn.url }]] : []),
              [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }]
            ]
          }
        });
        return;
      }
      
      // Select 2 items randomly or the top 2 latest
      const selected = filtered.slice(0, 2);
      
      let msgText = isNews ? '📰 **جدیدترین اخبار تکنولوژی:**\n\n' : '💡 **ترفندهای کاربردی موبایل:**\n\n';
      selected.forEach(it => {
        msgText += formatTechItemForTelegram(it, true);
      });
      
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: msgText,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            ...(sponsorBtn ? [[{ text: sponsorBtn.text, url: sponsorBtn.url }]] : []),
            [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }]
          ]
        }
      });
      return;
    }

    if (callbackData === 'get_ai_prompts' || callbackData === 'prompt_menu') {
      await answerCallback('🎨 منوی دسته‌بندی پرامپت‌های هوش مصنوعی');
      
      const menuText = `🎨 <b>سامانه استخراج زنده پرامپت‌های ترکیب عکس و چهره</b> ✨\n\n` +
        `با پرامپت‌های این بخش می‌توانید عکس‌های شخصی خود، همسر، فرزندان یا والدینتان را با جدیدترین ترندهای وایرال شبکه‌های اجتماعی ترکیب کرده و آثار هنری و انیمیشنی فوق‌العاده بسازید.\n\n` +
        `👇 <b>لطفاً سبک و دسته‌بندی مورد علاقه خود را انتخاب کنید:</b>`;

      const promptMenuKeyboard = [
        [
          { text: '🧚 کارتون و پیکسار دیزنی', callback_data: 'prompt_cat_pixar' },
          { text: '👨‍👩‍👧‍👦 خانوادگی، کودک و والدین', callback_data: 'prompt_cat_family' }
        ],
        [
          { text: '💑 دونفره، عاشقانه و همسر', callback_data: 'prompt_cat_couple' },
          { text: '🕶 سایبرپانک و سینمایی', callback_data: 'prompt_cat_cyberpunk' }
        ],
        [
          { text: '👑 سلطنتی و پرتره تاریخی', callback_data: 'prompt_cat_royal' },
          { text: '🎨 نقاشی روغنی و انیمه جیبلی', callback_data: 'prompt_cat_artistic' }
        ],
        [
          { text: '📸 مدلینگ و فشن استودیویی', callback_data: 'prompt_cat_fashion' },
          { text: '🎲 ترندهای داغ جهانی (سورپرایز)', callback_data: 'prompt_cat_random' }
        ],
        [
          { text: '📚 راهنمای ترکیب عکس شخصی با پرامپت 💡', callback_data: 'prompt_guide' }
        ],
        [
          { text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }
        ]
      ];

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: menuText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: promptMenuKeyboard }
      });
      return;
    }

    if (callbackData === 'prompt_guide') {
      await answerCallback('راهنمای استفاده از پرامپت');
      
      const guideText = `📚 <b>راهنمای جامع ترکیب عکس‌های شخصی با پرامپت هوش مصنوعی</b>\n\n` +
        `چگونه عکس خود، همسر، فرزند یا والدینتان را با پرامپت‌ها ترکیب کنید؟\n\n` +
        `1️⃣ <b>روش اول: سایت‌های رایگان FaceSwap (ساده‌ترین روش)</b>\n` +
        `• وارد سایت‌های معروفی مثل <b>Remaker.ai</b> یا <b>SeaArt.ai</b> یا <b>Pica AI</b> شوید.\n` +
        `• ابتدا متن پرامپت انگلیسی را کپی و در کادر Generate وارد کنید تا عکس ساخته شود.\n` +
        `• سپس روی گزینه <b>Face Swap</b> کلیک کرده و عکس چهره خود یا عزیزانتان را روی تصویر خروجی جایگزین کنید.\n\n` +
        `2️⃣ <b>روش دوم: در میدجرنی (Midjourney) با حفظ دقیق چهره</b>\n` +
        `• عکس چهره را در چت تلگرام یا دیسکورد بفرستید و لینک عکس را کپی کنید.\n` +
        `• دستور را به این شکل بنویسید:\n` +
        `<code>/imagine prompt: [متن پرامپت انگلیسی] --cref [لینک عکس شما] --cw 20</code>\n` +
        `💡 پارامتر <code>--cref</code> چهره شما را بدون تغییر به استایل پرامپت منتقل می‌کند.\n\n` +
        `3️⃣ <b>روش سوم: در بینگ و چت‌جی‌پی‌تی (Bing / DALL-E 3)</b>\n` +
        `• وارد Bing Image Creator یا چت هوش مصنوعی شوید، عکس خود را ضمیمه (Attach) کرده و بنویسید:\n` +
        `<i>«این تصویر را با سبک زیر بازآفرینی کن: [متن پرامپت]»</i>\n\n` +
        `✨ <b>نکته طلایی:</b> همیشه از عکس‌های واضح و با نور کافی از روبرو استفاده کنید تا خروجی بسیار طبیعی و خیره‌کننده باشد.`;

      const guideKeyboard = [
        [
          { text: '🎨 ورود به دسته‌بندی پرامپت‌ها ✨', callback_data: 'prompt_menu' }
        ],
        [
          { text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }
        ]
      ];

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: guideText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: guideKeyboard }
      });
      return;
    }

    if (callbackData.startsWith('prompt_cat_')) {
      const subCat = callbackData.replace('prompt_cat_', '');
      await answerCallback('🔄 در حال جستجو و استخراج پرامپت ترند از وب...');
      
      try {
        const livePrompt = await fetchLiveTrendingAiPromptFromInternet(subCat, chatId);
        
        let badgeEmoji = '🎨';
        let badgeTitle = 'پرامپت هوش مصنوعی';
        if (subCat === 'pixar') {
          badgeEmoji = '🧚';
          badgeTitle = 'پرامپت تبدیل عکس به کارتون پیکسار';
        } else if (subCat === 'family') {
          badgeEmoji = '👨‍👩‍👧‍👦';
          badgeTitle = 'پرامپت پرتره خانوادگی و فرزندان';
        } else if (subCat === 'couple') {
          badgeEmoji = '💑';
          badgeTitle = 'پرامپت دونفره و عاشقانه با همسر';
        } else if (subCat === 'cyberpunk') {
          badgeEmoji = '🕶';
          badgeTitle = 'پرامپت سایبرپانک و سینمایی چهره';
        } else if (subCat === 'royal') {
          badgeEmoji = '👑';
          badgeTitle = 'پرامپت سلطنتی و پرتره کلاسیک';
        } else if (subCat === 'artistic') {
          badgeEmoji = '🎨';
          badgeTitle = 'پرامپت نقاشی روغنی و انیمه جیبلی';
        } else if (subCat === 'fashion') {
          badgeEmoji = '📸';
          badgeTitle = 'پرامپت مدلینگ و فشن استودیویی';
        } else {
          badgeEmoji = '🌟';
          badgeTitle = 'پرامپت ترند و داغ شبکه‌های اجتماعی';
        }

        let captionText = `${badgeEmoji} <b>« ${badgeTitle} »</b>\n`;
        captionText += `📌 <b>${escapeHtml(livePrompt.title)}</b>\n\n`;
        
        if (livePrompt.description) {
          captionText += `🔹 <b>توضیحات سبک و منبع:</b>\n<i>${escapeHtml(livePrompt.description)}</i>\n\n`;
        }

        if (livePrompt.tipsForPersonalPhoto) {
          captionText += `💡 <b>نحوه ترکیب با عکس شخصی شما:</b>\n<i>${escapeHtml(livePrompt.tipsForPersonalPhoto)}</i>\n\n`;
        }

        captionText += `📋 <b>متن پرامپت انگلیسی (برای کپی لمس کنید):</b>\n`;
        captionText += `<blockquote expandable><code>${escapeHtml(livePrompt.promptText)}</code></blockquote>\n\n`;

        if (livePrompt.tags && livePrompt.tags.length > 0) {
          const formattedTags = livePrompt.tags
            .slice(0, 5)
            .map(t => `#${t.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '')}`)
            .join(' ');
          captionText += `🏷 <i>${formattedTags}</i>\n`;
        }

        const inlineKeyboard = [
          [
            { text: `🔄 یک پرامپت دیگر در همین سبک ⚡`, callback_data: `prompt_cat_${subCat}` }
          ],
          [
            { text: '🗂 تغییر دسته‌بندی پرامپت‌ها', callback_data: 'prompt_menu' },
            { text: '📚 راهنمای استفاده', callback_data: 'prompt_guide' }
          ],
          [
            { text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }
          ]
        ];

        if (livePrompt.imageUrl) {
          try {
            await callTelegramApi('sendPhoto', {
              chat_id: chatId,
              photo: livePrompt.imageUrl,
              caption: captionText,
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: inlineKeyboard }
            });
            return;
          } catch (photoErr: any) {
            console.error('Error sending prompt photo:', photoErr);
          }
        }

        // Fallback to sending as text
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: captionText,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineKeyboard }
        });

      } catch (err: any) {
        console.error('Error in prompt_cat callback:', err);
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `❌ **خطا در دریافت پرامپت زنده:**\n\n${escapeHtml(err.message || err)}`,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🗂 بازگشت به دسته‌بندی‌ها', callback_data: 'prompt_menu' }]] }
        });
      }
      return;
    }

    if (callbackData === 'get_net_status') {
      await answerCallback('وضعیت شبکه');
      const workingConfigsCount = db.configs.filter(c => c.status === 'working').length;
      const workingProxiesCount = (db.proxies || []).filter(p => p.status === 'working').length;
      const totalConfigs = db.configs.length;
      const sponsorBtn = getSponsorChannelInlineButton();

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
          inline_keyboard: [
            ...(sponsorBtn ? [[{ text: sponsorBtn.text, url: sponsorBtn.url }]] : []),
            [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }]
          ]
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
        const totalChunks = Math.ceil(selected.length / CHUNK_SIZE);
        for (let i = 0; i < selected.length; i += CHUNK_SIZE) {
          const chunk = selected.slice(i, i + CHUNK_SIZE);
          const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
          const isLast = chunkNum === totalChunks;

          const combinedBranded = chunk
            .map(conf => applyBrandingToConfig(conf.raw, db.settings.branding))
            .join('\n');

          let chunkMsg = `📋 <b>بخش ${chunkNum} از ${totalChunks} (کانفیگ‌های ${i + 1} تا ${i + chunk.length}):</b>\n`;
          chunkMsg += `<blockquote expandable><code>${escapeHtml(combinedBranded)}</code></blockquote>\n\n`;
          chunkMsg += `📍 جهت کپی یکجای این بخش روی کادر فوق لمس کنید و در برنامه Import from clipboard نمائید.`;

          const chunkKeyboard = isLast ? {
            inline_keyboard: [
              ...(sponsorBtn ? [[{ text: sponsorBtn.text, url: sponsorBtn.url }]] : []),
              [
                { text: '🔄 دریافت مجدد پک ۵۰ تایی', callback_data: 'v2ray_qty_50' },
                { text: '🔙 منوی اصلی', callback_data: 'back_to_main' }
              ]
            ]
          } : undefined;

          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: chunkMsg,
            parse_mode: 'HTML',
            reply_markup: chunkKeyboard
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
          ...feedbackRows,
          [
            { text: '🔄 دریافت کانفیگ‌های جدید', callback_data: `v2ray_qty_${qty}` },
            { text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main' }
          ]
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
        reply_markup: getReplyKeyboard(userId, username)
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
    await setupBotMenuButton(token);
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

  
  // --- Unified Hourly Content Update Engine (AI Prompts, Tech News, Fun/Memes, Configs) ---
  async function runHourlyContentRefresh() {
    addLog('info', '⏰ در حال اجرای بروزرسانی ساعتی محتوا: کانفیگ‌ها، اخبار روز تکنولوژی، مطالب فان و پرامپت‌های هوش مصنوعی...');
    try {
      // 1. Refresh AI Prompts from web & seed
      await refreshAiPromptsAndPurgeOld().catch(err => console.error('AI Prompts hourly refresh error:', err));
      
      // 2. Refresh Tech News & Tricks from sources
      await refreshTechContentAndPurgeOld().catch(err => console.error('Tech News hourly refresh error:', err));
      
      // 3. Extract fresh Fun & Entertainment content
      await extractFunNewsFromSources().catch(err => console.error('Fun/News hourly refresh error:', err));
      
      // 4. Scrape & refresh Configs and Proxies
      await triggerBulkScrape().catch(err => console.error('Configs hourly scrape error:', err));

      addLog('success', '✅ بروزرسانی ساعتی محتوا با موفقیت کامل انجام شد (پرامپت‌ها، اخبار، مطالب فان و کانفیگ‌ها بروز شدند).');
    } catch (err: any) {
      console.error('Unified hourly content refresh error:', err.message || err);
    }
  }

  // Auto refresh all content every 1 hour (60 minutes)
  setInterval(() => {
    runHourlyContentRefresh();
  }, 60 * 60 * 1000);

  // High-frequency crawl for Fun & News sources every 30 minutes
  setInterval(() => {
    extractFunNewsFromSources().catch(err => console.error('Fun/News auto-extract error:', err));
  }, 30 * 60 * 1000);

  // Set up auto post interval
  setupAutoPostInterval();

  // Run initial checks and hourly refresh shortly after startup
  setTimeout(() => {
    monitorChannelPosts();
    checkAndTriggerBackup();
    runHourlyContentRefresh();
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

  // --- Auto-Detect VPS Host Middleware ---
  app.use((req, res, next) => {
    // If we are not in the AI Studio environment, try to auto-save/update the host
    if (!process.env.DEV_APP_URL) {
      const host = req.get('x-forwarded-host') || req.get('host');
      if (host && !host.includes('localhost') && !host.includes('127.0.0.1') && !host.includes('ais-dev') && !host.includes('europe-west2.run.app')) {
        const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
        const newUrl = `${proto}://${host}`;
        detectedPublicHost = host;
        
        // If publicUrl is empty, is the default known URL, OR is DIFFERENT from the active URL (e.g. old server IP), update it!
        if (!db.settings.publicUrl || db.settings.publicUrl.trim() === '' || db.settings.publicUrl === DEFAULT_KNOWN_APP_URL || db.settings.publicUrl !== newUrl) {
          db.settings.publicUrl = newUrl;
          saveDatabase();
          addLog('info', `آدرس پنل مدیریت شما به صورت هوشمند و پویا به‌روزرسانی شد: ${newUrl}`);
          console.log(`[IP Dynamic Override] Overwrote stale publicUrl with active live URL: ${newUrl}`);
        }
      }
    }
    next();
  });

  // --- Admin Access Authentication Layer ---
  function verifyToken(token: string): boolean {
    if (!token) return false;
    
    // Direct comparison fallback (matches raw admin password)
    const adminPass = db.settings.adminPassword || 'admin';
    if (token === adminPass) return true;
    
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
      if (decoded && decoded.isAdmin === true && decoded.expires > Date.now()) {
        return true;
      }
    } catch {
      // Ignore errors
    }
    return false;
  }
  
  function generateAdminToken(): string {
    const expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days expiry
    return Buffer.from(JSON.stringify({ isAdmin: true, expires })).toString('base64');
  }

  // Middleware to enforce admin authorization on all /api routes (except auth and webhook)
  app.use((req, res, next) => {
    const publicPaths = [
      '/api/health',
      '/api/app-url',
      '/api/auth/login',
      '/api/auth/telegram-login',
      '/api/telegram-webhook',
      '/api/fun-news/refresh',
      '/api/fun-news/send',
      '/api/bot/auto-post/trigger-fun-news'
    ];
    
    if (publicPaths.includes(req.path) || req.path.startsWith('/api/fun-sources') || req.path.startsWith('/api/fun-news')) {
      return next();
    }
    
    // Allow regular users to read configs, proxies, tech items, fun sources, and vpn files list
    const publicGetPaths = [
      '/api/configs',
      '/api/proxies',
      '/api/tech-items',
      '/api/vpn-files',
      '/api/fun-sources',
      '/api/fun-news',
      '/api/ai-prompts'
    ];
    if (req.method === 'GET' && publicGetPaths.includes(req.path)) {
      return next();
    }
    
    // Only protect endpoints starting with /api/
    if (!req.path.startsWith('/api/')) {
      return next();
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'دسترسی غیرمجاز. لطفا ابتدا وارد پنل شوید.' });
    }
    
    const token = authHeader.substring(7);
    if (!verifyToken(token)) {
      return res.status(401).json({ success: false, message: 'اعتبار نشست شما منقضی شده است. لطفا دوباره وارد شوید.' });
    }
    
    next();
  });

  // API: Login with password
  app.post('/api/auth/login', (req, res) => {
    try {
      const { username, password } = req.body;
      const adminPass = db.settings.adminPassword || 'admin';
      const adminUser = db.settings.adminUsername || 'admin';
      
      // If only password is sent (legacy fallback) or both match
      if (
        (username === adminUser && password === adminPass) || 
        (!username && password === adminPass)
      ) {
        return res.json({ success: true, token: generateAdminToken() });
      }
      return res.status(400).json({ success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Auto login inside Telegram WebApp
  app.post('/api/auth/telegram-login', (req, res) => {
    try {
      const { userId, username } = req.body;
      const isAdmin = checkIsAdmin(userId, username);
      
      if (isAdmin) {
        addLog('info', `ورود موفقیت‌آمیز مدیر از طریق وب‌ویو تلگرام (آیدی: ${userId || 'نامشخص'}، یوزرنیم: ${username || 'نامشخص'})`);
        return res.json({ success: true, token: generateAdminToken() });
      }
      
      return res.status(403).json({ success: false, message: 'شما دسترسی مدیریت ندارید. این پنل فقط مخصوص ادمین ربات است.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

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

    const funItems = db.funNewsItems || [];
    const totalFunNewsItems = funItems.length;
    const funItemsCount = funItems.filter(i => i.category === 'fun').length;
    const newsItemsCount = funItems.filter(i => i.category === 'news').length;
    const funSourcesCount = (db.funSources || []).length;

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
      extractedTodayCount,
      totalFunNewsItems,
      funItemsCount,
      newsItemsCount,
      funSourcesCount
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
        adminUsername,
        adminPassword,
        maxConfigsRetention
      } = req.body;
      
      if (maxConfigsRetention !== undefined) {
        db.settings.maxConfigsRetention = Math.max(1, Math.min(10000, Number(maxConfigsRetention) || 2000));
        enforceConfigsRetentionLimit();
      }
      if (adminId !== undefined) {
        db.settings.adminId = adminId;
      }
      if (adminUsername !== undefined) {
        db.settings.adminUsername = adminUsername;
      }
      if (adminPassword !== undefined) {
        db.settings.adminPassword = adminPassword;
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

  // API: Automatically configure Telegram Bot WebApp Menu Button
  app.post('/api/settings/set-menu-button', async (req, res) => {
    try {
      const result = await setupBotMenuButton(undefined, req);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Error setting Telegram WebApp menu button' });
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
    saveDatabase(true);
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
    saveDatabase(true);
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
        includeTechImportanceBadge,
        antiFloodDelayMinutes,
        configsEnabled,
        configIntervalHours,
        configIntervalMinutes,
        techNewsEnabled,
        techNewsIntervalHours,
        techNewsIntervalMinutes,
        techTricksEnabled,
        techTricksIntervalHours,
        techTricksIntervalMinutes,
        aiPromptsEnabled,
        aiPromptsIntervalHours,
        aiPromptsIntervalMinutes,
        aiPromptsCount,
        funNewsEnabled,
        funNewsIntervalHours,
        funNewsIntervalMinutes,
        funNewsCount,
        digitalToolsEnabled,
        digitalToolsIntervalHours,
        digitalToolsIntervalMinutes,
        digitalToolsCount,
        digitalToolsCategories,
        inlineButtonEnabled,
        inlineButtonText,
        inlineButtonUrl,
        maxDailyPosts,
        minPostSpacingMinutes,
        smartGoldenHours,
        sleepHoursProtection,
        singlePostMode,
        channel2
      } = req.body;
      
      const parsedConfigMinutes = Number(configIntervalMinutes) || (Number(configIntervalHours) ? Number(configIntervalHours) * 60 : (Number(postIntervalHours) ? Number(postIntervalHours) * 60 : (db.settings.autoPost?.configIntervalMinutes || 240)));
      const parsedNewsMinutes = Number(techNewsIntervalMinutes) || (Number(techNewsIntervalHours) ? Number(techNewsIntervalHours) * 60 : (db.settings.autoPost?.techNewsIntervalMinutes || 240));
      const parsedTricksMinutes = Number(techTricksIntervalMinutes) || (Number(techTricksIntervalHours) ? Number(techTricksIntervalHours) * 60 : (db.settings.autoPost?.techTricksIntervalMinutes || 360));
      const parsedPromptsMinutes = Number(aiPromptsIntervalMinutes) || (Number(aiPromptsIntervalHours) ? Number(aiPromptsIntervalHours) * 60 : (db.settings.autoPost?.aiPromptsIntervalMinutes || 360));
      const parsedFunMinutes = Number(funNewsIntervalMinutes) || (Number(funNewsIntervalHours) ? Number(funNewsIntervalHours) * 60 : (db.settings.autoPost?.funNewsIntervalMinutes || 180));
      const parsedToolsMinutes = Number(digitalToolsIntervalMinutes) || (Number(digitalToolsIntervalHours) ? Number(digitalToolsIntervalHours) * 60 : (db.settings.autoPost?.digitalToolsIntervalMinutes || 240));

      let updatedChannel2 = db.settings.autoPost?.channel2 || { ...DEFAULT_CHANNEL2_SETTINGS };
      if (channel2 && typeof channel2 === 'object') {
        const c2ConfigMin = Number(channel2.configIntervalMinutes) || (Number(channel2.configIntervalHours) ? Number(channel2.configIntervalHours) * 60 : 240);
        const c2NewsMin = Number(channel2.techNewsIntervalMinutes) || (Number(channel2.techNewsIntervalHours) ? Number(channel2.techNewsIntervalHours) * 60 : 240);
        const c2TricksMin = Number(channel2.techTricksIntervalMinutes) || (Number(channel2.techTricksIntervalHours) ? Number(channel2.techTricksIntervalHours) * 60 : 360);
        const c2PromptsMin = Number(channel2.aiPromptsIntervalMinutes) || (Number(channel2.aiPromptsIntervalHours) ? Number(channel2.aiPromptsIntervalHours) * 60 : 360);
        const c2FunMin = Number(channel2.funNewsIntervalMinutes) || (Number(channel2.funNewsIntervalHours) ? Number(channel2.funNewsIntervalHours) * 60 : 120);
        const c2ToolsMin = Number(channel2.digitalToolsIntervalMinutes) || (Number(channel2.digitalToolsIntervalHours) ? Number(channel2.digitalToolsIntervalHours) * 60 : 360);

        updatedChannel2 = {
          ...updatedChannel2,
          enabled: typeof channel2.enabled !== 'undefined' ? !!channel2.enabled : updatedChannel2.enabled,
          targetChannel: channel2.targetChannel || updatedChannel2.targetChannel,
          adText: channel2.adText || '',
          silentMode: !!channel2.silentMode,
          antiFloodDelayMinutes: Number(channel2.antiFloodDelayMinutes) || updatedChannel2.antiFloodDelayMinutes || 3,

          inlineButtonEnabled: typeof channel2.inlineButtonEnabled !== 'undefined' ? !!channel2.inlineButtonEnabled : (updatedChannel2.inlineButtonEnabled ?? true),
          inlineButtonText: typeof channel2.inlineButtonText !== 'undefined' ? channel2.inlineButtonText : (updatedChannel2.inlineButtonText || ''),
          inlineButtonUrl: typeof channel2.inlineButtonUrl !== 'undefined' ? channel2.inlineButtonUrl : (updatedChannel2.inlineButtonUrl || ''),

          configsEnabled: typeof channel2.configsEnabled !== 'undefined' ? !!channel2.configsEnabled : updatedChannel2.configsEnabled,
          configCount: typeof channel2.configCount !== 'undefined' ? Math.max(0, Number(channel2.configCount)) : updatedChannel2.configCount,
          proxyCount: typeof channel2.proxyCount !== 'undefined' ? Math.max(0, Number(channel2.proxyCount)) : updatedChannel2.proxyCount,
          configIntervalMinutes: c2ConfigMin,
          configIntervalHours: Math.max(1, Math.round(c2ConfigMin / 60)),

          techNewsEnabled: typeof channel2.techNewsEnabled !== 'undefined' ? !!channel2.techNewsEnabled : updatedChannel2.techNewsEnabled,
          techNewsCount: typeof channel2.techNewsCount !== 'undefined' ? Math.max(0, Number(channel2.techNewsCount)) : updatedChannel2.techNewsCount,
          techNewsIntervalMinutes: c2NewsMin,
          techNewsIntervalHours: Math.max(1, Math.round(c2NewsMin / 60)),

          techTricksEnabled: typeof channel2.techTricksEnabled !== 'undefined' ? !!channel2.techTricksEnabled : updatedChannel2.techTricksEnabled,
          techTricksCount: typeof channel2.techTricksCount !== 'undefined' ? Math.max(0, Number(channel2.techTricksCount)) : updatedChannel2.techTricksCount,
          techTricksIntervalMinutes: c2TricksMin,
          techTricksIntervalHours: Math.max(1, Math.round(c2TricksMin / 60)),

          aiPromptsEnabled: typeof channel2.aiPromptsEnabled !== 'undefined' ? !!channel2.aiPromptsEnabled : updatedChannel2.aiPromptsEnabled,
          aiPromptsCount: typeof channel2.aiPromptsCount !== 'undefined' ? Math.max(0, Number(channel2.aiPromptsCount)) : updatedChannel2.aiPromptsCount,
          aiPromptsIntervalMinutes: c2PromptsMin,
          aiPromptsIntervalHours: Math.max(1, Math.round(c2PromptsMin / 60)),

          funNewsEnabled: typeof channel2.funNewsEnabled !== 'undefined' ? !!channel2.funNewsEnabled : updatedChannel2.funNewsEnabled,
          funNewsCount: typeof channel2.funNewsCount !== 'undefined' ? Math.max(0, Number(channel2.funNewsCount)) : updatedChannel2.funNewsCount,
          funNewsIntervalMinutes: c2FunMin,
          funNewsIntervalHours: Math.max(1, Math.round(c2FunMin / 60)),

          digitalToolsEnabled: typeof channel2.digitalToolsEnabled !== 'undefined' ? !!channel2.digitalToolsEnabled : (updatedChannel2.digitalToolsEnabled ?? false),
          digitalToolsCount: typeof channel2.digitalToolsCount !== 'undefined' ? Math.max(0, Number(channel2.digitalToolsCount)) : (updatedChannel2.digitalToolsCount || 1),
          digitalToolsIntervalMinutes: c2ToolsMin,
          digitalToolsIntervalHours: Math.max(1, Math.round(c2ToolsMin / 60)),
          digitalToolsCategories: Array.isArray(channel2.digitalToolsCategories) ? channel2.digitalToolsCategories : updatedChannel2.digitalToolsCategories,

          // Growth and Anti-Churn for Channel 2
          maxDailyPosts: typeof channel2.maxDailyPosts !== 'undefined' ? Math.max(1, Number(channel2.maxDailyPosts)) : (updatedChannel2.maxDailyPosts || 6),
          minPostSpacingMinutes: typeof channel2.minPostSpacingMinutes !== 'undefined' ? Math.max(15, Number(channel2.minPostSpacingMinutes)) : (updatedChannel2.minPostSpacingMinutes || 120),
          smartGoldenHours: typeof channel2.smartGoldenHours !== 'undefined' ? !!channel2.smartGoldenHours : (updatedChannel2.smartGoldenHours ?? true),
          sleepHoursProtection: typeof channel2.sleepHoursProtection !== 'undefined' ? !!channel2.sleepHoursProtection : (updatedChannel2.sleepHoursProtection ?? true),
          singlePostMode: typeof channel2.singlePostMode !== 'undefined' ? !!channel2.singlePostMode : (updatedChannel2.singlePostMode ?? true)
        };
      }

      db.settings.autoPost = {
        ...DEFAULT_AUTO_POST,
        ...db.settings.autoPost,
        enabled: typeof enabled !== 'undefined' ? !!enabled : db.settings.autoPost?.enabled ?? false,
        targetChannel: targetChannel || '',
        postIntervalHours: Math.max(1, Math.round(parsedConfigMinutes / 60)),
        configCount: typeof configCount !== 'undefined' && !isNaN(Number(configCount)) ? Math.max(0, Number(configCount)) : 5,
        proxyCount: typeof proxyCount !== 'undefined' && !isNaN(Number(proxyCount)) ? Math.max(0, Number(proxyCount)) : 0,
        customText: customText || '',
        adText: adText || '',
        postFiles: !!postFiles,
        silentMode: !!silentMode,
        inlineButtonEnabled: typeof inlineButtonEnabled !== 'undefined' ? !!inlineButtonEnabled : (db.settings.autoPost?.inlineButtonEnabled ?? true),
        inlineButtonText: typeof inlineButtonText !== 'undefined' ? inlineButtonText : (db.settings.autoPost?.inlineButtonText || ''),
        inlineButtonUrl: typeof inlineButtonUrl !== 'undefined' ? inlineButtonUrl : (db.settings.autoPost?.inlineButtonUrl || ''),
        techNewsCount: typeof techNewsCount !== 'undefined' && !isNaN(Number(techNewsCount)) ? Math.max(0, Number(techNewsCount)) : 2,
        techTricksCount: typeof techTricksCount !== 'undefined' && !isNaN(Number(techTricksCount)) ? Math.max(0, Number(techTricksCount)) : 2,
        aiPromptsCount: typeof aiPromptsCount !== 'undefined' && !isNaN(Number(aiPromptsCount)) ? Math.max(0, Number(aiPromptsCount)) : 1,
        funNewsCount: typeof funNewsCount !== 'undefined' && !isNaN(Number(funNewsCount)) ? Math.max(0, Number(funNewsCount)) : 1,
        digitalToolsCount: typeof digitalToolsCount !== 'undefined' && !isNaN(Number(digitalToolsCount)) ? Math.max(0, Number(digitalToolsCount)) : 1,
        digitalToolsCategories: Array.isArray(digitalToolsCategories) ? digitalToolsCategories : (db.settings.autoPost?.digitalToolsCategories || ['ai_tools', 'cool_websites', 'mobile_hacks', 'cyber_security', 'must_apps']),
        techPostMode: techPostMode || 'combined',
        autoPurgeOldTechDays: Number(autoPurgeOldTechDays) || 7,
        includeTechImportanceBadge: includeTechImportanceBadge !== false,
        lastPostedAt: db.settings.autoPost?.lastPostedAt || null,
        antiFloodDelayMinutes: typeof antiFloodDelayMinutes !== 'undefined' && !isNaN(Number(antiFloodDelayMinutes)) ? Math.max(1, Number(antiFloodDelayMinutes)) : (db.settings.autoPost?.antiFloodDelayMinutes ?? 3),
        lastAnyPostAt: db.settings.autoPost?.lastAnyPostAt || null,
        
        // Granular independent schedule fields for Channel 1
        configsEnabled: typeof configsEnabled !== 'undefined' ? !!configsEnabled : db.settings.autoPost?.configsEnabled ?? true,
        configIntervalMinutes: parsedConfigMinutes,
        configIntervalHours: Math.max(1, Math.round(parsedConfigMinutes / 60)),
        lastConfigsPostedAt: db.settings.autoPost?.lastConfigsPostedAt || null,

        techNewsEnabled: typeof techNewsEnabled !== 'undefined' ? !!techNewsEnabled : db.settings.autoPost?.techNewsEnabled ?? true,
        techNewsIntervalMinutes: parsedNewsMinutes,
        techNewsIntervalHours: Math.max(1, Math.round(parsedNewsMinutes / 60)),
        lastTechNewsPostedAt: db.settings.autoPost?.lastTechNewsPostedAt || null,

        techTricksEnabled: typeof techTricksEnabled !== 'undefined' ? !!techTricksEnabled : db.settings.autoPost?.techTricksEnabled ?? true,
        techTricksIntervalMinutes: parsedTricksMinutes,
        techTricksIntervalHours: Math.max(1, Math.round(parsedTricksMinutes / 60)),
        lastTechTricksPostedAt: db.settings.autoPost?.lastTechTricksPostedAt || null,

        aiPromptsEnabled: typeof aiPromptsEnabled !== 'undefined' ? !!aiPromptsEnabled : db.settings.autoPost?.aiPromptsEnabled ?? true,
        aiPromptsIntervalMinutes: parsedPromptsMinutes,
        aiPromptsIntervalHours: Math.max(1, Math.round(parsedPromptsMinutes / 60)),
        lastAiPromptsPostedAt: db.settings.autoPost?.lastAiPromptsPostedAt || null,

        funNewsEnabled: typeof funNewsEnabled !== 'undefined' ? !!funNewsEnabled : (db.settings.autoPost?.funNewsEnabled ?? false),
        funNewsIntervalMinutes: parsedFunMinutes,
        funNewsIntervalHours: Math.max(1, Math.round(parsedFunMinutes / 60)),
        lastFunNewsPostedAt: db.settings.autoPost?.lastFunNewsPostedAt || null,

        digitalToolsEnabled: typeof digitalToolsEnabled !== 'undefined' ? !!digitalToolsEnabled : (db.settings.autoPost?.digitalToolsEnabled ?? true),
        digitalToolsIntervalMinutes: parsedToolsMinutes,
        digitalToolsIntervalHours: Math.max(1, Math.round(parsedToolsMinutes / 60)),
        lastDigitalToolsPostedAt: db.settings.autoPost?.lastDigitalToolsPostedAt || null,

        // Growth and Anti-Churn for Channel 1
        maxDailyPosts: typeof maxDailyPosts !== 'undefined' ? Math.max(1, Number(maxDailyPosts)) : (db.settings.autoPost?.maxDailyPosts || 4),
        minPostSpacingMinutes: typeof minPostSpacingMinutes !== 'undefined' ? Math.max(15, Number(minPostSpacingMinutes)) : (db.settings.autoPost?.minPostSpacingMinutes || 180),
        smartGoldenHours: typeof smartGoldenHours !== 'undefined' ? !!smartGoldenHours : (db.settings.autoPost?.smartGoldenHours ?? true),
        sleepHoursProtection: typeof sleepHoursProtection !== 'undefined' ? !!sleepHoursProtection : (db.settings.autoPost?.sleepHoursProtection ?? true),
        singlePostMode: typeof singlePostMode !== 'undefined' ? !!singlePostMode : (db.settings.autoPost?.singlePostMode ?? true),

        channel2: updatedChannel2
      };

      saveDatabase();
      addLog('success', 'تنظیمات ارسال هوشمند و قوانین جلوگیری از ریزش ممبرها با موفقیت بروزرسانی شد.');
      
      // Update intervals/timers
      setupAutoPostInterval();
      
      res.json({ success: true, autoPost: db.settings.autoPost });
    } catch(err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Get Live Dual Channel Health & Growth Analytics
  app.get('/api/autopost/channel-health', async (req, res) => {
    try {
      const tehran = getTehranTimeInfo();
      const ch1Eval = await evaluateChannelPostingAllowance(1);
      const ch2Eval = await evaluateChannelPostingAllowance(2);

      const recentHistory = (db.channelPostHistory || []).slice(-25).reverse();

      res.json({
        success: true,
        tehranTime: tehran,
        channel1: {
          channelNum: 1,
          channelHandle: db.settings.autoPost?.targetChannel || '',
          title: ch1Eval.title || 'کانال ۱ (کانفیگ و ترفند)',
          memberCount: ch1Eval.memberCount,
          postsToday: ch1Eval.postsToday,
          maxDailyPosts: ch1Eval.maxDailyPosts,
          minutesSinceLastPost: ch1Eval.minutesSinceLastPost,
          minSpacingMinutes: db.settings.autoPost?.minPostSpacingMinutes || 180,
          inCooldown: ch1Eval.inCooldown,
          cooldownRemainingMinutes: ch1Eval.cooldownRemainingMinutes,
          isSleepHours: ch1Eval.isSleepHours,
          isGoldenHour: ch1Eval.isGoldenHour,
          statusLevel: ch1Eval.statusLevel,
          statusMessage: ch1Eval.reason,
          growthTips: [
            'سقف ۴ الی ۵ پست در روز مانع خروج اعضا (Unmute/Leave) می‌شود.',
            'کانفیگ‌های اختصاصی را در ساعات ۱۲ تا ۱۴ یا ۲۱ تا ۲۳ بفرستید تا حداکثر فوروارد را دریافت کنید.',
            'حالت تک‌پستی فعال است تا کانال شلوغ و گیج‌کننده نشود.'
          ]
        },
        channel2: {
          channelNum: 2,
          channelHandle: db.settings.autoPost?.channel2?.targetChannel || '',
          title: ch2Eval.title || 'کانال ۲ (فان، میم و اخبار)',
          memberCount: ch2Eval.memberCount,
          postsToday: ch2Eval.postsToday,
          maxDailyPosts: ch2Eval.maxDailyPosts,
          minutesSinceLastPost: ch2Eval.minutesSinceLastPost,
          minSpacingMinutes: db.settings.autoPost?.channel2?.minPostSpacingMinutes || 120,
          inCooldown: ch2Eval.inCooldown,
          cooldownRemainingMinutes: ch2Eval.cooldownRemainingMinutes,
          isSleepHours: ch2Eval.isSleepHours,
          isGoldenHour: ch2Eval.isGoldenHour,
          statusLevel: ch2Eval.statusLevel,
          statusMessage: ch2Eval.reason,
          growthTips: [
            'محتوای فان نباید بی‌وقفه ارسال شود؛ حداقل فاصله ۲ ساعته باعث می‌شود اعضا پست قبلی را ببینند و فوروارد کنند.',
            'پست‌های نیمه‌شب قطع شده تا اعلان‌های مکرر در خواب باعث لفت دادن ممبرها نشود.',
            'استفاده از دکمه شیشه‌ای و برندینگ کانال در انتهای هر پست، بازدیدها را به کانال شما پیوند می‌زند.'
          ]
        },
        recentHistory
      });
    } catch (err: any) {
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

  // API: Refresh AI Prompts Content (Fetch & Purge old)
  app.post('/api/ai-prompts/refresh', async (req, res) => {
    try {
      const result = await refreshAiPromptsAndPurgeOld(true);
      res.json({ success: true, addedCount: result.added, totalCount: result.total });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Add Custom Tech Item
  app.post('/api/tech-items', (req, res) => {
    try {
      const { title, summary, category, importance, imageUrl, videoUrl, mediaType } = req.body;
      if (!title || !summary) {
        return res.status(400).json({ success: false, message: 'عنوان و متن ترفند یا خبر الزامی است.' });
      }
      const calc = calculateTechImportance(title, summary);
      const cat = category === 'news' || category === 'trick' || category === 'secret' ? category : 'trick';
      const imp = (importance || calc.importance) as TechImportance;

      let determinedMediaType = mediaType;
      if (!determinedMediaType) {
        if (videoUrl) determinedMediaType = 'video';
        else if (imageUrl) determinedMediaType = 'photo';
      }

      const newItem: TechItem = {
        id: generateId(),
        title: title.trim(),
        summary: summary.trim(),
        category: cat,
        importance: imp,
        importanceScore: calc.score,
        imageUrl: imageUrl ? imageUrl.trim() : undefined,
        videoUrl: videoUrl ? videoUrl.trim() : undefined,
        mediaType: determinedMediaType || undefined,
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

  // API: Get AI Prompts
  app.get('/api/ai-prompts', (req, res) => {
    if (!db.aiPrompts || db.aiPrompts.length === 0) {
      db.aiPrompts = [...DEFAULT_AI_PROMPTS];
      saveDatabase();
    }
    res.json(db.aiPrompts || []);
  });

  // API: Add AI Prompt
  app.post('/api/ai-prompts', (req, res) => {
    try {
      const { title, category, description, promptText, imageUrl, videoUrl, mediaType, tags, importance } = req.body;
      if (!title || !description || !promptText) {
        return res.status(400).json({ success: false, message: 'پرکردن عنوان، توضیحات و متن پرامپت الزامی است.' });
      }

      const parsedTags = Array.isArray(tags) 
        ? tags.map((t: string) => t.trim().replace(/^#/, '')) 
        : typeof tags === 'string' 
          ? tags.split(',').map((t: string) => t.trim().replace(/^#/, '')) 
          : [];

      let determinedMediaType = mediaType;
      if (!determinedMediaType) {
        if (videoUrl) determinedMediaType = 'video';
        else if (imageUrl) determinedMediaType = 'photo';
      }

      const newItem: AiPrompt = {
        id: generateId(),
        title: title.trim(),
        category: category || 'image',
        description: description.trim(),
        promptText: promptText.trim(),
        imageUrl: imageUrl ? imageUrl.trim() : undefined,
        videoUrl: videoUrl ? videoUrl.trim() : undefined,
        mediaType: determinedMediaType || undefined,
        tags: parsedTags.filter(Boolean),
        importance: importance === 'hot' ? 'hot' : 'normal',
        createdAt: new Date().toISOString(),
        postedToChannel: false,
        postedAt: null
      };

      if (!db.aiPrompts) db.aiPrompts = [];
      db.aiPrompts.unshift(newItem);
      saveDatabase();
      addLog('success', `پرامپت جدید هوش مصنوعی افزوده شد: ${newItem.title}`);
      res.json({ success: true, item: newItem });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Edit AI Prompt
  app.put('/api/ai-prompts/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { title, category, description, promptText, imageUrl, videoUrl, mediaType, tags, importance } = req.body;
      
      const item = (db.aiPrompts || []).find(p => p.id === id);
      if (!item) {
        return res.status(404).json({ success: false, message: 'پرامپت یافت نشد.' });
      }

      if (title) item.title = title.trim();
      if (category) item.category = category;
      if (description) item.description = description.trim();
      if (promptText) item.promptText = promptText.trim();
      if (typeof imageUrl !== 'undefined') item.imageUrl = imageUrl ? imageUrl.trim() : undefined;
      if (typeof videoUrl !== 'undefined') item.videoUrl = videoUrl ? videoUrl.trim() : undefined;
      if (typeof mediaType !== 'undefined') item.mediaType = mediaType;
      if (importance) item.importance = importance === 'hot' ? 'hot' : 'normal';
      
      if (typeof tags !== 'undefined') {
        const parsedTags = Array.isArray(tags) 
          ? tags.map((t: string) => t.trim().replace(/^#/, '')) 
          : typeof tags === 'string' 
            ? tags.split(',').map((t: string) => t.trim().replace(/^#/, '')) 
            : [];
        item.tags = parsedTags.filter(Boolean);
      }

      saveDatabase();
      res.json({ success: true, item });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Delete AI Prompt
  app.delete('/api/ai-prompts/:id', (req, res) => {
    try {
      const { id } = req.params;
      const idx = (db.aiPrompts || []).findIndex(p => p.id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'پرامپت یافت نشد.' });
      }
      db.aiPrompts.splice(idx, 1);
      saveDatabase();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Trigger AI Prompts Auto-Post manually
  app.post('/api/bot/auto-post/trigger-ai-prompts', async (req, res) => {
    try {
      const channelNum = req.body?.channelNum === 2 ? 2 : 1;
      const ap = channelNum === 2 ? (db.settings.autoPost.channel2 || db.settings.autoPost) : db.settings.autoPost;
      const success = await executeAiPromptsAutoPost(channelNum, ap?.targetChannel);
      if (success) {
        res.json({ success: true, message: `پست پرامپت‌های طلایی هوش مصنوعی با موفقیت به کانال ${channelNum} ارسال گردید.` });
      } else {
        res.status(400).json({ success: false, message: 'ارسال پرامپت‌ها با خطا مواجه شد یا پرامپتی یافت نشد.' });
      }
    } catch(err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Trigger Auto-Post manually (All / Default)
  app.post('/api/bot/auto-post/trigger', async (req, res) => {
    try {
      const channelNum = req.body?.channelNum === 2 ? 2 : 1;
      const mode = req.body?.mode || 'all';
      const success = await executeAutoPost(mode, channelNum);
      if (success) {
        res.json({ success: true, message: `پست با موفقیت به کانال ${channelNum} ارسال گردید.` });
      } else {
        res.status(400).json({ success: false, message: `ارسال پست به کانال ${channelNum} با خطا مواجه شد. جزئیات را در بخش گزارشات بررسی کنید.` });
      }
    } catch(err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Trigger Configs & Proxies Auto-Post manually
  app.post('/api/bot/auto-post/trigger-configs', async (req, res) => {
    try {
      const channelNum = req.body?.channelNum === 2 ? 2 : 1;
      const ap = channelNum === 2 ? (db.settings.autoPost.channel2 || db.settings.autoPost) : db.settings.autoPost;
      const success = await executeConfigsAutoPost(channelNum, ap?.targetChannel);
      if (success) {
        res.json({ success: true, message: `پست کانفیگ‌ها و پروکسی‌ها با موفقیت به کانال ${channelNum} ارسال گردید.` });
      } else {
        res.status(400).json({ success: false, message: 'ارسال کانفیگ‌ها با خطا مواجه شد یا موردی یافت نشد.' });
      }
    } catch(err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Trigger Tech News Auto-Post manually
  app.post('/api/bot/auto-post/trigger-tech-news', async (req, res) => {
    try {
      const channelNum = req.body?.channelNum === 2 ? 2 : 1;
      const ap = channelNum === 2 ? (db.settings.autoPost.channel2 || db.settings.autoPost) : db.settings.autoPost;
      const success = await executeTechNewsAutoPost(channelNum, ap?.targetChannel);
      if (success) {
        res.json({ success: true, message: `پست اخبار تکنولوژی با موفقیت به کانال ${channelNum} ارسال گردید.` });
      } else {
        res.status(400).json({ success: false, message: 'ارسال اخبار با خطا مواجه شد یا خبری یافت نشد.' });
      }
    } catch(err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Trigger Tech Tricks Auto-Post manually
  app.post('/api/bot/auto-post/trigger-tech-tricks', async (req, res) => {
    try {
      const channelNum = req.body?.channelNum === 2 ? 2 : 1;
      const ap = channelNum === 2 ? (db.settings.autoPost.channel2 || db.settings.autoPost) : db.settings.autoPost;
      const success = await executeTechTricksAutoPost(channelNum, ap?.targetChannel);
      if (success) {
        res.json({ success: true, message: `پست ترفندها و رازهای تکنولوژی با موفقیت به کانال ${channelNum} ارسال گردید.` });
      } else {
        res.status(400).json({ success: false, message: 'ارسال ترفندها با خطا مواجه شد یا مطلبی یافت نشد.' });
      }
    } catch(err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Trigger Fun & News Auto-Post manually
  app.post('/api/bot/auto-post/trigger-fun-news', async (req, res) => {
    try {
      const channelNum = req.body?.channelNum === 1 ? 1 : 2;
      const isCh2 = channelNum === 2;
      const ap = isCh2 ? (db.settings.autoPost.channel2 || db.settings.autoPost) : db.settings.autoPost;
      if (!ap?.targetChannel) {
        return res.status(400).json({ success: false, message: `آیدی کانال مقصد شماره ${channelNum} در بخش «ارسال خودکار» تنظیم نشده است.` });
      }
      if (!db.settings.botToken) {
        return res.status(400).json({ success: false, message: 'توکن ربات تلگرام در تنظیمات ثبت نشده یا غیرفعال است.' });
      }
      const success = await executeFunNewsAutoPost(channelNum, ap.targetChannel);
      if (success) {
        res.json({ success: true, message: `پست فان و اخبار با موفقیت به کانال ${channelNum} (${ap.targetChannel}) ارسال گردید.` });
      } else {
        res.status(400).json({ success: false, message: 'ارسال با خطا مواجه شد یا مطلبی برای ارسال یافت نشد.' });
      }
    } catch(err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Trigger Digital Tools Auto-Post manually
  app.post('/api/bot/auto-post/trigger-digital-tools', async (req, res) => {
    try {
      const channelNum = req.body?.channelNum === 2 ? 2 : 1;
      const isCh2 = channelNum === 2;
      const ap = isCh2 ? (db.settings.autoPost.channel2 || db.settings.autoPost) : db.settings.autoPost;
      if (!ap?.targetChannel) {
        return res.status(400).json({ success: false, message: `آیدی کانال مقصد شماره ${channelNum} در بخش «ارسال خودکار» تنظیم نشده است.` });
      }
      if (!db.settings.botToken) {
        return res.status(400).json({ success: false, message: 'توکن ربات تلگرام در تنظیمات ثبت نشده یا غیرفعال است.' });
      }
      const success = await executeDigitalToolsAutoPost(channelNum, ap.targetChannel);
      if (success) {
        res.json({ success: true, message: `پست جعبه‌ابزار دیجیتال و کاربردی با موفقیت به کانال ${channelNum} (${ap.targetChannel}) ارسال گردید.` });
      } else {
        res.status(400).json({ success: false, message: 'ارسال با خطا مواجه شد یا ابزاری در دسته‌بندی انتخابی یافت نشد.' });
      }
    } catch(err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Get Digital Tools List
  app.get('/api/digital-tools', (req, res) => {
    if (!Array.isArray(db.digitalTools) || db.digitalTools.length === 0) {
      db.digitalTools = [...DEFAULT_DIGITAL_TOOLS];
      saveDatabase();
    }
    res.json(db.digitalTools || []);
  });

  // API: Add Custom Digital Tool
  app.post('/api/digital-tools', (req, res) => {
    try {
      const { title, summary, category, importance, linkUrl, buttonLabel, howToUse, tags } = req.body;
      if (!title || !summary) {
        return res.status(400).json({ success: false, message: 'عنوان و معرفی ابزار الزامی است.' });
      }
      const validCategories: DigitalToolCategory[] = ['ai_tools', 'cool_websites', 'mobile_hacks', 'cyber_security', 'must_apps'];
      const cat: DigitalToolCategory = validCategories.includes(category) ? category : 'ai_tools';

      const newItem: DigitalToolItem = {
        id: generateId(),
        title: title.trim(),
        summary: summary.trim(),
        category: cat,
        importance: importance === 'essential' || importance === 'trending' ? importance : 'normal',
        linkUrl: linkUrl ? linkUrl.trim() : undefined,
        buttonLabel: buttonLabel ? buttonLabel.trim() : undefined,
        howToUse: howToUse ? howToUse.trim() : undefined,
        tags: Array.isArray(tags) ? tags : ['کاربردی', 'تکنولوژی', 'ابزار_رایگان'],
        createdAt: new Date().toISOString(),
        postedToChannel1: false,
        postedToChannel2: false,
        postCount: 0
      };

      if (!db.digitalTools) db.digitalTools = [];
      db.digitalTools.unshift(newItem);
      saveDatabase();
      addLog('success', `ابزار کاربردی جدید به بانک محتوا اضافه شد: ${newItem.title}`);
      res.json({ success: true, item: newItem });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Edit Digital Tool
  app.put('/api/digital-tools/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { title, summary, category, importance, linkUrl, buttonLabel, howToUse, tags } = req.body;
      const item = (db.digitalTools || []).find(t => t.id === id);
      if (!item) {
        return res.status(404).json({ success: false, message: 'ابزار مورد نظر یافت نشد.' });
      }

      if (title) item.title = title.trim();
      if (summary) item.summary = summary.trim();
      if (category) item.category = category;
      if (importance) item.importance = importance;
      if (typeof linkUrl !== 'undefined') item.linkUrl = linkUrl ? linkUrl.trim() : undefined;
      if (typeof buttonLabel !== 'undefined') item.buttonLabel = buttonLabel ? buttonLabel.trim() : undefined;
      if (typeof howToUse !== 'undefined') item.howToUse = howToUse ? howToUse.trim() : undefined;
      if (Array.isArray(tags)) item.tags = tags;

      saveDatabase();
      res.json({ success: true, item });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Delete Digital Tool
  app.delete('/api/digital-tools/:id', (req, res) => {
    try {
      const { id } = req.params;
      const idx = (db.digitalTools || []).findIndex(t => t.id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'ابزار یافت نشد.' });
      }
      db.digitalTools.splice(idx, 1);
      saveDatabase();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Get Fun News Items
  app.get('/api/fun-news', (req, res) => {
    if (!Array.isArray(db.funNewsItems)) {
      db.funNewsItems = [];
    }
    res.json(db.funNewsItems || []);
  });

  // API: Refresh / Extract Fun News from Telegram sources
  app.post('/api/fun-news/refresh', async (req, res) => {
    try {
      const { sourceId } = req.body || {};
      const validSourceId = (typeof sourceId === 'string' && sourceId.trim().length > 0 && sourceId !== '[object Object]')
        ? sourceId.trim()
        : undefined;
      const result = await extractFunNewsFromSources(validSourceId);
      res.json({ success: true, addedCount: result.added, totalCount: result.total, skippedCount: result.skipped });
    } catch (err: any) {
      console.error('[FunNews Refresh Error]', err);
      res.status(500).json({ success: false, message: err?.message || 'خطا در فرآیند استخراج مطالب' });
    }
  });

  // API: Send specific Fun News Item to Channel
  app.post('/api/fun-news/send', async (req, res) => {
    try {
      const { itemId, channelNum } = req.body;
      const item = (db.funNewsItems || []).find(i => i.id === itemId);
      if (!item) {
        return res.status(404).json({ success: false, message: 'مطلب مورد نظر یافت نشد.' });
      }

      const targetNum = channelNum === 1 ? 1 : 2;
      const isCh2 = targetNum === 2;
      const ap = isCh2 ? (db.settings.autoPost.channel2 || db.settings.autoPost) : db.settings.autoPost;
      const targetChannel = ap?.targetChannel;

      if (!targetChannel) {
        return res.status(400).json({ success: false, message: `کانال مقصد شماره ${targetNum} تنظیم نشده است.` });
      }

      const channelHandle = targetChannel.startsWith('@') ? targetChannel : `@${targetChannel.replace('@', '')}`;
      
      // Channel 2 must NEVER inherit Channel 1's branding or handle
      let adText = '';
      if (isCh2) {
        let rawCh2Ad = (ap?.adText || '').trim();
        const ch1Handle = (db.settings.autoPost?.targetChannel || '').replace(/^@/, '').toLowerCase().trim();
        const ch1Branding = (db.settings.branding || '').toLowerCase().trim();
        if (ch1Handle && rawCh2Ad.toLowerCase().includes(ch1Handle)) rawCh2Ad = '';
        if (ch1Branding && rawCh2Ad.toLowerCase().includes(ch1Branding)) rawCh2Ad = '';
        adText = rawCh2Ad;
      } else {
        adText = ap?.adText || db.settings.branding || '';
      }

      const isFun = item.category === 'fun';
      const categoryEmoji = isFun ? '🎭' : '📰';
      const categoryName = isFun ? 'طنز و سرگرمی تلگرام' : 'اخبار عمومی و مهم روز';

      // Thoroughly sanitize title and body text so NO source group/channel handles appear
      const sanitizedText = sanitizeContentForTelegramPost(item.text, channelHandle);
      const sanitizedTitle = sanitizePostTitle(item.title, channelHandle);

      let text = `${categoryEmoji} <b>« ${categoryName} »</b>\n`;
      text += `📌 <b>${escapeHtml(sanitizedTitle)}</b>\n\n`;
      text += `${escapeHtml(sanitizedText)}\n\n`;

      if (item.tags && item.tags.length > 0) {
        const formattedTags = item.tags
          .slice(0, 5)
          .map(t => `#${t.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '')}`)
          .join(' ');
        text += `🏷 <i>${formattedTags}</i>\n`;
      }
      if (adText) {
        text += `\n📢 <i>${escapeHtml(adText)}</i>\n`;
      }
      text += `🆔 ${escapeHtml(channelHandle)}`;

      const inlineButtons: any[] = [];
      const channelBtn = getChannelInlineButton(isCh2 ? 2 : 1, channelHandle);
      if (channelBtn) {
        inlineButtons.push([{ text: channelBtn.text, url: channelBtn.url }]);
      }

      const postResult = await sendTelegramPostWithMedia({
        chatId: channelHandle,
        text,
        videoUrl: item.videoUrl,
        imageUrl: item.imageUrl,
        mediaType: item.mediaType,
        replyMarkup: inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined,
        silent: !!ap.silentMode
      });

      if (!postResult.success) {
        return res.status(500).json({ success: false, message: postResult.error || 'خطا در ارسال مطلب به تلگرام' });
      }

      if (isCh2) {
        item.postedToChannel2 = true;
      } else {
        item.postedToChannel1 = true;
      }
      item.postedAt = new Date().toISOString();
      saveDatabase();

      res.json({ success: true, message: `مطلب با موفقیت به کانال ${targetNum} (${channelHandle}) ارسال شد.` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Delete Fun News Item
  app.delete('/api/fun-news/:id', (req, res) => {
    try {
      const { id } = req.params;
      const idx = (db.funNewsItems || []).findIndex(i => i.id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'مطلب یافت نشد.' });
      }
      db.funNewsItems.splice(idx, 1);
      saveDatabase(true);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Get Fun Sources
  app.get('/api/fun-sources', (req, res) => {
    if (!Array.isArray(db.funSources)) {
      db.funSources = [];
    }
    res.json(db.funSources || []);
  });

  // API: Add Fun Source
  app.post('/api/fun-sources', (req, res) => {
    try {
      const { name, urlOrHandle, category } = req.body;
      if (!urlOrHandle) {
        return res.status(400).json({ success: false, message: 'شناسه یا آدرس کانال تلگرام الزامی است.' });
      }

      let clean = String(urlOrHandle || '').trim();
      // Remove URLs like https://t.me/, http://t.me/, https://telegram.me/, t.me/, etc.
      clean = clean.replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/(s\/)?/i, '');
      // Remove trailing slashes or path query params
      clean = clean.replace(/[/?#].*$/, '').trim();
      // Remove leading @ if any
      clean = clean.replace(/^@+/, '').trim();

      if (!clean) {
        return res.status(400).json({ success: false, message: 'شناسه یا لینک کانال تلگرام نامعتبر است.' });
      }
      const formattedHandle = `@${clean}`;

      if (!db.funSources) db.funSources = [];
      const existing = db.funSources.find(s => s.urlOrHandle.toLowerCase() === formattedHandle.toLowerCase());
      if (existing) {
        return res.status(400).json({ success: false, message: `این کانال (${formattedHandle}) قبلاً در لیست منابع ثبت شده است.` });
      }

      const newSource: FunNewsSource = {
        id: generateId(),
        name: (name || clean).trim(),
        urlOrHandle: formattedHandle,
        enabled: true,
        category: category === 'news' ? 'news' : 'fun',
        extractedCount: 0,
        lastExtracted: null,
        createdAt: new Date().toISOString()
      };

      db.funSources.push(newSource);
      saveDatabase(true);
      addLog('success', `کانال منبع فان و اخبار افزوده شد: ${newSource.name} (${newSource.urlOrHandle})`);
      res.json({ success: true, source: newSource });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Toggle or Update Fun Source
  app.put('/api/fun-sources/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { enabled, name, category } = req.body;
      const source = (db.funSources || []).find(s => s.id === id);
      if (!source) {
        return res.status(404).json({ success: false, message: 'منبع یافت نشد.' });
      }

      if (typeof enabled !== 'undefined') source.enabled = !!enabled;
      if (name) source.name = name.trim();
      if (category) source.category = category === 'news' ? 'news' : 'fun';

      saveDatabase(true);
      res.json({ success: true, source });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Delete Fun Source and its scraped items
  app.delete('/api/fun-sources/:id', (req, res) => {
    try {
      const { id } = req.params;
      const idx = (db.funSources || []).findIndex(s => s.id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, message: 'منبع یافت نشد.' });
      }
      const removed = db.funSources[idx];
      const removedHandle = (removed.urlOrHandle || '').replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/(s\/)?/i, '').replace(/^@+/, '').toLowerCase().trim();

      // Remove the source from list
      db.funSources.splice(idx, 1);

      // Also clean up all items harvested from this removed channel
      if (Array.isArray(db.funNewsItems) && removedHandle) {
        const initialCount = db.funNewsItems.length;
        db.funNewsItems = db.funNewsItems.filter(item => {
          const itemHandle = (item.sourceChannel || '').replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/(s\/)?/i, '').replace(/^@+/, '').toLowerCase().trim();
          return itemHandle !== removedHandle;
        });
        const deletedPostsCount = initialCount - db.funNewsItems.length;
        if (deletedPostsCount > 0) {
          addLog('info', `${deletedPostsCount} مطلب استخراج‌شده مربوط به کانال حذف‌شده (${removed.name}) پاکسازی گردید.`);
        }
      }

      saveDatabase(true);
      addLog('warn', `کانال منبع فان و اخبار حذف گردید: ${removed.name} (${removed.urlOrHandle})`);
      res.json({ success: true, removedSource: removed, remainingCount: db.funSources.length });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Get Public App URL for TWA / WebApp
  app.get('/api/app-url', (req, res) => {
    const url = getPublicAppUrl(req);
    res.json({ url });
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
    app.get('*', (req, res) => {
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
