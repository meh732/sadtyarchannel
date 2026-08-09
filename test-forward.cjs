const fs = require('fs');
const db = JSON.parse(fs.readFileSync('data_store.json', 'utf8'));
const token = db.settings.botToken;
const adminId = db.settings.adminId;

async function run() {
  console.log("Token:", token.substring(0, 10));
  console.log("AdminId:", adminId);
  const res = await fetch(`https://api.telegram.org/bot${token}/forwardMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: adminId,
      from_chat_id: '@v2rayNG_VPNN',
      message_id: 10,
      disable_notification: true
    })
  });
  const data = await res.json();
  console.log(data);
  if (data.ok) {
     const del = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         chat_id: adminId,
         message_id: data.result.message_id
       })
     });
     console.log('Delete:', await del.json());
  }
}
run();
