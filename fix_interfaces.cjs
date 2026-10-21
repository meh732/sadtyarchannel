const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `interface DatabaseSchema {`;

const replacement = `export interface ChannelStatItem {
  id: string;
  channelHandle: string;
  memberCount: number;
  recordedAt: string; // ISO String
}

export interface PollResultItem {
  pollId: string;
  messageId: number;
  channelHandle: string;
  question: string;
  options: { text: string; voterCount: number }[];
  totalVoterCount: number;
  isClosed: boolean;
  postedAt: string; // ISO String
  lastUpdatedAt: string; // ISO String
}

interface DatabaseSchema {
  channelStats?: ChannelStatItem[];
  pollResults?: PollResultItem[];`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log('done');
