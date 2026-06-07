const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

console.log('Starting play flow test for Device-63407...');

const ws = new WebSocket('ws://localhost:3000?type=admin');

const targetId = 'Device-63407';
const targetPath = '/data/user/0/com.example.screenrecorder.mobile_app/app_flutter/recording_20260521_015653-2026-05-21-01-56-53.mp4';
const expectedFilename = 'recording_20260521_015653-2026-05-21-01-56-53.mp4';

ws.on('open', () => {
  console.log('Connected to server as admin.');
  
  // Wait to ensure connection is registered, then trigger sync
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
  }, 2000);
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
      const filePathOnServer = path.join('C:\\Users\\anton\\Desktop\\screen_recorder_app\\backend\\recordings', expectedFilename);
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

// Timeout fail after 30 seconds (give it time to upload)
setTimeout(() => {
  console.error('FAIL: Timeout waiting for sync/upload to complete.');
  ws.close();
  process.exit(1);
}, 30000);
