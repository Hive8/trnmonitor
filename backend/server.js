const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const url = require('url');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const dgram = require('dgram');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ensure recordings folder exists
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://aroxnlnrnkophfcfugqt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyb3hubG5ybmtvcGhmY2Z1Z3F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2Mjg1MzQsImV4cCI6MjA5NjIwNDUzNH0.RsnBrpgs-8BlZP9CG77Yb7QGvs-aJmBTWJLceg4PsR0';
const supabase = createClient(supabaseUrl, supabaseKey);

const recordingsDir = path.join(__dirname, 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

function camelToSnake(obj) {
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[snakeKey] = camelToSnake(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

function snakeToCamel(obj) {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      acc[camelKey] = snakeToCamel(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

async function loadEmployees() {
  const { data } = await supabase.from('employees').select('*');
  return data ? snakeToCamel(data) : [];
}

async function saveEmployees(list) {
  for (const emp of list) {
    const { error } = await supabase.from('employees').upsert(camelToSnake(emp));
    if (error) console.error('Supabase upsert error in saveEmployees:', error);
  }
}

async function loadRoles() {
  const { data } = await supabase.from('roles_permissions').select('*');
  if (!data) return {};
  const rolesObj = {};
  data.forEach(r => {
    rolesObj[r.role] = r.permissions;
  });
  return rolesObj;
}

async function saveRoles(rolesObj) {
  for (const [role, permissions] of Object.entries(rolesObj)) {
    await supabase.from('roles_permissions').upsert({ role, permissions });
  }
}

async function loadClockSessions() {
  const { data } = await supabase.from('clock_sessions').select('*');
  return data ? snakeToCamel(data) : [];
}

async function saveClockSessions(list) {
  for (const session of list) {
    await supabase.from('clock_sessions').upsert(camelToSnake(session));
  }
}

async function loadDeviceSettings() {
  const { data } = await supabase.from('device_settings').select('*');
  if (!data) return {};
  const settingsObj = {};
  data.forEach(s => {
    settingsObj[s.device_id] = { fps: s.fps, resolution: s.resolution };
  });
  return settingsObj;
}

async function saveDeviceSettings(settingsObj) {
  for (const [device_id, settings] of Object.entries(settingsObj)) {
    await supabase.from('device_settings').upsert({ device_id, fps: settings.fps, resolution: settings.resolution });
  }
}

async function getDeviceSettings(deviceId) {
  const settings = await (await loadDeviceSettings());
  return settings[deviceId] || { fps: 5, resolution: '720x1600' };
}

async function loadRecordings() {
  const { data } = await supabase.from('recordings').select('*');
  return data ? snakeToCamel(data) : [];
}

async function saveRecordings(list) {
  for (const rec of list) {
    await supabase.from('recordings').upsert(camelToSnake(rec));
  }
}

function calculateDuration(startIso, endIso) {
  if (!startIso || !endIso) return '00:00:00';
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end - start;
  if (diffMs <= 0) return '00:00:00';
  
  const diffSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(diffSec / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
  const seconds = (diffSec % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// Serve static files from 'public' and 'recordings'
app.use(express.static(path.join(__dirname, 'public')));
app.use('/recordings', express.static(recordingsDir));

// Keep track of active devices and admins
// Key: deviceId, Value: WebSocket connection
const devices = new Map();
// Set of active admin WebSocket connections
const admins = new Set();

// Store active ADB capture intervals
// Key: deviceId, Value: { interval, serial }
const adbCaptures = new Map();
const pendingAdbCaptures = new Set();

// Helper to broadcast JSON messages to all admins
function broadcastToAdmins(messageObj) {
  const msgString = JSON.stringify(messageObj);
  admins.forEach(admin => {
    if (admin.readyState === WebSocket.OPEN) {
      admin.send(msgString);
    }
  });
}

function sendToAdmin(userId, messageObj) {
  const msgString = JSON.stringify(messageObj);
  admins.forEach(admin => {
    if (admin.userId === userId && admin.readyState === WebSocket.OPEN) {
      admin.send(msgString);
    }
  });
}

function getAdbSerialForDevice(deviceId, callback) {
  exec('adb devices', (err, stdout, stderr) => {
    if (err) {
      console.error('Failed to run adb devices:', err);
      callback(null);
      return;
    }

    const lines = stdout.split('\n');
    const serials = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && line.includes('\tdevice')) {
        serials.push(line.split('\t')[0].trim());
      }
    }

    if (serials.length === 0) {
      callback(null);
      return;
    }

    let checkedCount = 0;
    let foundSerial = null;

    const finishCheck = (serial) => {
      checkedCount++;
      if (serial) {
        foundSerial = serial;
      }

      if (foundSerial) {
        if (callback) {
          callback(foundSerial);
          callback = null;
        }
      } else if (checkedCount === serials.length) {
        if (callback) {
          callback(null);
          callback = null;
        }
      }
    };

    serials.forEach(serial => {
      // 1. Try reading from app's external files directory on shared storage (works for release builds)
      const extPath = '/sdcard/Android/data/com.example.screenrecorder.mobile_app/files/device_id.txt';
      exec(`adb -s ${serial} shell cat ${extPath}`, (catErr, catStdout, catStderr) => {
        if (!catErr && catStdout.trim() === deviceId) {
          finishCheck(serial);
        } else {
          // 2. Fallback to private data directory run-as (works for debuggable builds)
          exec(`adb -s ${serial} shell run-as com.example.screenrecorder.mobile_app cat app_flutter/device_id.txt`, (runAsErr, runAsStdout, runAsStderr) => {
            if (!runAsErr && runAsStdout.trim() === deviceId) {
              finishCheck(serial);
            } else {
              finishCheck(null);
            }
          });
        }
      });
    });
  });
}

// Function to query battery level via ADB and broadcast to admins
function queryAndBroadcastBattery(deviceId) {
  getAdbSerialForDevice(deviceId, (serial) => {
    if (!serial) return;
    exec(`adb -s ${serial} shell cmd battery get level`, (err, stdout, stderr) => {
      if (err) {
        console.error(`Failed to get battery level for device ${deviceId}:`, err.message);
        return;
      }
      const level = parseInt(stdout.trim(), 10);
      if (!isNaN(level)) {
        broadcastToAdmins({
          type: 'battery_update',
          deviceId: deviceId,
          level: level
        });
      }
    });
  });
}

// High-performance system-wide screen capture using host-side ADB
async function startAdbCapture(deviceId) {
  if (adbCaptures.has(deviceId) || pendingAdbCaptures.has(deviceId)) {
    return; // Already capturing or pending
  }

  pendingAdbCaptures.add(deviceId);

  getAdbSerialForDevice(deviceId, async (serial) => {
    pendingAdbCaptures.delete(deviceId);
    if (!serial) {
      console.log(`No ADB device serial found for deviceId ${deviceId}. Fallback to app-side stream.`);
      return;
    }

    const settings = await getDeviceSettings(deviceId);
    const intervalMs = Math.round(1000 / settings.fps);

    console.log(`Starting ADB system screen capture for device ${deviceId} using serial ${serial} at ${settings.fps} FPS (${intervalMs}ms interval)`);

    let isCapturingFrame = false;

    const interval = setInterval(() => {
      if (isCapturingFrame) return; // Prevent overlapping capture requests
      isCapturingFrame = true;

      // Capture raw PNG bytes from ADB
      const child = spawn('adb', ['-s', serial, 'exec-out', 'screencap', '-p']);
      const chunks = [];

      child.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      child.on('close', (code) => {
        isCapturingFrame = false;
        if (code === 0 && chunks.length > 0) {
          const frameBuffer = Buffer.concat(chunks);

          // Construct frame packet: [1 byte deviceId length] [deviceId string] [image frame data]
          const idBuffer = Buffer.from(deviceId, 'utf8');
          const header = Buffer.alloc(1);
          header.writeUInt8(idBuffer.length, 0);

          const relayBuffer = Buffer.concat([header, idBuffer, frameBuffer]);

          admins.forEach(admin => {
            if (admin.readyState === WebSocket.OPEN) {
              admin.send(relayBuffer, { binary: true });
            }
          });
        }
      });

      child.on('error', (spawnErr) => {
        isCapturingFrame = false;
        console.error(`ADB capture spawn error for ${deviceId}:`, spawnErr);
      });

    }, intervalMs);

    adbCaptures.set(deviceId, { interval, serial });
  });
}

function stopAdbCapture(deviceId) {
  const captureObj = adbCaptures.get(deviceId);
  if (captureObj) {
    console.log(`Stopping ADB system screen capture for device ${deviceId}`);
    clearInterval(captureObj.interval);
    adbCaptures.delete(deviceId);
  }
}

// In-memory session store (Token -> User Session)
const activeSessions = new Map();

// Generate a random token
function generateToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(24).toString('hex');
}

// Authentication middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token' });
  }

  const session = activeSessions.get(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }

  if (Date.now() > session.exp) {
    activeSessions.delete(token);
    return res.status(401).json({ success: false, error: 'Unauthorized: Session expired' });
  }

  // Refresh permissions dynamically in case they were updated
  const rolesObj = await (await loadRoles());
  session.permissions = rolesObj[session.role] || [];

  req.user = session; // Attach session info
  next();
}

// Permission authorization middleware
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
}

// Role authorization middleware (backward compatibility/legacy)
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
}

// REST API for login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const list = (await loadEmployees());
  const user = list.find(emp => emp.email.toLowerCase() === email.toLowerCase());

  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }

  const rolesObj = (await loadRoles());
  const userRole = user.role || 'employee';
  const permissions = rolesObj[userRole] || [];

  const token = generateToken();
  const session = {
    userId: user.id,
    email: user.email,
    role: userRole,
    permissions: permissions,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };
  activeSessions.set(token, session);

  console.log(`User logged in: ${user.email} with role ${session.role} and permissions: ${JSON.stringify(permissions)}`);

  res.json({
    success: true,
    token,
    user: {
      accountNo: user.id,
      email: user.email,
      role: [session.role],
      permissions: permissions,
      exp: session.exp
    }
  });
});

// REST API for roles list
app.get('/api/roles', authenticateToken, async (req, res) => {
  res.json((await loadRoles()));
});

// REST API to create a role
app.post('/api/roles', authenticateToken, requirePermission('roles'), async (req, res) => {
  const { name, permissions } = req.body;
  if (!name || !Array.isArray(permissions)) {
    return res.status(400).json({ success: false, error: 'Role name and permissions array are required.' });
  }

  const roleKey = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const rolesObj = (await loadRoles());

  if (rolesObj[roleKey]) {
    return res.status(400).json({ success: false, error: 'A role with this name already exists.' });
  }

  rolesObj[roleKey] = permissions;
  await saveRoles(rolesObj);

  console.log(`Created custom role: ${name} (${roleKey}) with permissions: ${JSON.stringify(permissions)}`);
  res.json({ success: true, key: roleKey, permissions });
});

// REST API to update a role
app.put('/api/roles/:key', authenticateToken, requirePermission('roles'), async (req, res) => {
  const { key } = req.params;
  const { permissions } = req.body;

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ success: false, error: 'Permissions array is required.' });
  }

  if (key === 'superadmin') {
    return res.status(400).json({ success: false, error: 'Cannot modify permissions for superadmin.' });
  }

  const rolesObj = (await loadRoles());
  if (!rolesObj[key]) {
    return res.status(404).json({ success: false, error: 'Role not found.' });
  }

  rolesObj[key] = permissions;
  await saveRoles(rolesObj);

  console.log(`Updated permissions for role ${key}: ${JSON.stringify(permissions)}`);
  res.json({ success: true, key, permissions });
});

// REST API to delete a role
app.delete('/api/roles/:key', authenticateToken, requirePermission('roles'), async (req, res) => {
  const { key } = req.params;

  if (key === 'superadmin' || key === 'admin' || key === 'employee') {
    return res.status(400).json({ success: false, error: 'Cannot delete standard system roles.' });
  }

  const rolesObj = (await loadRoles());
  if (!rolesObj[key]) {
    return res.status(404).json({ success: false, error: 'Role not found.' });
  }

  // Check if any employees are assigned to this role
  const employees = (await loadEmployees());
  const hasAssigned = employees.some(emp => emp.role === key);
  if (hasAssigned) {
    return res.status(400).json({ success: false, error: 'Cannot delete role because one or more employees are assigned to it.' });
  }

  delete rolesObj[key];
  await saveRoles(rolesObj);

  console.log(`Deleted role: ${key}`);
  res.json({ success: true });
});

// REST API for employees list
app.get('/api/employees', authenticateToken, requirePermission('users'), async (req, res) => {
  res.json((await loadEmployees()));
});

// REST API to add employee
app.post('/api/employees', authenticateToken, requirePermission('users'), async (req, res) => {
  const { firstName, lastName, email, phoneNumber, password, role, username, status } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ success: false, error: 'First name, last name, email, and password are required.' });
  }

  const list = (await loadEmployees());
  const exists = list.some(emp => emp.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    return res.status(400).json({ success: false, error: 'An employee with this email already exists.' });
  }

  const newEmp = {
    id: `emp_${Date.now()}`,
    firstName,
    lastName,
    email,
    phoneNumber: phoneNumber || '',
    password,
    deviceId: '',
    deviceModel: '',
    osVersion: '',
    lastActive: null,
    role: role || 'employee',
    username: username || email.split('@')[0],
    status: status || 'active'
  };

  list.push(newEmp);
  await saveEmployees(list);

  console.log(`Added employee: ${firstName} ${lastName} (${email})`);
  // Broadcast update to admins
  broadcastToAdmins({ type: 'employee_list_update', employees: list });

  res.json({ success: true, employee: newEmp });
});

// REST API to log in / link device (used by mobile app, unprotected by admin token)
app.post('/api/employees/login', async (req, res) => {
  const { email, password, deviceId, deviceModel, osVersion } = req.body;
  if (!email || !password || !deviceId) {
    return res.status(400).json({ success: false, error: 'Email, password, and Device ID are required.' });
  }

  const list = (await loadEmployees());
  const index = list.findIndex(emp => emp.email.toLowerCase() === email.toLowerCase());
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Employee not found. Please register in the Admin Dashboard first.' });
  }

  // Validate password
  if (list[index].password !== password) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }

  // Map device info
  list[index].deviceId = deviceId;
  list[index].deviceModel = deviceModel || 'Unknown Model';
  list[index].osVersion = osVersion || 'Unknown OS';
  list[index].lastActive = new Date().toISOString();

  await saveEmployees(list);

  console.log(`Linked device ${deviceId} (${deviceModel}) to employee ${list[index].firstName} ${list[index].lastName}`);
  
  // Broadcast update to admins
  broadcastToAdmins({ type: 'employee_list_update', employees: list });

  res.json({ success: true, employee: list[index] });
});

// REST API to unlink device
app.post('/api/employees/unlink', authenticateToken, requirePermission('users'), async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, error: 'Employee ID is required.' });
  }

  const list = (await loadEmployees());
  const index = list.findIndex(emp => emp.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Employee not found.' });
  }

  list[index].deviceId = '';
  list[index].deviceModel = '';
  list[index].osVersion = '';

  await saveEmployees(list);

  console.log(`Unlinked device from employee ${list[index].firstName} ${list[index].lastName}`);

  // Broadcast update to admins
  broadcastToAdmins({ type: 'employee_list_update', employees: list });

  res.json({ success: true });
});

// REST API to update an employee profile
app.put('/api/employees/:id', authenticateToken, requirePermission('users'), async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, phoneNumber, password, role, username, status } = req.body;

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ success: false, error: 'First name, last name, and email are required.' });
  }

  const list = (await loadEmployees());
  const index = list.findIndex(emp => emp.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Employee not found.' });
  }

  // Email uniqueness check (ignore current employee itself)
  const emailCollision = list.some(emp => emp.id !== id && emp.email.toLowerCase() === email.toLowerCase());
  if (emailCollision) {
    return res.status(400).json({ success: false, error: 'An employee with this email already exists.' });
  }

  // Update properties
  list[index].firstName = firstName;
  list[index].lastName = lastName;
  list[index].email = email;
  list[index].phoneNumber = phoneNumber || '';
  if (role) {
    list[index].role = role;
  }
  if (password && password.trim() !== '') {
    list[index].password = password;
  }
  if (username) {
    list[index].username = username;
  }
  if (status) {
    list[index].status = status;
  }

  await saveEmployees(list);

  console.log(`Updated employee ${id}: ${firstName} ${lastName} (${email}) with role ${list[index].role}`);

  // Broadcast update to admins
  broadcastToAdmins({ type: 'employee_list_update', employees: list });

  res.json({ success: true, employee: list[index] });
});

// REST API to delete an employee profile
app.delete('/api/employees/:id', authenticateToken, requirePermission('users'), async (req, res) => {
  const { id } = req.params;
  const list = (await loadEmployees());
  const filtered = list.filter(emp => emp.id !== id);

  if (list.length === filtered.length) {
    return res.status(404).json({ success: false, error: 'Employee not found.' });
  }

  await saveEmployees(filtered);
  console.log(`Deleted employee ${id}`);

  // Broadcast update to admins
  broadcastToAdmins({ type: 'employee_list_update', employees: filtered });

  res.json({ success: true });
});

// REST API for active devices
app.get('/api/devices', authenticateToken, requirePermission('live_monitor'), async (req, res) => {
  res.json(Array.from(devices.keys()));
});

// REST API for device settings
app.get('/api/devices/settings', authenticateToken, requirePermission('live_monitor'), async (req, res) => {
  res.json((await loadDeviceSettings()));
});

app.post('/api/devices/settings', authenticateToken, requirePermission('live_monitor'), async (req, res) => {
  const { deviceId, fps, resolution } = req.body;
  if (!deviceId || !fps || !resolution) {
    return res.status(400).json({ success: false, error: 'deviceId, fps, and resolution are required.' });
  }

  const settings = (await loadDeviceSettings());
  settings[deviceId] = {
    fps: parseInt(fps, 10),
    resolution: String(resolution)
  };
  await saveDeviceSettings(settings);

  console.log(`Updated settings for device ${deviceId}: ${fps} FPS, ${resolution}`);

  // Broadcast settings update to all admins
  broadcastToAdmins({ type: 'device_settings_update', settings });

  // Propagate settings to the device if connected via WS
  const deviceWs = devices.get(deviceId);
  if (deviceWs && deviceWs.readyState === WebSocket.OPEN) {
    deviceWs.send(JSON.stringify({
      action: 'update_settings',
      fps: parseInt(fps, 10),
      resolution: String(resolution)
    }));
  }

  // Restart ADB capture with new interval if active
  if (adbCaptures.has(deviceId)) {
    stopAdbCapture(deviceId);
    startAdbCapture(deviceId);
  }

  res.json({ success: true, settings: settings[deviceId] });
});

// REST API for recordings list
app.get('/api/recordings', authenticateToken, requirePermission('live_monitor'), async (req, res) => {
  res.json((await loadRecordings()));
});

// REST API for clock sessions list
app.get('/api/clock-sessions', authenticateToken, async (req, res) => {
  const sessions = (await loadClockSessions());
  if (!req.user.permissions || !req.user.permissions.includes('users')) {
    res.json(sessions.filter(s => s.employeeId === req.user.userId));
  } else {
    res.json(sessions);
  }
});

// REST API to manually add a clock session
app.post('/api/clock-sessions', authenticateToken, requirePermission('users'), async (req, res) => {
  const { employeeId, deviceId, clockInTime, clockOutTime, notes } = req.body;
  if (!employeeId || !clockInTime) {
    return res.status(400).json({ success: false, error: 'employeeId and clockInTime are required.' });
  }

  const list = (await loadClockSessions());
  const duration = clockOutTime ? calculateDuration(clockInTime, clockOutTime) : '00:00:00';
  const status = clockOutTime ? 'Completed' : 'Active';

  const newSession = {
    id: `session_${Date.now()}`,
    employeeId,
    deviceId: deviceId || 'Manual',
    clockInTime,
    clockOutTime: clockOutTime || null,
    duration,
    status,
    notes: notes || ''
  };

  list.unshift(newSession);
  await saveClockSessions(list);

  console.log(`Manually added clock session: ${employeeId} at ${clockInTime}`);
  broadcastToAdmins({ type: 'clock_sessions_update', sessions: list });

  res.json({ success: true, session: newSession });
});

// REST API to edit a clock session
app.put('/api/clock-sessions/:id', authenticateToken, requirePermission('users'), async (req, res) => {
  const { id } = req.params;
  const { clockInTime, clockOutTime, notes } = req.body;

  if (!clockInTime) {
    return res.status(400).json({ success: false, error: 'clockInTime is required.' });
  }

  const list = (await loadClockSessions());
  const index = list.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Session not found.' });
  }

  const duration = clockOutTime ? calculateDuration(clockInTime, clockOutTime) : '00:00:00';
  const status = clockOutTime ? 'Completed' : 'Active';

  list[index].clockInTime = clockInTime;
  list[index].clockOutTime = clockOutTime || null;
  list[index].duration = duration;
  list[index].status = status;
  list[index].notes = notes || '';

  await saveClockSessions(list);

  console.log(`Updated clock session ${id}`);
  broadcastToAdmins({ type: 'clock_sessions_update', sessions: list });

  res.json({ success: true, session: list[index] });
});

// REST API to delete a clock session
app.delete('/api/clock-sessions/:id', authenticateToken, requirePermission('users'), async (req, res) => {
  const { id } = req.params;

  const list = (await loadClockSessions());
  const filtered = list.filter(s => s.id !== id);

  if (list.length === filtered.length) {
    return res.status(404).json({ success: false, error: 'Session not found.' });
  }

  await saveClockSessions(filtered);

  console.log(`Deleted clock session ${id}`);
  broadcastToAdmins({ type: 'clock_sessions_update', sessions: filtered });

  res.json({ success: true });
});

// REST API to get GPS logs for a session
app.get('/api/gps-logs/session/:sessionId', authenticateToken, requirePermission('live_monitor'), async (req, res) => {
  const { sessionId } = req.params;
  const { data, error } = await supabase
    .from('gps_logs')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error(`Error fetching GPS logs for session ${sessionId}:`, error);
    return res.status(500).json({ success: false, error: 'Failed to fetch GPS logs.' });
  }

  res.json({ success: true, logs: data ? snakeToCamel(data) : [] });
});

// REST API for server IP addresses
app.get('/api/server-ips', authenticateToken, requirePermission('live_monitor'), async (req, res) => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  ips.push({ type: 'Localhost', address: `127.0.0.1:${port}` });
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
        ips.push({
          type: name,
          address: `${iface.address}:${port}`
         });
      }
    }
  }
  res.json(ips);
});

// Streamed POST upload for video files (used by mobile app, unprotected by admin token)
app.post('/api/upload', async (req, res) => {
  const deviceId = req.headers['x-device-id'] || 'Unknown_Device';
  const rawFileName = req.headers['x-file-name'] || `recording_${Date.now()}.mp4`;
  const duration = req.headers['x-duration'] || '00:00';
  const timestampHeader = req.headers['x-timestamp'] || new Date().toISOString();

  // Sanitize filename to avoid path traversal
  const sanitizedFileName = path.basename(rawFileName);
  const targetPath = path.join(recordingsDir, sanitizedFileName);

  console.log(`Receiving upload for device ${deviceId}: ${sanitizedFileName}`);

  const writeStream = fs.createWriteStream(targetPath);
  req.pipe(writeStream);

  req.on('error', (err) => {
    console.error(`Upload stream error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  });

  writeStream.on('error', (err) => {
    console.error(`Write stream error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  });

  writeStream.on('finish', async () => {
    // Check file size
    let sizeStr = '0.0 MB';
    try {
      const stats = fs.statSync(targetPath);
      sizeStr = `${(stats.size / (1024 * 1024)).toFixed(1)} MB`;
    } catch (e) {
      console.error('Failed to read uploaded file stats:', e);
    }

    const newRecord = {
      id: `session_rec_${Math.floor(Math.random() * 900000) + 100000}`,
      name: sanitizedFileName.replace('.mp4', ''),
      deviceId: deviceId,
      duration: duration,
      timestamp: timestampHeader,
      size: sizeStr,
      filename: sanitizedFileName,
      status: 'Completed'
    };

    // Save to recordings.json
    const records = (await loadRecordings());
    records.unshift(newRecord); // Prepend new recording
    await saveRecordings(records);

    console.log(`Upload complete: Saved ${sanitizedFileName} (${sizeStr})`);

    // Notify all admins via WS
    broadcastToAdmins({
      type: 'new_recording',
      recording: newRecord
    });

    res.json({ success: true, recording: newRecord });
  });
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', async (ws, req) => {
  const parsed = url.parse(req.url, true);
  const type = parsed.query.type;
  const deviceId = parsed.query.id;

  if (type === 'device') {
    if (!deviceId) {
      console.log('Device connection rejected: missing ID');
      ws.close(4000, 'Missing device ID');
      return;
    }

    console.log(`Device connected: ${deviceId}`);
    devices.set(deviceId, ws);

    // Send current device settings to the device upon connection
    const settings = await getDeviceSettings(deviceId);
    ws.send(JSON.stringify({
      action: 'update_settings',
      fps: settings.fps,
      resolution: settings.resolution
    }));

    // Notify admins of new device
    broadcastToAdmins({ type: 'device_connected', deviceId });

    // Automatically trigger ADB system screen capture
    startAdbCapture(deviceId);

    // Query and broadcast battery level
    setTimeout(() => queryAndBroadcastBattery(deviceId), 1000);

    ws.on('message', async (message, isBinary) => {
      const realIsBinary = (typeof isBinary === 'boolean') ? isBinary : Buffer.isBuffer(message);
      if (realIsBinary) {
        // Discard device binary frames if ADB capture is active to prevent duplication/flicker
        if (adbCaptures.has(deviceId)) {
          return;
        }

        const msgBuffer = Buffer.isBuffer(message) ? message : Buffer.from(message);
        const idBuffer = Buffer.from(deviceId, 'utf8');
        const header = Buffer.alloc(1);
        header.writeUInt8(idBuffer.length, 0);

        const frameBuffer = Buffer.concat([header, idBuffer, msgBuffer]);

        admins.forEach(admin => {
          if (admin.readyState === WebSocket.OPEN) {
            admin.send(frameBuffer, { binary: true });
          }
        });
      } else {
        try {
          const textMsg = JSON.parse(message.toString());
          if (textMsg.type === 'heartbeat') {
            return; // Suppress heartbeat logs and broadcasts to avoid console clutter
          }
          console.log(`Received text from device ${deviceId}: ${message.toString()}`);
          
          if (textMsg.type === 'gps_update') {
            const employeesList = (await loadEmployees());
            const employee = employeesList.find(e => e.deviceId === deviceId);
            if (employee) {
              const sessionsList = (await loadClockSessions());
              const activeSession = sessionsList.find(s => s.employeeId === employee.id && s.status === 'Active');
              
              const gpsLog = {
                id: `gps_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                device_id: deviceId,
                employee_id: employee.id,
                latitude: textMsg.latitude,
                longitude: textMsg.longitude,
                timestamp: new Date().toISOString(),
                session_id: activeSession ? activeSession.id : null
              };
              
              const { error } = await supabase.from('gps_logs').insert([gpsLog]);
              if (error) {
                console.error('Failed to save GPS log to Supabase:', error);
              } else {
                console.log(`Saved GPS log for device ${deviceId} (Session: ${activeSession ? activeSession.id : 'None'}): ${gpsLog.latitude}, ${gpsLog.longitude}`);
                broadcastToAdmins({
                  type: 'gps_update',
                  deviceId,
                  gpsLog: snakeToCamel(gpsLog)
                });
              }
            }
          }

          if (textMsg.type === 'status') {
            const employeesList = (await loadEmployees());
            const employee = employeesList.find(e => e.deviceId === deviceId);
            if (employee) {
              const sessionsList = (await loadClockSessions());
              if (textMsg.isClockedIn) {
                // Device wants to Clock In
                // Check if an active session already exists for this employee
                const hasActive = sessionsList.some(s => s.employeeId === employee.id && s.status === 'Active');
                if (!hasActive) {
                  const newSession = {
                    id: `session_${Date.now()}`,
                    employeeId: employee.id,
                    deviceId: deviceId,
                    clockInTime: new Date().toISOString(),
                    clockOutTime: null,
                    duration: '00:00:00',
                    status: 'Active',
                    notes: ''
                  };
                  sessionsList.unshift(newSession);
                  await saveClockSessions(sessionsList);
                  console.log(`Auto-created clock-in session for employee ${employee.firstName} ${employee.lastName}`);
                  broadcastToAdmins({ type: 'clock_sessions_update', sessions: sessionsList });
                }
              } else {
                // Device wants to Clock Out
                // Find any active session for this employee
                const activeIndex = sessionsList.findIndex(s => s.employeeId === employee.id && s.status === 'Active');
                if (activeIndex !== -1) {
                  const clockOutTime = new Date().toISOString();
                  sessionsList[activeIndex].clockOutTime = clockOutTime;
                  sessionsList[activeIndex].status = 'Completed';
                  sessionsList[activeIndex].duration = calculateDuration(sessionsList[activeIndex].clockInTime, clockOutTime);
                  await saveClockSessions(sessionsList);
                  console.log(`Auto-closed clock-out session for employee ${employee.firstName} ${employee.lastName}`);
                  broadcastToAdmins({ type: 'clock_sessions_update', sessions: sessionsList });
                }
              }
            }
          }

          broadcastToAdmins(textMsg);
        } catch (e) {
          // Ignore non-json text
        }
      }
    });

    ws.on('close', () => {
      console.log(`Device disconnected: ${deviceId}`);
      devices.delete(deviceId);
      stopAdbCapture(deviceId);
      broadcastToAdmins({ type: 'device_disconnected', deviceId });
    });

    ws.on('error', (err) => {
      console.error(`Device ${deviceId} error:`, err);
      devices.delete(deviceId);
      stopAdbCapture(deviceId);
      broadcastToAdmins({ type: 'device_disconnected', deviceId });
    });

  } else if (type === 'admin') {
    const token = parsed.query.token;
    const session = activeSessions.get(token);
    const rolesObj = (await loadRoles());
    const permissions = session ? (rolesObj[session.role] || []) : [];
    if (!session || (!permissions.includes('live_monitor') && !permissions.includes('chats'))) {
      console.log('Admin connection rejected: invalid token or missing required permissions');
      ws.close(4002, 'Unauthorized');
      return;
    }
    console.log(`Admin connected: ${session.email} (${session.role})`);
    ws.userId = session.userId;
    admins.add(ws);

    // Ensure ADB capture is active for all connected devices
    for (const devId of devices.keys()) {
      if (!adbCaptures.has(devId)) {
        startAdbCapture(devId);
      }
    }

    // Send current list of devices to the newly connected admin
    ws.send(JSON.stringify({ type: 'device_list', devices: Array.from(devices.keys()) }));
    ws.send(JSON.stringify({ type: 'employee_list_update', employees: (await loadEmployees()) }));
    ws.send(JSON.stringify({ type: 'device_settings_update', settings: (await loadDeviceSettings()) }));
    ws.send(JSON.stringify({ type: 'clock_sessions_list', sessions: (await loadClockSessions()) }));

    ws.on('message', async (message) => {
      console.log('Received message from admin:', message.toString());
      try {
        const msg = JSON.parse(message);
        if (msg.type === 'command' && msg.deviceId) {
          // If it is a simulated key command, attempt ADB execution as a hardware-level injection
          if (msg.payload && msg.payload.action === 'simulate_key') {
            const key = msg.payload.key;
            let keycode = null;
            if (key === 'home') keycode = 3;
            else if (key === 'back') keycode = 4;
            else if (key === 'lock') keycode = 26; // Power button
            else if (key === 'volume_up') keycode = 24;
            else if (key === 'volume_down') keycode = 25;

            if (keycode !== null) {
              const captureObj = adbCaptures.get(msg.deviceId);
              const serial = captureObj ? captureObj.serial : null;
              if (serial) {
                const adbCmd = `adb -s ${serial} shell input keyevent ${keycode}`;
                console.log(`ADB injection: Key event ${keycode} (${key}) on ${serial}`);
                exec(adbCmd, (err, stdout, stderr) => {
                  if (err) {
                    console.log(`ADB command skipped or failed: ${err.message}`);
                  }
                });
              } else {
                console.log(`ADB injection skipped: No ADB serial mapped for deviceId ${msg.deviceId}`);
              }
            }
          }

          // If ADB capture is not running for this device, attempt to start it
          if (!adbCaptures.has(msg.deviceId)) {
            startAdbCapture(msg.deviceId);
          }

          // Trigger battery level update for selected device
          queryAndBroadcastBattery(msg.deviceId);

          const deviceWs = devices.get(msg.deviceId);
          if (deviceWs && deviceWs.readyState === WebSocket.OPEN) {
            deviceWs.send(JSON.stringify(msg.payload));
          }
        }
      } catch (e) {
        // ignore invalid json
      }
    });

    ws.on('close', () => {
      console.log('Admin disconnected');
      admins.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('Admin error:', err);
      admins.delete(ws);
    });
  } else {
    console.log(`Unknown connection type: ${type}`);
    ws.close(4001, 'Invalid connection type');
  }
});

// REST API for chat messages
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user.userId;

  if (!currentUserId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUserId})`)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }

  res.json({ success: true, messages: data ? snakeToCamel(data) : [] });
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  const { receiverId, message } = req.body;
  const currentUserId = req.user.userId;

  if (!currentUserId || !receiverId || !message) {
    return res.status(400).json({ success: false, error: 'receiverId and message are required.' });
  }

  const payload = {
    sender_id: currentUserId,
    receiver_id: receiverId,
    message: message
  };

  const { data, error } = await supabase
    .from('messages')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ success: false, error: 'Failed to send message' });
  }

  const newMessage = snakeToCamel(data);

  // Broadcast to the receiver if they are currently connected as admin
  sendToAdmin(receiverId, { type: 'new_message', message: newMessage });

  // ALSO send to the receiver if they are connected as a mobile device (employee)
  const receiverEmployee = (await loadEmployees()).find(e => e.id === receiverId);
  if (receiverEmployee && receiverEmployee.deviceId) {
    const deviceWs = devices.get(receiverEmployee.deviceId);
    if (deviceWs && deviceWs.readyState === WebSocket.OPEN) {
      deviceWs.send(JSON.stringify({
        type: 'new_message',
        message: newMessage
      }));
      console.log(`Forwarded message to mobile device ${receiverEmployee.deviceId} for employee ${receiverEmployee.firstName}`);
    }
  }

  res.json({ success: true, message: newMessage });
});

app.get('/api/devices/users', async (req, res) => {
  const deviceId = req.headers['x-device-id'];
  if (!deviceId) {
    return res.status(400).json({ success: false, error: 'x-device-id header is required.' });
  }

  const employees = await loadEmployees();
  const employee = employees.find(e => e.deviceId === deviceId);
  if (!employee) {
    return res.status(404).json({ success: false, error: 'Employee not found for this device.' });
  }

  // Filter out the requesting employee themselves
  const contacts = employees.filter(e => e.id !== employee.id);
  res.json({ success: true, users: contacts });
});

app.get('/api/devices/messages', async (req, res) => {
  const deviceId = req.headers['x-device-id'];
  const { otherUserId } = req.query;
  if (!deviceId) {
    return res.status(400).json({ success: false, error: 'x-device-id header is required.' });
  }
  if (!otherUserId) {
    return res.status(400).json({ success: false, error: 'otherUserId query parameter is required.' });
  }

  const employees = await loadEmployees();
  const employee = employees.find(e => e.deviceId === deviceId);
  if (!employee) {
    return res.status(404).json({ success: false, error: 'Employee not found for this device.' });
  }

  // Retrieve messages between this employee and otherUserId
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${employee.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${employee.id})`)
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Error fetching messages for device:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch messages.' });
  }

  res.json({ success: true, messages: data ? snakeToCamel(data) : [] });
});

app.post('/api/devices/messages', async (req, res) => {
  const deviceId = req.headers['x-device-id'];
  const { receiverId, message } = req.body;

  if (!deviceId || !receiverId || !message) {
    return res.status(400).json({ success: false, error: 'x-device-id, receiverId, and message are required.' });
  }

  const employees = await loadEmployees();
  const employee = employees.find(e => e.deviceId === deviceId);
  if (!employee) {
    return res.status(404).json({ success: false, error: 'Employee not found for this device.' });
  }

  const payload = {
    sender_id: employee.id,
    receiver_id: receiverId,
    message: message
  };

  const { data, error } = await supabase
    .from('messages')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error sending message from device:', error);
    return res.status(500).json({ success: false, error: 'Failed to send message.' });
  }

  const newMessage = snakeToCamel(data);

  // Send to receiver if they are an admin connected to WebSocket
  sendToAdmin(receiverId, { type: 'new_message', message: newMessage });

  // ALSO send to receiver if they are connected as a mobile device (employee-to-employee chat!)
  const receiverEmployee = employees.find(e => e.id === receiverId);
  if (receiverEmployee && receiverEmployee.deviceId) {
    const deviceWs = devices.get(receiverEmployee.deviceId);
    if (deviceWs && deviceWs.readyState === WebSocket.OPEN) {
      deviceWs.send(JSON.stringify({
        type: 'new_message',
        message: newMessage
      }));
      console.log(`Forwarded message to mobile device ${receiverEmployee.deviceId} for employee ${receiverEmployee.firstName}`);
    }
  }

  // Broadcast to other admins to update active dashboards
  broadcastToAdmins({ type: 'new_message', message: newMessage });

  res.json({ success: true, message: newMessage });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);

  // Periodically query and broadcast battery levels for all active devices
  setInterval(() => {
    for (const deviceId of devices.keys()) {
      queryAndBroadcastBattery(deviceId);
    }
  }, 10000); // Check battery level every 10 seconds

  // UDP Discovery Beacon — broadcasts every 2s so Flutter clients can find this server
  const DISCOVERY_PORT = 4001;
  const udpBeacon = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  udpBeacon.on('error', (err) => console.error('UDP beacon error:', err.message));
  
  // Helper to calculate subnet broadcast address
  function getBroadcastAddress(ip, netmask) {
    try {
      const ipParts = ip.split('.').map(Number);
      const maskParts = netmask.split('.').map(Number);
      if (ipParts.length !== 4 || maskParts.length !== 4) return null;
      const broadcastParts = [];
      for (let i = 0; i < 4; i++) {
        broadcastParts.push(ipParts[i] | (~maskParts[i] & 255));
      }
      return broadcastParts.join('.');
    } catch (e) {
      return null;
    }
  }

  udpBeacon.bind(() => {
    try { udpBeacon.setBroadcast(true); } catch (_) {}
    const payload = Buffer.from(JSON.stringify({
      service: 'screen_recorder_admin',
      port: port,
      name: 'Admin Dashboard'
    }));
    const os = require('os');
    setInterval(() => {
      // Find all broadcast addresses dynamically
      const interfaces = os.networkInterfaces();
      const broadcastAddresses = new Set(['255.255.255.255']);
      
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
            const baddr = getBroadcastAddress(iface.address, iface.netmask);
            if (baddr) {
              broadcastAddresses.add(baddr);
            }
          }
        }
      }

      // Send to all broadcast addresses
      broadcastAddresses.forEach((addr) => {
        udpBeacon.send(payload, 0, payload.length, DISCOVERY_PORT, addr, (err) => {
          if (err && !err.message.includes('ENETUNREACH') && !err.message.includes('ENOBUFS')) {
            console.error(`UDP send error to ${addr}:`, err.message);
          }
        });
      });
    }, 2000);
    console.log(`UDP discovery beacon broadcasting on port ${DISCOVERY_PORT}`);
  });
});
