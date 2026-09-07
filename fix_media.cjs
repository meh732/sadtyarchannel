const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `  // 2. Try sending photo if imageUrl is available
  if (imageUrl && /^https?:\\/\\//i.test(imageUrl)) {
    // Step 2a: Attempt direct binary buffer download and upload via FormData`;

const replacement = `  let forceTextFallbackForPhoto = false;
  // 2. Try sending photo if imageUrl is available
  if (imageUrl && /^https?:\\/\\//i.test(imageUrl)) {
    if (safeFullText.length > 1000) {
      forceTextFallbackForPhoto = true;
    } else {
      // Step 2a: Attempt direct binary buffer download and upload via FormData`;

code = code.replace(target, replacement);

const target2 = `    } catch (photoErr: any) {
      addLog('warn', \`ارسال تصویر پست به \${chatId} با خطا مواجه شد (\${photoErr?.message || photoErr})، در حال ارسال متنی...\`);
    }
  }`;

const replacement2 = `    } catch (photoErr: any) {
      addLog('warn', \`ارسال تصویر پست به \${chatId} با خطا مواجه شد (\${photoErr?.message || photoErr})، در حال ارسال متنی...\`);
    }
    }
  }`;

code = code.replace(target2, replacement2);

const target3 = `  // 3. Fallback to sendMessage (Text)
  try {
    const result = await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: safeFullText,`;

const replacement3 = `  // 3. Fallback to sendMessage (Text)
  try {
    let finalPayloadText = safeFullText;
    let linkPreviewOptions = undefined;
    
    // If we forced text fallback because the caption was too long,
    // inject an invisible link at the top to force Telegram to render a rich image preview
    if (forceTextFallbackForPhoto && imageUrl) {
      finalPayloadText = \`<a href="\${imageUrl}">&#8205;</a>\\n\` + safeFullText;
      linkPreviewOptions = {
        is_disabled: false,
        url: imageUrl,
        prefer_large_media: true,
        show_above_text: true
      };
    }

    const result = await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: finalPayloadText,
      link_preview_options: linkPreviewOptions,`;

code = code.replace(target3, replacement3);
fs.writeFileSync('server.ts', code);
console.log('done');
