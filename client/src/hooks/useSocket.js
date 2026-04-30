import { useEffect, useMemo, useState } from 'react';
import { getSocket } from '../socket/socket.js';
import { useAuthStore } from '../store/auth.store.js';
import { SOCKET_URL } from '../utils/constants.js';

const useSocket = () => {
  const user = useAuthStore((state) => state.user);
  const socket = useMemo(() => getSocket(), []);
  const [connected, setConnected] = useState(socket.connected);
  const [pingMs, setPingMs] = useState(null);

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (user && !socket.connected) {
      socket.connect();
    }

    if (!user && socket.connected) {
      socket.disconnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, user]);

  useEffect(() => {
    if (!connected) {
      setPingMs(null);
      return undefined;
    }

    let cancelled = false;
    let timer;

    const measurePing = async () => {
      const startedAt = performance.now();
      try {
        await fetch(`${SOCKET_URL}/health`, {
          cache: 'no-store',
          credentials: 'include'
        });

        if (!cancelled) {
          setPingMs(Math.max(1, Math.round(performance.now() - startedAt)));
        }
      } catch {
        if (!cancelled) {
          setPingMs(null);
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(measurePing, 10000);
        }
      }
    };

    measurePing();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [connected]);

  return { socket, connected, pingMs };
};

export default useSocket;
