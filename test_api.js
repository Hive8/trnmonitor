async function run() {
  const loginRes = await fetch('http://127.0.0.1:3000/api/employees/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@trn.com', password: 'admin', deviceId: 'test_dev_1', deviceModel: 'Test', osVersion: 'Test' })
  });
  const loginData = await loginRes.json();
  console.log("Login:", loginData);

  const reqHeaders = { 'x-device-id': 'test_dev_1' };

  const usersRes = await fetch('http://127.0.0.1:3000/api/devices/users', { headers: reqHeaders });
  const usersData = await usersRes.json();
  console.log("Users API:", usersData);
  
  if (usersData.users && usersData.users.length > 0) {
    const messagesRes = await fetch(`http://127.0.0.1:3000/api/devices/messages?otherUserId=${usersData.users[0].id}`, { headers: reqHeaders });
    const messagesData = await messagesRes.json();
    console.log("Messages API:", messagesData);

    const postRes = await fetch('http://127.0.0.1:3000/api/devices/messages', {
      method: 'POST',
      headers: { ...reqHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: usersData.users[0].id, message: 'hello from script' })
    });
    console.log("Post Message:", await postRes.json());
  }
}
run();
