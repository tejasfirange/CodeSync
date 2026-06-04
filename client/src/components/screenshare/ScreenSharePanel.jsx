import { ChevronDown, ChevronUp, Maximize2, MonitorUp, ScreenShareOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getInitials } from '../../utils/constants.js';
import Button from '../common/Button.jsx';
import ScreenShareViewer, { ScreenVideo } from './ScreenShareViewer.jsx';

const formatDuration = (startedAt, now) => {
  if (!startedAt) {
    return '00:00';
  }

  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const ScreenSharePanel = ({
  activeShare,
  status,
  error,
  isSharing,
  localStreamRef,
  remoteStreamRef,
  localStreamVersion,
  remoteStreamVersion,
  onStop
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const previewRef = useRef(null);
  const previewVideoRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!activeShare) {
    return null;
  }

  const duration = formatDuration(activeShare.startedAt, now);
  const streamRef = isSharing ? localStreamRef : remoteStreamRef;
  const streamVersion = isSharing ? localStreamVersion : remoteStreamVersion;
  const title = isSharing ? 'You are sharing your screen' : `${activeShare.sharerName} is sharing`;
  const connected = isSharing || status === 'connected';

  const enterPreviewFullscreen = async () => {
    const video = previewVideoRef.current;
    if (!video) {
      setViewerOpen(true);
      return;
    }

    await video.play?.().catch(() => {});
    video.requestFullscreen?.();
  };

  return (
    <section className="screen-share-card shrink-0 border-b border-cyan-300/20 bg-[#07100f]">
      <div className="flex h-11 items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white shadow-[0_0_18px_rgba(0,229,255,0.18)]"
            style={{ backgroundColor: isSharing ? '#0891b2' : '#0f766e' }}
          >
            {getInitials(activeShare.sharerName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-black uppercase tracking-[0.14em] text-cyan-200">Screen Share</p>
            <p className="truncate text-xs font-semibold text-neutral-400">{title} · {duration}</p>
          </div>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-white/10 hover:text-white"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Maximize screen share panel' : 'Minimize screen share panel'}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed ? (
        <div className="space-y-3 px-3 pb-3">
          <div ref={previewRef} className="relative aspect-video overflow-hidden rounded-lg border border-cyan-300/20 bg-black">
            {connected ? (
              <ScreenVideo streamRef={streamRef} streamVersion={streamVersion} muted={isSharing} videoRef={previewVideoRef} />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm font-semibold text-neutral-500">
                {status === 'failed' ? error || 'WebRTC connection failed.' : 'Connecting viewer...'}
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/65 to-transparent" />
            <span className="absolute left-2 top-2 rounded border border-cyan-300/25 bg-black/55 px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-cyan-100">
              {isSharing ? 'Live local preview' : status === 'connected' ? 'Live' : 'Connecting'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" icon={MonitorUp} onClick={() => setViewerOpen(true)}>
              Open large view
            </Button>
            <Button variant="ghost" size="sm" icon={Maximize2} onClick={enterPreviewFullscreen}>
              Fullscreen
            </Button>
            {isSharing ? (
              <Button variant="danger" size="sm" icon={ScreenShareOff} onClick={() => onStop?.()}>
                Stop Sharing
              </Button>
            ) : null}
          </div>

          {error ? <p className="rounded border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">{error}</p> : null}
        </div>
      ) : null}

      <ScreenShareViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        activeShare={activeShare}
        duration={duration}
        streamRef={streamRef}
        streamVersion={streamVersion}
        muted={isSharing}
      />
    </section>
  );
};

export default ScreenSharePanel;
