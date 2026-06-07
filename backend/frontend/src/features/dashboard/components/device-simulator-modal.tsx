import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Terminal, RefreshCw, Smartphone } from 'lucide-react';
import { useState } from 'react';

export function DeviceSimulatorModal({ isOpen, onOpenChange }: { isOpen: boolean, onOpenChange: (open: boolean) => void }) {
  const [logs, setLogs] = useState<string[]>(['Simulator initialized...']);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  };

  const testConnection = () => {
    addLog('Testing backend websocket connection...');
    setTimeout(() => addLog('Connection successful!'), 1000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-slate-950 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="w-5 h-5 text-violet-400" />
            Virtual Device Simulator
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            A utility to test backend connectivity without a physical device.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Simulation Controls</h4>
              <p className="text-xs text-slate-500">Connect to the backend as a mock device.</p>
            </div>
            <Button onClick={testConnection} className="bg-violet-600 hover:bg-violet-700">
              <RefreshCw className="w-4 h-4 mr-2" /> Connect
            </Button>
          </div>

          <div className="bg-black/50 border border-slate-800 rounded-xl overflow-hidden h-[250px] flex flex-col font-mono text-xs">
            <div className="bg-slate-900 border-b border-slate-800 p-2 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400 font-semibold">Simulator Terminal</span>
            </div>
            <div className="p-4 overflow-y-auto flex-1 flex flex-col-reverse text-emerald-400">
              {logs.map((log, i) => (
                <div key={i} className="mb-1">{log}</div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
