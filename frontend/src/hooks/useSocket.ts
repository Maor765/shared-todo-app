import { useContext, useEffect } from 'react';
import { SocketContext } from '../context/SocketContext';

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSocketEvent(event: string, handler: (payload: any) => void) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
}
