const fs = require('fs');
const db = JSON.parse(fs.readFileSync('data_store.json', 'utf8'));
const confs = db.configs.filter(c => c.protocol === 'vmess' || c.protocol === 'vless');
console.log("Configs to test:", confs.length);
if (confs.length > 0) {
  console.log("Testing:", confs[0].raw.substring(0, 50));
  fetch('http://localhost:3000/api/configs/test-all', { method: 'POST' }).then(r => r.json()).then(console.log);
}
