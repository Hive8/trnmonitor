import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useDeviceStream } from '@/hooks/useDeviceStream';
import { History, Play, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

export function SyncSessionsTable() {
  const { serverRecordings, employees, setVideoModal, fetchRecordings, showToast } = useDeviceStream();
  const [sessionPage, setSessionPage] = useState(1);
  const sessionsPerPage = 25;

  const totalPages = Math.ceil(serverRecordings.length / sessionsPerPage);
  const paginatedSessions = serverRecordings.slice(
    (sessionPage - 1) * sessionsPerPage,
    sessionPage * sessionsPerPage
  );

  const getEmployeeName = (deviceId: string) => {
    const emp = employees.find(e => e.deviceId === deviceId);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned';
  };

  const playRealVideo = (filename: string, title: string) => {
    setVideoModal({
      isOpen: true,
      title: `Session Player: ${title}`,
      filename: filename,
      isLoading: false
    });
  };

  return (
    <Card className="flex flex-col h-full border-slate-800 shadow-xl bg-slate-900/50 backdrop-blur-sm">
      <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4" />
          Recent Synchronization Sessions
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            onClick={async () => {
              await fetchRecordings();
              showToast('Recent sessions refreshed from database', 'success');
            }}
            title="Sync Recent Sessions"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-500">
            Total Records: {serverRecordings.length}
          </span>
          <div className="flex gap-1 ml-4 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 rounded disabled:opacity-50"
              disabled={sessionPage === 1}
              onClick={() => setSessionPage(Math.max(1, sessionPage - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-medium text-slate-300 w-16 text-center flex items-center justify-center">
              Page {sessionPage} of {totalPages || 1}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 rounded disabled:opacity-50"
              disabled={sessionPage >= totalPages}
              onClick={() => setSessionPage(Math.min(totalPages, sessionPage + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-y-auto w-full">
          {serverRecordings.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
              <History className="w-12 h-12 opacity-20" />
              <p className="text-sm">No recorded sessions available</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 bg-slate-900/80 sticky top-0">
                  <TableHead className="text-xs font-semibold text-slate-400">SESSION ID</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400">EMPLOYEE</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400">DURATION</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400">TIMESTAMP</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400">SIZE</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-slate-400 pr-6">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSessions.map((rec) => (
                  <TableRow key={rec.id} className="border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <TableCell className="font-mono text-xs text-slate-300">{rec.id}</TableCell>
                    <TableCell className="text-sm text-slate-200">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-700">
                          {getEmployeeName(rec.deviceId).charAt(0)}
                        </div>
                        {getEmployeeName(rec.deviceId)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-400">{rec.duration}</TableCell>
                    <TableCell className="text-sm text-slate-400">{rec.timestamp}</TableCell>
                    <TableCell className="text-sm text-slate-400">{rec.size}</TableCell>
                    <TableCell className="text-right pr-4">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => playRealVideo(rec.filename, rec.name)}
                        className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg gap-2"
                      >
                        <Play className="w-4 h-4" /> Play
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
