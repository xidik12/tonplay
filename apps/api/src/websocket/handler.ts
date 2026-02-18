import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { JwtPayload, SocketData } from '../types/index.js';
import { env } from '../config/env.js';

let io: SocketIOServer | null = null;

/**
 * Initializes the Socket.IO server and attaches it to the given HTTP server.
 * Handles JWT authentication during handshake, and manages rooms for
 * game-specific and global leaderboard subscriptions.
 */
export function setupSocketIO(
  httpServer: HttpServer,
  jwtVerify: (token: string) => Promise<JwtPayload>
): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.WEBAPP_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 30_000,
    pingInterval: 10_000,
    transports: ['websocket', 'polling'],
    path: '/ws',
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = await jwtVerify(token);
      (socket.data as SocketData) = {
        userId: payload.userId,
        telegramId: payload.telegramId,
      };

      next();
    } catch {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const data = socket.data as SocketData;
    console.log(`[WS] User ${data.userId} connected (socket: ${socket.id})`);

    // Join personal room for targeted notifications
    socket.join(`user:${data.userId}`);

    // Join global room
    socket.join('global');

    /**
     * Subscribe to a game-specific leaderboard channel.
     * Client sends: { gameSlug: string, period?: 'global' | 'daily' | 'weekly' }
     */
    socket.on('leaderboard:subscribe', (payload: { gameSlug: string; period?: string }) => {
      const { gameSlug, period = 'global' } = payload;

      if (!gameSlug || typeof gameSlug !== 'string') {
        socket.emit('error', { message: 'Invalid gameSlug' });
        return;
      }

      const room = `leaderboard:${gameSlug}:${period}`;
      socket.join(room);
      console.log(`[WS] User ${data.userId} subscribed to ${room}`);
    });

    /**
     * Unsubscribe from a game leaderboard channel.
     */
    socket.on('leaderboard:unsubscribe', (payload: { gameSlug: string; period?: string }) => {
      const { gameSlug, period = 'global' } = payload;
      const room = `leaderboard:${gameSlug}:${period}`;
      socket.leave(room);
      console.log(`[WS] User ${data.userId} unsubscribed from ${room}`);
    });

    /**
     * Subscribe to tournament updates.
     */
    socket.on('tournament:subscribe', (payload: { tournamentId: string }) => {
      const { tournamentId } = payload;

      if (!tournamentId || typeof tournamentId !== 'string') {
        socket.emit('error', { message: 'Invalid tournamentId' });
        return;
      }

      const room = `tournament:${tournamentId}`;
      socket.join(room);
      console.log(`[WS] User ${data.userId} subscribed to ${room}`);
    });

    socket.on('tournament:unsubscribe', (payload: { tournamentId: string }) => {
      const room = `tournament:${payload.tournamentId}`;
      socket.leave(room);
    });

    /**
     * Ping/pong for connection health.
     */
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[WS] User ${data.userId} disconnected (reason: ${reason})`);
    });

    socket.on('error', (err) => {
      console.error(`[WS] Socket error for user ${data.userId}:`, err.message);
    });
  });

  console.log('[WS] Socket.IO server initialized');

  return io;
}

/**
 * Returns the Socket.IO server instance.
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO server not initialized. Call setupSocketIO first.');
  }
  return io;
}

/**
 * Emits a leaderboard update event to all subscribers of a specific leaderboard.
 */
export function emitLeaderboardUpdate(
  gameSlug: string,
  period: string,
  data: {
    userId: string;
    username: string | null;
    score: number;
    rank: number;
  }
): void {
  if (!io) return;

  const room = `leaderboard:${gameSlug}:${period}`;
  io.to(room).emit('leaderboard:update', {
    gameSlug,
    period,
    entry: data,
    timestamp: Date.now(),
  });
}

/**
 * Emits a session verified event to the session owner.
 */
export function emitSessionVerified(
  userId: string,
  data: {
    sessionId: string;
    status: string;
    score: number;
    rewards: unknown;
    verificationScore: number;
  }
): void {
  if (!io) return;

  io.to(`user:${userId}`).emit('game:verified', {
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * Emits a notification event to a specific user.
 */
export function emitNotification(
  userId: string,
  notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    data?: unknown;
  }
): void {
  if (!io) return;

  io.to(`user:${userId}`).emit('notification', {
    ...notification,
    timestamp: Date.now(),
  });
}

/**
 * Emits a balance update event to a specific user.
 */
export function emitBalanceUpdate(
  userId: string,
  data: {
    ticketBalance: number;
    tplayBalance: string;
    change: {
      currency: string;
      amount: number;
      direction: string;
      reason: string;
    };
  }
): void {
  if (!io) return;

  io.to(`user:${userId}`).emit('balance:update', {
    ...data,
    timestamp: Date.now(),
  });
}

/**
 * Emits a tournament update event to all subscribers.
 */
export function emitTournamentUpdate(
  tournamentId: string,
  data: {
    status?: string;
    leaderboard?: Array<{ userId: string; score: number; rank: number }>;
    message?: string;
  }
): void {
  if (!io) return;

  io.to(`tournament:${tournamentId}`).emit('tournament:update', {
    tournamentId,
    ...data,
    timestamp: Date.now(),
  });
}
