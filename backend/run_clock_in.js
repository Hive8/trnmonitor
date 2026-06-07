const WebSocket = require('ws');
console.log('Connecting as admin...');
const adminWs = new WebSocket('ws://localhost:3000?type=admin');
adminWs.on('open', () => {
  console.log('Connected. Sending clock_in command to Device-81520...');
  adminWs.send(JSON.stringify({
    type: 'command',
    deviceId: 'Device-81520',
    payload: {
      action: 'clock_in'
    }
  }));
  setTimeout(() => {
    console.log('Closing.');
    adminWs.close();
  }, 1000);
});
adminWs.on('error', (err) => {
  console.error('Error:', err);
});
