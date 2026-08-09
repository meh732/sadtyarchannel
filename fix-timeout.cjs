const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /const checkResult = await withHardTimeout\(\s*\(\) => checkConfigFully\(config\.raw\),\s*4000,/g,
  'const checkResult = await withHardTimeout(\n        () => checkConfigFully(config.raw),\n        20000,'
);

fs.writeFileSync('server.ts', code);
