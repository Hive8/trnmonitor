import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Employee, Recording, DeviceRecording, ServerIp, ClockSession, ToastMessage, SystemLog } from '../types/device';
import { useAuthStore } from '../stores/auth-store';

interface DeviceStreamContextProps {
  wsStatus: 'Connecting' | 'Online' | 'Disconnected';
  activeDevices: string[];
  selectedDeviceId: string | null;
  serverRecordings: Recording[];
  deviceRecordings: DeviceRecording[];
  employees: Employee[];
  serverIps: ServerIp[];
  deviceSettings: { [deviceId: string]: { fps: number; resolution: string } };
  clockSessions: ClockSession[];
  localRecordedSessions: Array<{ id: string; deviceId: string; duration: string; timestamp: string; size: string; frameCount: number }>;
  isRecording: boolean;
  fps: number;
  streamUrl: string | null;
  videoModal: { isOpen: boolean; title: string; filename: string; isLoading: boolean };
  toasts: ToastMessage[];
  deviceBatteries: { [deviceId: string]: number };
  deviceLocations: { [deviceId: string]: { latitude: number; longitude: number; timestamp: string } };
  systemLogs: SystemLog[];
  unreadChatCount: number;
  unreadBySender: { [senderId: string]: number };
  
  handleSelectDevice: (deviceId: string) => void;
  toggleRecord: () => void;
  clearStream: () => void;
  showToast: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  fetchClockSessions: () => void;
  fetchEmployees: () => void;
  fetchRecordings: () => Promise<void>;
  setVideoModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; title: string; filename: string; isLoading: boolean }>>;
  sendCommandToDevice: (action: string, extraPayload?: any) => boolean;
  takeScreenshot: () => void;
  playDeviceRecording: (path: string, name: string) => void;
  fetchUnreadCounts: () => Promise<void>;
  markChatAsRead: (senderId: string) => void;
  updateDeviceSettings: (deviceId: string, targetFps: number, targetResolution: string) => Promise<void>;
}

const DeviceStreamContext = createContext<DeviceStreamContextProps | undefined>(undefined);

export const DeviceStreamProvider = ({ children }: { children: ReactNode }) => {
  const [wsStatus, setWsStatus] = useState<'Connecting' | 'Online' | 'Disconnected'>('Connecting');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [activeDevices, setActiveDevices] = useState<string[]>([]);
  const [serverRecordings, setServerRecordings] = useState<Recording[]>([]);
  const [deviceRecordings, setDeviceRecordings] = useState<DeviceRecording[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [serverIps, setServerIps] = useState<ServerIp[]>([]);
  const [deviceSettings, setDeviceSettings] = useState<{ [deviceId: string]: { fps: number; resolution: string } }>({});
  const [clockSessions, setClockSessions] = useState<ClockSession[]>([]);
  const [localRecordedSessions, setLocalRecordedSessions] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [fps, setFps] = useState(0);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [videoModal, setVideoModal] = useState({ isOpen: false, title: '', filename: '', isLoading: false });
  const [deviceBatteries, setDeviceBatteries] = useState<{ [deviceId: string]: number }>({});
  const [deviceLocations, setDeviceLocations] = useState<{ [deviceId: string]: { latitude: number; longitude: number; timestamp: string } }>({});
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [unreadBySender, setUnreadBySender] = useState<{ [senderId: string]: number }>({});

  const socketRef = useRef<WebSocket | null>(null);
  const frameCountRef = useRef(0);
  const currentObjectURLRef = useRef<string | null>(null);
  const latestFrameBlobRef = useRef<Blob | null>(null);
  const currentExtensionRef = useRef<string>('jpg');
  const lastScreenshotObjectURLRef = useRef<string | null>(null);
  const localRecordedFramesRef = useRef<Blob[]>([]);
  const localRecordingStartTimeRef = useRef<number | null>(null);
  const pendingPlayFilenamesRef = useRef<Set<string>>(new Set());

  const getBaseUrl = () => window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
  const getWsUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host;
    return `${protocol}//${host}`;
  };

  const getHeaders = () => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const { accessToken } = useAuthStore.getState().auth;
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
  };

  const showToast = (message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const fetchDevices = async () => {
    try {
      const { accessToken } = useAuthStore.getState().auth;
      if (!accessToken) return;
      const response = await fetch(`${getBaseUrl()}/api/devices`, { headers: getHeaders() });
      if (response.status === 401) {
        useAuthStore.getState().auth.reset();
        return;
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setActiveDevices(data);
      }
    } catch (err) { console.error(err); }
  };

  const fetchRecordings = async () => {
    try {
      const { accessToken } = useAuthStore.getState().auth;
      if (!accessToken) return;
      const response = await fetch(`${getBaseUrl()}/api/recordings`, { headers: getHeaders() });
      if (response.status === 401) {
        useAuthStore.getState().auth.reset();
        return;
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setServerRecordings(data);
      }
    } catch (err) { console.error(err); }
  };

  const fetchServerIps = async () => {
    try {
      const { accessToken } = useAuthStore.getState().auth;
      if (!accessToken) return;
      const response = await fetch(`${getBaseUrl()}/api/server-ips`, { headers: getHeaders() });
      if (response.status === 401) {
        useAuthStore.getState().auth.reset();
        return;
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setServerIps(data);
      }
    } catch (err) { console.error(err); }
  };

  const fetchEmployees = async () => {
    try {
      const { accessToken } = useAuthStore.getState().auth;
      if (!accessToken) return;
      const response = await fetch(`${getBaseUrl()}/api/employees`, { headers: getHeaders() });
      if (response.status === 401) {
        useAuthStore.getState().auth.reset();
        return;
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setEmployees(data);
      }
    } catch (err) { console.error(err); }
  };

  const fetchDeviceSettings = async () => {
    try {
      const { accessToken } = useAuthStore.getState().auth;
      if (!accessToken) return;
      const response = await fetch(`${getBaseUrl()}/api/devices/settings`, { headers: getHeaders() });
      if (response.status === 401) {
        useAuthStore.getState().auth.reset();
        return;
      }
      const data = await response.json();
      if (data && typeof data === 'object') {
        setDeviceSettings(data);
      }
    } catch (err) { console.error(err); }
  };

  const updateDeviceSettings = async (deviceId: string, targetFps: number, targetResolution: string) => {
    try {
      const { accessToken } = useAuthStore.getState().auth;
      if (!accessToken) return;
      const response = await fetch(`${getBaseUrl()}/api/devices/settings`, {
        method: 'POST',
        headers: getHeaders(),
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
          [deviceId]: data.settings || { fps: targetFps, resolution: targetResolution }
        }));
      } else {
        showToast(data.error || 'Failed to update settings', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating device settings', 'error');
    }
  };

  const fetchClockSessions = async () => {
    try {
      const { accessToken } = useAuthStore.getState().auth;
      if (!accessToken) return;
      const response = await fetch(`${getBaseUrl()}/api/clock-sessions`, { headers: getHeaders() });
      if (response.status === 401) {
        useAuthStore.getState().auth.reset();
        return;
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setClockSessions(data);
      }
    } catch (err) { console.error(err); }
  };

  const fetchUnreadCounts = async () => {
    try {
      const { accessToken, user } = useAuthStore.getState().auth;
      if (!accessToken || !user) return;
      const baseUrl = getBaseUrl();
      const headers = getHeaders();
      
      const [countRes, senderRes] = await Promise.all([
        fetch(`${baseUrl}/api/messages/unread-count`, { headers }),
        fetch(`${baseUrl}/api/messages/unread-by-sender`, { headers })
      ]);
      
      if (countRes.ok && senderRes.ok) {
        const countData = await countRes.json();
        const senderData = await senderRes.json();
        setUnreadChatCount(countData.count || 0);
        setUnreadBySender(senderData.counts || {});
      }
    } catch (err) {
      console.error('Error fetching unread counts:', err);
    }
  };

  const markChatAsRead = (senderId: string) => {
    setUnreadBySender(prev => {
      const countForSender = prev[senderId] || 0;
      if (countForSender === 0) return prev;
      
      // Update total unread count
      setUnreadChatCount(total => Math.max(0, total - countForSender));
      
      return {
        ...prev,
        [senderId]: 0
      };
    });
  };

  const sendCommandToDevice = (action: string, extraPayload: any = {}) => {
    if (!selectedDeviceId) return false;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'command',
        deviceId: selectedDeviceId,
        payload: { action, ...extraPayload, timestamp: Date.now() }
      }));
      return true;
    }
    showToast('Admin WebSocket not connected', 'error');
    return false;
  };

  const toggleRecord = () => {
    if (!selectedDeviceId) return;
    const action = isRecording ? 'clock_out' : 'clock_in';
    if (sendCommandToDevice(action)) {
      showToast(isRecording ? 'Sending Clock Out command...' : 'Sending Clock In command...', 'info');
    }
  };

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
  };

  const handleSelectDevice = (deviceId: string) => {
    if (selectedDeviceId === deviceId) return;
    if (currentObjectURLRef.current) {
      URL.revokeObjectURL(currentObjectURLRef.current);
      currentObjectURLRef.current = null;
    }
    setStreamUrl(null);
    setSelectedDeviceId(deviceId);
    setDeviceRecordings([]);
    setFps(0);
    frameCountRef.current = 0;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'command', deviceId, payload: { action: 'get_status', timestamp: Date.now() } }));
      socketRef.current.send(JSON.stringify({ type: 'command', deviceId, payload: { action: 'get_recordings', timestamp: Date.now() } }));
    }
  };

  const takeScreenshot = () => {
    if (!latestFrameBlobRef.current) {
      showToast('No frame available to capture', 'error');
      return;
    }
    if (lastScreenshotObjectURLRef.current) URL.revokeObjectURL(lastScreenshotObjectURLRef.current);
    const objectUrl = URL.createObjectURL(latestFrameBlobRef.current);
    lastScreenshotObjectURLRef.current = objectUrl;
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `screenshot_${selectedDeviceId}_${Date.now()}.${currentExtensionRef.current}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Screenshot downloaded!', 'success');
  };
 
  const playDeviceRecording = (path: string, name: string) => {
    if (!selectedDeviceId) return;
    setVideoModal({
      isOpen: true,
      title: `Loading from Device: ${name}`,
      filename: name,
      isLoading: true
    });
    pendingPlayFilenamesRef.current.add(name);
    sendCommandToDevice('upload_file', { path });
  };

  useEffect(() => {
    let active = true;
    let reconnectTimeout: number;

    const connectWebSocket = () => {
      if (!active) return;
      const { accessToken } = useAuthStore.getState().auth;
      if (!accessToken) {
        setWsStatus('Disconnected');
        return;
      }
      setWsStatus('Connecting');
      const wsUrl = `${getWsUrl()}?type=admin&token=${accessToken}`;
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
        fetchUnreadCounts();

        if (selectedDeviceId) {
          ws.send(JSON.stringify({
            type: 'command',
            deviceId: selectedDeviceId,
            payload: { action: 'get_status', timestamp: Date.now() }
          }));
          ws.send(JSON.stringify({
            type: 'command',
            deviceId: selectedDeviceId,
            payload: { action: 'get_recordings', timestamp: Date.now() }
          }));
        }
      };

      ws.onmessage = async (event) => {
        if (!active) return;
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'device_list') setActiveDevices(data.devices || []);
            else if (data.type === 'device_connected') { fetchDevices(); showToast(`Device ${data.deviceId} is now online`, 'success'); }
            else if (data.type === 'device_disconnected') {
              fetchDevices(); showToast(`Device ${data.deviceId} went offline`, 'warning');
              if (selectedDeviceId === data.deviceId) clearStream();
            } else if (data.type === 'status') {
              if (data.deviceId === selectedDeviceId) {
                setIsRecording(data.isClockedIn);
                if (data.isClockedIn) {
                  localRecordedFramesRef.current = [];
                  localRecordingStartTimeRef.current = Date.now();
                } else if (localRecordedFramesRef.current.length > 0 && localRecordingStartTimeRef.current) {
                  const elapsed = Date.now() - localRecordingStartTimeRef.current;
                  const sec = Math.floor(elapsed / 1000) % 60;
                  const min = Math.floor(Math.floor(elapsed / 1000) / 60);
                  setLocalRecordedSessions(prev => [{
                    id: `session_rec_${Math.floor(Math.random() * 900) + 100}`,
                    deviceId: selectedDeviceId || 'unknown',
                    duration: `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`,
                    timestamp: new Date().toLocaleString(),
                    size: `${(localRecordedFramesRef.current.length * 0.12).toFixed(1)} MB`,
                    frameCount: localRecordedFramesRef.current.length
                  }, ...prev]);
                }
              }
            } else if (data.type === 'new_recording') {
              setServerRecordings(prev => [data.recording, ...prev]);
              if (pendingPlayFilenamesRef.current.has(data.recording.filename)) {
                pendingPlayFilenamesRef.current.delete(data.recording.filename);
                setVideoModal({ isOpen: true, title: `Session Player: ${data.recording.name}`, filename: data.recording.filename, isLoading: false });
              }
            } else if (data.type === 'device_recordings' && data.deviceId === selectedDeviceId) setDeviceRecordings(data.recordings || []);
            else if (data.type === 'employee_list_update') setEmployees(data.employees || []);
            else if (data.type === 'tasks_update') {
              document.dispatchEvent(new CustomEvent('tasks_update', { detail: data.tasks }));
            }
            else if (data.type === 'device_settings_update') setDeviceSettings(data.settings || {});
            else if (data.type === 'clock_sessions_list' || data.type === 'clock_sessions_update') setClockSessions(data.sessions || []);
            else if (data.type === 'battery_update') {
              setDeviceBatteries(prev => ({ ...prev, [data.deviceId]: data.level }));
            }
            else if (data.type === 'gps_update') {
              setDeviceLocations(prev => ({ ...prev, [data.deviceId]: data.gpsLog }));
            }
            else if (data.type === 'system_log') {
              setSystemLogs(prev => {
                const next = [...prev, data.log];
                if (next.length > 300) {
                  return next.slice(next.length - 300);
                }
                return next;
              });
            }
            else if (data.type === 'new_message') {
              const msg = data.message;
              const { user } = useAuthStore.getState().auth;
              if (user && msg.receiverId === user.accountNo) {
                setUnreadChatCount(prev => prev + 1);
                setUnreadBySender(prev => ({
                  ...prev,
                  [msg.senderId]: (prev[msg.senderId] || 0) + 1
                }));
              }
              document.dispatchEvent(new CustomEvent('new_chat_message', { detail: msg }));
            }
          } catch (err) { console.error('Error parsing text frame:', err); }
        } else {
          try {
            const buffer = event.data instanceof Blob ? await event.data.arrayBuffer() : event.data as ArrayBuffer;
            const view = new DataView(buffer);
            const idLen = view.getUint8(0);
            const deviceId = new TextDecoder('utf-8').decode(new Uint8Array(buffer, 1, idLen));
            if (deviceId === selectedDeviceId) {
              frameCountRef.current++;
              const imgBytes = buffer.slice(1 + idLen);
              let mimeType = 'image/jpeg', ext = 'jpg';
              if (imgBytes.byteLength >= 4) {
                const h = new Uint8Array(imgBytes, 0, 4);
                if (h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4E && h[3] === 0x47) { mimeType = 'image/png'; ext = 'png'; }
              }
              currentExtensionRef.current = ext;
              const blob = new Blob([new Uint8Array(imgBytes)], { type: mimeType });
              latestFrameBlobRef.current = blob;
              if (isRecording) localRecordedFramesRef.current.push(blob);
              if (currentObjectURLRef.current) URL.revokeObjectURL(currentObjectURLRef.current);
              const newUrl = URL.createObjectURL(blob);
              currentObjectURLRef.current = newUrl;
              setStreamUrl(newUrl);
            }
          } catch (err) { console.error('Error reading binary packet:', err); }
        }
      };
      ws.onclose = () => { if (active) { setWsStatus('Disconnected'); reconnectTimeout = window.setTimeout(connectWebSocket, 3000); } };
      ws.onerror = (err) => { if (active) { console.error('WS Error:', err); ws.close(); } };
    };

    connectWebSocket();
    const pollInterval = setInterval(fetchDevices, 6000);
    const fpsInterval = setInterval(() => { setFps(frameCountRef.current); frameCountRef.current = 0; }, 1000);

    return () => {
      active = false;
      clearInterval(pollInterval);
      clearInterval(fpsInterval);
      clearTimeout(reconnectTimeout);
      if (socketRef.current) socketRef.current.close();
      if (currentObjectURLRef.current) URL.revokeObjectURL(currentObjectURLRef.current);
    };
  }, [selectedDeviceId, isRecording]);

  useEffect(() => {
    if (activeDevices.length > 0 && selectedDeviceId === null) {
      handleSelectDevice(activeDevices[0]);
    }
  }, [activeDevices, selectedDeviceId]);

  return (
    <DeviceStreamContext.Provider value={{
      wsStatus, activeDevices, selectedDeviceId, serverRecordings, deviceRecordings, employees, serverIps, deviceSettings, clockSessions, localRecordedSessions, isRecording, fps, streamUrl, toasts, videoModal, deviceBatteries, deviceLocations, systemLogs, unreadChatCount, unreadBySender,
      handleSelectDevice, toggleRecord, clearStream, showToast, fetchClockSessions, fetchEmployees, fetchRecordings, setVideoModal, sendCommandToDevice, takeScreenshot, playDeviceRecording, fetchUnreadCounts, markChatAsRead, updateDeviceSettings
    }}>
      {children}
    </DeviceStreamContext.Provider>
  );
};

export const useDeviceStream = () => {
  const context = useContext(DeviceStreamContext);
  if (context === undefined) throw new Error('useDeviceStream must be used within a DeviceStreamProvider');
  return context;
};
