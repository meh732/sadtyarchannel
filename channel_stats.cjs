const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const statsLogic = `
async function trackChannelStats() {
  if (!db.settings.botToken) return;
  const channels = new Set();
  
  if (db.settings.autoPost?.targetChannel) {
    channels.add(db.settings.autoPost.targetChannel);
  }
  if (db.settings.autoPost?.channel2?.targetChannel) {
    channels.add(db.settings.autoPost.channel2.targetChannel);
  }
  
  for (const channel of channels) {
    const handle = channel.startsWith('@') ? channel : '@' + channel.replace('@', '');
    try {
      const resp = await callTelegramApi('getChatMemberCount', { chat_id: handle });
      if (resp && typeof resp === 'number') {
        if (!db.channelStats) db.channelStats = [];
        db.channelStats.push({
          id: 'stat-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          channelHandle: handle,
          memberCount: resp,
          recordedAt: new Date().toISOString()
        });
        
        // Keep last 365 entries (e.g. 2 years of daily data per channel, or more depending on frequency)
        if (db.channelStats.length > 2000) {
          db.channelStats = db.channelStats.slice(-2000);
        }
      }
    } catch (err) {
      console.warn('Failed to get chat member count for ' + handle + ':', err?.message || err);
    }
  }
}
`;

const target1 = `function setupIntervals() {`;
code = code.replace(target1, statsLogic + '\n' + target1);

const target2 = `  // Post monitoring check (every 15 minutes)`;
const statInterval = `  // Track Channel Stats (every 12 hours)
  setInterval(() => {
    trackChannelStats().catch(err => console.error('Error tracking stats:', err));
  }, 12 * 60 * 60 * 1000);
  
  // Also run once on startup after 30 seconds
  setTimeout(() => trackChannelStats().catch(() => {}), 30 * 1000);
  
`;

code = code.replace(target2, statInterval + target2);
fs.writeFileSync('server.ts', code);
console.log('done');
