const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/const cleaned = content.replace\(\/```json\\\\n\?\|\\\\n\?```\/g, ''\)\.trim\(\);/, "const cleaned = content.replace(/```json\\n?|\\n?```/g, '').trim();");
fs.writeFileSync('server.ts', code);
