const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const target = `await callTelegramApi('setWebhook', { url: webhookUrl });`;
const replacement = `await callTelegramApi('setWebhook', { 
        url: webhookUrl,
        allowed_updates: ["message", "callback_query", "channel_post", "poll", "poll_answer"] 
      });`;
code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log('done');
