const WebSocket = require('ws');

console.log('Connecting to server as admin...');
const ws = new WebSocket('ws://localhost:3000?type=admin');

let frameCount = 0;
let lastReportTime = Date.now();

ws.on('open', () => {
  console.log('Connected to gateway! Waiting for frames...');
});

ws.on('message', (data, isBinary) => {
  if (isBinary) {
    frameCount++;
    try {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const idLen = buffer.readUInt8(0);
      const deviceId = buffer.toString('utf8', 1, 1 + idLen);
      const imgBytes = buffer.slice(1 + idLen);
      
      const now = Date.now();
      if (now - lastReportTime >= 2000) {
        const fps = (frameCount / ((now - lastReportTime) / 1000)).toFixed(1);
        console.log(`[STREAM STATUS] Received ${frameCount} frames from device: ${deviceId} (${fps} FPS)`);
        console.log(`  Frame Buffer Size: ${buffer.length} bytes, Image Size: ${imgBytes.length} bytes`);
        console.log(`  Image header bytes: ${imgBytes.slice(0, 8).toString('hex')}`);
        frameCount = 0;
        lastReportTime = now;
      }
    } catch (e) {
      console.error('Error parsing binary frame:', e);
    }
  } else {
    try {
      const text = data.toString();
      const parsed = JSON.parse(text);
      console.log('[TEXT MSG]', parsed.type || text);
    } catch (e) {
      console.log('[TEXT MSG raw]', data.toString());
    }
  }
});

ws.on('close', () => {
  console.log('Admin socket closed.');
});

ws.on('error', (err) => {
  console.error('Socket error:', err);
});

// Auto exit after 10 seconds
setTimeout(() => {
  console.log('Test finished. Exiting.');
  ws.close();
  process.exit(0);
}, 10000);
