const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `    if (update.message) {`;
const replacement = `    if (update.poll) {
      const poll = update.poll;
      if (!db.pollResults) db.pollResults = [];
      const existing = db.pollResults.find(p => p.pollId === poll.id);
      if (existing) {
        existing.options = poll.options.map(opt => ({ text: opt.text, voterCount: opt.voter_count }));
        existing.totalVoterCount = poll.total_voter_count;
        existing.isClosed = poll.is_closed;
        existing.lastUpdatedAt = new Date().toISOString();
        saveDatabase();
      } else {
        db.pollResults.push({
          pollId: poll.id,
          messageId: 0, // We don't get message_id in update.poll
          channelHandle: 'Unknown',
          question: poll.question,
          options: poll.options.map(opt => ({ text: opt.text, voterCount: opt.voter_count })),
          totalVoterCount: poll.total_voter_count,
          isClosed: poll.is_closed,
          postedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString()
        });
        saveDatabase();
      }
      return;
    }
    
    if (update.message) {`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log('done');
