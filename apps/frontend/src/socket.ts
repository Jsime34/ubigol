import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(token: string) {
  if (socket?.connected) return;
  const url = import.meta.env.VITE_API_URL;
  socket = url ? io(url, { auth: { token } }) : io({ auth: { token } });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
