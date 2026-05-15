import { Server as HTTPServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWTPayload, MemberStatusPayload } from '../types.js';
import { query } from '../db.js';

export function initSocket(server: HTTPServer): Server {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:4001',
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET!,
      ) as JWTPayload;
      socket.data.user = payload;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const { sub: userId, workspace_id: workspaceId } = socket.data.user as JWTPayload;

    socket.join(`workspace:${workspaceId}`);
    socket.join(`user:${userId}`);

    console.log(`User ${userId} connected to workspace ${workspaceId}`);

    socket.on('status_update', async ({ status }: { status: 'active' | 'away' }) => {
      try {
        await query(`UPDATE users SET status = $1 WHERE id = $2`, [
          status,
          userId,
        ]);

        const payload: MemberStatusPayload = {
          user_id: userId,
          status,
        };

        io.to(`workspace:${workspaceId}`).emit('member:status', payload);
      } catch (error) {
        console.error('Error updating status:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected from workspace ${workspaceId}`);
    });
  });

  return io;
}
