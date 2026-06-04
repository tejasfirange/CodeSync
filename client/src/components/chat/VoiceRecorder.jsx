import { Mic, RotateCcw, Send, Square, Trash2, X } from 'lucide-react';
import { useEffect } from 'react';
import useVoiceRecorder from '../../hooks/useVoiceRecorder.js';
import Button from '../common/Button.jsx';

const formatDuration = (seconds = 0) => {
  const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const WaveBars = () => (
  <div className="flex h-8 items-center gap-1" aria-hidden="true">
    {Array.from({ length: 14 }).map((_, index) => (
      <span
        key={index}
        className="voice-wave-bar block w-1 rounded-full bg-emerald-300"
        style={{ animationDelay: `${index * 70}ms` }}
      />
    ))}
  </div>
);

const VoiceRecorder = ({ disabled, sending, onSend, onNotice, onStateChange }) => {
  const recorder = useVoiceRecorder({ onNotice });

  useEffect(() => {
    onStateChange?.(recorder.state);
  }, [onStateChange, recorder.state]);

  const sendPreview = async () => {
    if (!recorder.blob || sending) {
      return;
    }

    try {
      await onSend?.({
        blob: recorder.blob,
        duration: recorder.duration
      });
      recorder.reset();
    } catch {
      // Keep the preview so the user can retry or cancel after an upload failure.
    }
  };

  if (recorder.state === 'recording') {
    return (
      <div className="voice-recorder-panel">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400 shadow-[0_0_16px_rgba(251,113,133,0.75)]" />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-200">Recording</p>
            <p className="text-sm font-black text-white">{formatDuration(recorder.elapsed)}</p>
          </div>
          <WaveBars />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" icon={Square} onClick={recorder.stopRecording}>
            Stop
          </Button>
          <Button variant="ghost" size="icon" onClick={recorder.cancelRecording} aria-label="Cancel recording">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (recorder.state === 'preview') {
    return (
      <div className="voice-recorder-panel">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">Voice preview · {formatDuration(recorder.duration)}</p>
          <audio className="h-9 w-full" src={recorder.previewUrl} controls preload="metadata" />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" icon={Send} onClick={sendPreview} disabled={sending}>
            {sending ? 'Sending' : 'Send'}
          </Button>
          <Button variant="secondary" size="sm" icon={RotateCcw} onClick={recorder.startRecording} disabled={sending}>
            Re-record
          </Button>
          <Button variant="ghost" size="icon" onClick={recorder.reset} disabled={sending} aria-label="Cancel voice note">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={recorder.startRecording}
      disabled={disabled || sending}
      title={recorder.supported ? 'Record voice note' : 'Voice recording is not supported in this browser.'}
      aria-label="Record voice note"
    >
      <Mic className="h-4 w-4" />
    </button>
  );
};

export { formatDuration };
export default VoiceRecorder;
