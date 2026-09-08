const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `    if (!db.funSources) db.funSources = [];
    if (!db.digitalTools) db.digitalTools = [];`;

const replacement = `    if (!db.funSources) db.funSources = [];
    if (!db.digitalTools) db.digitalTools = [];
    if (!db.channelStats) db.channelStats = [];
    if (!db.pollResults) db.pollResults = [];`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log('done');
