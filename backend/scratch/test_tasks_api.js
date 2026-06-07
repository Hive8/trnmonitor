const http = require('http');

const loginData = JSON.stringify({
  email: 'admin@trn.com',
  password: 'admin123'
});

const reqLogin = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
}, (resLogin) => {
  let body = '';
  resLogin.on('data', (c) => body += c);
  resLogin.on('end', async () => {
    const result = JSON.parse(body);
    if (!result.success) {
      console.error('Login failed');
      return;
    }
    const token = result.token;
    console.log('Login successful. Token acquired.');

    // 1. GET /api/tasks
    await testGetTasks(token);

    // 2. POST /api/tasks
    const newTaskId = await testPostTask(token);

    // 3. PUT /api/tasks/:id
    if (newTaskId) {
      await testPutTask(token, newTaskId);
      // 4. DELETE /api/tasks/:id
      await testDeleteTask(token, newTaskId);
    }
  });
});

reqLogin.on('error', (err) => console.error('Login request error:', err));
reqLogin.write(loginData);
reqLogin.end();

function testGetTasks(token) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/tasks',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log('\n--- GET /api/tasks ---');
        console.log('Status:', res.statusCode);
        const data = JSON.parse(body);
        console.log('Success:', data.success);
        console.log('Tasks Count:', data.tasks ? data.tasks.length : 'undefined');
        resolve();
      });
    });
    req.end();
  });
}

function testPostTask(token) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      title: 'Integration Test Task',
      description: 'Created by automated endpoint integration script',
      status: 'backlog',
      priority: 'high',
      label: 'feature'
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/tasks',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log('\n--- POST /api/tasks ---');
        console.log('Status:', res.statusCode);
        const data = JSON.parse(body);
        console.log('Success:', data.success);
        if (data.success && data.task) {
          console.log('Created Task ID:', data.task.id);
          resolve(data.task.id);
        } else {
          console.log('Error payload:', body);
          resolve(null);
        }
      });
    });
    req.write(postData);
    req.end();
  });
}

function testPutTask(token, id) {
  return new Promise((resolve) => {
    const putData = JSON.stringify({
      status: 'in progress',
      description: 'Updated description for testing'
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/tasks/${id}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(putData)
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log(`\n--- PUT /api/tasks/${id} ---`);
        console.log('Status:', res.statusCode);
        const data = JSON.parse(body);
        console.log('Success:', data.success);
        if (data.success && data.task) {
          console.log('Updated Task Status:', data.task.status);
          console.log('Updated Task Description:', data.task.description);
        } else {
          console.log('Error payload:', body);
        }
        resolve();
      });
    });
    req.write(putData);
    req.end();
  });
}

function testDeleteTask(token, id) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/tasks/${id}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log(`\n--- DELETE /api/tasks/${id} ---`);
        console.log('Status:', res.statusCode);
        const data = JSON.parse(body);
        console.log('Success:', data.success);
        resolve();
      });
    });
    req.end();
  });
}
