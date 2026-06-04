import { Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../../utils/constants.js';
import { formatDuration } from './VoiceRecorder.jsx';

const getVoiceSrc = (voiceUrl = '') => {
  if (!voiceUrl) {
    return '';
  }

  if (/^https?:\/\//i.test(voiceUrl)) {
    return voiceUrl;
  }

  return `${API_URL.replace(/\/api\/?$/, '')}${voiceUrl}`;
};

const getSafeDuration = (value, fallback = 0) => {
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) {
    return Math.ceil(number);
  }

  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) && fallbackNumber > 0 ? Math.ceil(fallbackNumber) : 0;
};

const VoiceMessage = ({ message, isMine }) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(getSafeDuration(message.voiceDuration));
  const src = useMemo(() => getVoiceSrc(message.voiceUrl), [message.voiceUrl]);

  useEffect(() => {
    const pauseForAnother = (event) => {
      if (event.detail !== message._id && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    };

    window.addEventListener('codesync:voice-play', pauseForAnother);
    return () => window.removeEventListener('codesync:voice-play', pauseForAnother);
  }, [message._id]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !src) {
      return;
    }

    setError('');
    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      setLoading(true);
      window.dispatchEvent(new CustomEvent('codesync:voice-play', { detail: message._id }));
      await audio.play();
    } catch {
      setError('Playback failed');
    } finally {
      setLoading(false);
    }
  };

  const safeCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
  const progress = duration > 0 ? Math.min(100, (safeCurrentTime / duration) * 100) : 0;

  return (
    <div className={`voice-message ${isMine ? 'voice-message-mine' : 'voice-message-other'}`}>
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-white transition hover:bg-white/10"
        onClick={togglePlay}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="voice-message-main">
        <div className="voice-message-meta">
          <span className="voice-message-title">Voice note</span>
          <span className="voice-message-duration">
            {formatDuration(Math.floor(safeCurrentTime))} / {formatDuration(duration)}
          </span>
        </div>
        <div className="voice-message-progress">
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="voice-message-status">{loading ? 'Loading...' : error}</p>
      </div>
      <audio
        ref={audioRef}
        src={src}
        crossOrigin="use-credentials"
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onLoadedMetadata={(event) => setDuration(getSafeDuration(event.currentTarget.duration, message.voiceDuration))}
        onTimeUpdate={(event) => setCurrentTime(Number.isFinite(event.currentTarget.currentTime) ? event.currentTarget.currentTime : 0)}
        onError={() => {
          setLoading(false);
          setError('Playback failed');
        }}
      />
    </div>
  );
};

export default VoiceMessage;
