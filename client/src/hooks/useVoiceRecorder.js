import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const maxDurationSeconds = 60;
const maxFileSize = 5 * 1024 * 1024;

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }

  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }

  return '';
};

const getRecorderError = (error) => {
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'Microphone permission was denied.';
  }

  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'No microphone was found.';
  }

  return error?.message || 'Unable to record voice note.';
};

const useVoiceRecorder = ({ onNotice } = {}) => {
  const [state, setState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const stopReasonRef = useRef('preview');
  const previewUrlRef = useRef('');

  const supported = useMemo(() => Boolean(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined' && getSupportedMimeType()), []);

  const notify = useCallback(
    (message) => {
      if (message) {
        onNotice?.(message);
      }
    },
    [onNotice]
  );

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
    }
  }, []);

  const reset = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      stopReasonRef.current = 'cancel';
      mediaRecorderRef.current.stop();
    }
    window.clearInterval(timerRef.current);
    stopTracks();
    revokePreviewUrl();
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setBlob(null);
    setPreviewUrl('');
    setDuration(0);
    setElapsed(0);
    setError('');
    setState('idle');
  }, [revokePreviewUrl, stopTracks]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      stopReasonRef.current = 'preview';
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    stopReasonRef.current = 'cancel';
    reset();
  }, [reset]);

  const startRecording = useCallback(async () => {
    setError('');
    if (!supported) {
      const message = 'Voice recording is not supported in this browser.';
      setError(message);
      notify(message);
      return;
    }

    reset();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      stopReasonRef.current = 'preview';

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        window.clearInterval(timerRef.current);
        stopTracks();

        if (stopReasonRef.current === 'cancel') {
          chunksRef.current = [];
          setState('idle');
          setElapsed(0);
          return;
        }

        const recordedBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const recordedDuration = Math.min(maxDurationSeconds, Math.max(1, Math.ceil((Date.now() - startedAtRef.current) / 1000)));
        chunksRef.current = [];

        if (recordedBlob.size > maxFileSize) {
          const message = 'Voice note is larger than 5 MB.';
          setError(message);
          notify(message);
          setState('idle');
          return;
        }

        revokePreviewUrl();
        const url = URL.createObjectURL(recordedBlob);
        previewUrlRef.current = url;
        setBlob(recordedBlob);
        setPreviewUrl(url);
        setDuration(recordedDuration);
        setElapsed(recordedDuration);
        setState('preview');
      };

      recorder.onerror = () => {
        const message = 'Recording failed.';
        setError(message);
        notify(message);
        reset();
      };

      startedAtRef.current = Date.now();
      setElapsed(0);
      setState('recording');
      recorder.start(1000);
      timerRef.current = window.setInterval(() => {
        const nextElapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(nextElapsed);
        if (nextElapsed >= maxDurationSeconds && mediaRecorderRef.current?.state === 'recording') {
          notify('Voice note reached the 60 second limit.');
          stopRecording();
        }
      }, 250);
    } catch (recordError) {
      const message = getRecorderError(recordError);
      setError(message);
      notify(message);
      reset();
    }
  }, [notify, reset, revokePreviewUrl, stopRecording, stopTracks, supported]);

  useEffect(() => reset, [reset]);

  return {
    state,
    elapsed,
    blob,
    previewUrl,
    duration,
    error,
    supported,
    maxDurationSeconds,
    startRecording,
    stopRecording,
    cancelRecording,
    reset
  };
};

export default useVoiceRecorder;
