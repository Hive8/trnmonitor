const WebSocket = require('ws');

console.log('Starting clock flow test...');

const adminWs = new WebSocket('ws://localhost:3000?type=admin');

adminWs.on('open', () => {
  console.log('Admin connected.');

  // Send clock_in to Device-63407
  console.log('Sending clock_in command...');
  adminWs.send(JSON.stringify({
    type: 'command',
    deviceId: 'Device-63407',
    payload: {
      action: 'clock_in'
    }
  }));

  // Wait 4 seconds, then send clock_out
  setTimeout(() => {
    console.log('Sending clock_out command...');
    adminWs.send(JSON.stringify({
      type: 'command',
      deviceId: 'Device-63407',
      payload: {
        action: 'clock_out'
      }
    }));
  }, 4000);

  // Close connection after 10 seconds
  setTimeout(() => {
    console.log('Closing test client...');
    adminWs.close();
  }, 10000);
});

adminWs.on('message', (message) => {
  try {
    const text = message.toString();
    // Only log text updates
    if (text.startsWith('{')) {
      console.log('[Admin Rx Text]:', text);
    }
  } catch (e) {}
});

adminWs.on('error', (err) => {
  console.error('Admin error:', err);
});
