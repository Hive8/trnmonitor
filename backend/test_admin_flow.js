const WebSocket = require('ws');
const http = require('http');

console.log('Starting automated integration test...');

const ws = new WebSocket('ws://localhost:3000?type=admin');

let targetDeviceId = null;
let testStage = 'init';

ws.on('open', () => {
  console.log('Connected to backend as admin');
});

ws.on('message', (message, isBinary) => {
  if (isBinary) return; // Skip binary screen frame data
  const data = JSON.parse(message.toString());
  console.log('Admin received WS message:', data);

  if (data.type === 'device_list') {
    if (data.devices.length > 0) {
      targetDeviceId = data.devices[0];
      console.log(`Found active device: ${targetDeviceId}`);
      
      // Start test by clocking in
      clockIn();
    } else {
      console.log('No devices connected yet. Waiting...');
    }
  } else if (data.type === 'device_connected') {
    if (!targetDeviceId) {
      targetDeviceId = data.deviceId;
      console.log(`Device connected: ${targetDeviceId}`);
      clockIn();
    }
  } else if (data.type === 'new_recording') {
    console.log('SUCCESS: Received new_recording notification on admin socket!', data.recording);
    verifyRecordingList(data.recording.filename);
  }
});

ws.on('error', (err) => {
  console.error('WS Error:', err);
  process.exit(1);
});

function clockIn() {
  if (testStage !== 'init') return;
  testStage = 'clocked_in';
  console.log(`[TEST STAGE] Clocking in device: ${targetDeviceId}`);
  
  ws.send(JSON.stringify({
    type: 'command',
    deviceId: targetDeviceId,
    payload: {
      action: 'clock_in',
      timestamp: Date.now()
    }
  }));

  // Wait 6 seconds before clocking out
  setTimeout(clockOut, 6000);
}

function clockOut() {
  testStage = 'clocked_out';
  console.log(`[TEST STAGE] Clocking out device: ${targetDeviceId}`);
  
  ws.send(JSON.stringify({
    type: 'command',
    deviceId: targetDeviceId,
    payload: {
      action: 'clock_out',
      timestamp: Date.now()
    }
  }));

  // Set a timeout to fail if we don't get the upload completion notification
  setTimeout(() => {
    console.error('FAIL: Timeout waiting for new_recording upload notification');
    ws.close();
    process.exit(1);
  }, 10000);
}

function verifyRecordingList(expectedFilename) {
  console.log('[TEST STAGE] Verifying recordings via GET /api/recordings...');
  
  http.get('http://localhost:3000/api/recordings', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const recordings = JSON.parse(data);
        console.log('Current recordings list:', recordings);
        
        const found = recordings.find(r => r.filename === expectedFilename);
        if (found) {
          console.log(`SUCCESS: Found matching recording in server database!`, found);
          ws.close();
          process.exit(0);
        } else {
          console.error(`FAIL: expected filename ${expectedFilename} not found in database`);
          ws.close();
          process.exit(1);
        }
      } catch (e) {
        console.error('FAIL: Error parsing GET recordings response:', e);
        ws.close();
        process.exit(1);
      }
    });
  }).on('error', (err) => {
    console.error('FAIL: GET recordings request error:', err);
    ws.close();
    process.exit(1);
  });
}
