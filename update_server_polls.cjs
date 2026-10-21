const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const defaultPolls = `
const DEFAULT_SMART_POLLS = [
  {
    question: "شما بیشتر از چه نوع پروکسی یا کانفیگی استفاده می‌کنید؟",
    options: ["Vless / Reality 🚀", "Vmess 🛡️", "Trojan 🐎", "MTProto Proxy ⚡", "سایر / VPNهای پولی 💰"]
  },
  {
    question: "از نظر شما مهم‌ترین ویژگی یک فیلترشکن خوب چیست؟",
    options: ["سرعت بالا برای دانلود و ویدیو 🎥", "پایداری و قطعی کم ⏱️", "پینگ پایین برای بازی 🎮", "رایگان بودن 💸", "مصرف باتری کم 🔋"]
  },
  {
    question: "بیشتر از کدام هوش مصنوعی استفاده می‌کنید؟",
    options: ["ChatGPT (OpenAI) 🧠", "Claude (Anthropic) 📝", "Gemini (Google) 🌐", "Copilot (Microsoft) 💻", "هیچکدام / سایر 🤷‍♂️"]
  },
  {
    question: "سیستم عامل اصلی گوشی شما چیست؟",
    options: ["Android (اندروید) 🤖", "iOS (آیفون) 🍎", "سایر 📱"]
  },
  {
    question: "اینترنت اصلی که با آن به پروکسی‌ها وصل می‌شوید کدام است؟",
    options: ["ایرانسل 💛", "همراه اول 🩵", "رایتل 💜", "مخابرات (ADSL) 📞", "سایر شرکت‌های خانگی 🏠"]
  },
  {
    question: "آیا تا به حال با آموزش‌های کانال توانسته‌اید پروکسی شخصی خود را بسازید؟",
    options: ["بله، خیلی راحت بود ✅", "بله، ولی سخت بود 🛠️", "نه، هنوز فرصت نکردم ⏳", "نه، خیلی پیچیده است ❌"]
  }
];

async function executeSmartPollsAutoPost(channelTarget: 1 | 2, targetChannelHandle: string) {
  if (!db.settings.isBotRunning || !targetChannelHandle) return false;
  
  // Pick a random poll
  const poll = DEFAULT_SMART_POLLS[Math.floor(Math.random() * DEFAULT_SMART_POLLS.length)];
  
  const payload = {
    chat_id: targetChannelHandle,
    question: poll.question,
    options: JSON.stringify(poll.options),
    is_anonymous: true,
    type: 'regular',
    allows_multiple_answers: false
  };

  try {
    const res = await callTelegramApi('sendPoll', payload);
    if (res && res.message_id) {
      addLog('success', \`نظرسنجی خودکار با موفقیت در \${targetChannelHandle} ارسال شد: \${poll.question}\`);
      
      const nowStr = new Date().toISOString();
      if (channelTarget === 1) {
        db.settings.autoPost.lastSmartPollPostedAt = nowStr;
      } else if (db.settings.autoPost.channel2) {
        db.settings.autoPost.channel2.lastSmartPollPostedAt = nowStr;
      }
      
      // We don't save poll results here since it's just the initial post. 
      // The webhook updates will catch the votes.
      saveDatabase();
      return true;
    }
    return false;
  } catch (err: any) {
    addLog('error', \`خطا در ارسال نظرسنجی خودکار به \${targetChannelHandle}: \${err.message}\`);
    return false;
  }
}
`;

const insertTarget = `// --- 6. Digital Tools / AI Toolbox Auto-Post ---`;
code = code.replace(insertTarget, defaultPolls + '\n\n' + insertTarget);

fs.writeFileSync('server.ts', code);
console.log('done server polls setup');
