const fs = require('fs');
let code = fs.readFileSync('before.txt', 'utf8');
code = code.replace(/^\s*\d+\t/gm, ''); // remove line numbers

let orig = fs.readFileSync('server.ts', 'utf8');

// I will just use indices to remove everything from `if (callbackData === 'get_npv_configs') {` 
// down to the end of that block.
const startIdx = orig.indexOf("    if (callbackData === 'get_npv_configs') {");
const endStr = "      return;\n    }\n\n    if (callbackData === 'get_proxies') {";
const endIdx = orig.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `
    if (callbackData === 'get_file_npvt' || callbackData === 'get_file_ovpn' || callbackData === 'get_file_txt') {
      const fileExt = callbackData === 'get_file_npvt' ? 'npvt' : callbackData === 'get_file_ovpn' ? 'ovpn' : 'txt';
      const label = fileExt === 'npvt' ? 'NapsternetV (.NPVT)' : fileExt === 'ovpn' ? 'OpenVPN (.OVPN)' : 'متنی (.TXT)';
      
      await answerCallback(\`در حال بررسی فایل‌های \${fileExt.toUpperCase()}...\`);
      
      const fileCount = db.npvFiles ? db.npvFiles.filter(f => f.filename.toLowerCase().endsWith(fileExt)).length : 0;

      if (fileCount === 0) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: \`⚠️ <b>فایل \${label} در حال حاضر موجود نیست!</b>\\n\\nسیستم به صورت خودکار در حال بروزرسانی است. لطفا دقایقی دیگر امتحان کنید.\`,
          parse_mode: 'HTML',
          reply_markup: getReplyKeyboard(userId)
        });
        return;
      }

      const qtyKeyboard = {
        inline_keyboard: [
          [
            { text: '1️⃣ یک عدد', callback_data: \`file_qty_\${fileExt}_1\`, style: 'success' },
            { text: '2️⃣ دو عدد', callback_data: \`file_qty_\${fileExt}_2\`, style: 'success' }
          ],
          [
            { text: '3️⃣ سه عدد', callback_data: \`file_qty_\${fileExt}_3\`, style: 'primary' },
            { text: '5️⃣ پنج عدد', callback_data: \`file_qty_\${fileExt}_5\`, style: 'primary' }
          ],
          [
            { text: '🔙 بازگشت به منوی اصلی', callback_data: 'back_to_main', style: 'danger' }
          ]
        ]
      };
      
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: \`♻️ <b>دریافت فایل‌های \${label}</b>\\n\\nلطفاً تعداد فایل‌های مورد نیاز خود را انتخاب کنید:\`,
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
      
      let msg = '';
      msg = \`📥 <b>کانفیگ‌های اختصاصی V2Ray (ویتوری)</b>\\n\`;
      msg += \`🔔 تعداد درخواستی: <b>\${qty} عدد</b>\\n\`;
      msg += \`⚡️ اتصال: همراه اول، ایرانسل، مخابرات و رایتل\\n\`;
      msg += \`🏷️ برندینگ انحصاری: <code>\${db.settings.branding}</code>\\n\\n\`;

      selected.forEach((conf, idx) => {
        const branded = applyBrandingToConfig(conf.raw, db.settings.branding);
        const latencyText = conf.latency ? \`(پینگ: \${conf.latency}ms)\` : '';
          
        msg += \`⚡ <b>کانفیگ \${idx + 1}</b> [\${conf.protocol.toUpperCase()}] \${latencyText}:\\n\`;
        msg += \`<code>\${branded}</code>\\n\\n\`;
      });

      if (selected.length > 1) {
        const allBrandedCombined = selected
          .map(conf => applyBrandingToConfig(conf.raw, db.settings.branding))
          .join('\\n');
        msg += \`📋 <b>کپی یکجای تمامی \${selected.length} کانفیگ با یک لمس:</b>\\n\`;
        msg += \`<code>\${allBrandedCombined}</code>\\n\\n\`;
      }

      msg += \`📍 جهت کپی روی هر کانفیگ یا کادر کپی یکجا ضربه بزنید. سپس در نرم‌افزارهای v2rayNG یا NapsternetV یا Streisand وارد (Import) کنید.\\n\\n🆔 \${db.settings.branding}\`;

      const sponsorBtn = getSponsorChannelInlineButton();
      const feedbackRows = [];
      if (selected.length > 0) {
        const upRow = selected.slice(0, 5).map((conf, idx) => ({
          text: \`👍 \${idx + 1} فعال\`,
          callback_data: \`fb_up_\${conf.id}\`
        }));
        const downRow = selected.slice(0, 5).map((conf, idx) => ({
          text: \`👎 \${idx + 1} خراب\`,
          callback_data: \`fb_down_\${conf.id}\`
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
          text: \`❌ متأسفانه در حال حاضر فایل \${label} معتبری در آرشیو ربات وجود ندارد. لطفا بعدا تلاش کنید.\`,
          reply_markup: getReplyKeyboard(userId)
        });
        return;
      }
      
      let msg = \`🌀 <b>فایل‌های اختصاصی \${label} صادر شد</b>\\n\\n\`;
      msg += \`🔔 تعداد درخواستی: <b>\${qty} عدد</b>\\n\`;
      msg += \`⚡️ اتصال: همراه اول، ایرانسل، مخابرات و رایتل\\n\`;
      msg += \`🏷️ برندینگ انحصاری: <code>\${db.settings.branding}</code>\\n\\n\`;
      msg += \`📥 تعداد \${selection.length} فایل در زیر برای شما ارسال شدند.\`;

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
          
        const cleanBranding = (db.settings.branding || 'VPN').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
        let brandedFilename = file.filename;
        if (db.settings.branding) {
          brandedFilename = brandedFilename.replace(/\\.(npv(t)?|ovpn|txt)$/i, \`_\${cleanBranding}.$1\`);
        }
          
        const caption = \`🌀 فایل کانفیگ \${label} شماره \${i + 1}\\n🆔 \${db.settings.branding}\`;
          
        try {
          const formData = new FormData();
          formData.append('chat_id', String(chatId));
          const fileBuffer = Buffer.from(file.content, 'base64');
          const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
          formData.append('document', blob, brandedFilename);
          formData.append('caption', caption);
            
          if (inlineKeyboard) {
            formData.append('reply_markup', JSON.stringify(inlineKeyboard));
          }
            
          await callTelegramApi('sendDocument', formData);
        } catch (err) {
          console.error('Error sending file to user:', err);
        }
      }
      return;
    }
`;
  const newCode = orig.substring(0, startIdx) + replacement + orig.substring(endIdx);
  fs.writeFileSync('server.ts', newCode);
  console.log("Successfully replaced block.");
} else {
  console.log("Could not find start or end block.");
  console.log("startIdx:", startIdx);
  console.log("endIdx:", endIdx);
}
