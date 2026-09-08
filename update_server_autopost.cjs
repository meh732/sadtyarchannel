const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target1 = `  digitalToolsIntervalHours: 4,
  digitalToolsCount: 1,`;

const replacement1 = `  digitalToolsIntervalHours: 4,
  digitalToolsCount: 1,
  smartPollsEnabled: true,
  smartPollsIntervalHours: 24,
  smartPollsCount: 1,`;

code = code.replace(target1, replacement1);

const target2 = `  digitalToolsIntervalHours: 6,
  digitalToolsCount: 1,`;

const replacement2 = `  digitalToolsIntervalHours: 6,
  digitalToolsCount: 1,
  smartPollsEnabled: false,
  smartPollsIntervalHours: 24,
  smartPollsCount: 1,`;

code = code.replace(target2, replacement2);
fs.writeFileSync('server.ts', code);
console.log('done server defaults');
