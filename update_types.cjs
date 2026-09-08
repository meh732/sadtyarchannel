const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

const target1 = `  digitalToolsIntervalHours?: number; // e.g. 1, 2, 4, 6, 8, 12, 24
  digitalToolsIntervalMinutes?: number; // e.g. 30, 45, 60, 120, etc.
  digitalToolsCount?: number; // 1, 2, 3, etc.
  lastDigitalToolsPostedAt?: string | null;`;

const replacement1 = `  digitalToolsIntervalHours?: number; // e.g. 1, 2, 4, 6, 8, 12, 24
  digitalToolsIntervalMinutes?: number; // e.g. 30, 45, 60, 120, etc.
  digitalToolsCount?: number; // 1, 2, 3, etc.
  lastDigitalToolsPostedAt?: string | null;

  // 7. Smart Polls (Engagement / Analysis)
  smartPollsEnabled?: boolean;
  smartPollsIntervalMinutes?: number;
  smartPollsIntervalHours?: number;
  smartPollsCount?: number;
  lastSmartPollPostedAt?: string | null;`;

code = code.replace(target1, replacement1);

const target2 = `  digitalToolsIntervalHours?: number;
  digitalToolsIntervalMinutes?: number;
  digitalToolsCount?: number;
  lastDigitalToolsPostedAt?: string | null;`;

const replacement2 = `  digitalToolsIntervalHours?: number;
  digitalToolsIntervalMinutes?: number;
  digitalToolsCount?: number;
  lastDigitalToolsPostedAt?: string | null;

  smartPollsEnabled?: boolean;
  smartPollsIntervalMinutes?: number;
  smartPollsIntervalHours?: number;
  smartPollsCount?: number;
  lastSmartPollPostedAt?: string | null;`;

code = code.replace(target2, replacement2);
fs.writeFileSync('src/types.ts', code);
console.log('done src/types.ts');
