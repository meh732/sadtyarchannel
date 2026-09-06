import { DigitalToolItem, AiPrompt } from './types';

// ==========================================
// 1. EVERGREEN DIGITAL TOOLS & AI TOOLBOX (برای استقلال کانال از فیلترینگ)
// ==========================================
export const DEFAULT_DIGITAL_TOOLS: DigitalToolItem[] = [
  // --- A. AI Tools (ابزارهای هوش مصنوعی فوق‌العاده کاربردی) ---
  {
    id: 'tool-ai-gamma',
    title: 'Gamma App | ساخت خودکار اسلاید و پاورپوینت حرفه‌ای در ۳۰ ثانیه',
    summary: 'دیگر ساعت‌ها وقت صرف طراحی پاورپوینت نکنید! کافیست موضوع تحقیق یا کلاستان را به زبان فارسی به این هوش مصنوعی بدهید تا اسلایدهایی بی‌نظیر با تصاویر، چارت‌ها و متن‌های دسته‌بندی‌شده تحویل دهد.',
    howToUse: 'وارد سایت شوید، دکمه Generate را بزنید، موضوع ارائه را به فارسی بنویسید و تم رنگی مورد نظر را انتخاب کنید. خروجی را مستقیماً به صورت PDF یا PPTX دریافت کنید.',
    linkUrl: 'https://gamma.app',
    buttonLabel: '🚀 ورود به هوش مصنوعی Gamma',
    category: 'ai_tools',
    tags: ['هوش_مصنوعی', 'پاورپوینت', 'دانشجویی', 'ارائه', 'تولید_محتوا'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-ai-perplexity',
    title: 'Perplexity AI | موتور جستجوی هوشمند بدون تبلیغات با ذکر منابع',
    summary: 'نسل جدید جستجو در اینترنت! به جای گشتن در ده‌ها لینک تبلیغاتی گوگل، هر سوال علمی، پزشکی، برنامه‌نویسی یا عمومی دارید بپرسید تا پاسخی منسجم، مستند و خلاصه با ارجاع دقیق به مقالات علمی دریافت کنید.',
    howToUse: 'نیازی به ثبت‌نام ندارید. سوال یا مسئله مدنظرتان را به زبان فارسی بنویسید و از گزینه Focus برای تمرکز روی مقالات دانشگاهی یا یوتیوب استفاده کنید.',
    linkUrl: 'https://www.perplexity.ai',
    buttonLabel: '🔍 جستجوی هوشمند در Perplexity',
    category: 'ai_tools',
    tags: ['هوش_مصنوعی', 'موتور_جستجو', 'تحقیق', 'دانشگاهی', 'علمی'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-ai-clipdrop',
    title: 'Clipdrop by Stability AI | جعبه‌ابزار جادویی ادیت و روتوش عکس با هوش مصنوعی',
    summary: 'حذف هر شیء یا فرد مزاحم از عکس، حذف بک‌گراند با یک کلیک، تغییر جهت نورپردازی چهره، و افزایش کیفیت عکس‌های تار بدون افت کیفیت.',
    howToUse: 'گزینه Cleanup یا Relight را انتخاب کرده، عکستان را بکشید و رها کنید. با قلم مو روی شیء مزاحم بکشید تا مثل معجزه ناپدید شود.',
    linkUrl: 'https://clipdrop.co',
    buttonLabel: '✨ شروع ادیت حرفه‌ای در Clipdrop',
    category: 'ai_tools',
    tags: ['ادیت_عکس', 'حذف_پس_زمینه', 'هوش_مصنوعی', 'روتوش', 'گرافیک'],
    importance: 'trending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-ai-chatpdf',
    title: 'ChatPDF | صحبت کردن با کتاب‌ها، جزوه‌ها و فایل‌های PDF طولانی',
    summary: 'هر فایل کتاب، پایان‌نامه، جزوه دانشگاهی یا دفترچه راهنما را آپلود کنید و مثل یک انسان با آن گفتگو کنید؛ از آن خلاصه بخواهید، سوالات امتحانی طرح کنید یا بخش‌های مهم را استخراج نمایید.',
    howToUse: 'فایل PDF خود را در صفحه اصلی درگ کنید. بلافاصله چند سوال پیشنهادی به شما می‌دهد یا می‌توانید هر سوالی درباره متن از آن بپرسید.',
    linkUrl: 'https://www.chatpdf.com',
    buttonLabel: '📚 آپلود کتاب و جزوه در ChatPDF',
    category: 'ai_tools',
    tags: ['پی_دی_اف', 'کتابخوان', 'خلاصه_کتاب', 'دانشجویی', 'هوش_مصنوعی'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-ai-elevenlabs',
    title: 'ElevenLabs Reader | تبدیل کتاب و مقالات به پادکست صوتی با صدای طبیعی انسان',
    summary: 'طبیعی‌ترین هوش مصنوعی تبدیل متن به صدا با لحن و احساسات انسانی. مقالات طولانی، فایل‌های متنی یا اخبار را با بهترین صداهای فارسی و انگلیسی به پادکست تبدیل کنید.',
    howToUse: 'متن خود را کپی کنید یا فایل متنی را بدهید، صدای مورد نظر را انتخاب و با فشردن Generate پادکست باکیفیت را دانلود کنید.',
    linkUrl: 'https://elevenlabs.io',
    buttonLabel: '🎙️ تست صدای طبیعی ElevenLabs',
    category: 'ai_tools',
    tags: ['تبدیل_متن_به_صدا', 'پادکست', 'صداگذاری', 'هوش_مصنوعی', 'تولید_محتوا'],
    importance: 'trending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-ai-upscayl',
    title: 'Upscayl | ارتقای رزولوشن و کیفیت عکس‌های قدیمی و تار تا 8K کاملاً رایگان',
    summary: 'نرم‌افزار رایگان و متن‌باز مجهز به مدل‌های پیشرفته AI که عکس‌های کوچک، تار، تاریک یا قدیمی را بدون مات شدن تا ۸ برابر بزرگ و شفاف می‌کند.',
    howToUse: 'نرم‌افزار کم‌حجم آن را برای ویندوز، مک یا لینوکس دانلود کنید، عکستان را انتخاب کرده و دکمه Upscale را بزنید.',
    linkUrl: 'https://upscayl.org',
    buttonLabel: '🖼️ دانلود برنامه رایگان Upscayl',
    category: 'ai_tools',
    tags: ['افزایش_کیفیت_عکس', 'رزولوشن_بالا', 'ابزار_رایگان', 'هوش_مصنوعی'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-ai-phind',
    title: 'Phind AI | دستیار فوق‌العاده برای برنامه‌نویسی و حل خطاهای کدنویسی',
    summary: 'هوش مصنوعی بهینه‌شده برای توسعه‌دهندگان نرم‌افزار، طراحان سایت و دانشجویان کامپیوتر. کد را کپی کنید تا خطاها را تصحیح کند و بهترین روش پیاده‌سازی را توضیح دهد.',
    howToUse: 'بدون نیاز به ثبت نام سوال برنامه‌نویسی، تکه کد یا ارور دریافتی خود را وارد کنید.',
    linkUrl: 'https://www.phind.com',
    buttonLabel: '💻 تست دستیار کدنویسی Phind',
    category: 'ai_tools',
    tags: ['برنامه‌نویسی', 'کدنویسی', 'حل_باگ', 'هوش_مصنوعی', 'توسعه_وب'],
    importance: 'normal',
    createdAt: new Date().toISOString()
  },

  // --- B. Cool & Useful Websites (سایت‌های شگفت‌انگیز و ناشناخته اینترنت) ---
  {
    id: 'tool-web-12ft',
    title: '12ft Ladder | مطالعه رایگان مقالات سایت‌های پولی و اشتراکی بدون پرداخت',
    summary: 'وقتی به مقاله‌ای در سایت‌های خارجی مثل مدیوم یا ژورنال‌ها برخورد می‌کنید که پولی است و اشتراک می‌خواهد، کافیست لینک آن را به این سایت بدهید تا دیوار پرداخت را بردارد.',
    howToUse: 'کافیست قبل از آدرس هر سایت عبارت 12ft.io/ را بگذارید یا لینک صفحه را در کادر جستجوی 12ft وارد کنید.',
    linkUrl: 'https://12ft.io',
    buttonLabel: '🪜 دور زدن دیوار پرداخت در 12ft',
    category: 'cool_websites',
    tags: ['سایت_کاربردی', 'مقالات_رایگان', 'اینترنت_آزاد', 'دانشگاهی', 'ترفند_وب'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-web-tinywow',
    title: 'TinyWow | جعبه‌ابزار همه‌کاره اینترنت با ۲۰۰ ابزار رایگان بدون نیاز به نصب',
    summary: 'تمام ابزارهای ادیت PDF، تبدیل فایل‌ها، حذف پس‌زمینه ویدیو، دانلودر، فشرده‌سازی عکس، استخراج صدا از فیلم و ده‌ها ابزار اداری همگی در یک سایت و ۱۰۰٪ رایگان.',
    howToUse: 'وارد سایت شده، ابزار مورد نظر مثل PDF to Word یا Remove Background را انتخاب کنید و در چند ثانیه فایل نهایی را تحویل بگیرید.',
    linkUrl: 'https://tinywow.com',
    buttonLabel: '🛠️ جعبه ابزار ۲۰۰ کاره TinyWow',
    category: 'cool_websites',
    tags: ['جعبه_ابزار', 'رایگان', 'پی_دی_اف', 'کانورتور', 'کاربردی'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-web-snapdrop',
    title: 'Snapdrop | ایردراپ تحت وب برای انتقال برق‌آسای فایل بین آیفون، اندروید و ویندوز',
    summary: 'دیگر نیازی به کابل، تلگرام یا فلش مموری برای انتقال عکس و فیلم بین گوشی و لپ‌تاپ ندارید! با وصل شدن به یک وای‌فای مشترک در هر دو دستگاه این سایت را باز کنید تا مثل AirDrop اپل فایل‌ها را جابجا کنید.',
    howToUse: 'در هر دو دستگاه (مثلاً گوشی و لپ‌تاپ) وارد سایت snapdrop.net شوید. روی آیکون دستگاه دیگر ضربه بزنید و فایلتان را ارسال کنید.',
    linkUrl: 'https://snapdrop.net',
    buttonLabel: '⚡ انتقال فوری فایل با Snapdrop',
    category: 'cool_websites',
    tags: ['انتقال_فایل', 'ایردراپ', 'اندروید', 'آیفون', 'ویندوز', 'شبکه'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-web-alternativeto',
    title: 'AlternativeTo | کشف جایگزین‌های رایگان و متن‌باز برای برنامه‌های گران‌قیمت',
    summary: 'دنبال جایگزین رایگان برای فتوشاپ، آفیس، پریمیر یا نوتین هستید؟ این سایت بهترین نرم‌افزارهای رایگان و متن‌باز را بر اساس امتیاز کاربران معرفی می‌کند.',
    howToUse: 'نام برنامه پولی مورد نظرتان (مثلاً Photoshop) را سرچ کنید و فیلتر را روی Free یا Open Source بگذارید تا بهترین جایگزین‌ها را ببینید.',
    linkUrl: 'https://alternativeto.net',
    buttonLabel: '🔄 پیدا کردن برنامه جایگزین',
    category: 'cool_websites',
    tags: ['نرم_افزار_رایگان', 'اپلیکیشن', 'جایگزین_برنامه', 'کاربردی'],
    importance: 'normal',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-web-virustotal',
    title: 'VirusTotal | اسکن همزمان فایل‌ها و لینک‌ها با ۷۰ آنتی‌ویروس معتبر دنیا',
    summary: 'قبل از باز کردن هر فایل دانلودی، برنامه کرک‌شده یا لینک مشکوک، آن را در این سایت متعلق به گوگل تست کنید تا مطمئن شوید حاوی بدافزار، جاسوس‌افزار یا تروجان نیست.',
    howToUse: 'فایل مشکوک تا حجم ۶۵۰ مگابایت را آپلود کنید یا آدرس لینک را در تب URL وارد کنید تا گزارش ۷۰ شرکت امنیتی را همزمان مشاهده فرمایید.',
    linkUrl: 'https://www.virustotal.com',
    buttonLabel: '🛡️ اسکن امنیتی در VirusTotal',
    category: 'cool_websites',
    tags: ['امنیت', 'آنتی_ویروس', 'ضد_ویروس', 'اسکن_فایل', 'امنیت_دیجیتال'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-web-printfriendly',
    title: 'PrintFriendly | پرینت و ذخیره صفحات وب به شکل PDF بدون تبلیغات مزاحم',
    summary: 'هر صفحه وب و مقاله‌ای را به نسخه تمیز با فونت خوانا، بدون بنرهای تبلیغاتی، منوهای مزاحم و ویدیوهای جانبی تبدیل و به صورت PDF تمیز ذخیره کنید.',
    howToUse: 'لینک صفحه مقاله را وارد کنید، روی دکمه Preview بزنید و با یک کلیک خروجی PDF تمیز بگیرید.',
    linkUrl: 'https://www.printfriendly.com',
    buttonLabel: '📄 پاکسازی و خروجی PDF',
    category: 'cool_websites',
    tags: ['پی_دی_اف', 'پرینت_تمیز', 'حذف_تبلیغات', 'مطالعه'],
    importance: 'normal',
    createdAt: new Date().toISOString()
  },

  // --- C. Mobile & Computer Hacks (ترفندهای طلایی موبایل، ویندوز و شبکه‌های اجتماعی) ---
  {
    id: 'tool-hack-storage',
    title: '🧹 ترفند آزادسازی فوری ۵ تا ۱۵ گیگابایت از حافظه گوشی بدون پاک شدن حتی یک عکس!',
    summary: 'دلیل اصلی پر شدن حافظه گوشی فایل‌های کش موقت پیام‌رسان‌ها به خصوص تلگرام و اینستاگرام است. با این ترفند ساده، حجم زیادی از رم و حافظه داخلی آزاد شده و گوشی به طرز چشمگیری سریع می‌شود.',
    howToUse: 'در تلگرام به Settings > Data and Storage > Storage Usage بروید. گزینه Auto-Remove Cached Media را روی ۳ روز تنظیم کرده و دکمه Clear Cache را بزنید. عکس‌ها و فایل‌های شما در چت‌ها باقی می‌مانند و هر زمان نیاز داشتید مجدد لود می‌شوند.',
    category: 'mobile_hacks',
    tags: ['ترفند_موبایل', 'افزایش_سرعت', 'خالی_کردن_حافظه', 'تلگرام', 'اندروید', 'آیفون'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-hack-battery',
    title: '🔋 ترفند طلایی افزایش ۲ برابری طول عمر باتری آیفون و اندروید',
    summary: 'شارژ کردن مداوم گوشی تا ۱۰۰٪ یا تخلیه تا صفر درصد، چرخه شیمیایی باتری‌های لیتیومی را به سرعت فرسوده می‌کند. همچنین اسکن دائمی وای‌فای و بلوتوث در پس‌زمینه باتری‌خوری شدیدی ایجاد می‌کند.',
    howToUse: '۱. در تنظیمات باتری گزینه Protect Battery (شارژ تا ۸۰ الی ۸۵ درصد) را فعال کنید.\n۲. در تنظیمات جستجو عبارت Wi-Fi Scanning را پیدا کرده و هر دو گزینه اسکن وای‌فای و بلوتوث در پس‌زمینه را خاموش نمایید.',
    category: 'mobile_hacks',
    tags: ['سلامت_باتری', 'عمر_باتری', 'شارژ_گوشی', 'ترفند_موبایل', 'کاربردی'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-hack-windows',
    title: '⌨️ ۳ میانبر جادویی کیبورد در ویندوز که ساعت‌ها وقت شما را نجات می‌دهد',
    summary: 'میانبرهای شگفت‌انگیزی که اکثر کاربران از آن بی‌خبرند و راندمان کار با کامپیوتر و لپ‌تاپ را چند برابر می‌کنند.',
    howToUse: '۱. کلید Win + V: باز کردن تاریخچه کامل کلیپ‌بورد (دیدن تمام متن‌ها و تصاویری که قبلاً کپی کرده‌اید).\n۲. کلید Win + Shift + S: اسکرین‌شات گرفتن از ناحیه دلخواه و کپی خودکار در حافظه.\n۳. کلید Ctrl + Shift + Esc: باز کردن آنی تسک منیجر بدون اتلاف وقت.',
    category: 'mobile_hacks',
    tags: ['ویندوز', 'ترفند_کیبورد', 'میانبر', 'افزایش_بهره_وری', 'لپ_تاپ'],
    importance: 'trending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-hack-read-unsent',
    title: '👁️ ترفند خواندن پیام‌های پاک‌شده یا بدون تیک آبی در تلگرام و واتساپ',
    summary: 'آیا می‌دانستید می‌توانید پیام‌هایی که فرستنده برای همه حذف کرده (Delete for Everyone) را همچنان به راحتی بخوانید بدون اینکه نیاز به نصب برنامه‌های هک باشد؟',
    howToUse: 'در گوشی‌های اندروید وارد Settings > Notifications > Advanced settings شوید و گزینه Notification history (تاریخچه اعلان‌ها) را روشن کنید. تمام پیام‌های دریافتی حتی پس از پاک شدن در این لیست به همراه ساعت ثبت می‌مانند!',
    category: 'mobile_hacks',
    tags: ['پیام_پاک_شده', 'ترفند_تلگرام', 'واتساپ', 'اندروید', 'راز_موبایل'],
    importance: 'trending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-hack-find-phone',
    title: '📍 نحوه پیدا کردن و به صدا درآوردن گوشی گم‌شده حتی اگر کاملاً سایلنت باشد',
    summary: 'اگر گوشی خود را در خانه یا بیرون گم کرده‌اید و روی حالت بی‌صدا (Silent) است، با این روش رسمی گوگل و اپل می‌توانید آن را با حداکثر بلندی صدا به زنگ درآورید یا از راه دور موقعیت مکانی‌اش را روی نقشه ردیابی و قفل کنید.',
    howToUse: 'از طریق کامپیوتر یا گوشی دیگر وارد سایت google.com/android/find یا icloud.com/find شوید، با اکانت جیمیل یا اپل‌آیدی خود وارد شوید و دکمه Play Sound را بزنید تا گوشی به مدت ۵ دقیقه با بلندترین صدا زنگ بخورد.',
    linkUrl: 'https://www.google.com/android/find',
    buttonLabel: '📱 تست سرویس ردیابی گوشی',
    category: 'mobile_hacks',
    tags: ['گوشی_گمشده', 'ردیابی_موبایل', 'ضد_سرقت', 'امنیت_گوشی'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },

  // --- D. Cyber Security & Anti-Fraud (امنیت دیجیتال، ضد هک و محافظت از دارایی) ---
  {
    id: 'tool-sec-telegram-2fa',
    title: '🔐 راهنمای حیاتی فعال‌سازی تایید دو مرحله‌ای (2FA) در تلگرام جهت ضد هک ۱۰۰٪',
    summary: 'کد پیامکی تلگرام به تنهایی کافی نیست! در صورتی که سیمکارت شما شبیه‌سازی شود یا کسی به پیامک‌ها دسترسی یابد، اکانت شما تصاحب می‌شود. فعال‌سازی رمز ابری (Cloud Password) نفوذ را غیرممکن می‌سازد.',
    howToUse: 'در تلگرام وارد مسیر Settings > Privacy and Security > Two-Step Verification شوید. یک رمز قوی تعیین کرده و حتماً ایمیل ریکاوری معتبر خود را ثبت کنید.',
    category: 'cyber_security',
    tags: ['امنیت_تلگرام', 'ضد_هک', 'تایید_دومرحله_ای', 'حریم_خصوصی', 'امنیت_سایبری'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-sec-active-sessions',
    title: '🚨 از کجا بفهمیم تلگرام یا اینستاگرام ما روی دستگاه دیگری هک شده یا باز است؟',
    summary: 'بررسی دوره‌ای نشست‌های فعال (Active Sessions) ساده‌ترین و مطمئن‌ترین راه برای مچ‌گیری از هرگونه دسترسی غیرمجاز به گفتگوها و حساب‌های شخصی شماست.',
    howToUse: 'در تلگرام به Settings > Devices بروید. تمام گوشی‌ها، کامپیوترها و مرورگرهایی که به اکانت شما وصل هستند نمایش داده می‌شوند. در صورت مشاهده هر دستگاه غریبه، روی آن لمس کرده و دکمه Terminate Session را بزنید.',
    category: 'cyber_security',
    tags: ['ضد_هک', 'امنیت_حساب', 'تلگرام', 'حریم_شخصی', 'دستگاه_های_فعال'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-sec-phishing-guide',
    title: '⚠️ ۵ نشانه قطعی پیامک‌ها و لینک‌های جعلی کلاهبرداری بانکی و فیشینگ',
    summary: 'پیامک‌های با عنوان «سهام عدالت»، «ابلاغیه ثنا / سامانه قوه قضاییه»، «قطع یارانه» یا «بسته پستی برگشتی» همگی ترفندهای فیشینگ برای خالی کردن حساب بانکی هستند.',
    howToUse: '۱. مراجع دولتی هرگز از شماره موبایل شخصی پیامک نمی‌فرستند.\n۲. لینک‌های رسمی همگی به .ir ختم می‌شوند نه به دامنه‌های رایگان مثل .xyz یا .site.\n۳. هرگز در صفحه‌ای که آدرس درگاه آن shaparak.ir نیست، رمز دوم یا CVV2 کارتتان را وارد نکنید.',
    category: 'cyber_security',
    tags: ['کلاهبرداری_بانکی', 'فیشینگ', 'امنیت_کارت_بانکی', 'اطلاع_رسانی'],
    importance: 'essential',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-sec-haveibeenpwned',
    title: '🔍 تست رایگان نشت اطلاعات شماره موبایل و ایمیل در دارک‌وب و سرقت‌های اینترنتی',
    summary: 'با بررسی دیتابیس سایت مشهور Have I Been Pwned می‌توانید بررسی کنید که آیا مشخصات، ایمیل یا پسورد شما در حملات هکری و نشت اطلاعات سایت‌های مختلف لو رفته است یا خیر.',
    howToUse: 'وارد سایت haveibeenpwned.com شوید، آدرس ایمیل یا شماره همراهتان (با کد 98+) را وارد کنید تا نتیجه کامل بررسی شود.',
    linkUrl: 'https://haveibeenpwned.com',
    buttonLabel: '🛡️ استعلام وضعیت نشت پسوردها',
    category: 'cyber_security',
    tags: ['امنیت_رمز_عبور', 'دارک_وب', 'تست_نفوذ', 'هک_ایمیل'],
    importance: 'trending',
    createdAt: new Date().toISOString()
  }
];

// ==========================================
// 2. EXTENDED DIVERSE AI PROMPTS (جهت رفع قطعی مشکل تکرار پرامپت‌ها)
// ==========================================
export const EXTENDED_AI_PROMPTS: AiPrompt[] = [
  // --- A. Text Prompts for ChatGPT / Claude (کاری، درآمدزایی، زبان، برنامه‌نویسی) ---
  {
    id: 'prompt-text-english-tutor',
    title: 'تبدیل چت‌جی‌پی‌تی به استاد خصوصی مکالمه زبان انگلیسی بدون اشتباه',
    category: 'chat',
    description: 'پرامپت فوق‌العاده برای تقویت مکالمه و اسپیکینگ زبان انگلیسی؛ مدل نقش پارتنر زبان را بازی کرده، اشتباهات گرامری را به آرامی تصحیح می‌کند و اصطلاحات طبیعی بومی را آموزش می‌دهد.',
    promptText: 'Act as my personal native English speaking coach. Let\'s have a casual conversation about daily life and hobbies. Every time I reply, gently point out any grammatical errors or awkward phrasing, suggest a more natural native alternative, and then continue the conversation by asking an open-ended question. Let\'s start: introduce yourself and ask me how my day was.',
    tags: ['مکالمه_انگلیسی', 'آموزش_زبان', 'چت‌جی‌پی‌تی', 'پرامپت_متنی', 'کلود'],
    importance: 'hot',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prompt-text-interview-coach',
    title: 'شبیه‌ساز هوشمند مصاحبه استخدامی و شغلی همراه با فیدبک دقیق',
    category: 'chat',
    description: 'تمرین مصاحبه کاری قبل از جلسه واقعی. هوش مصنوعی سوالات تخصصی و چالش‌برانگیز شغلی مطرح کرده و به پاسخ‌های شما نمره و پیشنهاد ارتقا می‌دهد.',
    promptText: 'I want you to act as an expert HR hiring manager and senior technical interviewer for the position of [Insert Job Title]. Ask me realistic, tough interview questions one by one. After each of my answers, provide constructive critique: what was strong, what was missing, and how to frame it using the STAR method, then ask the next question.',
    tags: ['مصاحبه_کاری', 'استخدام', 'رزومه', 'موفقیت_شغلی', 'پرامپت_متنی'],
    importance: 'hot',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prompt-text-copywriter',
    title: 'پرامپت طلایی کپی‌رایتینگ و نوشتن کپشن‌های پرفروش اینستاگرام',
    category: 'chat',
    description: 'نگارش پست و کپشن‌های جذاب بر اساس متد بازاریابی AIDA (جلب توجه، علاقه، اشتیاق، دعوت به اقدام) همراه با قلاب‌های روانشناسی جلب توجه مخاطب.',
    promptText: 'Act as a world-class direct-response copywriter. Write a high-converting social media caption for a product/service about [Insert Topic]. Include 3 viral hook options, a relatable story-driven body using the AIDA framework, bullet points of key benefits, and a compelling Call-to-Action (CTA).',
    tags: ['کپی_رایتینگ', 'کپشن_نویسی', 'اینستاگرام', 'افزایش_فروش', 'مارکتینگ'],
    importance: 'hot',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prompt-text-code-refactor',
    title: 'اصلاح، بازنویسی و بالا بردن امنیت کدهای برنامه‌نویسی با متد Clean Code',
    category: 'chat',
    description: 'ارتقای کیفیت کدهای نرم‌افزاری، بهینه‌سازی سرعت اجرا، رفع حفره‌های امنیتی و افزودن کامنت‌های مستندسازی به تمیزترین شکل ممکن.',
    promptText: 'Act as a principal software architect. Review the following code snippet. Refactor it to adhere to SOLID principles and Clean Code standards. Improve performance, handle edge cases, eliminate memory leaks, and add clear explanatory comments for critical logic.',
    tags: ['برنامه‌نویسی', 'کد_تمیز', 'ریفرکتور', 'امنیت_کد', 'توسعه_دهنده'],
    importance: 'normal',
    createdAt: new Date().toISOString()
  },

  // --- B. Realistic & Aesthetic Image Prompts (Midjourney V6, Flux, Leonardo) ---
  {
    id: 'prompt-flux-cinematic-portrait',
    title: 'پرتره سینمایی با نور شمع در کافه بارانی سبک فیلم‌های کریستوفر نولان',
    category: 'image',
    styleCategory: 'cinematic',
    description: 'شات پرتره بسیار احساسی و عمیق، بازتاب نور ملایم شمع روی چهره، پنجره‌های خیس از باران شبانه، عکاسی ۳۵ میلی‌متری فیلمی با رنگ‌های گرم و غنی.',
    promptText: 'cinematic 35mm film photography portrait of a person sitting in a dimly lit cozy cafe, warm candlelight illuminating facial features, heavy raindrops streaking on window glass behind, anamorphic lens flare, Kodak Vision3 500T aesthetic, directed by Christopher Nolan, 8k --ar 16:9 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/9qbfr7mlnt8sn7yp01pw02z7ez1r-midjourney-6-close-up-of-a-stunning-fashion-model-ultra-realistic-portrait-shot-on-a-sony-a7iii-high-quality-ar-3564-stylize.png',
    tipsForPersonalPhoto: 'عکس با نگاه نافذ و نور گرم جانبی بهترین نتیجه را برای ترکیب چهره ارائه می‌دهد.',
    tags: ['سینمایی', 'نولان', 'بارانی', 'کافه', 'عکاسی_آنالوگ'],
    importance: 'hot',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prompt-flux-cyberpunk-tokyo',
    title: 'شخصیت آینده‌نگرانه سایبرپانک در خیابان‌های نئونی بارانی توکیو',
    category: 'image',
    styleCategory: 'cyberpunk',
    description: 'استایل فوق‌العاده با ژاکت چرمی مجهز به نوارهای نوری LED، تابلوهای نئونی هولوگرافیک، آسفالت خیس و بازتاب خیره‌کننده رنگ‌های فیروزه‌ای و بنفش.',
    promptText: 'futuristic cyberpunk nomad standing in a neon-drenched Tokyo alleyway at night, wet reflective asphalt reflecting vivid magenta and cyan neon signs, wearing high-tech streetwear with subtle fiber-optic accents, cinematic atmospheric haze, octane render, 8k --ar 9:16 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/xjsos7jl5jltflxms50aa37a4bw5-midjourney-6-japanese-girl-18-21-years-old-brown-hair-high-quality-photo-portrait-shot-on-a-polaroid-camera-double-eyelid-ar.png',
    tipsForPersonalPhoto: 'سلفی با پس‌زمینه شهری یا زاویه کمی از پایین جذابیت کاراکتر را دوچندان می‌کند.',
    tags: ['سایبرپانک', 'نئون', 'توکیو', 'آینده', 'طراحی_کاراکتر'],
    importance: 'hot',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prompt-midjourney-3d-clay-avatar',
    title: 'آواتار سه بعدی بامزه سبک خمیری مدرن و انیمیشن‌های نرم استاپ‌موشن',
    category: 'image',
    styleCategory: 'claymation',
    description: 'تبدیل عکس به کاراکتر بسیار دوست‌داشتنی و ترند سبک خمیری با بافت نرم، چشمان کنجکاو، نورپردازی ایزومتریک و بک‌گراند پاستلی مینیمال.',
    promptText: 'cute stylized 3D claymation avatar of a person, smooth plasticine clay texture, tactile handmade craft feel, joyful friendly facial expression, pastel minimalist background, soft studio ambient occlusion lighting, Blender 3D render, trending on Behance --ar 1:1 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/7nqvhyrmf607ngkesub1l7kxc9j3-midjourney-6-chroma-portrait.png',
    tipsForPersonalPhoto: 'عکس با لبخند باز و زاویه روبرو بهترین مدل خمیری را خواهد ساخت.',
    tags: ['خمیری', 'استاپ_موشن', 'آواتار_۳بعدی', 'طراحی_کاراکتر', 'بلندر'],
    importance: 'hot',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prompt-midjourney-luxury-interior',
    title: 'طراحی دکوراسیون و ویلای مدرن مینیمال در دل صخره‌های جنگلی بارانی',
    category: 'image',
    styleCategory: 'architecture',
    description: 'معماری مدرن با دیوارهای شیشه‌ای قدی، بتن اکسپوز، استخر اینفینیتی و مبلمان مدرن اسکاندیناوی، محصور در درختان جنگل مه‌آلود.',
    promptText: 'breathtaking luxury minimalist brutalist villa perched on a misty forest cliff edge, floor-to-ceiling glass walls, warm interior architectural lights glowing at dusk, infinity pool reflecting the moody sky, designed by Tadao Ando, Architectural Digest photography, 8k --ar 16:9 --v 6.0',
    imageUrl: 'https://cdn.prompthero.com/zgkq5uftglj1q0xkl07ycr2n839i-midjourney-6-model-portrait.png',
    tipsForPersonalPhoto: 'می‌توانید عکس خود را در حال استراحت در تراس این ویلا قرار دهید.',
    tags: ['معماری_مدرن', 'دکوراسیون', 'ویلای_لوکس', 'مینیمال', 'طراحی_داخلی'],
    importance: 'normal',
    createdAt: new Date().toISOString()
  }
];
