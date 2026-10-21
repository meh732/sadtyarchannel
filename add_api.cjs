const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newApi = `
  // API: Get Channel Stats
  app.get('/api/bot/channel-stats', (req, res) => {
    try {
      res.json({ success: true, stats: db.channelStats || [] });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
  
  // API: Get Poll Results
  app.get('/api/bot/poll-results', (req, res) => {
    try {
      res.json({ success: true, polls: db.pollResults || [] });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // API: Restart/Start Bot
`;

const target = `  // API: Restart/Start Bot`;
code = code.replace(target, newApi);
fs.writeFileSync('server.ts', code);
console.log('done');
