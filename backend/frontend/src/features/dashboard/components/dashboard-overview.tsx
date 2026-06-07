import { useState, useEffect, useRef } from 'react';
import { useDeviceStream } from '@/hooks/useDeviceStream';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LeafletMap } from './leaflet-map';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Laptop, 
  Users as UsersIcon, 
  Video, 
  Activity, 
  Trash2, 
  Search, 
  Terminal
} from 'lucide-react';

export function DashboardOverview() {
  const { 
    activeDevices, 
    deviceLocations, 
    deviceBatteries, 
    employees, 
    serverRecordings, 
    clockSessions, 
    wsStatus,
    systemLogs 
  } = useDeviceStream();

  const [searchFilter, setSearchFilter] = useState('');
  const [localLogs, setLocalLogs] = useState<typeof systemLogs>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Sync internal systemLogs but allow clearing them locally
  useEffect(() => {
    setLocalLogs(systemLogs);
  }, [systemLogs]);

  // Autoscroll to bottom of the console logs container when new logs arrive
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [localLogs]);

  // Compute KPI Counts
  const connectedCount = activeDevices.length;
  const clockedInCount = clockSessions.filter(s => s.status === 'Active').length;
  const recordingsCount = serverRecordings.length;

  // Filter local logs based on user search query
  const filteredLogs = localLogs.filter(log => 
    log.message.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Prepare device locations for the Leaflet Map
  const mapLocations = activeDevices.map(deviceId => {
    const location = deviceLocations[deviceId];
    const employee = employees.find(emp => emp.deviceId === deviceId);
    const name = employee ? `${employee.firstName} ${employee.lastName}` : `Device ${deviceId}`;
    const battery = deviceBatteries[deviceId];

    return {
      id: deviceId,
      name,
      lat: location?.latitude ?? null,
      lng: location?.longitude ?? null,
      battery,
      timestamp: location?.timestamp
    };
  }).filter(loc => loc.lat !== null && loc.lng !== null) as Array<{ id: string; name: string; lat: number; lng: number; battery?: number; timestamp?: string }>;

  return (
    <div className="space-y-6">
      {/* ===== KPI Metrics Grid ===== */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Connected Devices */}
        <Card className="border-slate-800 bg-slate-900/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold tracking-tight text-slate-400">
              Active Devices
            </CardTitle>
            <Laptop className="h-4.5 w-4.5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{connectedCount}</div>
            <p className="text-xs text-slate-500 mt-1">
              Currently connected to gateway
            </p>
          </CardContent>
        </Card>

        {/* Clocked In Staff */}
        <Card className="border-slate-800 bg-slate-900/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold tracking-tight text-slate-400">
              Clocked In Staff
            </CardTitle>
            <UsersIcon className="h-4.5 w-4.5 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{clockedInCount}</div>
            <p className="text-xs text-slate-500 mt-1">
              Employees currently clocked in
            </p>
          </CardContent>
        </Card>

        {/* Saved Recordings */}
        <Card className="border-slate-800 bg-slate-900/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold tracking-tight text-slate-400">
              Recorded Sessions
            </CardTitle>
            <Video className="h-4.5 w-4.5 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{recordingsCount}</div>
            <p className="text-xs text-slate-500 mt-1">
              Synced video log archives
            </p>
          </CardContent>
        </Card>

        {/* Gateway Connection State */}
        <Card className="border-slate-800 bg-slate-900/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold tracking-tight text-slate-400">
              Gateway Status
            </CardTitle>
            <Activity className={`h-4.5 w-4.5 ${wsStatus === 'Online' ? 'text-emerald-500 animate-pulse' : wsStatus === 'Connecting' ? 'text-amber-500 animate-bounce' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${wsStatus === 'Online' ? 'bg-emerald-500' : wsStatus === 'Connecting' ? 'bg-amber-500' : 'bg-red-500'}`} />
              <div className="text-2xl font-bold text-white capitalize">{wsStatus}</div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time WebSockets connection
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ===== Map and Log Console Layout ===== */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Real-time Map Panel (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col space-y-2">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-md font-bold text-white">Connected Devices Map</h2>
              <p className="text-xs text-slate-500">Live coordinates captured from staff GPS logs</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-medium">
              {mapLocations.length} Online
            </span>
          </div>
          <div className="flex-1 h-[400px] md:h-[480px]">
            <LeafletMap locations={mapLocations} />
          </div>
        </div>

        {/* Live Logs Terminal Window (1/3 width) */}
        <div className="lg:col-span-1 flex flex-col space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Terminal className="w-4.5 h-4.5 text-slate-400" />
              <div>
                <h2 className="text-md font-bold text-white">Live System Logs</h2>
                <p className="text-xs text-slate-500">Real-time gateway & database events</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setLocalLogs([])}
              className="h-7 text-xs gap-1 hover:bg-slate-800 hover:text-red-400 border-slate-800"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </Button>
          </div>

          <Card className="flex-1 flex flex-col border-slate-800 bg-slate-900/40 overflow-hidden min-h-[400px]">
            {/* Console Toolbar */}
            <div className="p-3 border-b border-slate-800 flex items-center gap-2 bg-slate-950/60">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search log messages..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 h-9 text-xs border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            {/* Console Console Screen */}
            <CardContent className="flex-1 overflow-y-auto p-4 bg-slate-950 font-mono text-[11px] leading-relaxed text-slate-300 selection:bg-emerald-900 selection:text-white h-[320px] max-h-[380px]">
              <div className="space-y-1.5">
                <div className="text-slate-500 italic pb-1">
                  -- Session started: {new Date().toLocaleTimeString()} --
                </div>
                {filteredLogs.length === 0 ? (
                  <div className="text-slate-600 italic py-8 text-center">
                    {searchFilter ? 'No search results match the query.' : 'Waiting for incoming logs...'}
                  </div>
                ) : (
                  filteredLogs.map((log, index) => {
                    const time = new Date(log.timestamp).toLocaleTimeString();
                    const isError = log.level === 'error';
                    
                    let logColor = 'text-emerald-400/90'; // Default green
                    if (isError) logColor = 'text-red-400';
                    else if (log.message.includes('GPS') || log.message.includes('gps')) logColor = 'text-sky-400';
                    else if (log.message.includes('connected') || log.message.includes('online')) logColor = 'text-yellow-400';
                    else if (log.message.includes('Clock In') || log.message.includes('Clock Out')) logColor = 'text-indigo-400';

                    return (
                      <div key={index} className="flex gap-2 items-start break-all hover:bg-slate-900/40 p-0.5 rounded transition-colors">
                        <span className="text-slate-500 flex-shrink-0 select-none">[{time}]</span>
                        <span className={logColor}>{log.message}</span>
                      </div>
                    );
                  })
                )}
                <div ref={consoleBottomRef} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
