import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceStream } from '@/hooks/useDeviceStream';
import { Camera, Radio, StopCircle, RefreshCw } from 'lucide-react';

export function LiveMonitorCard() {
  const { 
    selectedDeviceId, isRecording, fps, streamUrl, 
    toggleRecord, takeScreenshot, wsStatus 
  } = useDeviceStream();

  return (
    <Card className="flex flex-col h-full border-slate-800 shadow-xl bg-slate-900/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-900/80 border-b border-slate-800">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Radio className={`w-5 h-5 ${wsStatus === 'Online' ? 'text-emerald-500 animate-pulse' : 'text-slate-500'}`} />
            Live Monitor
          </CardTitle>
          <CardDescription>
            {selectedDeviceId ? `Connected to ${selectedDeviceId}` : 'Waiting for device selection...'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {streamUrl && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
              <span className={`w-2 h-2 rounded-full ${fps > 0 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
              <span className="text-xs font-mono font-medium text-slate-300">{fps} FPS</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 relative bg-slate-950 flex flex-col items-center justify-center min-h-[400px]">
        {!selectedDeviceId ? (
          <div className="text-slate-500 flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin-slow opacity-50" />
            <span className="text-sm font-medium tracking-wide uppercase">Awaiting Device Stream</span>
          </div>
        ) : streamUrl ? (
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <img 
              src={streamUrl} 
              alt={`Live stream from ${selectedDeviceId}`} 
              className="max-h-[650px] object-contain rounded-lg border border-slate-800 shadow-2xl"
            />
          </div>
        ) : (
          <div className="text-slate-500 flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin opacity-50" />
            <span className="text-sm font-medium">Connecting video feed...</span>
          </div>
        )}

        {/* Floating Controls Overlay */}
        {selectedDeviceId && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800/80 shadow-2xl">
            <Button 
              variant={isRecording ? 'destructive' : 'default'} 
              onClick={toggleRecord}
              className={`rounded-xl shadow-lg transition-all ${isRecording ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}
            >
              {isRecording ? <StopCircle className="w-5 h-5 mr-2 animate-pulse" /> : <Radio className="w-5 h-5 mr-2" />}
              {isRecording ? 'Clock Out (Stop Rec)' : 'Clock In (Start Rec)'}
            </Button>
            
            <div className="w-px h-8 bg-slate-800 mx-1"></div>
            
            <Button 
              variant="outline" 
              size="icon"
              onClick={takeScreenshot}
              className="rounded-xl border-slate-700 bg-slate-800/50 hover:bg-slate-700 hover:text-white transition-colors"
              title="Take Screenshot"
            >
              <Camera className="w-5 h-5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
