import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDeviceStream } from '@/hooks/useDeviceStream';
import { Smartphone, BatteryCharging, Server, Play, Copy, RefreshCw, UploadCloud, MapPin, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DeviceConsole() {
  const { 
    activeDevices, selectedDeviceId, handleSelectDevice, 
    deviceRecordings, employees, playDeviceRecording, deviceBatteries,
    deviceLocations, sendCommandToDevice, showToast, deviceSettings, updateDeviceSettings
  } = useDeviceStream();

  const getEmployeeName = (deviceId: string) => {
    const emp = employees.find(e => e.deviceId === deviceId);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned';
  };

  const currentEmp = selectedDeviceId ? employees.find(e => e.deviceId === selectedDeviceId) : null;
  const osVersion = currentEmp?.osVersion || 'Unknown';
  const deviceModel = currentEmp?.deviceModel || 'Unknown';
  const batteryVal = selectedDeviceId && deviceBatteries[selectedDeviceId] !== undefined
    ? `${deviceBatteries[selectedDeviceId]}%`
    : '--';
  const location = selectedDeviceId ? deviceLocations[selectedDeviceId] : null;
  const locationVal = location 
    ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
    : 'No GPS data yet';

  return (
    <div className="flex flex-col gap-4">
      {/* Device Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Target Device
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeDevices.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 flex flex-col items-center justify-center text-slate-500 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin opacity-50" />
              <span className="text-xs">Waiting for devices...</span>
            </div>
          ) : (
            <Select value={selectedDeviceId || ''} onValueChange={handleSelectDevice}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a device" />
              </SelectTrigger>
              <SelectContent>
                {activeDevices.map(id => (
                  <SelectItem key={id} value={id}>
                    {id} <span className="text-muted-foreground ml-2">({getEmployeeName(id)})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Device Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4" />
            Device Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Device Model</span>
            <span className="font-medium">{deviceModel}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">OS Version</span>
            <span className="font-medium">{osVersion}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Battery</span>
            <span className="font-medium text-emerald-400 flex items-center gap-1">
              <BatteryCharging className="w-4 h-4" /> {batteryVal}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Storage</span>
            <span className="font-medium">42 GB Free</span>
          </div>
          <div className="flex justify-between items-start text-sm pt-2 border-t border-slate-800/40">
            <span className="text-slate-500 mt-0.5">Location</span>
            <div className="flex flex-col items-end gap-1">
              <span className="font-medium text-slate-300 text-right">{locationVal}</span>
              {location && (
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1"
                >
                  <MapPin className="w-3.5 h-3.5" /> View on Google Maps
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capture Settings */}
      {selectedDeviceId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-500" />
              Capture Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Resolution</label>
                <select
                  value={deviceSettings[selectedDeviceId]?.resolution || '720x1600'}
                  onChange={(e) => updateDeviceSettings(selectedDeviceId, deviceSettings[selectedDeviceId]?.fps || 5, e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="1080x2400">1080x2400 (Original)</option>
                  <option value="720x1600">720x1600 (High)</option>
                  <option value="480x1066">480x1066 (Medium)</option>
                  <option value="360x800">360x800 (Low)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">Target FPS</label>
                <select
                  value={deviceSettings[selectedDeviceId]?.fps || 5}
                  onChange={(e) => updateDeviceSettings(selectedDeviceId, parseInt(e.target.value, 10), deviceSettings[selectedDeviceId]?.resolution || '720x1600')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={2}>2 FPS</option>
                  <option value={3}>3 FPS</option>
                  <option value={5}>5 FPS</option>
                  <option value={10}>10 FPS</option>
                  <option value={15}>15 FPS</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Device Local Files */}
      <Card className="flex-1 flex flex-col min-h-[300px]">
        <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-slate-800/40">
          <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Copy className="w-4 h-4" />
            Device Local Files
          </CardTitle>
          {selectedDeviceId && (
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              onClick={() => {
                if (sendCommandToDevice('get_recordings')) {
                  showToast('Requesting local recordings list from device...', 'info');
                }
              }}
              title="Sync Local Recordings List"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto pr-2 space-y-2">
          {deviceRecordings.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center">
              <span className="text-xs">No recordings found on device</span>
            </div>
          ) : (
            deviceRecordings.map((rec, i) => (
              <div key={i} className="p-3 rounded-xl border border-slate-800 bg-slate-900 flex justify-between items-center group hover:border-slate-600 transition-colors">
                <div className="overflow-hidden">
                  <p className="text-xs font-medium text-slate-300 truncate" title={rec.name}>{rec.name}</p>
                  <p className="text-[10px] text-slate-500">{rec.size} • {rec.duration}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 hover:bg-sky-500/10 hover:text-sky-400" 
                    onClick={() => {
                      if (sendCommandToDevice('upload_file', { path: rec.path })) {
                        showToast(`Syncing ${rec.name} to server...`, 'info');
                      }
                    }}
                    title="Sync to Server"
                  >
                    <UploadCloud className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-400" onClick={() => playDeviceRecording(rec.path, rec.name)}>
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
