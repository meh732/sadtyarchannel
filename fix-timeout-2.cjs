const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /await checkTlsHandshake\(details\.host, details\.port, details\.sni, 2000\)/g,
  'await checkTlsHandshake(details.host, details.port, details.sni, 5000)'
);

code = code.replace(
  /await checkPort\(details\.host, details\.port, 2000\)/g,
  'await checkPort(details.host, details.port, 5000)'
);

fs.writeFileSync('server.ts', code);
