const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newApi = `
  // API: Export AI Analysis Report
  app.get('/api/bot/export-ai-report', (req, res) => {
    try {
      const stats = db.channelStats || [];
      const polls = db.pollResults || [];
      
      let report = \`========== AI CHANNEL ANALYSIS REPORT ==========\\n\\n\`;
      report += \`Report Generated At: \${new Date().toISOString()}\\n\\n\`;
      
      report += \`--- CHANNEL GROWTH STATS ---\\n\`;
      if (stats.length === 0) {
        report += \`No growth data available yet.\\n\`;
      } else {
        const byChannel = {};
        for (const s of stats) {
          if (!byChannel[s.channelHandle]) byChannel[s.channelHandle] = [];
          byChannel[s.channelHandle].push(s);
        }
        for (const ch in byChannel) {
          report += \`Channel: \${ch}\\n\`;
          const chStats = byChannel[ch].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
          for (const s of chStats) {
            report += \` - [\${s.recordedAt}] Members: \${s.memberCount}\\n\`;
          }
          report += \`\\n\`;
        }
      }
      
      report += \`\\n--- SMART POLL RESULTS ---\\n\`;
      if (polls.length === 0) {
        report += \`No polls data available yet.\\n\`;
      } else {
        for (const p of polls) {
          report += \`Poll ID: \${p.pollId}\\n\`;
          report += \`Question: \${p.question}\\n\`;
          report += \`Status: \${p.isClosed ? 'Closed' : 'Active'}\\n\`;
          report += \`Total Voters: \${p.totalVoterCount}\\n\`;
          report += \`Last Updated: \${p.lastUpdatedAt}\\n\`;
          report += \`Options:\\n\`;
          for (const opt of p.options) {
            const percentage = p.totalVoterCount > 0 ? ((opt.voterCount / p.totalVoterCount) * 100).toFixed(1) : 0;
            report += \` - \${opt.text}: \${opt.voterCount} votes (\${percentage}%)\\n\`;
          }
          report += \`\\n\`;
        }
      }
      
      report += \`==============================================\\n\`;
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="ai_analysis_report.txt"');
      res.status(200).send(report);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/bot/toggle',`;

const target = `  app.post('/api/bot/toggle',`;
code = code.replace(target, newApi);
fs.writeFileSync('server.ts', code);
console.log('done api export setup');
