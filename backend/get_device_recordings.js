const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000?type=admin');

ws.on('open', () => {
  console.log('Connected to server as admin.');
  // Ask for recordings from Device-04505
  setTimeout(() => {
    console.log('Requesting recordings list from Device-04505...');
    ws.send(JSON.stringify({
      type: 'command',
      deviceId: 'Device-04505',
      payload: {
        action: 'get_recordings'
      }
    }));
  }, 1000);
});

ws.on('message', (message, isBinary) => {
  if (isBinary) return;
  const text = message.toString();
  console.log('Received raw message:', text);
  try {
    const data = JSON.parse(text);
    if (data.type === 'device_recordings') {
      console.log('Recordings list from device:');
      console.log(JSON.stringify(data.recordings, null, 2));
      ws.close();
      process.exit(0);
    }
  } catch (err) {
    console.error('JSON parse error:', err);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
});

setTimeout(() => {
  console.log('Timeout waiting for recordings list.');
  ws.close();
  process.exit(1);
}, 10000);
