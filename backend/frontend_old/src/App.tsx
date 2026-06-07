import { useState, useEffect, useRef } from 'react'
import {
  Video,
  Monitor,
  Users,
  RefreshCw,
  Smartphone,
  Server,
  Plus,
  Camera,
  Tv,
  Info,
  BatteryCharging,
  Home,
  ArrowLeft,
  Lock,
  Volume2,
  Volume1,
  Folder,
  History,
  UserPlus,
  X,
  Play,
  Copy,
  Loader2,
  AlertCircle,
  ArrowRight,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

// Interfaces
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  password?: string;
  deviceId?: string;
  deviceModel?: string;
  osVersion?: string;
  lastActive?: string;
}

interface Recording {
  id: string;
  name: string;
  deviceId: string;
  duration: string;
  timestamp: string;
  size: string;
  filename: string;
  status?: string;
  path?: string; // only for device recordings
}

interface DeviceRecording {
  name: string;
  size: string;
  timestamp: string;
  path: string;
  duration?: string;
}

interface ServerIp {
  type: string;
  address: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

interface ClockSession {
  id: string;
  employeeId: string;
  deviceId: string;
  clockInTime: string;
  clockOutTime: string | null;
  duration: string;
  status: 'Active' | 'Completed';
  notes: string;
}

const formatUSPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'monitor' | 'employees' | 'timekeeping'>('monitor')

  // Timekeeping State
  const [clockSessions, setClockSessions] = useState<ClockSession[]>([])
  const [isClockSessionModalOpen, setIsClockSessionModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<ClockSession | null>(null)
  
  // Form states for manual additions/edits
  const [formEmployeeId, setFormEmployeeId] = useState('')
  const [formClockIn, setFormClockIn] = useState('')
  const [formClockOut, setFormClockOut] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const [filterEmp, setFilterEmp] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  const filteredSessions = clockSessions.filter(s => {
    if (filterEmp && s.employeeId !== filterEmp) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_logged_in') === 'true';
  });
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Global State
  const [wsStatus, setWsStatus] = useState<'Connecting' | 'Online' | 'Disconnected'>('Connecting')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [activeDevices, setActiveDevices] = useState<string[]>([])
  const [serverRecordings, setServerRecordings] = useState<Recording[]>([])
  const [deviceRecordings, setDeviceRecordings] = useState<DeviceRecording[]>([])
  const [sessionPage, setSessionPage] = useState(1)
  const sessionsPerPage = 25
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  
  // Employee Profile Edit States
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhoneNumber, setEditPhoneNumber] = useState('')
  const [editPassword, setEditPassword] = useState('')

  const [serverIps, setServerIps] = useState<ServerIp[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])

  // Selection & Loading States
  const [isRecording, setIsRecording] = useState(false)
  const [fps, setFps] = useState(0)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [deviceSettings, setDeviceSettings] = useState<{ [deviceId: string]: { fps: number; resolution: string } }>({})

  // Modals state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false)
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState(false)
  const [videoModal, setVideoModal] = useState<{
    isOpen: boolean;
    title: string;
    filename: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    title: '',
    filename: '',
    isLoading: false
  })

  // Employee Form State
  const [empFirstName, setEmpFirstName] = useState('')
  const [empLastName, setEmpLastName] = useState('')
  const [empEmail, setEmpEmail] = useState('')
  const [empPhone, setEmpPhone] = useState('')
  const [empPassword, setEmpPassword] = useState('')

  // Simulator State
  const [simDeviceId, setSimDeviceId] = useState('Device_Sim_ABC')
  const [simFps, setSimFps] = useState(15)
  const [isSimConnected, setIsSimConnected] = useState(false)
  const [simIsClockedIn, setSimIsClockedIn] = useState(false)
  const [simLogs, setSimLogs] = useState<string[]>([])
  const [simRecordings, setSimRecordings] = useState<DeviceRecording[]>([
    {
      name: 'recording_20260520_120000.mp4',
      size: '2.4 MB',
      timestamp: 'May 20, 2026 12:00 PM',
      path: '/mock/path/recording_20260520_120000.mp4',
      duration: '00:05:00'
    },
    {
      name: 'recording_20260520_153000.mp4',
      size: '1.8 MB',
      timestamp: 'May 20, 2026 03:30 PM',
      path: '/mock/path/recording_20260520_153000.mp4',
      duration: '00:03:15'
    }
  ])
  const simClockInTimeRef = useRef<number | null>(null)

  // Refs for tracking references without triggering renders
  const socketRef = useRef<WebSocket | null>(null)
  const simSocketRef = useRef<WebSocket | null>(null)
  const simIntervalRef = useRef<number | null>(null)
  const simRotationRef = useRef<number>(0)
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null)
  
  // Draggable Simulator Window State
  const [simPosition, setSimPosition] = useState({ x: 100, y: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  // Center window when opened
  useEffect(() => {
    if (isSimulationModalOpen) {
      const width = 768; // max-w-3xl is 768px
      const height = 630; // approximate height
      const x = Math.max(20, (window.innerWidth - width) / 2);
      const y = Math.max(20, (window.innerHeight - height) / 2);
      setSimPosition({ x, y });
    }
  }, [isSimulationModalOpen]);

  // Handle mouse move dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      let newX = e.clientX - dragStartRef.current.x;
      let newY = e.clientY - dragStartRef.current.y;

      const width = 768;
      const height = 630;
      newX = Math.max(10, Math.min(window.innerWidth - width - 10, newX));
      newY = Math.max(10, Math.min(window.innerHeight - height - 10, newY));

      setSimPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleSimHeaderMouseDown = (e: React.MouseEvent) => {
    // Only drag with left click and avoid dragging on button clicks
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input')) {
      return;
    }
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - simPosition.x,
      y: e.clientY - simPosition.y
    };
    e.preventDefault();
  };

  const frameCountRef = useRef(0)
  const currentObjectURLRef = useRef<string | null>(null)
  const latestFrameBlobRef = useRef<Blob | null>(null)
  const currentExtensionRef = useRef<string>('jpg')
  const lastScreenshotObjectURLRef = useRef<string | null>(null)
  const pendingPlayFilenamesRef = useRef<Set<string>>(new Set())

  // Local device recording frame captures (mock)
  const localRecordedFramesRef = useRef<Blob[]>([])
  const localRecordingStartTimeRef = useRef<number | null>(null)
  const [localRecordedSessions, setLocalRecordedSessions] = useState<Array<{
    id: string;
    deviceId: string;
    duration: string;
    timestamp: string;
    size: string;
    frameCount: number;
  }>>([])

  // Base API URLs
  const getBaseUrl = () => {
    return window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
  }

  const getWsUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host;
    return `${protocol}//${host}`;
  }

  // Toast System Helper
  const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }

  // HTTP Fetches
  const fetchDevices = async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/devices`)
      const devicesData = await response.json()
      setActiveDevices(devicesData || [])
    } catch (err) {
      console.error('Error fetching devices list:', err)
    }
  }

  const fetchRecordings = async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/recordings`)
      const recordingsData = await response.json()
      setServerRecordings(recordingsData || [])
    } catch (err) {
      console.error('Error fetching recordings:', err)
    }
  }

  const fetchServerIps = async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/server-ips`)
      const ipsData = await response.json()
      setServerIps(ipsData || [])
    } catch (err) {
      console.error('Error fetching server IPs:', err)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/employees`)
      const employeesData = await response.json()
      setEmployees(employeesData || [])
    } catch (err) {
      console.error('Error fetching employees:', err)
    }
  }

  const simFpsRef = useRef(simFps)
  useEffect(() => {
    simFpsRef.current = simFps;
  }, [simFps]);

  const fetchDeviceSettings = async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/devices/settings`)
      const settingsData = await response.json()
      setDeviceSettings(settingsData || {})
    } catch (err) {
      console.error('Error fetching device settings:', err)
    }
  }

  const fetchClockSessions = async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/clock-sessions`)
      const data = await response.json()
      setClockSessions(data || [])
    } catch (err) {
      console.error('Error fetching clock sessions:', err)
    }
  }

  const deleteClockSession = async (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      const response = await fetch(`${getBaseUrl()}/api/clock-sessions/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        showToast('Clock session deleted successfully', 'success');
        fetchClockSessions();
      } else {
        showToast(data.error || 'Failed to delete clock session', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error deleting clock session', 'error');
    }
  }

  const submitClockSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeId || !formClockIn) {
      showToast('Employee and Clock In time are required.', 'error');
      return;
    }

    const payload = {
      employeeId: formEmployeeId,
      clockInTime: new Date(formClockIn).toISOString(),
      clockOutTime: formClockOut ? new Date(formClockOut).toISOString() : null,
      notes: formNotes
    };

    try {
      let response;
      if (editingSession) {
        response = await fetch(`${getBaseUrl()}/api/clock-sessions/${editingSession.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clockInTime: payload.clockInTime,
            clockOutTime: payload.clockOutTime,
            notes: payload.notes
          })
        });
      } else {
        const emp = employees.find(e => e.id === formEmployeeId);
        response = await fetch(`${getBaseUrl()}/api/clock-sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            deviceId: emp?.deviceId || 'Manual'
          })
        });
      }

      const data = await response.json();
      if (data.success) {
        showToast(editingSession ? 'Clock session updated' : 'Manual clock session created', 'success');
        setIsClockSessionModalOpen(false);
        setEditingSession(null);
        setFormEmployeeId('');
        setFormClockIn('');
        setFormClockOut('');
        setFormNotes('');
        fetchClockSessions();
      } else {
        showToast(data.error || 'Operation failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error saving clock session', 'error');
    }
  }

  const updateDeviceSettings = async (deviceId: string, targetFps: number, targetResolution: string) => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/devices/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          fps: targetFps,
          resolution: targetResolution
        })
      });
      const data = await response.json();
      if (data.success) {
        showToast(`Settings updated for device ${deviceId}`, 'success');
        setDeviceSettings(prev => ({
          ...prev,
          [deviceId]: data.settings
        }));
      } else {
        showToast(data.error || 'Failed to update settings', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating device settings', 'error');
    }
  }

  // Send message helper to device
  const sendCommandToDevice = (action: string, extraPayload: any = {}) => {
    if (!selectedDeviceId) return;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'command',
        deviceId: selectedDeviceId,
        payload: { action, ...extraPayload, timestamp: Date.now() }
      }));
      return true;
    } else {
      showToast('Admin WebSocket not connected', 'error');
      return false;
    }
  }

  // Device Diagnostic Commands
  const sendSimulatedCommand = (command: string) => {
    const success = sendCommandToDevice('simulate_key', { key: command });
    if (success) {
      showToast(`Sent simulation payload: ${command}`, 'success');
    }
  }

  // Clock In / Out (Trigger device recording)
  const toggleRecord = () => {
    if (!selectedDeviceId) return;
    const action = isRecording ? 'clock_out' : 'clock_in';
    const success = sendCommandToDevice(action);
    if (success) {
      showToast(isRecording ? 'Sending Clock Out command...' : 'Sending Clock In command...', 'info');
    }
  }

  // Fetch device files
  const requestDeviceRecordings = () => {
    const success = sendCommandToDevice('get_recordings');
    if (success) {
      showToast('Requesting recordings list from device...', 'info');
    }
  }

  // Sync / Upload device file
  const syncDeviceRecording = (filePath: string) => {
    const success = sendCommandToDevice('upload_file', { path: filePath });
    if (success) {
      showToast('Sync request sent to device...', 'info');
    }
  }

  // Delete recording from device
  const deleteDeviceRecording = (filePath: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete the recording "${filename}" from the device?`)) return;
    const success = sendCommandToDevice('delete_recording', { path: filePath });
    if (success) {
      showToast(`Delete command sent for "${filename}"`, 'info');
    }
  }

  // Play a file that is on the device: triggers upload first, then auto-plays
  const playDeviceRecording = (filePath: string, filename: string, title: string) => {
    if (!selectedDeviceId) return;
    
    // Set video player to loading state
    setVideoModal({
      isOpen: true,
      title: `Loading from Device: ${title}`,
      filename: filename,
      isLoading: true
    });

    // Register file for auto-play when upload notification arrives
    pendingPlayFilenamesRef.current.add(filename);

    // Send command
    const success = sendCommandToDevice('upload_file', { path: filePath });
    if (success) {
      showToast('Requesting recording file transfer...', 'info');
    } else {
      setVideoModal(prev => ({ ...prev, isOpen: false }));
    }
  }

  // Play synced server video
  const playRealVideo = (filename: string, title: string) => {
    setVideoModal({
      isOpen: true,
      title: `Session Player: ${title}`,
      filename: filename,
      isLoading: false
    });
  }

  // Screenshot capture
  const takeScreenshot = () => {
    if (!latestFrameBlobRef.current) {
      showToast('No frame available to capture', 'error');
      return;
    }

    if (lastScreenshotObjectURLRef.current) {
      URL.revokeObjectURL(lastScreenshotObjectURLRef.current);
    }

    const objectUrl = URL.createObjectURL(latestFrameBlobRef.current);
    lastScreenshotObjectURLRef.current = objectUrl;

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `screenshot_${selectedDeviceId}_${Date.now()}.${currentExtensionRef.current}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Screenshot downloaded!', 'success');
  }

  // Clear current video feed selection
  const clearStream = () => {
    setSelectedDeviceId(null);
    setDeviceRecordings([]);
    setStreamUrl(null);
    setFps(0);

    if (currentObjectURLRef.current) {
      URL.revokeObjectURL(currentObjectURLRef.current);
      currentObjectURLRef.current = null;
    }
    latestFrameBlobRef.current = null;
  }

  // Switch Selected Device
  const handleSelectDevice = (deviceId: string) => {
    if (selectedDeviceId === deviceId) return;
    
    // Cleanup old URL
    if (currentObjectURLRef.current) {
      URL.revokeObjectURL(currentObjectURLRef.current);
      currentObjectURLRef.current = null;
    }
    setStreamUrl(null);
    setSelectedDeviceId(deviceId);
    setDeviceRecordings([]);
    setFps(0);
    frameCountRef.current = 0;

    // Send commands to initialize details
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'command',
        deviceId: deviceId,
        payload: { action: 'get_status', timestamp: Date.now() }
      }));
      socketRef.current.send(JSON.stringify({
        type: 'command',
        deviceId: deviceId,
        payload: { action: 'get_recordings', timestamp: Date.now() }
      }));
    }
  }

  // Register Employee POST
  const submitAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empFirstName || !empLastName || !empEmail || !empPassword) {
      showToast('Missing required fields', 'error');
      return;
    }

    try {
      const response = await fetch(`${getBaseUrl()}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: empFirstName,
          lastName: empLastName,
          email: empEmail,
          phoneNumber: empPhone,
          password: empPassword
        })
      });
      const data = await response.json();
      if (data.success) {
        showToast(`Employee ${empFirstName} ${empLastName} registered!`, 'success');
        setIsEmployeeModalOpen(false);
        setEmpFirstName('');
        setEmpLastName('');
        setEmpEmail('');
        setEmpPhone('');
        setEmpPassword('');
        fetchEmployees();
      } else {
        showToast(data.error || 'Failed to add employee', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error registering employee', 'error');
    }
  }

  // Unlink Device from Employee POST
  const unlinkDevice = async (id: string) => {
    if (!confirm('Are you sure you want to unlink this device?')) return;
    try {
      const response = await fetch(`${getBaseUrl()}/api/employees/unlink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (data.success) {
        showToast('Device unlinked successfully', 'success');
        fetchEmployees();
      } else {
        showToast(data.error || 'Failed to unlink device', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error unlinking device', 'error');
    }
  }

  // Edit profile actions
  const startEditingProfile = () => {
    if (!selectedEmployee) return;
    setEditFirstName(selectedEmployee.firstName);
    setEditLastName(selectedEmployee.lastName);
    setEditEmail(selectedEmployee.email);
    setEditPhoneNumber(selectedEmployee.phoneNumber || '');
    setEditPassword(selectedEmployee.password || '');
    setIsEditingProfile(true);
  }

  const updateEmployeeProfile = async () => {
    if (!selectedEmployee) return;
    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
      showToast('First name, last name, and email are required.', 'error');
      return;
    }

    try {
      const response = await fetch(`${getBaseUrl()}/api/employees/${selectedEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          email: editEmail.trim(),
          phoneNumber: editPhoneNumber.trim(),
          password: editPassword.trim()
        })
      });
      const data = await response.json();
      if (data.success && data.employee) {
        showToast('Profile updated successfully', 'success');
        setSelectedEmployee(data.employee);
        setEmployees(prev => prev.map(emp => emp.id === data.employee.id ? data.employee : emp));
        setIsEditingProfile(false);
        setEditPassword('');
      } else {
        showToast(data.error || 'Failed to update profile', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating profile', 'error');
    }
  }

  // Helper: Match employee names
  const getEmployeeName = (deviceId: string) => {
    if (!deviceId) return null;
    const emp = employees.find(e => e.deviceId === deviceId);
    return emp ? `${emp.firstName} ${emp.lastName}` : null;
  }

  // Initialize WebSocket Admin connection
  useEffect(() => {
    let active = true;
    let reconnectTimeout: number;

    const connectWebSocket = () => {
      if (!active) return;
      setWsStatus('Connecting');
      const wsUrl = `${getWsUrl()}?type=admin`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      socketRef.current = ws;

      ws.onopen = () => {
        if (!active) return;
        setWsStatus('Online');
        showToast('Connected to main gateway', 'success');
        fetchDevices();
        fetchRecordings();
        fetchEmployees();
        fetchServerIps();
        fetchDeviceSettings();
        fetchClockSessions();
      };

      ws.onmessage = async (event) => {
        if (!active) return;
        if (typeof event.data === 'string') {
          // Handle Text / JSON
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'device_list') {
              setActiveDevices(data.devices || []);
            } else if (data.type === 'device_connected') {
              fetchDevices();
              showToast(`Device ${data.deviceId} is now online`, 'success');
            } else if (data.type === 'device_disconnected') {
              fetchDevices();
              showToast(`Device ${data.deviceId} went offline`, 'warning');
              if (selectedDeviceId === data.deviceId) {
                clearStream();
              }
            } else if (data.type === 'status') {
              if (data.deviceId === selectedDeviceId) {
                setIsRecording(data.isClockedIn);
                
                // Track recording state transitions
                if (data.isClockedIn) {
                  localRecordedFramesRef.current = [];
                  localRecordingStartTimeRef.current = Date.now();
                  showToast('Live stream recording active on phone', 'success');
                } else {
                  showToast('Stream recording stopped on phone', 'warning');
                  // compile mock local download if local capture caught frames
                  if (localRecordedFramesRef.current.length > 0 && localRecordingStartTimeRef.current) {
                    const elapsed = Date.now() - localRecordingStartTimeRef.current;
                    const durationSec = Math.floor(elapsed / 1000);
                    const min = Math.floor(durationSec / 60).toString().padStart(2, '0');
                    const sec = (durationSec % 60).toString().padStart(2, '0');
                    
                    const newLocalSession = {
                      id: `session_rec_${Math.floor(Math.random() * 900) + 100}`,
                      deviceId: selectedDeviceId || 'unknown',
                      duration: `${min}:${sec}`,
                      timestamp: new Date().toLocaleString(),
                      size: `${(localRecordedFramesRef.current.length * 0.12).toFixed(1)} MB`,
                      frameCount: localRecordedFramesRef.current.length
                    };
                    setLocalRecordedSessions(prev => [newLocalSession, ...prev]);
                  }
                }
              }
            } else if (data.type === 'new_recording') {
              // Prepend to list
              setServerRecordings(prev => [data.recording, ...prev]);
              showToast(`New recording synchronized: ${data.recording.name}`, 'success');
              
              // Auto-play checks
              if (pendingPlayFilenamesRef.current.has(data.recording.filename)) {
                pendingPlayFilenamesRef.current.delete(data.recording.filename);
                // switch video modal state to display loaded video
                setVideoModal({
                  isOpen: true,
                  title: `Session Player: ${data.recording.name}`,
                  filename: data.recording.filename,
                  isLoading: false
                });
              }
            } else if (data.type === 'device_recordings') {
              if (data.deviceId === selectedDeviceId) {
                setDeviceRecordings(data.recordings || []);
              }
            } else if (data.type === 'employee_list_update') {
              setEmployees(data.employees || []);
            } else if (data.type === 'device_settings_update') {
              setDeviceSettings(data.settings || {});
            } else if (data.type === 'clock_sessions_list') {
              setClockSessions(data.sessions || []);
            } else if (data.type === 'clock_sessions_update') {
              setClockSessions(data.sessions || []);
            }
          } catch (err) {
            console.error('Error parsing text frame:', err);
          }
        } else {
          // Handle Binary frame (device video stream output)
          // format: [1 byte deviceId length] [deviceId string] [image frame data]
          try {
            let buffer: ArrayBuffer;
            if (event.data instanceof Blob) {
              buffer = await event.data.arrayBuffer();
            } else {
              buffer = event.data as ArrayBuffer;
            }
            const view = new DataView(buffer);
            const idLen = view.getUint8(0);
            
            const decoder = new TextDecoder('utf-8');
            const deviceId = decoder.decode(new Uint8Array(buffer, 1, idLen));

            if (deviceId === selectedDeviceId) {
              frameCountRef.current++;
              
              const imgBytes = buffer.slice(1 + idLen);
              let mimeType = 'image/jpeg';
              let ext = 'jpg';
              
              if (imgBytes.byteLength >= 4) {
                const headerBytes = new Uint8Array(imgBytes, 0, 4);
                if (headerBytes[0] === 0x89 && headerBytes[1] === 0x50 && headerBytes[2] === 0x4E && headerBytes[3] === 0x47) {
                  mimeType = 'image/png';
                  ext = 'png';
                }
              }
              currentExtensionRef.current = ext;

              const blob = new Blob([new Uint8Array(imgBytes)], { type: mimeType });
              latestFrameBlobRef.current = blob;

              // Collect frames if clocked in
              if (isRecording) {
                localRecordedFramesRef.current.push(blob);
              }

              if (currentObjectURLRef.current) {
                URL.revokeObjectURL(currentObjectURLRef.current);
              }
              const newUrl = URL.createObjectURL(blob);
              currentObjectURLRef.current = newUrl;
              setStreamUrl(newUrl);
            }
          } catch (err) {
            console.error('Error reading binary packet:', err);
          }
        }
      };

      ws.onclose = () => {
        if (!active) return;
        setWsStatus('Disconnected');
        reconnectTimeout = window.setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (err) => {
        if (!active) return;
        console.error('WebSocket client error:', err);
        ws.close();
      };
    };

    connectWebSocket();
    fetchDevices();
    fetchEmployees();
    fetchRecordings();
    fetchServerIps();
    fetchDeviceSettings();

    // Set polling fallback for active devices list
    const pollInterval = setInterval(fetchDevices, 6000);

    // Setup 1-second FPS calculator tick
    const fpsInterval = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    return () => {
      active = false;
      clearInterval(pollInterval);
      clearInterval(fpsInterval);
      clearTimeout(reconnectTimeout);
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (currentObjectURLRef.current) {
        URL.revokeObjectURL(currentObjectURLRef.current);
      }
    };
  }, [selectedDeviceId, isRecording]);

  // Handle default selected device
  useEffect(() => {
    if (activeDevices.length > 0 && selectedDeviceId === null) {
      handleSelectDevice(activeDevices[0]);
    }
  }, [activeDevices, selectedDeviceId]);

  if (!isLoggedIn) {
    const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (usernameInput === 'admin' && passwordInput === 'admin123') {
        setIsLoggedIn(true);
        sessionStorage.setItem('admin_logged_in', 'true');
        showToast('Successfully logged in as administrator', 'success');
      } else {
        setLoginError('Invalid administrator credentials');
        showToast('Login failed: Invalid credentials', 'error');
      }
    };

    return (
      <div className="text-slate-100 min-h-screen flex items-center justify-center bg-slate-950 antialiased p-4 relative overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Toast notifications */}
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
          {toasts.map(toast => {
            const style = {
              success: 'bg-emerald-950 border-emerald-800 text-emerald-400',
              warning: 'bg-amber-950 border-amber-800 text-amber-400',
              error: 'bg-red-950 border-red-800 text-red-400',
              info: 'bg-slate-900 border-slate-800 text-slate-300'
            }[toast.type];
            return (
              <div
                key={toast.id}
                className={`px-4 py-3 rounded-xl border shadow-2xl text-xs font-medium animate-in slide-in-from-bottom-3 duration-200 ${style}`}
              >
                {toast.message}
              </div>
            )
          })}
        </div>

        <div className="glass max-w-md w-full rounded-2xl p-8 border border-slate-800/80 shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 mx-auto rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-400 flex items-center justify-center text-white font-extrabold shadow-lg shadow-violet-500/20">
              <Lock className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white mt-4">Admin Authentication</h2>
            <p className="text-xs text-slate-400">Sign in to access the TRN Monitor Admin control center</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">Username</label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  if (loginError) setLoginError('');
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="Enter admin username"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (loginError) setLoginError('');
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-3 px-4 rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all flex items-center justify-center gap-2"
            >
              Sign In <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="border-t border-slate-850 pt-4 flex flex-col items-center justify-center gap-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Default Credentials</span>
            <div className="flex gap-2 text-[10px] text-slate-400 font-mono bg-slate-900/60 border border-slate-850 px-3 py-1.5 rounded-lg">
              <span>user: <strong className="text-violet-400">admin</strong></span>
              <span className="text-slate-600">•</span>
              <span>pass: <strong className="text-violet-400">admin123</strong></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Simulator WebSocket & Canvas Loop Control
  const addSimLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setSimLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  }

  const handleSimClockIn = () => {
    setSimIsClockedIn(true);
    simClockInTimeRef.current = Date.now();
    addSimLog('Simulator state: CLOCKED IN');
    if (simSocketRef.current && simSocketRef.current.readyState === WebSocket.OPEN) {
      simSocketRef.current.send(JSON.stringify({
        type: 'status',
        deviceId: simDeviceId,
        isClockedIn: true,
        timestamp: Date.now()
      }));
    }
  };

  const handleSimClockOut = () => {
    setSimIsClockedIn(false);
    addSimLog('Simulator state: STANDBY');
    
    let durationStr = '00:00:15';
    if (simClockInTimeRef.current) {
      const elapsedSec = Math.floor((Date.now() - simClockInTimeRef.current) / 1000);
      const hours = Math.floor(elapsedSec / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((elapsedSec % 3600) / 60).toString().padStart(2, '0');
      const seconds = (elapsedSec % 60).toString().padStart(2, '0');
      durationStr = `${hours}:${minutes}:${seconds}`;
      simClockInTimeRef.current = null;
    }
    
    const timestampStr = new Date().toLocaleString();
    const formattedDate = new Date().toISOString().replace(new RegExp('[-' + ':.]', 'g'), '').split('T')[0] + '_' + new Date().toTimeString().split(' ')[0].replace(new RegExp(':', 'g'), '');
    const fileName = `recording_sim_${formattedDate}.mp4`;
    const newMockPath = `/mock/path/${fileName}`;
    const newMockSize = `${(Math.random() * 5 + 1).toFixed(1)} MB`;
    
    const newRec: DeviceRecording = {
      name: fileName,
      size: newMockSize,
      timestamp: timestampStr,
      path: newMockPath,
      duration: durationStr
    };
    
    setSimRecordings(prev => {
      const newList = [newRec, ...prev];
      setTimeout(() => {
        sendSimulatedRecordings(newList);
      }, 100);
      return newList;
    });

    if (simSocketRef.current && simSocketRef.current.readyState === WebSocket.OPEN) {
      simSocketRef.current.send(JSON.stringify({
        type: 'status',
        deviceId: simDeviceId,
        isClockedIn: false,
        timestamp: Date.now()
      }));
    }

    addSimLog(`Created mock file: ${fileName} (${durationStr})`);
    
    setTimeout(() => {
      simulateUpload(newMockPath, durationStr);
    }, 500);
  };

  const generateManualMockFile = () => {
    const formattedDate = new Date().toISOString().replace(new RegExp('[-' + ':.]', 'g'), '').split('T')[0] + '_' + new Date().toTimeString().split(' ')[0].replace(new RegExp(':', 'g'), '');
    const fileName = `recording_sim_manual_${formattedDate}.mp4`;
    const newMockPath = `/mock/path/${fileName}`;
    const newMockSize = `${(Math.random() * 5 + 1).toFixed(1)} MB`;
    const durationStr = '00:02:30';
    const timestampStr = new Date().toLocaleString();

    const newRec: DeviceRecording = {
      name: fileName,
      size: newMockSize,
      timestamp: timestampStr,
      path: newMockPath,
      duration: durationStr
    };

    setSimRecordings(prev => {
      const newList = [newRec, ...prev];
      setTimeout(() => {
        sendSimulatedRecordings(newList);
      }, 100);
      return newList;
    });

    addSimLog(`Manually created mock file: ${fileName}`);
    showToast(`Created file ${fileName} on simulated device`, 'success');
  };

  const toggleSimulation = () => {
    if (isSimConnected) {
      // Disconnect Simulator
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      if (simSocketRef.current) {
        simSocketRef.current.close();
        simSocketRef.current = null;
      }
      setIsSimConnected(false);
      showToast('Device simulator disconnected', 'warning');
    } else {
      // Connect Simulator
      const wsUrl = `${getWsUrl()}?type=device&id=${simDeviceId}`;
      const simWs = new WebSocket(wsUrl);
      simSocketRef.current = simWs;

      simWs.onopen = () => {
        setIsSimConnected(true);
        showToast('Device simulator connected & casting!', 'success');
        addSimLog(`Connected to backend as device: ${simDeviceId}`);
        
        // Notify server of initial status
        simWs.send(JSON.stringify({
          type: 'status',
          deviceId: simDeviceId,
          isClockedIn: simIsClockedIn,
          timestamp: Date.now()
        }));

        const intervalMs = 1000 / simFps;
        simIntervalRef.current = window.setInterval(() => {
          sendSimulatedFrame();
        }, intervalMs);

        // Send simulated recordings after connection
        setTimeout(() => {
          sendSimulatedRecordings();
        }, 300);
      };

      simWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.action === 'get_recordings') {
            addSimLog('Received command: get_recordings');
            sendSimulatedRecordings();
          } else if (data.action === 'upload_file') {
            addSimLog(`Received command: upload_file (${data.path})`);
            // Find recording duration from list if exists
            const recItem = simRecordings.find(r => r.path === data.path);
            simulateUpload(data.path, recItem?.duration);
          } else if (data.action === 'delete_recording') {
            addSimLog(`Received command: delete_recording (${data.path})`);
            const targetPath = data.path;
            setSimRecordings(prev => {
              const newList = prev.filter(r => r.path !== targetPath);
              setTimeout(() => {
                sendSimulatedRecordings(newList);
              }, 100);
              return newList;
            });
            showToast(`Simulator: Deleted mock file ${targetPath.split('/').pop()}`, 'warning');
          } else if (data.action === 'update_settings') {
            addSimLog(`Received command: update_settings (fps: ${data.fps})`);
            const targetFps = data.fps || 5;
            setSimFps(targetFps);
            simFpsRef.current = targetFps;
            if (simIntervalRef.current) {
              clearInterval(simIntervalRef.current);
            }
            const intervalMs = 1000 / targetFps;
            simIntervalRef.current = window.setInterval(() => {
              sendSimulatedFrame();
            }, intervalMs);
            showToast(`Simulator stream rate updated to ${targetFps} FPS`, 'info');
          } else if (data.action === 'clock_in') {
            addSimLog('Received command: clock_in');
            handleSimClockIn();
          } else if (data.action === 'clock_out') {
            addSimLog('Received command: clock_out');
            handleSimClockOut();
          } else if (data.action === 'simulate_key') {
            addSimLog(`Received keyevent injection: ${data.key}`);
          }
        } catch (e) {
          console.log('Simulator received raw bytes/data:', event.data);
        }
      };

      simWs.onclose = () => {
        if (simIntervalRef.current) {
          clearInterval(simIntervalRef.current);
          simIntervalRef.current = null;
        }
        setIsSimConnected(false);
        showToast('Simulator connection closed', 'warning');
        addSimLog('Connection closed by remote host.');
      };

      simWs.onerror = () => {
        showToast('Simulator encountered websocket error', 'error');
        addSimLog('Websocket error encountered.');
        simWs.close();
      };
    }
  }

  // Draw simulated phone display to canvas and broadcast bytes
  const sendSimulatedFrame = () => {
    const canvas = simCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!simIsClockedIn) {
      // Draw Standby Screen
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 320, 480);

      // Standby grid pattern
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 320; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, 480);
        ctx.stroke();
      }
      for (let j = 0; j < 480; j += 20) {
        ctx.beginPath();
        ctx.moveTo(0, j); ctx.lineTo(320, j);
        ctx.stroke();
      }

      // Top Header bar
      ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
      ctx.fillRect(10, 10, 300, 35);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('LTE', 20, 32);
      ctx.fillStyle = '#475569';
      ctx.fillRect(278, 22, 20, 10);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(298, 25, 2, 4);

      // Red flashing standby dot
      const isDotVisible = Math.floor(Date.now() / 1000) % 2 === 0;
      ctx.fillStyle = isDotVisible ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.05)';
      ctx.beginPath();
      ctx.arc(160, 160, 30, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = isDotVisible ? '#ef4444' : '#b91c1c';
      ctx.beginPath();
      ctx.arc(160, 160, 10, 0, 2 * Math.PI);
      ctx.fill();

      // Main Standby text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DEVICE STANDBY', 160, 230);
      
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(`Clocked Out`, 160, 255);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText('Ready for simulation triggers', 160, 290);
      ctx.fillText('Clock in to start screen broadcast.', 160, 310);

      ctx.fillStyle = '#475569';
      ctx.font = '9px monospace';
      ctx.fillText(`Time: ${new Date().toLocaleTimeString()}`, 160, 420);
      return;
    }

    // Draw UI container (Clocked In state)
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, 320, 480);

    // Moving radial mesh background lines
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.12)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 480; i += 25) {
      ctx.beginPath();
      ctx.moveTo(0, i + (simRotationRef.current % 25));
      ctx.lineTo(320, i + (simRotationRef.current % 25));
      ctx.stroke();
    }

    // Top Header bar
    ctx.fillStyle = 'rgba(31, 41, 55, 0.4)';
    ctx.fillRect(10, 10, 300, 35);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LTE', 20, 32);

    // Battery bar green
    ctx.fillStyle = '#10b981';
    ctx.fillRect(278, 22, 20, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(298, 25, 2, 4);

    // Rotating visualizer gear
    ctx.save();
    ctx.translate(160, 240);
    ctx.rotate((simRotationRef.current * Math.PI) / 180);
    simRotationRef.current += 3;
    if (simRotationRef.current >= 360) simRotationRef.current = 0;

    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, 2 * Math.PI);
    ctx.fill();

    // teeth
    ctx.fillStyle = '#8b5cf6';
    for (let k = 0; k < 8; k++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-10, -56, 20, 25);
    }

    // gear hole cut
    ctx.fillStyle = '#0b0f19';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // Dashboard Info titles
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Simulated Screen Broadcast', 160, 125);

    ctx.fillStyle = '#a78bfa';
    ctx.font = '10px monospace';
    ctx.fillText(`Casting FPS: ${simFpsRef.current}fps`, 160, 150);

    ctx.fillStyle = '#f59e0b';
    const indicatorY = 360 + Math.sin(simRotationRef.current * 0.08) * 10;
    ctx.beginPath();
    ctx.arc(160, indicatorY, 6, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px monospace';
    ctx.fillText(`Clock: ${new Date().toLocaleTimeString()}`, 160, 395);

    // Convert to blob and send binary
    canvas.toBlob((blob) => {
      if (!blob || !simSocketRef.current || simSocketRef.current.readyState !== WebSocket.OPEN) return;
      blob.arrayBuffer().then((buffer) => {
        if (simSocketRef.current && simSocketRef.current.readyState === WebSocket.OPEN) {
          simSocketRef.current.send(buffer);
        }
      });
    }, 'image/jpeg', 0.6);
  }

  // Send simulator mock recordings list
  const sendSimulatedRecordings = (currentList = simRecordings) => {
    if (!simSocketRef.current || simSocketRef.current.readyState !== WebSocket.OPEN) return;
    simSocketRef.current.send(JSON.stringify({
      type: 'device_recordings',
      deviceId: simDeviceId,
      recordings: currentList,
      timestamp: Date.now()
    }));
  }

  // Upload file mock simulator execution
  const simulateUpload = async (filePath: string, customDuration?: string) => {
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'recording_sim.mp4';
    showToast(`Simulator: Syncing file ${fileName} to server...`, 'info');
    addSimLog(`Syncing file to server: ${fileName}`);

    let blob: Blob;
    try {
      const res = await fetch('/sample.mp4');
      if (res.ok) {
        blob = await res.blob();
      } else {
        throw new Error('Fallback needed');
      }
    } catch (e) {
      blob = new Blob(['mock video data'], { type: 'video/mp4' });
    }

    try {
      const uploadRes = await fetch(`${getBaseUrl()}/api/upload`, {
        method: 'POST',
        headers: {
          'x-device-id': simDeviceId,
          'x-file-name': fileName,
          'x-duration': customDuration || '00:02:30',
          'x-timestamp': new Date().toLocaleString()
        },
        body: blob
      });
      const data = await uploadRes.json();
      if (data.success) {
        showToast(`Simulator successfully uploaded ${fileName}`, 'success');
        addSimLog(`Successfully synced: ${fileName}`);
      } else {
        showToast(`Simulator upload failed: ${data.error}`, 'error');
        addSimLog(`Sync failed: ${data.error}`);
      }
    } catch (err: any) {
      showToast(`Simulator sync failed: ${err.message}`, 'error');
      addSimLog(`Sync failed: ${err.message}`);
    }
  }

  const downloadMockSession = (id: string, size: string, framesCount: number) => {
    showToast(`Downloading compilation package for ${id}...`, 'info');
    const content = `Screen Recording Data for Session ${id}\nFrames Captured: ${framesCount}\nEstimated Size: ${size}\nDate: ${new Date().toISOString()}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const getSessionTime = (timestampStr: string) => {
    if (!timestampStr || timestampStr === 'Not Synced') return 0;
    const parsed = Date.parse(timestampStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  const combinedSessions = [
    // 1. Unsynced local recordings
    ...(selectedDeviceId
      ? deviceRecordings
          .filter(dRec => !serverRecordings.some(sr => sr.filename === dRec.name))
          .map(dRec => ({
            id: `device-unsynced-${dRec.name}`,
            name: dRec.name,
            deviceId: selectedDeviceId,
            duration: dRec.duration || '00:00:00',
            timestamp: 'Not Synced',
            rawTimestamp: dRec.timestamp,
            size: dRec.size,
            filename: dRec.name,
            path: dRec.path,
            status: 'pending' as const
          }))
      : []
    ),
    // 2. Local Mock Sessions
    ...localRecordedSessions.map(rec => ({
      id: rec.id,
      name: rec.id,
      deviceId: rec.deviceId,
      duration: rec.duration,
      timestamp: rec.timestamp,
      rawTimestamp: rec.timestamp,
      size: rec.size,
      filename: '',
      frameCount: rec.frameCount,
      status: 'local-cache' as const
    })),
    // 3. Server Recordings
    ...serverRecordings.map(rec => ({
      id: rec.id,
      name: rec.name,
      deviceId: rec.deviceId,
      duration: rec.duration,
      timestamp: rec.timestamp,
      rawTimestamp: rec.timestamp,
      size: rec.size,
      filename: rec.filename,
      status: 'completed' as const
    }))
  ];

  const sortedSessions = [...combinedSessions].sort((a, b) => {
    const timeA = getSessionTime(a.rawTimestamp);
    const timeB = getSessionTime(b.rawTimestamp);
    if (timeA !== timeB) return timeB - timeA;
    // Tie-breaker: sort by ID or name alphabetically if timestamps are identical
    return b.name.localeCompare(a.name);
  });

  const totalPages = Math.ceil(sortedSessions.length / sessionsPerPage);
  const currentPage = Math.max(1, Math.min(sessionPage, totalPages || 1));
  const startIndex = (currentPage - 1) * sessionsPerPage;
  const endIndex = Math.min(startIndex + sessionsPerPage, sortedSessions.length);
  const paginatedSessions = sortedSessions.slice(startIndex, endIndex);

  const selectedEmployeeInfo = selectedDeviceId ? employees.find(e => e.deviceId === selectedDeviceId) : null;

  useEffect(() => {
    setSessionPage(1);
  }, [selectedDeviceId]);

  useEffect(() => {
    if (sessionPage > totalPages && totalPages > 0) {
      setSessionPage(totalPages);
    }
  }, [totalPages, sessionPage]);

  return (
    <div className="text-slate-100 min-h-screen flex flex-col antialiased">
      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => {
          const style = {
            success: 'bg-emerald-950 border-emerald-800 text-emerald-400',
            warning: 'bg-amber-950 border-amber-800 text-amber-400',
            error: 'bg-red-950 border-red-800 text-red-400',
            info: 'bg-slate-900 border-slate-800 text-slate-300'
          }[toast.type];
          return (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-xl border shadow-2xl text-xs font-medium animate-in slide-in-from-bottom-3 duration-200 ${style}`}
            >
              {toast.message}
            </div>
          )
        })}
      </div>

      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-400 flex items-center justify-center text-white font-extrabold shadow-lg shadow-violet-500/20 shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
              TRN Monitor Admin
            </h1>
            <p className="text-xs text-slate-400 font-medium">Real-time Mobile Cast & Control Center</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('monitor')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'monitor'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> Live Monitor
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'employees'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Employees Directory
          </button>
          <button
            onClick={() => setActiveTab('timekeeping')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'timekeeping'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Time Tracking
          </button>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Status Badge */}
          <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <span className="relative flex h-2 w-2">
              {wsStatus === 'Online' ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              ) : wsStatus === 'Connecting' ? (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              )}
            </span>
            <span className={`font-semibold ${
              wsStatus === 'Online' ? 'text-emerald-400' : wsStatus === 'Connecting' ? 'text-amber-400' : 'text-red-400'
            }`}>
              {wsStatus}
            </span>
          </div>

          <button
            onClick={fetchDevices}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-800"
            title="Refresh Device List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setIsLoggedIn(false);
              sessionStorage.removeItem('admin_logged_in');
              setUsernameInput('');
              setPasswordInput('');
              showToast('Logged out successfully', 'info');
            }}
            className="px-3 py-2 bg-red-950/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 font-semibold text-xs transition-colors border border-red-900/30 rounded-lg flex items-center gap-1.5 animate-in fade-in duration-200"
            title="Sign Out of Admin Console"
          >
            <Lock className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full lg:w-80 border-r border-slate-800/60 bg-slate-950/40 p-6 flex flex-col gap-6 shrink-0">
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Online Devices</h2>
            {activeDevices.length === 0 ? (
              <div className="glass-card rounded-xl p-6 text-center border border-dashed border-slate-800">
                <Smartphone className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                <p className="text-xs text-slate-400">No active devices connected</p>
                <p className="text-[10px] text-slate-500 mt-1">Connect a mobile client with type=device</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeDevices.map(devId => {
                  const isSelected = devId === selectedDeviceId
                  const empName = getEmployeeName(devId)
                  return (
                    <div
                      key={devId}
                      onClick={() => handleSelectDevice(devId)}
                      className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-violet-600 text-white font-medium border-violet-500 shadow-md shadow-violet-600/20'
                          : 'glass-card hover:bg-slate-850/60 border-slate-850 hover:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate pr-2">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <div className="truncate">
                          <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`} title={empName || devId}>
                            {empName || devId}
                          </div>
                          <div className={`text-[10px] ${isSelected ? 'text-violet-200' : 'text-slate-400'} font-mono truncate`}>
                            {empName ? devId : 'Mobile Client'}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold shrink-0 ${
                        isSelected ? 'bg-violet-700/80 text-violet-100' : 'bg-slate-900 border border-slate-800 text-slate-300'
                      }`}>
                        {isSelected ? 'Casting' : 'View'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Server IPs list */}
          <div className="glass-card rounded-xl p-4 border border-slate-800/50">
            <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" /> Server Addresses
            </h3>
            <div className="space-y-2 text-[11px]">
              {serverIps.length === 0 ? (
                <div className="text-slate-500 italic">Loading addresses...</div>
              ) : (
                serverIps.map((ip, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-slate-800/30 last:border-0 hover:bg-slate-850/40 px-1 rounded transition-colors">
                    <span className="text-slate-400 font-medium truncate max-w-[80px]" title={ip.type}>{ip.type}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(ip.address);
                        showToast(`Copied: ${ip.address}`, 'success');
                      }}
                      className="text-slate-200 font-mono hover:text-violet-400 transition-colors flex items-center gap-1 text-[10px]"
                      title="Click to copy address"
                    >
                      <span>{ip.address}</span>
                      <Copy className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Simulator Quick Action */}
          <div className="mt-auto">
            <div className="glass-card rounded-xl p-4 border border-slate-800/50">
              <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">Simulate Connection</h3>
              <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                Connect a virtual device casting mock canvas stream coordinates to test the server websocket relay.
              </p>
              <button
                onClick={() => setIsSimulationModalOpen(true)}
                className="w-full bg-slate-900 hover:bg-slate-850 text-slate-200 text-xs font-semibold py-2 px-3 rounded-lg border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Device Simulator
              </button>
            </div>
          </div>
        </aside>

        {/* Content Panel */}
        <main className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'monitor' ? (
            <div className="space-y-6">
              {/* Top streaming panel */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Live Stream Panel */}
                <div className="xl:col-span-2 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-5 h-5 text-violet-400" />
                      <h2 className="text-lg font-bold tracking-tight">Active Screen Stream</h2>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={toggleRecord}
                        disabled={!selectedDeviceId}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isRecording
                            ? 'bg-red-950/60 border-red-800 text-red-400 hover:bg-red-900/20'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
                        <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
                      </button>
                      <button
                        onClick={takeScreenshot}
                        disabled={!selectedDeviceId || !streamUrl}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Capture
                      </button>
                    </div>
                  </div>

                  {/* Video Monitor */}
                  <div className="relative rounded-2xl glass overflow-hidden border border-slate-800/80 flex items-center justify-center min-h-[420px] bg-slate-950/40">
                    {/* Grid Pattern Background */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(139,92,246,0.1),rgba(255,255,255,0))] pointer-events-none" />
                    
                    {streamUrl ? (
                      <img
                        src={streamUrl}
                        className="max-h-[580px] w-auto object-contain rounded-lg shadow-2xl z-10 border border-slate-850"
                        alt="Live Device Screen Buffer"
                      />
                    ) : (
                      <div className="text-center p-8 z-10 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-4">
                          <Tv className="w-8 h-8 text-slate-500" />
                        </div>
                        <h3 className="text-base font-semibold text-slate-300">No stream is active</h3>
                        <p className="text-xs text-slate-500 max-w-sm mt-2">
                          Select an active device from the sidebar, or run the simulator to cast mock frames to the admin socket.
                        </p>
                      </div>
                    )}

                    {/* Stats HUD overlay */}
                    {selectedDeviceId && (
                      <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] font-mono text-slate-400 z-20 flex items-center gap-2">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping"></span>
                        <span>ID: {selectedDeviceId}</span>
                        <span className="text-slate-700">|</span>
                        <span>Target: {deviceSettings[selectedDeviceId]?.resolution || '720x1600'} @ {deviceSettings[selectedDeviceId]?.fps || 5} FPS</span>
                        <span className="text-slate-700">|</span>
                        <span>Actual: {fps} FPS</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Device Console Sidebar */}
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4">
                    <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                      <Info className="w-5 h-5 text-violet-400" />
                      Device Console
                    </h2>
                    
                    <div className="glass-card rounded-2xl p-5 border border-slate-850 space-y-4">
                      {!selectedDeviceId ? (
                        <div className="text-slate-500 text-xs py-4 text-center">
                          Select a device to view diagnostics and execute remote keystrokes.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="border-b border-slate-850 pb-3 flex justify-between items-center">
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Device Name</div>
                              <div className="text-sm font-bold text-white mt-0.5 truncate max-w-[150px]">
                                {getEmployeeName(selectedDeviceId) || selectedDeviceId}
                              </div>
                            </div>
                            <button
                              onClick={clearStream}
                              className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-900 border border-slate-800"
                            >
                              Deselect
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">OS VERSION</div>
                              <div className="text-xs font-semibold text-slate-300 mt-0.5 truncate" title={selectedEmployeeInfo?.osVersion || 'Android 14'}>
                                {selectedEmployeeInfo?.osVersion || 'Android 14'}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Device Model</div>
                              <div className="text-xs font-semibold text-slate-300 mt-0.5 truncate" title={selectedEmployeeInfo?.deviceModel || (selectedDeviceId?.startsWith('Device_Sim') ? 'Virtual Simulator' : 'Unknown Model')}>
                                {selectedEmployeeInfo?.deviceModel || (selectedDeviceId?.startsWith('Device_Sim') ? 'Virtual Simulator' : 'Unknown Model')}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Power</div>
                              <div className="text-xs font-semibold text-slate-300 mt-0.5 flex items-center gap-1">
                                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" /> 92%
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Network</div>
                              <div className="text-xs font-semibold text-slate-300 mt-0.5">WiFi • 12ms</div>
                            </div>
                          </div>

                          {/* Capture Settings */}
                          <div className="border-t border-slate-850 pt-4 space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capture Settings</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Resolution</label>
                                <select
                                  value={deviceSettings[selectedDeviceId]?.resolution || '720x1600'}
                                  onChange={(e) => updateDeviceSettings(selectedDeviceId, deviceSettings[selectedDeviceId]?.fps || 5, e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                                >
                                  <option value="1080x2400">1080x2400 (Original)</option>
                                  <option value="720x1600">720x1600 (High)</option>
                                  <option value="480x1066">480x1066 (Medium)</option>
                                  <option value="360x800">360x800 (Low)</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Target FPS</label>
                                <select
                                  value={deviceSettings[selectedDeviceId]?.fps || 5}
                                  onChange={(e) => updateDeviceSettings(selectedDeviceId, parseInt(e.target.value, 10), deviceSettings[selectedDeviceId]?.resolution || '720x1600')}
                                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                                >
                                  <option value={2}>2 FPS</option>
                                  <option value={3}>3 FPS</option>
                                  <option value={5}>5 FPS</option>
                                  <option value={10}>10 FPS</option>
                                  <option value={15}>15 FPS</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Simulation controls */}
                          <div className="border-t border-slate-850 pt-4">
                            <h4 className="text-xs font-bold text-slate-400 mb-2.5 uppercase tracking-wider">Keystroke Injections</h4>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => sendSimulatedCommand('home')}
                                className="bg-slate-900 hover:bg-slate-850 text-xs py-2 px-3 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold transition-all flex items-center justify-center gap-1.5"
                              >
                                <Home className="w-3.5 h-3.5 text-violet-400" /> Home
                              </button>
                              <button
                                onClick={() => sendSimulatedCommand('back')}
                                className="bg-slate-900 hover:bg-slate-850 text-xs py-2 px-3 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold transition-all flex items-center justify-center gap-1.5"
                              >
                                <ArrowLeft className="w-3.5 h-3.5 text-violet-400" /> Back
                              </button>
                              <button
                                onClick={() => sendSimulatedCommand('lock')}
                                className="col-span-2 bg-slate-900 hover:bg-slate-850 text-xs py-2 px-3 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold transition-all flex items-center justify-center gap-1.5"
                              >
                                <Lock className="w-3.5 h-3.5 text-violet-400" /> Power
                              </button>
                              <div className="col-span-2 flex items-center gap-2">
                                <button
                                  onClick={() => sendSimulatedCommand('volume_down')}
                                  className="flex-1 bg-slate-900 hover:bg-slate-850 text-xs py-2 px-3 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold transition-all flex items-center justify-center gap-1.5"
                                >
                                  <Volume1 className="w-3.5 h-3.5 text-violet-400" /> Vol -
                                </button>
                                <button
                                  onClick={() => sendSimulatedCommand('volume_up')}
                                  className="flex-1 bg-slate-900 hover:bg-slate-850 text-xs py-2 px-3 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold transition-all flex items-center justify-center gap-1.5"
                                >
                                  <Volume2 className="w-3.5 h-3.5 text-violet-400" /> Vol +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Device Recordings Panel */}
                  {selectedDeviceId && (
                    <div className="flex flex-col gap-4">
                      <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                        <Folder className="w-5 h-5 text-violet-400" />
                        Files on Device
                      </h2>
                      <div className="glass-card rounded-2xl p-5 border border-slate-850 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Device Storage</span>
                          <button
                            onClick={requestDeviceRecordings}
                            className="p-1 hover:bg-slate-850 rounded text-slate-400 hover:text-white transition-colors border border-slate-800"
                            title="Reload Device file index"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {deviceRecordings.length === 0 ? (
                            <div className="text-xs text-slate-500 text-center py-4">No local recordings found on phone disk.</div>
                          ) : (
                            deviceRecordings.map((dRec, index) => {
                              const isSynced = serverRecordings.some(r => r.filename === dRec.name)
                              return (
                                <div key={index} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between transition-all gap-2">
                                  <div className="flex items-center gap-2.5 truncate max-w-[70%]">
                                    <div className="p-1.5 bg-violet-500/10 rounded-lg text-violet-400 shrink-0">
                                      <Video className="w-4 h-4" />
                                    </div>
                                    <div className="truncate">
                                      <div className="text-xs font-semibold text-slate-200 truncate" title={dRec.name}>{dRec.name}</div>
                                      <div className="text-[10px] text-slate-500 mt-0.5">{dRec.timestamp} • {dRec.size}</div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isSynced ? (
                                      <>
                                        <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Synced</span>
                                        <button
                                          onClick={() => playRealVideo(dRec.name, dRec.name)}
                                          className="p-1.5 bg-violet-600/20 hover:bg-violet-600 text-violet-400 hover:text-white rounded-lg transition-all"
                                          title="Play Synced Recording"
                                        >
                                          <Play className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => deleteDeviceRecording(dRec.path, dRec.name)}
                                          className="p-1.5 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all border border-red-500/20"
                                          title="Delete from Device"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Device</span>
                                        <button
                                          onClick={() => playDeviceRecording(dRec.path, dRec.name, dRec.name)}
                                          className="p-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white rounded-lg transition-all animate-pulse"
                                          title="Play from Device (will auto-upload)"
                                        >
                                          <Play className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => deleteDeviceRecording(dRec.path, dRec.name)}
                                          className="p-1.5 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all border border-red-500/20"
                                          title="Delete from Device"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sessions Table */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-violet-400" />
                    <h2 className="text-lg font-bold tracking-tight">Recent Synchronization Sessions</h2>
                  </div>
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Cloud Storage Registry</span>
                </div>

                <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                          <th className="p-4">Session Name / ID</th>
                          <th className="p-4">Device Node</th>
                          <th className="p-4">Duration</th>
                          <th className="p-4">Synchronized At</th>
                          <th className="p-4">Data Size</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {paginatedSessions.map((session) => {
                          const empName = getEmployeeName(session.deviceId);
                          
                          if (session.status === 'local-cache') {
                            return (
                              <tr key={session.id} className="hover:bg-slate-900/10 transition-colors border-b border-slate-800/40">
                                <td className="p-4 font-semibold text-slate-200">
                                  <div className="flex items-center gap-2">
                                    <Video className="w-4 h-4 text-violet-400" />
                                    <span>{session.id}</span>
                                  </div>
                                </td>
                                <td className="p-4 font-mono text-slate-300">
                                  {empName || session.deviceId}
                                  <span className="text-slate-500 text-[10px] block font-sans">{session.deviceId}</span>
                                </td>
                                <td className="p-4 text-slate-300">{session.duration}</td>
                                <td className="p-4 text-slate-400">{session.timestamp}</td>
                                <td className="p-4 text-slate-400">{session.size}</td>
                                <td className="p-4">
                                  <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">Local-Cache</span>
                                </td>
                                <td className="p-4 text-right">
                                  <button
                                    onClick={() => downloadMockSession(session.id, session.size, session.frameCount || 0)}
                                    className="text-violet-400 hover:text-violet-300 font-semibold text-xs"
                                  >
                                    Download
                                  </button>
                                </td>
                              </tr>
                            );
                          }
                          
                          if (session.status === 'completed') {
                            return (
                              <tr key={session.id} className="hover:bg-slate-900/10 transition-colors border-b border-slate-800/40">
                                <td className="p-4 font-semibold text-slate-200">
                                  <div className="flex items-center gap-2">
                                    <Video className="w-4 h-4 text-violet-400" />
                                    <div>
                                      <span className="font-mono text-slate-300 block">{session.id}</span>
                                      <span className="text-slate-500 text-[10px] block font-sans font-normal">{session.name}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4 font-mono text-slate-300">
                                  {empName || session.deviceId}
                                  <span className="text-slate-500 text-[10px] block font-sans">{session.deviceId}</span>
                                </td>
                                <td className="p-4 text-slate-300">{session.duration}</td>
                                <td className="p-4 text-slate-400">{session.timestamp}</td>
                                <td className="p-4 text-slate-400">{session.size}</td>
                                <td className="p-4">
                                  <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">Completed</span>
                                </td>
                                <td className="p-4 text-right space-x-2.5">
                                  <button
                                    onClick={() => playRealVideo(session.filename || '', session.name)}
                                    className="text-violet-400 hover:text-violet-300 font-bold"
                                  >
                                    Play
                                  </button>
                                  <span className="text-slate-700">|</span>
                                  <a
                                    href={`${getBaseUrl()}/recordings/${session.filename}`}
                                    download={session.filename}
                                    className="text-slate-400 hover:text-slate-300 font-semibold"
                                  >
                                    Download
                                  </a>
                                </td>
                              </tr>
                            );
                          }
                          
                          // pending
                          return (
                            <tr key={session.id} className="hover:bg-slate-900/10 transition-colors border-b border-slate-800/40">
                              <td className="p-4 font-semibold text-slate-200">
                                <div className="flex items-center gap-2">
                                  <Video className="w-4 h-4 text-amber-500/80" />
                                  <div>
                                    <span className="text-amber-500 block">Pending Sync</span>
                                    <span className="text-slate-500 text-[10px] block font-sans font-normal">{session.name}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 font-mono text-slate-300">
                                {empName || session.deviceId}
                                <span className="text-slate-500 text-[10px] block font-sans">{session.deviceId}</span>
                              </td>
                              <td className="p-4 text-slate-300">{session.duration}</td>
                              <td className="p-4 text-slate-500 italic">Not Synced</td>
                              <td className="p-4 text-slate-400">{session.size}</td>
                              <td className="p-4">
                                <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-medium">Pending Sync</span>
                              </td>
                              <td className="p-4 text-right space-x-2.5">
                                <button
                                  onClick={() => playDeviceRecording(session.path || '', session.name, session.name)}
                                  className="text-violet-400 hover:text-violet-300 font-bold"
                                >
                                  Play
                                </button>
                                <span className="text-slate-700">|</span>
                                <button
                                  onClick={() => syncDeviceRecording(session.path || '')}
                                  className="text-amber-400 hover:text-amber-300 font-semibold"
                                >
                                  Sync
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {sortedSessions.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                              No synchronization sessions recorded. Connect a device or launch simulation to start casting.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-800/60 bg-slate-900/20">
                    <div className="text-xs text-slate-400 font-medium">
                      Showing <span className="font-semibold text-slate-200">{sortedSessions.length > 0 ? startIndex + 1 : 0}</span> to{' '}
                      <span className="font-semibold text-slate-200">{endIndex}</span> of{' '}
                      <span className="font-semibold text-slate-200">{sortedSessions.length}</span> sessions
                    </div>
                    
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSessionPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-900 hover:border-slate-700 transition-all"
                          title="Previous Page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        
                        {Array.from({ length: totalPages }).map((_, idx) => {
                          const pageNum = idx + 1;
                          
                          // Render ellipsis for many pages
                          if (totalPages > 6 && pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentPage) > 1) {
                            if (pageNum === 2 && currentPage > 3) {
                              return <span key="dots-prev" className="text-slate-600 px-1 text-xs select-none">...</span>;
                            }
                            if (pageNum === totalPages - 1 && currentPage < totalPages - 2) {
                              return <span key="dots-next" className="text-slate-600 px-1 text-xs select-none">...</span>;
                            }
                            return null;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setSessionPage(pageNum)}
                              className={`px-3 py-1 rounded-md text-xs font-semibold border transition-all ${
                                currentPage === pageNum
                                  ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/10'
                                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-700'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        <button
                          onClick={() => setSessionPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-900 hover:border-slate-700 transition-all"
                          title="Next Page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'employees' ? (
            /* Employees Directory Tab */
            selectedEmployee ? (
              /* Employee Detail Subpage */
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Back button and title */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSelectedEmployee(null);
                        setIsEditingProfile(false);
                      }}
                      className="p-2 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-colors"
                      title="Back to Directory"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20 uppercase">
                          Profile Details
                        </span>
                        {selectedEmployee.deviceId && activeDevices.includes(selectedEmployee.deviceId) ? (
                          <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px] font-semibold flex items-center gap-1">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                            Online
                          </span>
                        ) : (
                          <span className="bg-slate-850 text-slate-400 px-2 py-0.5 rounded border border-slate-800 text-[10px] font-semibold flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Offline
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-white mt-1">
                        {selectedEmployee.firstName} {selectedEmployee.lastName}
                      </h2>
                    </div>
                  </div>

                  {selectedEmployee.deviceId && (
                    <button
                      onClick={() => {
                        unlinkDevice(selectedEmployee.id);
                        setSelectedEmployee(null);
                        setIsEditingProfile(false);
                      }}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-semibold py-2 px-4 rounded-xl transition-all flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
                    >
                      <X className="w-4 h-4" /> Unlink Node
                    </button>
                  )}
                </div>

                {/* Profile and Device Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Contact and hardware details */}
                  <div className="lg:col-span-1 space-y-6">
                    {/* Contact Profile Card */}
                    <div className="glass rounded-2xl p-6 border border-slate-800/80 relative overflow-hidden bg-slate-900/20">
                      <div className="flex items-center justify-between mb-4 border-b border-slate-850 pb-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact Info</h3>
                        {!isEditingProfile && (
                          <button
                            onClick={startEditingProfile}
                            className="text-violet-400 hover:text-violet-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <span className="underline">Edit Profile</span>
                          </button>
                        )}
                      </div>

                      {isEditingProfile ? (
                        /* Edit Mode UI */
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">First Name</label>
                            <input
                              type="text"
                              value={editFirstName}
                              onChange={(e) => setEditFirstName(e.target.value)}
                              className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                              placeholder="First Name"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Last Name</label>
                            <input
                              type="text"
                              value={editLastName}
                              onChange={(e) => setEditLastName(e.target.value)}
                              className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                              placeholder="Last Name"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Email Address</label>
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                              placeholder="Email Address"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Phone Profile</label>
                            <input
                              type="text"
                              value={editPhoneNumber}
                              onChange={(e) => setEditPhoneNumber(formatUSPhoneNumber(e.target.value))}
                              className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                              placeholder="(555) 555-1234"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Password</label>
                            <input
                              type="text"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                              placeholder="Enter new password"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-2">
                            <button
                              onClick={updateEmployeeProfile}
                              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2 px-3 rounded-xl transition-all"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setIsEditingProfile(false)}
                              className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-350 border border-slate-700 text-xs font-semibold py-2 px-3 rounded-xl transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Read Mode UI */
                        <>
                          <div className="flex items-center gap-4 mb-5">
                            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center font-bold text-xl uppercase shadow-lg">
                              {selectedEmployee.firstName[0]}{selectedEmployee.lastName[0]}
                            </div>
                            <div>
                              <div className="text-base font-semibold text-white">
                                {selectedEmployee.firstName} {selectedEmployee.lastName}
                              </div>
                              <div className="text-xs text-slate-500 font-mono mt-0.5">
                                EMP ID: {selectedEmployee.id}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3.5">
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Email Address</div>
                              <div className="text-xs text-slate-200 font-medium mt-0.5">{selectedEmployee.email}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Phone Profile</div>
                              <div className="text-xs text-slate-200 font-medium mt-0.5">
                                {selectedEmployee.phoneNumber || 'No phone profile registered'}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Password</div>
                              <div className="text-xs text-slate-200 font-medium font-mono mt-0.5">
                                {selectedEmployee.password || 'password123'}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Linked Device Specifications */}
                    <div className="glass rounded-2xl p-6 border border-slate-800/80 bg-slate-900/20">
                      <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-violet-400" /> Device Specs
                      </h3>
                      {selectedEmployee.deviceId ? (
                        <div className="space-y-3.5">
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Node Device ID</div>
                            <div className="text-xs font-mono text-slate-200 bg-slate-950 border border-slate-850 px-2 py-1 rounded-md mt-1 w-fit">
                              {selectedEmployee.deviceId}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Model & Brand</div>
                            <div className="text-xs text-slate-200 mt-0.5">{selectedEmployee.deviceModel || 'Unknown Model'}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Operating System</div>
                            <div className="text-xs text-slate-200 mt-0.5">{selectedEmployee.osVersion || 'Unknown OS'}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Last Server Handshake</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {selectedEmployee.lastActive ? new Date(selectedEmployee.lastActive).toLocaleString() : 'Never'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-slate-500 text-xs italic">
                          No mobile hardware integrated with this employee node yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Live Remote Controls (if online) or Status message */}
                  <div className="lg:col-span-2 space-y-6">
                    {selectedEmployee.deviceId && activeDevices.includes(selectedEmployee.deviceId) ? (
                      <div className="glass rounded-2xl p-6 border border-slate-800/80 bg-slate-900/20 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                          <div>
                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Live Control Node</h3>
                            <p className="text-[10px] text-slate-500 mt-0.5">Active WebSocket connection is open. Control the screen recordings and ADB inputs.</p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedDeviceId(selectedEmployee.deviceId!);
                              setActiveTab('monitor');
                            }}
                            className="bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-500/20 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all flex items-center gap-1"
                          >
                            <Monitor className="w-3.5 h-3.5" /> Monitor
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Stream recording trigger & Capture settings */}
                          <div className="space-y-4">
                            <div className="space-y-3">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Session Manager</h4>
                              <button
                                onClick={toggleRecord}
                                className={`w-full py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 shadow-lg ${
                                  isRecording
                                    ? 'bg-red-950/60 border-red-800 text-red-400 hover:bg-red-900/20'
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                                }`}
                              >
                                <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                                {isRecording ? 'Clock Out (Stop Screen Recording)' : 'Clock In (Start Screen Recording)'}
                              </button>
                              <p className="text-[10px] text-slate-500 text-center">
                                Triggers native media projection on the mobile device.
                              </p>
                            </div>

                            <div className="space-y-3 border-t border-slate-850 pt-4">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capture Settings</h4>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Resolution</label>
                                  <select
                                    value={deviceSettings[selectedEmployee.deviceId || '']?.resolution || '720x1600'}
                                    onChange={(e) => selectedEmployee.deviceId && updateDeviceSettings(selectedEmployee.deviceId, deviceSettings[selectedEmployee.deviceId]?.fps || 5, e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                                  >
                                    <option value="1080x2400">1080x2400 (Original)</option>
                                    <option value="720x1600">720x1600 (High)</option>
                                    <option value="480x1066">480x1066 (Medium)</option>
                                    <option value="360x800">360x800 (Low)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">Target FPS</label>
                                  <select
                                    value={deviceSettings[selectedEmployee.deviceId || '']?.fps || 5}
                                    onChange={(e) => selectedEmployee.deviceId && updateDeviceSettings(selectedEmployee.deviceId, parseInt(e.target.value, 10), deviceSettings[selectedEmployee.deviceId]?.resolution || '720x1600')}
                                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                                  >
                                    <option value={2}>2 FPS</option>
                                    <option value={3}>3 FPS</option>
                                    <option value={5}>5 FPS</option>
                                    <option value={10}>10 FPS</option>
                                    <option value={15}>15 FPS</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Diagnostics and simulation controls */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">ADB Keystroke Simulation</h4>
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                onClick={() => sendSimulatedCommand('home')}
                                className="bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1"
                              >
                                <Home className="w-3.5 h-3.5 text-violet-400" /> Home
                              </button>
                              <button
                                onClick={() => sendSimulatedCommand('back')}
                                className="bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1"
                              >
                                <ArrowLeft className="w-3.5 h-3.5 text-violet-400" /> Back
                              </button>
                              <button
                                onClick={() => sendSimulatedCommand('lock')}
                                className="bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1"
                              >
                                <Lock className="w-3.5 h-3.5 text-violet-400" /> Power
                              </button>
                            </div>

                            {/* Vol controls grouped into one line */}
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => sendSimulatedCommand('volume_down')}
                                className="flex-1 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                              >
                                <Volume1 className="w-3.5 h-3.5 text-violet-400" /> Vol -
                              </button>
                              <button
                                onClick={() => sendSimulatedCommand('volume_up')}
                                className="flex-1 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                              >
                                <Volume2 className="w-3.5 h-3.5 text-violet-400" /> Vol +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="glass rounded-2xl p-6 border border-slate-800/80 bg-slate-900/20 flex flex-col items-center justify-center text-center py-10">
                        <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
                          <Smartphone className="w-6 h-6 text-slate-500" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-300">Device offline or unlinked</h4>
                        <p className="text-xs text-slate-500 max-w-sm mt-1">
                          Connect a device via USB/ADB and open the TRN Monitor app to start casting and unlock simulation controls.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Synced Cloud Recordings History Table */}
                <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
                  <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <History className="w-4 h-4 text-violet-400" /> Synced Cloud Sessions
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Recorded screen capture sessions uploaded and stored on the administrative backend.</p>
                    </div>
                    <span className="bg-slate-900 text-slate-400 border border-slate-850 px-2 py-0.5 rounded text-[10px] font-mono">
                      {selectedEmployee.deviceId ? serverRecordings.filter(r => r.deviceId === selectedEmployee.deviceId).length : 0} Session(s)
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                          <th className="p-4">Session Name</th>
                          <th className="p-4">Duration</th>
                          <th className="p-4">Captured Timestamp</th>
                          <th className="p-4">File Size</th>
                          <th className="p-4">Cloud Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {!selectedEmployee.deviceId || serverRecordings.filter(r => r.deviceId === selectedEmployee.deviceId).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                              No synced cloud sessions available for this employee node.
                            </td>
                          </tr>
                        ) : (
                          serverRecordings.filter(r => r.deviceId === selectedEmployee.deviceId).map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-900/10 transition-colors border-b border-slate-800/40">
                              <td className="p-4 font-semibold text-slate-200">
                                <div className="flex items-center gap-2">
                                  <Video className="w-4 h-4 text-violet-400" />
                                  <div>
                                    <span className="font-mono text-slate-300 block">{rec.id}</span>
                                    <span className="text-slate-500 text-[10px] block font-sans font-normal">{rec.name}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-slate-300">{rec.duration}</td>
                              <td className="p-4 text-slate-400">{rec.timestamp}</td>
                              <td className="p-4 text-slate-400">{rec.size}</td>
                              <td className="p-4">
                                <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                                  Synced
                                </span>
                              </td>
                              <td className="p-4 text-right space-x-2.5">
                                <button
                                  onClick={() => playRealVideo(rec.filename, rec.name)}
                                  className="text-violet-400 hover:text-violet-300 font-bold"
                                >
                                  Play
                                </button>
                                <span className="text-slate-700">|</span>
                                <a
                                  href={`${getBaseUrl()}/recordings/${rec.filename}`}
                                  download={rec.filename}
                                  className="text-slate-400 hover:text-slate-300 font-semibold"
                                >
                                  Download
                                </a>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* On-Device Local Recordings Table (Only if online) */}
                {selectedEmployee.deviceId && activeDevices.includes(selectedEmployee.deviceId) && (
                  <div className="glass-card rounded-2xl overflow-hidden border border-slate-800 animate-in fade-in duration-200">
                    <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Folder className="w-4 h-4 text-amber-400" /> On-Device Local Recordings
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Files currently stored on mobile device storage that have not yet been synced to the cloud.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={requestDeviceRecordings}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-800 flex items-center gap-1.5 text-[10px] font-semibold"
                          title="Refresh local files"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Refresh List
                        </button>
                        <span className="bg-slate-900 text-slate-400 border border-slate-850 px-2 py-0.5 rounded text-[10px] font-mono">
                          {deviceRecordings.filter(dRec => !serverRecordings.some(sr => sr.filename === dRec.name)).length} File(s)
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                            <th className="p-4">File Name</th>
                            <th className="p-4">Timestamp</th>
                            <th className="p-4">File Size</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {deviceRecordings.filter(dRec => !serverRecordings.some(sr => sr.filename === dRec.name)).length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                                No unsynced local files found on the device. All files are synchronized.
                              </td>
                            </tr>
                          ) : (
                            deviceRecordings.filter(dRec => !serverRecordings.some(sr => sr.filename === dRec.name)).map((dRec, i) => (
                              <tr key={`detail-unsynced-${i}`} className="hover:bg-slate-900/10 transition-colors border-b border-slate-800/40">
                                <td className="p-4 font-semibold text-slate-200">
                                  <div className="flex items-center gap-2">
                                    <Video className="w-4 h-4 text-amber-500/80" />
                                    <span>{dRec.name}</span>
                                  </div>
                                </td>
                                <td className="p-4 text-slate-400">{dRec.timestamp}</td>
                                <td className="p-4 text-slate-400">{dRec.size}</td>
                                <td className="p-4">
                                  <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-medium">
                                    On Device
                                  </span>
                                </td>
                                <td className="p-4 text-right space-x-2.5">
                                  <button
                                    onClick={() => playDeviceRecording(dRec.path, dRec.name, dRec.name)}
                                    className="text-violet-400 hover:text-violet-300 font-bold"
                                  >
                                    Play
                                  </button>
                                  <span className="text-slate-700">|</span>
                                  <button
                                    onClick={() => syncDeviceRecording(dRec.path)}
                                    className="text-amber-400 hover:text-amber-300 font-semibold"
                                  >
                                    Sync
                                  </button>
                                  <span className="text-slate-700">|</span>
                                  <button
                                    onClick={() => deleteDeviceRecording(dRec.path, dRec.name)}
                                    className="text-red-400 hover:text-red-300 font-semibold"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Employees Directory Directory Table List */
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                      <Users className="w-6 h-6 text-violet-400" /> Employees Directory
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Register new administrative nodes and manage mobile hardware integrations.</p>
                  </div>
                  <button
                    onClick={() => setIsEmployeeModalOpen(true)}
                    className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all flex items-center gap-2 self-stretch sm:self-auto justify-center"
                  >
                    <UserPlus className="w-4 h-4" /> Register Employee
                  </button>
                </div>

                <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                          <th className="p-4">Employee</th>
                          <th className="p-4">Contact Info</th>
                          <th className="p-4">Linked Device</th>
                          <th className="p-4">Model & OS</th>
                          <th className="p-4">Last Sync Handshake</th>
                          <th className="p-4">Recorded Sessions</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {employees.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                              No employees registered. Register your first staff member to start.
                            </td>
                          </tr>
                        ) : (
                          employees.map((emp) => {
                            const isOnline = emp.deviceId && activeDevices.includes(emp.deviceId)
                            return (
                              <tr key={emp.id} className="hover:bg-slate-900/20 transition-colors border-b border-slate-800/40">
                                <td
                                  className="p-4 font-semibold text-slate-200 cursor-pointer group"
                                  onClick={() => {
                                    setSelectedEmployee(emp);
                                    if (emp.deviceId) {
                                      handleSelectDevice(emp.deviceId);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-400 group-hover:bg-violet-600 group-hover:text-white flex items-center justify-center font-bold text-sm uppercase border border-violet-500/20 transition-all">
                                      {emp.firstName[0]}{emp.lastName[0]}
                                    </div>
                                    <div>
                                      <div className="text-sm font-semibold group-hover:text-violet-400 transition-colors">{emp.firstName} {emp.lastName}</div>
                                      <div className="text-[10px] text-slate-500 mt-0.5">EMP ID: {emp.id}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="text-slate-300 font-medium">{emp.email}</div>
                                  <div className="text-slate-500 text-[10px] mt-0.5">{emp.phoneNumber || 'No phone profile'}</div>
                                </td>
                                <td className="p-4 font-mono">
                                  {emp.deviceId ? (
                                    <span className="text-slate-300 bg-slate-900 border border-slate-850 px-2.5 py-1 rounded-md text-[10px]">
                                      {emp.deviceId}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 italic">No Device Linked</span>
                                  )}
                                </td>
                                <td className="p-4">
                                  {emp.deviceId ? (
                                    <>
                                      <div className="font-semibold text-slate-300">{emp.deviceModel}</div>
                                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{emp.osVersion}</div>
                                    </>
                                  ) : (
                                    <span className="text-slate-500 italic">-</span>
                                  )}
                                </td>
                                <td className="p-4 text-slate-400">
                                  {emp.lastActive ? new Date(emp.lastActive).toLocaleString() : <span className="text-slate-500 italic">Never</span>}
                                </td>
                                <td className="p-4">
                                  {emp.deviceId ? (
                                    (() => {
                                      const empRecs = serverRecordings.filter(r => r.deviceId === emp.deviceId)
                                      if (empRecs.length === 0) {
                                        return <span className="text-slate-500 italic">No recordings</span>
                                      }
                                      return (
                                        <div className="space-y-1.5 max-w-[220px]">
                                          {empRecs.slice(0, 3).map(rec => (
                                            <div key={rec.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-violet-500/30 transition-all">
                                              <div className="truncate pr-1">
                                                <div className="text-[10px] font-semibold text-slate-300 truncate" title={rec.name}>{rec.name}</div>
                                                <div className="text-[9px] text-slate-500 mt-0.5">{rec.duration} • {rec.timestamp}</div>
                                              </div>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  playRealVideo(rec.filename, rec.name);
                                                }}
                                                className="p-1 bg-violet-600/20 hover:bg-violet-600 text-violet-400 hover:text-white rounded transition-all shrink-0"
                                                title="Play Session"
                                              >
                                                <Play className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          ))}
                                          {empRecs.length > 3 && (
                                            <div className="text-[10px] text-violet-400 font-semibold pl-1">
                                              + {empRecs.length - 3} more session(s)
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })()
                                  ) : (
                                    <span className="text-slate-500 italic">-</span>
                                  )}
                                </td>
                                <td className="p-4">
                                  {isOnline ? (
                                    <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold flex items-center gap-1.5 w-fit">
                                      <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                      </span>
                                      Online
                                    </span>
                                  ) : (
                                    <span className="bg-slate-850 text-slate-400 px-2.5 py-1 rounded-full border border-slate-800 font-semibold flex items-center gap-1.5 w-fit">
                                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500" />
                                      Offline
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex items-center justify-end gap-2.5">
                                    <button
                                      onClick={() => {
                                        setSelectedEmployee(emp);
                                        if (emp.deviceId) {
                                          handleSelectDevice(emp.deviceId);
                                        }
                                      }}
                                      className="text-violet-400 hover:text-violet-300 font-semibold text-xs transition-colors"
                                    >
                                      Details
                                    </button>
                                    {emp.deviceId && (
                                      <>
                                        <span className="text-slate-700">|</span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            unlinkDevice(emp.id);
                                          }}
                                          className="text-red-400 hover:text-red-300 font-semibold text-xs transition-colors flex items-center justify-end gap-1"
                                        >
                                          Unlink
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                </div>
              </div>
            </div>
          )
        ) : (
            /* Timekeeping Tab Content */
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                    <History className="w-6 h-6 text-violet-400" /> Time Tracking & Logs
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Review clock sessions, track durations, and manage staff time logs.</p>
                </div>
                <button
                  onClick={() => {
                    setEditingSession(null);
                    setFormEmployeeId(employees[0]?.id || '');
                    setFormClockIn(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                    setFormClockOut('');
                    setFormNotes('');
                    setIsClockSessionModalOpen(true);
                  }}
                  className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all flex items-center gap-2 self-stretch sm:self-auto justify-center"
                >
                  <Plus className="w-4 h-4" /> Add Manual Session
                </button>
              </div>

              {/* Filters */}
              <div className="glass-card p-4 rounded-2xl border border-slate-800 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filters</span>
                  <div className="flex flex-wrap gap-2">
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        setFilterEmp(val === 'all' ? null : val);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                    >
                      <option value="all">All Employees</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                      ))}
                    </select>
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        setFilterStatus(val === 'all' ? null : val);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Active">Active Shifts</option>
                      <option value="Completed">Completed Shifts</option>
                    </select>
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-mono">{filteredSessions.length} record(s) found</span>
              </div>

              {/* Logs Table */}
              <div className="glass-card rounded-2xl overflow-hidden border border-slate-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                        <th className="p-4">Employee</th>
                        <th className="p-4">Device ID</th>
                        <th className="p-4">Clock In</th>
                        <th className="p-4">Clock Out</th>
                        <th className="p-4">Duration</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Notes</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {filteredSessions.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                            No clock sessions recorded.
                          </td>
                        </tr>
                      ) : (
                        filteredSessions.map((session) => {
                          const emp = employees.find(e => e.id === session.employeeId);
                          const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown Employee';
                          return (
                            <tr key={session.id} className="hover:bg-slate-900/20 transition-colors border-b border-slate-800/40">
                              <td className="p-4 font-semibold text-slate-200">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center font-bold text-sm uppercase border border-violet-500/20">
                                    {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : '??'}
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold">{empName}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">Emp ID: {session.employeeId}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 font-mono text-slate-350">
                                {session.deviceId === 'Manual' ? (
                                  <span className="text-[10px] bg-slate-900 border border-slate-850 px-2 py-0.5 rounded text-slate-500">Manual Entry</span>
                                ) : (
                                  <span className="text-[10px] bg-slate-900 border border-slate-850 px-2 py-0.5 rounded text-slate-350">{session.deviceId}</span>
                                )}
                              </td>
                              <td className="p-4 text-slate-300 font-medium">
                                {new Date(session.clockInTime).toLocaleString()}
                              </td>
                              <td className="p-4 text-slate-300 font-medium">
                                {session.clockOutTime ? new Date(session.clockOutTime).toLocaleString() : <span className="text-slate-500 italic">-</span>}
                              </td>
                              <td className="p-4 font-mono font-bold text-slate-200">
                                {session.status === 'Active' ? (
                                  <span className="text-violet-400 animate-pulse">Casting Live</span>
                                ) : (
                                  session.duration
                                )}
                              </td>
                              <td className="p-4">
                                {session.status === 'Active' ? (
                                  <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold flex items-center gap-1.5 w-fit">
                                    <span className="relative flex h-1.5 w-1.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                    </span>
                                    Active Shift
                                  </span>
                                ) : (
                                  <span className="bg-slate-850 text-slate-400 px-2.5 py-1 rounded-full border border-slate-800 font-semibold flex items-center gap-1.5 w-fit">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500" />
                                    Completed
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-slate-400 max-w-xs truncate" title={session.notes}>
                                {session.notes || <span className="text-slate-650 italic">No notes</span>}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingSession(session);
                                      setFormEmployeeId(session.employeeId);
                                      setFormClockIn(new Date(new Date(session.clockInTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                                      setFormClockOut(session.clockOutTime ? new Date(new Date(session.clockOutTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
                                      setFormNotes(session.notes || '');
                                      setIsClockSessionModalOpen(true);
                                    }}
                                    className="text-violet-400 hover:text-violet-300 font-semibold text-xs transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <span className="text-slate-700">|</span>
                                  <button
                                    onClick={() => deleteClockSession(session.id)}
                                    className="text-red-400 hover:text-red-300 font-semibold text-xs transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        }
      </main>
      </div>

      {/* Add/Edit Clock Session Modal */}
      {isClockSessionModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-md w-full rounded-2xl p-6 border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-150 animate-out duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-violet-400" />
                <span>{editingSession ? 'Edit Clock Session' : 'Add Manual Clock Session'}</span>
              </h3>
              <button
                onClick={() => {
                  setIsClockSessionModalOpen(false);
                  setEditingSession(null);
                }}
                className="p-2 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitClockSession} className="space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Employee *</label>
                <select
                  disabled={!!editingSession}
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                  required
                >
                  <option value="" disabled>Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Clock In Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={formClockIn}
                  onChange={(e) => setFormClockIn(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Clock Out Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={formClockOut}
                  onChange={(e) => setFormClockOut(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  placeholder="Leave empty for Active session"
                />
                <span className="text-[9px] text-slate-500 mt-1 block">Leaving Clock Out empty sets status to 'Active Shift'.</span>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 h-20 resize-none"
                  placeholder="Describe details, e.g. manual override reason..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all"
                >
                  {editingSession ? 'Save Changes' : 'Create Session'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsClockSessionModalOpen(false);
                    setEditingSession(null);
                  }}
                  className="bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-semibold py-2.5 px-4 rounded-xl border border-slate-800 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Employee Modal */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-md w-full rounded-2xl p-6 border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-violet-400" />
                Register New Employee
              </h3>
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="p-2 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitAddEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={empFirstName}
                    onChange={(e) => setEmpFirstName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={empLastName}
                    onChange={(e) => setEmpLastName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={empPhone}
                  onChange={(e) => setEmpPhone(formatUSPhoneNumber(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  placeholder="(555) 555-1234"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Password *</label>
                <input
                  type="text"
                  required
                  value={empPassword}
                  onChange={(e) => setEmpPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                  placeholder="Enter login password"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all"
                >
                  Register Employee
                </button>
                <button
                  type="button"
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-semibold py-2.5 px-4 rounded-xl border border-slate-800 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {videoModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-3xl w-full rounded-2xl p-6 border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-violet-400" />
                <span>{videoModal.title}</span>
              </h3>
              <button
                onClick={() => setVideoModal(prev => ({ ...prev, isOpen: false }))}
                className="p-2 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {videoModal.isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 text-violet-500 animate-spin" />
                <p className="text-sm text-slate-300 font-semibold">Streaming video payload from device...</p>
                <p className="text-xs text-slate-500 text-center max-w-xs">
                  The recording file bytes are being synchronized via ADB remote tunnel.
                </p>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-slate-850 bg-slate-950">
                <video
                  src={`${getBaseUrl()}/recordings/${videoModal.filename}`}
                  className="w-full max-h-[500px] object-contain"
                  controls
                  autoPlay
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Simulator Modal */}
      {isSimulationModalOpen && (
        <div
          style={{
            position: 'fixed',
            left: `${simPosition.x}px`,
            top: `${simPosition.y}px`,
            width: '768px',
            zIndex: 100
          }}
          className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-150 cursor-default"
        >
          <div 
            onMouseDown={handleSimHeaderMouseDown}
            className={`flex items-center justify-between mb-3 pb-2 border-b border-slate-800/60 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            title="Drag here to move simulator window"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-violet-400" />
              Virtual Device Simulator Dashboard
            </h3>
            <button
              onClick={() => setIsSimulationModalOpen(false)}
              className="p-2 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
            <p className="text-xs text-slate-400 mb-5">
              Connect a simulated Android instance to debug local socket frame streams, diagnostic keys, and sync files.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Device Config & Canvas */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Simulated Device ID</label>
                  <input
                    type="text"
                    disabled={isSimConnected}
                    value={simDeviceId}
                    onChange={(e) => setSimDeviceId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Target Frame Rate (FPS)</label>
                  <select
                    disabled={isSimConnected}
                    value={simFps}
                    onChange={(e) => setSimFps(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                  >
                    <option value={5}>5 FPS (Low Network Load)</option>
                    <option value={15}>15 FPS (Standard Video Relay)</option>
                    <option value={30}>30 FPS (High Fidelity Broadcaster)</option>
                  </select>
                </div>

                <div className="border border-slate-800 rounded-xl p-2.5 bg-slate-950/60 flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Casting Frame Buffer Output</span>
                  <canvas
                    ref={simCanvasRef}
                    width="320"
                    height="480"
                    className="w-44 h-64 border border-slate-850 bg-slate-900 rounded-lg object-cover"
                  />
                </div>
              </div>

              {/* Right Column - Status, Controls & Storage */}
              <div className="space-y-4 flex flex-col h-full">
                {/* Status Dashboard */}
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 space-y-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Simulator Status Dashboard</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex flex-col">
                      <span className="text-[10px] text-slate-500">Connection</span>
                      <span className={`font-semibold mt-1 flex items-center gap-1.5 ${isSimConnected ? 'text-emerald-400' : 'text-slate-500'}`}>
                        <span className={`w-2 h-2 rounded-full ${isSimConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {isSimConnected ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex flex-col">
                      <span className="text-[10px] text-slate-500">Clock Status</span>
                      <span className={`font-semibold mt-1 flex items-center gap-1.5 ${simIsClockedIn ? 'text-violet-400' : 'text-amber-500'}`}>
                        <span className={`w-2 h-2 rounded-full ${simIsClockedIn ? 'bg-violet-400' : 'bg-amber-500'}`} />
                        {simIsClockedIn ? 'CLOCKED IN' : 'STANDBY'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Simulation Control Buttons */}
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 space-y-2.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Hardware Simulation Triggers</span>
                  <div className="flex gap-2">
                    <button
                      onClick={simIsClockedIn ? handleSimClockOut : handleSimClockIn}
                      disabled={!isSimConnected}
                      className={`flex-1 text-xs font-semibold py-2 px-3 rounded-lg border transition-all disabled:opacity-50 ${
                        simIsClockedIn
                          ? 'bg-amber-600/10 text-amber-400 border-amber-500/20 hover:bg-amber-600/20'
                          : 'bg-violet-600/10 text-violet-400 border-violet-500/20 hover:bg-violet-600/20'
                      }`}
                    >
                      {simIsClockedIn ? 'Simulate Clock Out' : 'Simulate Clock In'}
                    </button>
                    <button
                      onClick={generateManualMockFile}
                      className="flex-1 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 text-xs font-semibold py-2 px-3 rounded-lg transition-all"
                    >
                      Generate Mock File
                    </button>
                  </div>
                </div>

                {/* Simulated Local Storage */}
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex-1 flex flex-col min-h-[140px] max-h-[170px]">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 block">Simulated Local Storage ({simRecordings.length} files)</span>
                  <div className="overflow-y-auto flex-1 space-y-1.5 pr-1 custom-scrollbar text-[11px]">
                    {simRecordings.length === 0 ? (
                      <span className="text-slate-500 italic block text-center py-4">No local files on device.</span>
                    ) : (
                      simRecordings.map((file, idx) => (
                        <div key={idx} className="bg-slate-900/40 border border-slate-850/80 p-1.5 rounded-lg flex items-center justify-between gap-2">
                          <div className="truncate flex-1 min-w-0">
                            <span className="text-slate-300 font-mono block truncate">{file.name}</span>
                            <span className="text-slate-500 text-[10px] block">{file.size} | Duration: {file.duration || '00:00:00'}</span>
                          </div>
                          <button
                            onClick={() => simulateUpload(file.path, file.duration)}
                            disabled={!isSimConnected}
                            className="bg-violet-600/25 hover:bg-violet-600/40 text-violet-300 border border-violet-500/20 py-0.5 px-2 rounded font-semibold text-[10px] transition-all disabled:opacity-30"
                          >
                            Sync
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Terminal Event Log */}
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 h-28 flex flex-col">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 block">Simulator Event Terminal Logs</span>
                  <div className="bg-slate-900 border border-slate-850 rounded-lg p-1.5 font-mono text-[10px] text-emerald-400 overflow-y-auto flex-1 h-full select-text selection:bg-emerald-950">
                    {simLogs.length === 0 ? (
                      <span className="text-slate-600 italic">// Waiting for simulator connection events...</span>
                    ) : (
                      simLogs.map((log, idx) => (
                        <div key={idx} className="leading-relaxed border-b border-slate-950/20 py-0.5 whitespace-pre-wrap">{log}</div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={toggleSimulation}
                className={`text-xs font-semibold py-2.5 px-5 rounded-xl shadow-lg transition-all ${
                  isSimConnected
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/10'
                    : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/10 hover:shadow-violet-500/20'
                }`}
              >
                {isSimConnected ? 'Disconnect Simulator' : 'Connect & Cast Stream'}
              </button>
              <button
                onClick={() => setIsSimulationModalOpen(false)}
                className="bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-semibold py-2.5 px-5 rounded-xl border border-slate-800 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
    </div>
  )
}

export default App
