async function run() {
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@trn.com', password: 'admin' })
  });
  const loginData = await loginRes.json();
  console.log("Login:", loginData);

  const empRes = await fetch('http://127.0.0.1:3000/api/employees', {
    headers: { 'Authorization': `Bearer ${loginData.token}` }
  });
  const employees = await empRes.json();
  const firstMobileEmp = employees.find(e => e.deviceId);
  console.log("Found employee with device:", firstMobileEmp);

  if (firstMobileEmp) {
    const postRes = await fetch('http://127.0.0.1:3000/api/devices/messages', {
      method: 'POST',
      headers: { 'x-device-id': firstMobileEmp.deviceId, 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: 'emp_superadmin', message: 'test from script' })
    });
    console.log("Post Message:", await postRes.json());
  }
}
run();
