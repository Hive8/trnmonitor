const WebSocket = require('ws');

console.log('Sending clock_out command...');

const adminWs = new WebSocket('ws://localhost:3000?type=admin');

adminWs.on('open', () => {
  adminWs.send(JSON.stringify({
    type: 'command',
    deviceId: 'Device-81520',
    payload: {
      action: 'clock_out'
    }
  }));

  setTimeout(() => {
    adminWs.close();
  }, 3000);
});
