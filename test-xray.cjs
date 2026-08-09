const fs = require('fs');
const { spawn, exec } = require('child_process');
const path = require('path');
const db = JSON.parse(fs.readFileSync('data_store.json', 'utf8'));
const confs = db.configs.filter(c => c.protocol === 'vless').slice(0, 5);

// The xray command
const xrayPath = path.join(process.cwd(), 'bin/xray');
console.log("Xray path:", xrayPath, fs.existsSync(xrayPath));

// Try to execute it directly to see if it works
exec(xrayPath + ' -version', (err, stdout, stderr) => {
  if (err) console.error("Xray exec error:", err);
  else console.log("Xray output:", stdout);
});
