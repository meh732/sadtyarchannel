const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const injection = `
  // Auto refresh Tech News/Tricks content & purge old items every 6 hours
  setInterval(() => {
    refreshTechContentAndPurgeOld().catch(err => console.error('Tech auto-refresh error:', err));
  }, 6 * 60 * 60 * 1000);

  // Auto refresh AI Prompts every 2 hours
  setInterval(() => {
    refreshAiPromptsAndPurgeOld().catch(err => console.error('AiPrompts auto-refresh error:', err));
  }, 2 * 60 * 60 * 1000);
`;

code = code.replace(/\/\/ Auto refresh Tech News\/Tricks content & purge old items every 6 hours\n  setInterval\(\(\) => \{\n    refreshTechContentAndPurgeOld\(\)\.catch\(err => console\.error\('Tech auto-refresh error:', err\)\);\n  \}, 6 \* 60 \* 60 \* 1000\);/g, injection);

const initInjection = `
  // Run initial checks shortly after startup
  setTimeout(() => {
    monitorChannelPosts();
    checkAndTriggerBackup();
    refreshTechContentAndPurgeOld().catch(() => {});
    refreshAiPromptsAndPurgeOld().catch(() => {});
  }, 5 * 1000);
`;

code = code.replace(/\/\/ Run initial checks shortly after startup\n  setTimeout\(\(\) => \{\n    monitorChannelPosts\(\);\n    checkAndTriggerBackup\(\);\n    refreshTechContentAndPurgeOld\(\)\.catch\(\(\) => \{\}\);\n  \}, 5 \* 1000\);/g, initInjection);

fs.writeFileSync('server.ts', code);
console.log('Injected successfully');
