const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `    db = {
      settings: finalSettings,
      sources: finalSources,`;

const replacement1 = `    db = {
      settings: finalSettings,
      sources: finalSources,
      channelStats: loadedDataStore?.channelStats || [],
      pollResults: loadedDataStore?.pollResults || [],`;

code = code.replace(target1, replacement1);

const target2 = `        postedPromptHistory: db.postedPromptHistory || []
      };
      writeJsonAtomic(DB_FILE, storeData);`;

const replacement2 = `        postedPromptHistory: db.postedPromptHistory || [],
        channelStats: db.channelStats || [],
        pollResults: db.pollResults || []
      };
      writeJsonAtomic(DB_FILE, storeData);`;

code = code.replace(target2, replacement2);
fs.writeFileSync('server.ts', code);
console.log('done');
