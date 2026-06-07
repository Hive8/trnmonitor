const WebSocket = require('ws');

console.log('Starting stream isolation test...');

// 1. Connect admin client
const adminWs = new WebSocket('ws://localhost:3000?type=admin');
adminWs.binaryType = 'arraybuffer';

let gotSimulatedFrames = false;

adminWs.on('open', () => {
  console.log('Admin client connected.');
  
  // 2. Connect a simulated device client (which doesn't send any frames itself)
  console.log('Connecting simulated device: Device_Sim_XYZ...');
  const deviceWs = new WebSocket('ws://localhost:3000?type=device&id=Device_Sim_XYZ');
  
  deviceWs.on('open', () => {
    console.log('Simulated device connected.');
  });
  
  deviceWs.on('error', (err) => {
    console.error('Device WebSocket error:', err);
  });
  
  // Keep connections open for 5 seconds to observe any leaked/captured frames
  setTimeout(() => {
    console.log('\n--- Test Result ---');
    if (gotSimulatedFrames) {
      console.error('FAIL: Received binary frames for Device_Sim_XYZ! The server is capturing an ADB device and mapping it to the simulated device.');
      deviceWs.close();
      adminWs.close();
      process.exit(1);
    } else {
      console.log('SUCCESS: No binary frames leaked to Device_Sim_XYZ. ADB capture was correctly isolated/bypassed for simulated devices.');
      deviceWs.close();
      adminWs.close();
      process.exit(0);
    }
  }, 5000);
});

adminWs.on('message', (data, isBinary) => {
  if (!isBinary) return;
  
  try {
    const buffer = Buffer.from(data);
    if (buffer.length < 5) return;
    
    const idLen = buffer.readUInt8(0);
    const deviceId = buffer.toString('utf8', 1, 1 + idLen);
    
    console.log(`[Admin Rx] Received frame for device: ${deviceId} (${buffer.length - 1 - idLen} bytes)`);
    
    if (deviceId === 'Device_Sim_XYZ') {
      gotSimulatedFrames = true;
    }
  } catch (err) {
    console.error('Error parsing binary frame:', err);
  }
});

adminWs.on('error', (err) => {
  console.error('Admin WebSocket error:', err);
});
