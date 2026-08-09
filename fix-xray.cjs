const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /const globalTimeout = setTimeout\(\(\) => \{\s*finish\(false, 999\);\s*\}, 4500\);/g,
  'const globalTimeout = setTimeout(() => {\n      finish(false, 999);\n    }, 12000);'
);

code = code.replace(
  /http:\/\/cp\.cloudflare\.com\/generate_204 --max-time 3/g,
  'http://cp.cloudflare.com/generate_204 --max-time 10'
);

code = code.replace(
  /exec\(curlCmd, \{ timeout: 3500 \}/g,
  'exec(curlCmd, { timeout: 10500 }'
);

code = code.replace(
  /const CONCURRENCY = 25;/g,
  'const CONCURRENCY = 15;'
);

code = code.replace(
  /const checkResult = await withHardTimeout\(\s*\(\) => checkConfigFully\(config\.raw\),\s*20000,/g,
  'const checkResult = await withHardTimeout(\n        () => checkConfigFully(config.raw),\n        20000,'
);

fs.writeFileSync('server.ts', code);
