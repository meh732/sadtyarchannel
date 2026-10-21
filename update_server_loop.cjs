const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const ch1Insert = `
    // 7. Smart Polls
    if (ap.smartPollsEnabled === true) {
      const pollsMinutes = Number(ap.smartPollsIntervalMinutes) || (Number(ap.smartPollsIntervalHours) ? Number(ap.smartPollsIntervalHours) * 60 : 360);
      const intervalMs = Math.max(30, pollsMinutes) * 60 * 1000;
      const lastTime = ap.lastSmartPollPostedAt;
      const elapsed = lastTime ? (now - new Date(lastTime).getTime()) : Infinity;
      if (elapsed >= intervalMs) {
        let p = 1; // lowest priority
        if (ap.smartGoldenHours !== false && tehran.isGoldenHour) p = 1; 
        candidates.push({
          category: 'polls',
          isDue: true,
          timeSinceDueMs: elapsed - intervalMs,
          goldenPriority: p,
          run: () => executeSmartPollsAutoPost(1, ap.targetChannel)
        });
      }
    }
`;

const ch2Insert = `
    // 7. Smart Polls for Channel 2
    if (ap2.smartPollsEnabled === true) {
      const pollsMinutes2 = Number(ap2.smartPollsIntervalMinutes) || (Number(ap2.smartPollsIntervalHours) ? Number(ap2.smartPollsIntervalHours) * 60 : 360);
      const intervalMs2 = Math.max(30, pollsMinutes2) * 60 * 1000;
      const lastTime2 = ap2.lastSmartPollPostedAt;
      const elapsed2 = lastTime2 ? (now - new Date(lastTime2).getTime()) : Infinity;
      if (elapsed2 >= intervalMs2) {
        candidates2.push({
          category: 'polls',
          timeSinceDueMs: elapsed2 - intervalMs2,
          priority: 6,
          run: () => executeSmartPollsAutoPost(2, ap2.targetChannel)
        });
      }
    }
`;

const target1 = `    // If candidates are ready, pick the single highest priority / longest waiting one
    if (candidates.length > 0) {`;

code = code.replace(target1, ch1Insert + '\n' + target1);

const target2 = `    if (candidates2.length > 0) {
      candidates2.sort((a, b) => {`;

code = code.replace(target2, ch2Insert + '\n' + target2);

fs.writeFileSync('server.ts', code);
console.log('done server loop update');
