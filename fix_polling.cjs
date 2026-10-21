const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
const target = `const url = \`https://api.telegram.org/bot\${token}/getUpdates?offset=\${botOffset}&timeout=10\`;`;
const replacement = `const url = \`https://api.telegram.org/bot\${token}/getUpdates?offset=\${botOffset}&timeout=10&allowed_updates=["message","callback_query","channel_post","poll","poll_answer"]\`;`;
code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log('done');
