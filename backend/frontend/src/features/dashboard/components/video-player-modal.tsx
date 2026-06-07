import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useDeviceStream } from '@/hooks/useDeviceStream';
import { Loader2, Play } from 'lucide-react';

export function VideoPlayerModal() {
  const { videoModal, setVideoModal } = useDeviceStream();

  const getBaseUrl = () => window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
  const videoUrl = videoModal.filename ? `${getBaseUrl()}/recordings/${videoModal.filename}` : '';

  const handleOpenChange = (open: boolean) => {
    setVideoModal(prev => ({ ...prev, isOpen: open }));
  };

  return (
    <Dialog open={videoModal.isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] bg-slate-950 border-slate-800 text-slate-100 p-6">
        <DialogHeader className="pb-4 border-b border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Play className="w-5 h-5 text-emerald-400" />
            {videoModal.title || 'Session Player'}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            {videoModal.filename || ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center min-h-[300px] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 mt-4">
          {videoModal.isLoading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <span className="text-sm font-medium">Requesting file from device and preparing playback...</span>
            </div>
          ) : videoModal.filename ? (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <video
                src={videoUrl}
                controls
                autoPlay
                playsInline
                className="w-full max-h-[60vh] object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="text-slate-500 text-sm">No video selected</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
