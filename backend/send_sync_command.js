const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000?type=admin');

ws.on('open', () => {
  console.log('Connected to server as admin.');
});

ws.on('message', (message, isBinary) => {
  if (isBinary) {
    return; // Ignore binary screen frames
  }
  
  console.log('Received text message:', message.toString());
  try {
    const data = JSON.parse(message.toString());
    if (data.type === 'device_list') {
      console.log('Online devices:', data.devices);
      const targetId = 'Device-04505';
      if (data.devices.includes(targetId)) {
        console.log(`Sending upload_file command to ${targetId}...`);
        ws.send(JSON.stringify({
          type: 'command',
          deviceId: targetId,
          payload: {
            action: 'upload_file',
            path: '/data/user/0/com.example.screenrecorder.mobile_app/app_flutter/recording_20260520_232025-2026-05-20-23-20-25.mp4'
          }
        }));
        setTimeout(() => {
          ws.close();
          process.exit(0);
        }, 2000);
      } else {
        console.log(`Device ${targetId} is not online.`);
        ws.close();
        process.exit(1);
      }
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
});
