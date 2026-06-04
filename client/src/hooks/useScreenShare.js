import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SOCKET_EVENTS } from '../socket/socketEvents.js';

const peerConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

const captureOptions = {
  video: {
    frameRate: 15,
    width: { max: 1920 },
    height: { max: 1080 }
  },
  audio: false
};

const getUserMediaErrorMessage = (error) => {
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return 'Screen sharing permission was denied.';
  }

  return error?.message || 'Unable to start screen sharing.';
};

const canShareFromRole = (permissions, roomSettings) =>
  permissions?.role === 'owner' ||
  (permissions?.role === 'editor' && roomSettings?.allowScreenShare) ||
  (permissions?.role === 'viewer' && roomSettings?.allowViewersToScreenShare);

const useScreenShare = ({ socket, roomId, currentUser, permissions, roomSettings, onNotice }) => {
  const [activeShare, setActiveShare] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [localStreamVersion, setLocalStreamVersion] = useState(0);
  const [remoteStreamVersion, setRemoteStreamVersion] = useState(0);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const statusRef = useRef(status);
  const activeShareRef = useRef(activeShare);
  const startingRef = useRef(false);

  const isSharing = activeShare?.sharerUserId === currentUser?._id;
  const isViewing = Boolean(activeShare && !isSharing);
  const canShare = useMemo(() => canShareFromRole(permissions, roomSettings), [permissions, roomSettings]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    activeShareRef.current = activeShare;
  }, [activeShare]);

  const notify = useCallback(
    (message) => {
      if (message) {
        onNotice?.(message);
      }
    },
    [onNotice]
  );

  const closePeer = useCallback((socketId) => {
    const peer = peersRef.current.get(socketId);
    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.close();
      peersRef.current.delete(socketId);
    }
  }, []);

  const closeAllPeers = useCallback(() => {
    peersRef.current.forEach((peer) => {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.close();
    });
    peersRef.current.clear();
  }, []);

  const stopLocalTracks = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    localStreamRef.current = null;
    setLocalStreamVersion((value) => value + 1);
  }, []);

  const clearRemoteStream = useCallback(() => {
    remoteStreamRef.current = null;
    setRemoteStreamVersion((value) => value + 1);
  }, []);

  const cleanupViewer = useCallback(
    (emitLeave = true) => {
      if (emitLeave && activeShareRef.current && socket?.connected) {
        socket.emit(SOCKET_EVENTS.SCREEN_USER_LEFT_VIEWER, { roomId });
      }
      closeAllPeers();
      clearRemoteStream();
      if (statusRef.current !== 'idle') {
        setStatus('idle');
      }
    },
    [clearRemoteStream, closeAllPeers, roomId, socket]
  );

  const stopSharing = useCallback(
    (emitStop = true) => {
      if (emitStop && socket?.connected) {
        socket.emit(SOCKET_EVENTS.SCREEN_STOP, { roomId });
      }
      closeAllPeers();
      stopLocalTracks();
      setStatus('idle');
    },
    [closeAllPeers, roomId, socket, stopLocalTracks]
  );

  const makePeerConnection = useCallback(
    (socketId, mode) => {
      closePeer(socketId);
      const peer = new RTCPeerConnection(peerConfig);

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, {
            roomId,
            to: socketId,
            candidate: event.candidate
          });
        }
      };

      peer.onconnectionstatechange = () => {
        if (['failed', 'disconnected'].includes(peer.connectionState)) {
          if (mode === 'viewer') {
            setStatus('failed');
            setError('WebRTC connection failed.');
            notify('WebRTC connection failed.');
          }
        }
      };

      if (mode === 'viewer') {
        peer.ontrack = (event) => {
          const [stream] = event.streams;
          if (stream) {
            remoteStreamRef.current = stream;
            setRemoteStreamVersion((value) => value + 1);
            setStatus('connected');
            setError('');
          }
        };
      }

      peersRef.current.set(socketId, peer);
      return peer;
    },
    [closePeer, notify, roomId, socket]
  );

  const createOfferForViewer = useCallback(
    async (viewerSocketId) => {
      if (!localStreamRef.current || !viewerSocketId) {
        return;
      }

      try {
        const peer = makePeerConnection(viewerSocketId, 'sharer');
        localStreamRef.current.getTracks().forEach((track) => peer.addTrack(track, localStreamRef.current));
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit(SOCKET_EVENTS.WEBRTC_OFFER, {
          roomId,
          to: viewerSocketId,
          offer
        });
      } catch (offerError) {
        console.error('Screen share offer failed:', offerError);
        notify('Unable to connect a screen viewer.');
      }
    },
    [makePeerConnection, notify, roomId, socket]
  );

  const startSharing = useCallback(async () => {
    if (startingRef.current || isSharing) {
      return;
    }

    setError('');
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Screen sharing is not supported in this browser.');
      notify('Screen sharing is not supported in this browser.');
      return;
    }

    if (!canShare) {
      setError('Screen sharing is disabled by the room owner.');
      notify('Screen sharing is disabled by the room owner.');
      return;
    }

    if (activeShareRef.current && activeShareRef.current.sharerUserId !== currentUser?._id) {
      notify(`${activeShareRef.current.sharerName} is currently sharing their screen.`);
      return;
    }

    startingRef.current = true;
    setStatus('starting');

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(captureOptions);
      localStreamRef.current = stream;
      setLocalStreamVersion((value) => value + 1);

      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          stopSharing(true);
        };
      });

      socket.emit(SOCKET_EVENTS.SCREEN_START, { roomId }, (ack) => {
        if (!ack?.success) {
          stopLocalTracks();
          setStatus('idle');
          setError(ack?.message || 'Unable to start screen sharing.');
          notify(ack?.message || 'Unable to start screen sharing.');
          return;
        }

        setActiveShare(ack.activeShare);
        setStatus('sharing');
      });
    } catch (captureError) {
      const message = getUserMediaErrorMessage(captureError);
      setError(message);
      setStatus('idle');
      notify(message);
    } finally {
      startingRef.current = false;
    }
  }, [canShare, currentUser?._id, isSharing, notify, roomId, socket, stopLocalTracks, stopSharing]);

  useEffect(() => {
    if (!socket || !roomId) {
      return undefined;
    }

    const handleActiveShare = ({ roomId: incomingRoomId, activeShare: nextShare }) => {
      if (incomingRoomId !== roomId) {
        return;
      }

      const previousShare = activeShareRef.current;
      setActiveShare(nextShare || null);

      if (!nextShare) {
        if (previousShare?.sharerUserId === currentUser?._id) {
          stopSharing(false);
        } else {
          cleanupViewer(false);
        }
        setStatus('idle');
        return;
      }

      if (nextShare.sharerUserId === currentUser?._id) {
        setStatus(localStreamRef.current ? 'sharing' : 'idle');
        return;
      }

      if (previousShare?.sharerSocketId !== nextShare.sharerSocketId) {
        cleanupViewer(false);
        setStatus('connecting');
        socket.emit(SOCKET_EVENTS.SCREEN_USER_JOINED_VIEWER, { roomId });
      }
    };

    const handleViewerJoined = ({ roomId: incomingRoomId, viewerSocketId }) => {
      if (incomingRoomId === roomId && activeShareRef.current?.sharerUserId === currentUser?._id) {
        createOfferForViewer(viewerSocketId);
      }
    };

    const handleViewerLeft = ({ roomId: incomingRoomId, viewerSocketId }) => {
      if (incomingRoomId === roomId) {
        closePeer(viewerSocketId);
      }
    };

    const handleOffer = async ({ roomId: incomingRoomId, from, offer }) => {
      if (incomingRoomId !== roomId || !offer || activeShareRef.current?.sharerSocketId !== from) {
        return;
      }

      try {
        setStatus('connecting');
        const peer = makePeerConnection(from, 'viewer');
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit(SOCKET_EVENTS.WEBRTC_ANSWER, { roomId, to: from, answer });
      } catch (answerError) {
        console.error('Screen share answer failed:', answerError);
        setStatus('failed');
        setError('WebRTC connection failed.');
        notify('WebRTC connection failed.');
      }
    };

    const handleAnswer = async ({ roomId: incomingRoomId, from, answer }) => {
      if (incomingRoomId !== roomId || !answer) {
        return;
      }

      const peer = peersRef.current.get(from);
      if (!peer) {
        return;
      }

      try {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (answerError) {
        console.error('Screen share remote answer failed:', answerError);
      }
    };

    const handleIceCandidate = async ({ roomId: incomingRoomId, from, candidate }) => {
      if (incomingRoomId !== roomId || !candidate) {
        return;
      }

      const peer = peersRef.current.get(from);
      if (!peer) {
        return;
      }

      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (iceError) {
        console.error('Screen share ICE failed:', iceError);
      }
    };

    const handleScreenStop = ({ roomId: incomingRoomId }) => {
      if (incomingRoomId !== roomId) {
        return;
      }

      if (activeShareRef.current?.sharerUserId === currentUser?._id) {
        stopSharing(false);
      } else {
        cleanupViewer(false);
      }
      setActiveShare(null);
      setStatus('idle');
    };

    socket.on(SOCKET_EVENTS.SCREEN_ACTIVE, handleActiveShare);
    socket.on(SOCKET_EVENTS.SCREEN_STOP, handleScreenStop);
    socket.on(SOCKET_EVENTS.SCREEN_USER_JOINED_VIEWER, handleViewerJoined);
    socket.on(SOCKET_EVENTS.SCREEN_USER_LEFT_VIEWER, handleViewerLeft);
    socket.on(SOCKET_EVENTS.WEBRTC_OFFER, handleOffer);
    socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, handleAnswer);
    socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, handleIceCandidate);

    return () => {
      socket.off(SOCKET_EVENTS.SCREEN_ACTIVE, handleActiveShare);
      socket.off(SOCKET_EVENTS.SCREEN_STOP, handleScreenStop);
      socket.off(SOCKET_EVENTS.SCREEN_USER_JOINED_VIEWER, handleViewerJoined);
      socket.off(SOCKET_EVENTS.SCREEN_USER_LEFT_VIEWER, handleViewerLeft);
      socket.off(SOCKET_EVENTS.WEBRTC_OFFER, handleOffer);
      socket.off(SOCKET_EVENTS.WEBRTC_ANSWER, handleAnswer);
      socket.off(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, handleIceCandidate);
    };
  }, [cleanupViewer, closePeer, createOfferForViewer, currentUser?._id, makePeerConnection, notify, roomId, socket, stopSharing]);

  useEffect(
    () => () => {
      if (activeShareRef.current?.sharerUserId === currentUser?._id) {
        stopSharing(true);
      } else {
        cleanupViewer(true);
      }
    },
    [cleanupViewer, currentUser?._id, stopSharing]
  );

  return {
    activeShare,
    status,
    error,
    isSharing,
    isViewing,
    canShare,
    localStreamRef,
    remoteStreamRef,
    localStreamVersion,
    remoteStreamVersion,
    startSharing,
    stopSharing
  };
};

export default useScreenShare;
