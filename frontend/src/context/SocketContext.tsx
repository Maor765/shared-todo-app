import React, { createContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

export interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

export const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!auth.token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const newSocket = io(apiUrl, {
      auth: {
        token: auth.token,
      },
      // No reconnectionAttempts cap: Render free-tier cold starts can take ~30s
      // to respond, and a 5-attempt cap (~15s) gives up before that, leaving the
      // tab permanently unable to receive other users' live updates until reload.
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [auth.token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}
