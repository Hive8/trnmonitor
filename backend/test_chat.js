const http = require('http');

async function testChat() {
  console.log('Testing login...');
  const loginRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.write(JSON.stringify({ email: 'admin@trn.com', password: 'admin123' }));
    req.end();
  });

  if (!loginRes.success) {
    console.log('Login failed', loginRes);
    return;
  }

  const token = loginRes.token;
  const myId = loginRes.user.accountNo;
  console.log('Login successful. My ID:', myId);

  console.log('Fetching employees...');
  const empRes = await new Promise((resolve) => {
    http.get('http://localhost:3000/api/employees', { headers: { Authorization: `Bearer ${token}` } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });

  const targetUser = empRes.find(e => e.id !== myId);
  if (!targetUser) {
    console.log('No other users found to chat with.');
    return;
  }

  console.log(`Sending message to ${targetUser.email} (${targetUser.id})...`);
  const msgRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/messages',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.write(JSON.stringify({ receiverId: targetUser.id, message: 'Hello from the automated test script!' }));
    req.end();
  });

  console.log('Send Message Response:', msgRes);

  console.log('Fetching chat history...');
  const historyRes = await new Promise((resolve) => {
    http.get(`http://localhost:3000/api/messages/${targetUser.id}`, { headers: { Authorization: `Bearer ${token}` } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });

  console.log('Chat History length:', historyRes.messages?.length);
  if (historyRes.messages?.length > 0) {
    console.log('Latest message:', historyRes.messages[historyRes.messages.length - 1].message);
  }
}

testChat();
