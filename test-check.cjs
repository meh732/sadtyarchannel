const fs = require('fs');
fetch('http://localhost:3000/api/configs/test-all', { method: 'POST' })
  .then(r => r.json())
  .then(console.log);
