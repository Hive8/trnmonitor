const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

console.log('Starting sync test for a specific file...');

const ws = new WebSocket('ws://localhost:3000?type=admin');

const targetId = 'Device-04505';
const targetPath = '/data/user/0/com.example.screenrecorder.mobile_app/app_flutter/recording_20260520_231309-2026-05-20-23-13-09.mp4';
const expectedFilename = 'recording_20260520_231309-2026-05-20-23-13-09.mp4';

ws.on('open', () => {
  console.log('Connected to server as admin.');
  
  // Wait for 1 second to ensure connection is registered, then trigger sync
  setTimeout(() => {
    console.log(`Sending upload_file command to device ${targetId} for path ${targetPath}...`);
    ws.send(JSON.stringify({
      type: 'command',
      deviceId: targetId,
      payload: {
        action: 'upload_file',
        path: targetPath
      }
    }));
  }, 1000);
});

ws.on('message', (message, isBinary) => {
  if (isBinary) return;
  const text = message.toString();
  try {
    const data = JSON.parse(text);
    console.log('Received WS message:', data.type);
    if (data.type === 'new_recording' && data.recording.filename === expectedFilename) {
      console.log('SUCCESS: Received new_recording notification for target file!', data.recording);
      
      // Verify file exists on server disk
      const filePathOnServer = path.join(__dirname, 'recordings', expectedFilename);
      if (fs.existsSync(filePathOnServer)) {
        const stats = fs.statSync(filePathOnServer);
        console.log(`SUCCESS: File exists on server disk! Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
        ws.close();
        process.exit(0);
      } else {
        console.error('FAIL: File does not exist on server disk at:', filePathOnServer);
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

// Timeout fail after 15 seconds
setTimeout(() => {
  console.error('FAIL: Timeout waiting for sync to complete.');
  ws.close();
  process.exit(1);
}, 15000);
