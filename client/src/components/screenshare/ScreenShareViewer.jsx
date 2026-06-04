import { Maximize2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import Button from '../common/Button.jsx';

const ScreenVideo = ({ streamRef, streamVersion, className = '', muted = false, videoRef: externalVideoRef }) => {
  const videoRef = useRef(null);
  const targetVideoRef = externalVideoRef || videoRef;

  useEffect(() => {
    const video = targetVideoRef.current;
    const stream = streamRef.current;

    if (video) {
      video.srcObject = stream ? new MediaStream(stream.getTracks()) : null;
      video.play?.().catch(() => {
        // Autoplay can briefly reject while the element is mounting; metadata load will retry.
      });
    }
  }, [streamRef, streamVersion, targetVideoRef]);

  return (
    <video
      ref={targetVideoRef}
      className={`h-full w-full bg-black object-contain ${className}`}
      autoPlay
      playsInline
      muted={muted}
      onLoadedMetadata={(event) => {
        event.currentTarget.play?.().catch(() => {});
      }}
    />
  );
};

const ScreenShareViewer = ({ open, onClose, activeShare, duration, streamRef, streamVersion, muted = false }) => {
  const viewerRef = useRef(null);

  if (!open || !activeShare) {
    return null;
  }

  const enterFullscreen = () => {
    viewerRef.current?.requestFullscreen?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur">
      <section
        ref={viewerRef}
        className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-cyan-300/25 bg-[#050908] shadow-[0_0_40px_rgba(0,229,255,0.18)]"
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white">{activeShare.sharerName} is sharing</p>
            <p className="text-xs font-semibold text-cyan-200/70">{duration}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={enterFullscreen} aria-label="Fullscreen screen share">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close screen share viewer">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-black">
          <ScreenVideo streamRef={streamRef} streamVersion={streamVersion} muted={muted} />
        </div>
      </section>
    </div>
  );
};

export { ScreenVideo };
export default ScreenShareViewer;
