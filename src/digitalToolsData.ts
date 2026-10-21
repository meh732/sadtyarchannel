import { DigitalToolItem, AiPrompt } from './types';

export const DEFAULT_DIGITAL_TOOLS: DigitalToolItem[] = [
  {
    id: 'tool-1',
    title: 'V2RayN (ویندوز)',
    summary: 'کلاینت قدرتمند و پرسرعت برای ویندوز با پشتیبانی از پروتکل‌های VMess, VLESS, Trojan, Shadowsocks.',
    howToUse: 'کانفیگ را کپی کرده و در برنامه با کلیدهای Ctrl+V وارد کنید.',
    linkUrl: 'https://github.com/2dust/v2rayN/releases',
    buttonLabel: 'دانلود v2rayN',
    category: 'must_apps',
    importance: 'essential',
    tags: ['Windows', 'V2Ray', 'Client'],
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false
  },
  {
    id: 'tool-2',
    title: 'v2rayNG (اندروید)',
    summary: 'محبوب‌ترین کلاینت اندروید برای اتصال آسان به کانفیگ‌های وی‌تو‌ری و دور زدن فیلترینگ.',
    howToUse: 'کد کانفیگ را از کلیپ‌بورد با لمس آیکون + و گزینه Import from Clipboard وارد نمایید.',
    linkUrl: 'https://github.com/2dust/v2rayNG/releases',
    buttonLabel: 'دانلود v2rayNG',
    category: 'mobile_hacks',
    importance: 'essential',
    tags: ['Android', 'V2Ray', 'Mobile'],
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false
  },
  {
    id: 'tool-3',
    title: 'NekoBox (اندروید)',
    summary: 'کلاینت پیشرفته بر پایه هسته قدرتمند Sing-Box با مسیریابی هوشمند برای وب‌سایت‌های ایرانی.',
    howToUse: 'لینک سابسکریپشن را در تب Groups اضافه کرده و دکمه تست اتصال را بزنید.',
    linkUrl: 'https://github.com/MatsuriDayo/NekoBoxForAndroid/releases',
    buttonLabel: 'دانلود NekoBox',
    category: 'mobile_hacks',
    importance: 'trending',
    tags: ['Android', 'Sing-Box', 'Clash'],
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false
  },
  {
    id: 'tool-4',
    title: 'FoxRay (iOS / macOS)',
    summary: 'کلاینت مدرن آیفون و مک با پشتیبانی از REALITY، gRPC و پروتکل‌های مدرن.',
    howToUse: 'کانفیگ را کپی کرده و با دکمه + در برنامه اضافه کنید.',
    linkUrl: 'https://apps.apple.com/app/foxray/id6448898396',
    buttonLabel: 'نصب FoxRay از اپ‌استور',
    category: 'must_apps',
    importance: 'essential',
    tags: ['iOS', 'iPhone', 'Mac'],
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false
  },
  {
    id: 'tool-5',
    title: 'Have I Been Pwned',
    summary: 'سرویس امنیتی معتبر برای بررسی نشت گذرواژه‌ها و ایمیل‌های شما در رخنه‌های داده.',
    howToUse: 'ایمیل خود را جستجو کنید تا از امنیت حساب‌هایتان مطلع شوید.',
    linkUrl: 'https://haveibeenpwned.com',
    buttonLabel: 'بررسی امنیت حساب',
    category: 'cyber_security',
    importance: 'trending',
    tags: ['Security', 'Privacy', 'Password'],
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false
  }
];

export const digitalToolsData = DEFAULT_DIGITAL_TOOLS;

export const EXTENDED_AI_PROMPTS: AiPrompt[] = [
  {
    id: 'ai-prompt-ext-1',
    title: 'کاراکتر سایبرپانک نئونی',
    category: 'image',
    description: 'پرامپت ساخت پرتره سینمایی سایبرپانک با نورپردازی نئونی واقع‌گرایانه',
    promptText: 'hyper-realistic cinematic portrait of a cyberpunk hacker in futuristic Tokyo, volumetric neon lights, photorealistic 8k, Octane render, moody cinematic color grading',
    tags: ['سایبرپانک', 'پرتره', 'نئون', 'هوش_مصنوعی'],
    importance: 'hot',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  },
  {
    id: 'ai-prompt-ext-2',
    title: 'معماری مینیمال آینده‌نگر',
    category: 'image',
    description: 'طراحی ویلای صخره‌ای مدرن با فرم‌های ارگانیک',
    promptText: 'ultra-modern minimalist cliffside villa overlooking foggy ocean, organic brutalist concrete architecture, golden hour light, architectural digest photography, 8k resolution',
    tags: ['معماری', 'مینیمال', 'ویلا', 'رندر'],
    importance: 'normal',
    createdAt: new Date().toISOString(),
    postedToChannel: false,
    postedToChannel1: false,
    postedToChannel2: false,
    postedAt: null
  }
];
