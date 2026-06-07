import React, { useEffect, useState } from 'react';
import { useDeviceStream } from '@/hooks/useDeviceStream';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Clock, Plus, Trash2, Edit, Calendar, User, Smartphone, 
  FileText, Loader2, CheckCircle2, AlertCircle, RefreshCw, MapPin,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

export function TimeTracking() {
  const { 
    clockSessions, employees, fetchClockSessions, fetchEmployees, showToast 
  } = useDeviceStream();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isRouteOpen, setIsRouteOpen] = useState(false);
  const [gpsLogs, setGpsLogs] = useState<any[]>([]);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  
  // Expanded session row states
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());
  const [sessionGpsLogs, setSessionGpsLogs] = useState<{ [sessionId: string]: any[] }>({});
  const [sessionGpsLoading, setSessionGpsLoading] = useState<{ [sessionId: string]: boolean }>({});
  
  // Form States
  const [employeeId, setEmployeeId] = useState('');
  const [deviceId, setDeviceId] = useState('Manual');
  const [clockInTime, setClockInTime] = useState('');
  const [clockOutTime, setClockOutTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic ticker state for active sessions
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchClockSessions();
    fetchEmployees();
    
    // Ticker every second
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getBaseUrl = () => window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
  const getHeaders = () => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const { accessToken } = useAuthStore.getState().auth;
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return headers;
  };

  const getEmployeeName = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown Employee';
  };

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const toLocalDatetimeString = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    // Format to YYYY-MM-DDTHH:mm
    const tzoffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  // Helper to format dynamic duration for active sessions or finished sessions
  const getDuration = (session: any) => {
    if (session.status === 'Completed' || session.clockOutTime) {
      return session.duration;
    }
    
    // Dynamic calculate for active session
    const start = new Date(session.clockInTime).getTime();
    const diffMs = now - start;
    if (diffMs <= 0) return '00:00:00';
    
    const diffSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSec / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
    const seconds = (diffSec % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const handleOpenAdd = () => {
    setEmployeeId(employees[0]?.id || '');
    setDeviceId('Manual');
    setClockInTime(toLocalDatetimeString(new Date().toISOString()));
    setClockOutTime('');
    setNotes('');
    setIsAddOpen(true);
  };

  const handleOpenEdit = (session: any) => {
    setSelectedSession(session);
    setClockInTime(toLocalDatetimeString(session.clockInTime));
    setClockOutTime(session.clockOutTime ? toLocalDatetimeString(session.clockOutTime) : '');
    setNotes(session.notes || '');
    setIsEditOpen(true);
  };

  const handleOpenDelete = (session: any) => {
    setSelectedSession(session);
    setIsDeleteOpen(true);
  };
  
  const handleOpenRoute = async (session: any) => {
    setSelectedSession(session);
    setIsRouteOpen(true);
    setIsGpsLoading(true);
    setGpsLogs([]);
    try {
      const res = await fetch(`${getBaseUrl()}/api/gps-logs/session/${session.id}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setGpsLogs(data.logs);
      } else {
        showToast(data.error || 'Failed to fetch GPS logs', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error occurred', 'error');
    } finally {
      setIsGpsLoading(false);
    }
  };

  const toggleSessionExpand = async (sessionId: string, hasDevice: boolean) => {
    const next = new Set(expandedSessionIds);
    if (next.has(sessionId)) {
      next.delete(sessionId);
      setExpandedSessionIds(next);
      return;
    }

    next.add(sessionId);
    setExpandedSessionIds(next);

    if (hasDevice && !sessionGpsLogs[sessionId]) {
      setSessionGpsLoading(prev => ({ ...prev, [sessionId]: true }));
      try {
        const res = await fetch(`${getBaseUrl()}/api/gps-logs/session/${sessionId}`, {
          headers: getHeaders()
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setSessionGpsLogs(prev => ({ ...prev, [sessionId]: data.logs }));
        }
      } catch (err) {
        console.error('Failed to fetch GPS logs for session:', err);
      } finally {
        setSessionGpsLoading(prev => ({ ...prev, [sessionId]: false }));
      }
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !clockInTime) {
      showToast('Employee and Clock In Time are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedEmp = employees.find(emp => emp.id === employeeId);
      const payload = {
        employeeId,
        deviceId: deviceId === 'Manual' ? 'Manual' : (selectedEmp?.deviceId || 'Manual'),
        clockInTime: new Date(clockInTime).toISOString(),
        clockOutTime: clockOutTime ? new Date(clockOutTime).toISOString() : null,
        notes
      };

      const res = await fetch(`${getBaseUrl()}/api/clock-sessions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        showToast('Clock session added successfully', 'success');
        fetchClockSessions();
        setIsAddOpen(false);
      } else {
        showToast(data.error || 'Failed to add session', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error occurred', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clockInTime) {
      showToast('Clock In Time is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        clockInTime: new Date(clockInTime).toISOString(),
        clockOutTime: clockOutTime ? new Date(clockOutTime).toISOString() : null,
        notes
      };

      const res = await fetch(`${getBaseUrl()}/api/clock-sessions/${selectedSession.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        showToast('Clock session updated successfully', 'success');
        fetchClockSessions();
        setIsEditOpen(false);
      } else {
        showToast(data.error || 'Failed to update session', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error occurred', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSession = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${getBaseUrl()}/api/clock-sessions/${selectedSession.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });

      const data = await res.json();
      if (data.success) {
        showToast('Clock session deleted successfully', 'success');
        fetchClockSessions();
        setIsDeleteOpen(false);
      } else {
        showToast(data.error || 'Failed to delete session', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error occurred', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Clock className="w-6 h-6 text-violet-400" />
            Time Tracking Manager
          </h2>
          <p className="text-slate-400 text-sm">
            Manage employee shifts, review clock-in notes, and correct shift logs.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => fetchClockSessions()}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4" /> Add Session
          </Button>
        </div>
      </div>

      <Card className="border-slate-800 shadow-xl bg-slate-900/50 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            All Clock Sessions
          </CardTitle>
          <CardDescription>
            List of all mobile shift recordings and manually tracked time blocks.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {clockSessions.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center text-slate-500 gap-3">
              <Clock className="w-12 h-12 opacity-20" />
              <p className="text-sm">No clock sessions found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 bg-slate-900/80">
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400">Employee</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400">Device ID</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400">Clock In</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400">Clock Out</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400">Duration</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400">Notes</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-400 pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clockSessions.map((session: any) => (
                  <React.Fragment key={session.id}>
                    <TableRow className="border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                      <TableCell className="w-[40px]">
                        {session.deviceId !== 'Manual' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-200"
                            onClick={() => toggleSessionExpand(session.id, session.deviceId !== 'Manual')}
                          >
                            {expandedSessionIds.has(session.id) ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-700">
                            {getEmployeeName(session.employeeId).charAt(0)}
                          </div>
                          {getEmployeeName(session.employeeId)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-400">
                        {session.deviceId}
                      </TableCell>
                      <TableCell className="text-sm text-slate-300">
                        {formatDateTime(session.clockInTime)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-300">
                        {formatDateTime(session.clockOutTime)}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-slate-200 font-semibold">
                        {getDuration(session)}
                      </TableCell>
                      <TableCell>
                        {session.status === 'Active' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Clocked In
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-800 text-slate-400 border border-slate-700 gap-1">
                            <CheckCircle2 className="w-3 h-3 text-slate-500" />
                            Completed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400 max-w-[200px] truncate" title={session.notes}>
                        {session.notes || <span className="text-slate-600 italic">None</span>}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex justify-end gap-1">
                          {session.deviceId !== 'Manual' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 hover:bg-violet-500/10 hover:text-violet-400 text-slate-400"
                              onClick={() => handleOpenRoute(session)}
                              title="View Route History"
                            >
                              <MapPin className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-slate-800 hover:text-slate-200 text-slate-400"
                            onClick={() => handleOpenEdit(session)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-red-500/10 hover:text-red-400 text-slate-400"
                            onClick={() => handleOpenDelete(session)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedSessionIds.has(session.id) && (
                      <TableRow className="bg-slate-900/30 border-slate-800/50 hover:bg-slate-900/30">
                        <TableCell colSpan={9} className="p-4 pl-14">
                          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-violet-400" />
                                GPS Session Breadcrumbs
                              </h4>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Device: {session.deviceId}
                              </span>
                            </div>

                            {sessionGpsLoading[session.id] ? (
                              <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
                                <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                                <span>Loading GPS points...</span>
                              </div>
                            ) : !sessionGpsLogs[session.id] || sessionGpsLogs[session.id].length === 0 ? (
                              <div className="text-xs text-slate-500 py-3">
                                No GPS breadcrumbs logged during this shift.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 bg-slate-900/20 p-2.5 rounded-lg border border-slate-900">
                                  <div className="flex flex-wrap gap-4">
                                    <div>
                                      Total Points: <span className="font-semibold text-slate-300 font-mono">{sessionGpsLogs[session.id].length}</span>
                                    </div>
                                    <div>
                                      First Logged: <span className="font-semibold text-slate-300">{new Date(sessionGpsLogs[session.id][0].timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div>
                                      Last Logged: <span className="font-semibold text-slate-300">{new Date(sessionGpsLogs[session.id][sessionGpsLogs[session.id].length - 1].timestamp).toLocaleTimeString()}</span>
                                    </div>
                                  </div>
                                  
                                  {sessionGpsLogs[session.id].length > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-[10px] gap-1 border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-400 text-slate-300"
                                      onClick={() => {
                                        const logs = sessionGpsLogs[session.id];
                                        let url = '';
                                        if (logs.length === 1) {
                                          url = `https://www.google.com/maps/search/?api=1&query=${logs[0].latitude},${logs[0].longitude}`;
                                        } else {
                                          const origin = `${logs[0].latitude},${logs[0].longitude}`;
                                          const destination = `${logs[logs.length - 1].latitude},${logs[logs.length - 1].longitude}`;
                                          const intermediate = logs.slice(1, -1);
                                          let waypoints = '';
                                          if (intermediate.length > 0) {
                                            let sampled = intermediate;
                                            if (intermediate.length > 20) {
                                              const step = Math.ceil(intermediate.length / 20);
                                              sampled = [];
                                              for (let i = 0; i < intermediate.length; i += step) {
                                                sampled.push(intermediate[i]);
                                              }
                                            }
                                            waypoints = '&waypoints=' + sampled.map(p => `${p.latitude},${p.longitude}`).join('|');
                                          }
                                          url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}`;
                                        }
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                      }}
                                    >
                                      <MapPin className="w-3 h-3 text-violet-400" />
                                      View Full Route on Google Maps
                                    </Button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[160px] overflow-y-auto pr-1">
                                  {sessionGpsLogs[session.id].map((log: any, idx: number) => (
                                    <div key={log.id} className="p-2 rounded-lg border border-slate-900 bg-slate-900/30 flex justify-between items-center hover:border-slate-800 transition-colors">
                                      <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-semibold text-slate-400">Point #{idx + 1}</span>
                                        <span className="text-xs font-mono text-slate-300">{log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}</span>
                                        <span className="text-[9px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      </div>
                                      <a 
                                        href={`https://www.google.com/maps/search/?api=1&query=${log.latitude},${log.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-sky-400 hover:text-sky-300 hover:underline px-2 py-1 bg-sky-500/5 hover:bg-sky-500/10 rounded border border-sky-500/10 font-medium"
                                      >
                                        Map
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ADD MODAL */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] bg-slate-950 border-slate-800 text-slate-100">
          <form onSubmit={handleAddSession}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                <Plus className="w-5 h-5 text-violet-400" />
                Add Clock Session
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Manually record a shift or time entry for an employee.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Employee
                </label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger className="w-full bg-slate-900 border-slate-800">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> Track Method / Device
                </label>
                <Select value={deviceId} onValueChange={setDeviceId}>
                  <SelectTrigger className="w-full bg-slate-900 border-slate-800">
                    <SelectValue placeholder="Select tracking device" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-800 text-slate-100">
                    <SelectItem value="Manual">Manual Entry (No device)</SelectItem>
                    <SelectItem value="Device">Use Employee Device Mapping</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Clock In Time
                  </label>
                  <Input 
                    type="datetime-local" 
                    value={clockInTime} 
                    onChange={e => setClockInTime(e.target.value)} 
                    className="bg-slate-900 border-slate-800"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Clock Out Time
                  </label>
                  <Input 
                    type="datetime-local" 
                    value={clockOutTime} 
                    onChange={e => setClockOutTime(e.target.value)} 
                    className="bg-slate-900 border-slate-800"
                    placeholder="Active shift"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Shift Notes
                </label>
                <Textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Reason for manual entry, shift details, etc."
                  className="bg-slate-900 border-slate-800 min-h-[80px]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-violet-600 hover:bg-violet-700 text-white">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px] bg-slate-950 border-slate-800 text-slate-100">
          <form onSubmit={handleEditSession}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                <Edit className="w-5 h-5 text-violet-400" />
                Edit Clock Session
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Correct date/time shift log details for {selectedSession ? getEmployeeName(selectedSession.employeeId) : ''}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Clock In Time
                  </label>
                  <Input 
                    type="datetime-local" 
                    value={clockInTime} 
                    onChange={e => setClockInTime(e.target.value)} 
                    className="bg-slate-900 border-slate-800"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Clock Out Time
                  </label>
                  <Input 
                    type="datetime-local" 
                    value={clockOutTime} 
                    onChange={e => setClockOutTime(e.target.value)} 
                    className="bg-slate-900 border-slate-800"
                    placeholder="Shift remains active"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Shift Notes
                </label>
                <Textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Notes detailing shift correction..."
                  className="bg-slate-900 border-slate-800 min-h-[80px]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-violet-600 hover:bg-violet-700 text-white">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update Log
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[400px] bg-slate-950 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-red-500">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Delete Clock Session
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Are you sure you want to permanently delete this clock session? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Employee:</span>
              <span className="font-semibold">{selectedSession ? getEmployeeName(selectedSession.employeeId) : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Clock In:</span>
              <span>{selectedSession ? formatDateTime(selectedSession.clockInTime) : ''}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteSession}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ROUTE HISTORY DIALOG */}
      <Dialog open={isRouteOpen} onOpenChange={setIsRouteOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[80vh] flex flex-col bg-slate-950 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <MapPin className="w-5 h-5 text-violet-400" />
              Route History
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              GPS breadcrumbs captured for {selectedSession ? getEmployeeName(selectedSession.employeeId) : ''}'s shift.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-4 min-h-[200px]">
            {isGpsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                <span className="text-sm">Fetching route points...</span>
              </div>
            ) : gpsLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-3">
                <MapPin className="w-12 h-12 opacity-15" />
                <p className="text-sm font-medium text-slate-400">No route logs found for this session.</p>
                <p className="text-xs text-slate-500 text-center max-w-[300px]">
                  Coordinates are captured automatically every 60 seconds when employee is clocked in.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                  <div className="flex gap-4">
                    <span>Device ID: <strong className="font-mono text-slate-300">{selectedSession?.deviceId}</strong></span>
                    <span>Total points: <strong className="text-slate-300">{gpsLogs.length}</strong></span>
                  </div>
                  {gpsLogs.length > 0 && (
                    <Button
                      size="sm"
                      className="h-7 text-[10px] gap-1 bg-violet-600 hover:bg-violet-700 text-white font-medium"
                      onClick={() => {
                        let url = '';
                        if (gpsLogs.length === 1) {
                          url = `https://www.google.com/maps/search/?api=1&query=${gpsLogs[0].latitude},${gpsLogs[0].longitude}`;
                        } else {
                          const origin = `${gpsLogs[0].latitude},${gpsLogs[0].longitude}`;
                          const destination = `${gpsLogs[gpsLogs.length - 1].latitude},${gpsLogs[gpsLogs.length - 1].longitude}`;
                          const intermediate = gpsLogs.slice(1, -1);
                          let waypoints = '';
                          if (intermediate.length > 0) {
                            let sampled = intermediate;
                            if (intermediate.length > 20) {
                              const step = Math.ceil(intermediate.length / 20);
                              sampled = [];
                              for (let i = 0; i < intermediate.length; i += step) {
                                sampled.push(intermediate[i]);
                              }
                            }
                            waypoints = '&waypoints=' + sampled.map(p => `${p.latitude},${p.longitude}`).join('|');
                          }
                          url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}`;
                        }
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <MapPin className="w-3 h-3" />
                      View Full Route on Google Maps
                    </Button>
                  )}
                </div>

                <div className="relative border-l border-slate-800 ml-3.5 pl-6 space-y-4">
                  {gpsLogs.map((log, index) => (
                    <div key={log.id} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 border border-slate-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-400"></span>
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300">
                            Point #{index + 1}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-900/40 hover:bg-slate-900/80 transition-colors p-2 rounded-md border border-slate-900/60 mt-1">
                          <span className="text-xs font-mono text-slate-400">
                            {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                          </span>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${log.latitude},${log.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 font-medium"
                          >
                            Google Maps
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-900 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsRouteOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
