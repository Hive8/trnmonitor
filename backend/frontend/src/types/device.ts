export interface Employee {
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
  role?: string;
  username?: string;
  status?: string;
}

export interface Recording {
  id: string;
  name: string;
  deviceId: string;
  duration: string;
  timestamp: string;
  size: string;
  filename: string;
  status?: string;
  path?: string;
}

export interface DeviceRecording {
  name: string;
  size: string;
  timestamp: string;
  path: string;
  duration?: string;
}

export interface ServerIp {
  type: string;
  address: string;
}

export interface ClockSession {
  id: string;
  employeeId: string;
  deviceId: string;
  clockInTime: string;
  clockOutTime: string | null;
  duration: string;
  status: 'Active' | 'Completed';
  notes: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}
