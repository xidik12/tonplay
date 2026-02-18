import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { createServer } from 'node:http';

import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis, redis } from './config/redis.js';
import { errorHandler } from './middleware/error-handler.js';
import { authPlugin } from './middleware/auth.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/user/user.routes.js';
import { gameRoutes } from './modules/game/game.routes.js';
import { leaderboardRoutes } from './modules/leaderboard/leaderboard.routes.js';
import { economyRoutes } from './modules/economy/economy.routes.js';
import { socialRoutes } from './modules/social/social.routes.js';
import { notificationRoutes } from './modules/notification/notification.routes.js';
import { walletRoutes } from './modules/wallet/wallet.routes.js';
import { clanRoutes } from './modules/clan/clan.routes.js';
import { nftRoutes } from './modules/nft/nft.routes.js';
import { tournamentRoutes } from './modules/tournament/tournament.routes.js';
import { progressionRoutes } from './modules/progression/progression.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { setupSocketIO } from './websocket/handler.js';
import { createScoreVerifyWorker } from './workers/score-verify.worker.js';
import { startSessionCleanup } from './workers/session-cleanup.worker.js';
import { startTournamentLifecycle } from './workers/tournament-lifecycle.worker.js';
import { cleanupExpiredLeaderboards } from './modules/leaderboard/leaderboard.service.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from './types/index.js';

async function main(): Promise<void> {
  // Create the HTTP server first so we can share it with Socket.IO
  const httpServer = createServer();

  // Create Fastify instance using the shared HTTP server
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    serverFactory: (handler) => {
      httpServer.on('request', handler);
      return httpServer;
    },
  });

  // ─── Global Plugins ─────────────────────────────────────────────────────────

  // CORS
  await app.register(cors, {
    origin: env.WEBAPP_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // JWT
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRY,
    },
  });

  // Rate Limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Use user ID if authenticated, otherwise IP
      return request.user?.userId ?? request.ip;
    },
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please slow down.',
      },
    }),
  });

  // ─── Custom Plugins ────────────────────────────────────────────────────────

  // Auth decorator (adds app.authenticate)
  await app.register(authPlugin);

  // ─── Error Handler ──────────────────────────────────────────────────────────

  app.setErrorHandler(errorHandler);

  // ─── Health Check ───────────────────────────────────────────────────────────

  app.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['system'],
    },
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      const redisOk = redis.status === 'ready';

      return reply.send({
        success: true,
        data: {
          status: 'ok',
          version: '0.1.0',
          uptime: process.uptime(),
          environment: env.NODE_ENV,
          services: {
            redis: redisOk ? 'connected' : 'disconnected',
            database: 'connected', // If we got here, DB is connected
          },
        },
      });
    },
  });

  // ─── Route Modules ─────────────────────────────────────────────────────────

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(gameRoutes);
  await app.register(leaderboardRoutes);
  await app.register(economyRoutes);
  await app.register(socialRoutes);
  await app.register(notificationRoutes);
  await app.register(walletRoutes);
  await app.register(clanRoutes);
  await app.register(nftRoutes);
  await app.register(tournamentRoutes);
  await app.register(progressionRoutes);
  await app.register(adminRoutes);

  // ─── Connect Services ──────────────────────────────────────────────────────

  console.log('Connecting to database...');
  await connectDatabase();

  console.log('Connecting to Redis...');
  await connectRedis();

  // ─── Socket.IO ──────────────────────────────────────────────────────────────

  const jwtVerify = async (token: string): Promise<JwtPayload> => {
    return app.jwt.verify<JwtPayload>(token);
  };

  setupSocketIO(httpServer, jwtVerify);

  // ─── Workers ────────────────────────────────────────────────────────────────

  const scoreVerifyWorker = createScoreVerifyWorker();

  // ─── Session Cleanup ──────────────────────────────────────────────────────────

  const cleanupTimer = startSessionCleanup();

  // ─── Tournament Lifecycle ───────────────────────────────────────────────────

  const tournamentTimer = startTournamentLifecycle();

  // ─── Leaderboard Cleanup (every 6 hours) ────────────────────────────────────

  const leaderboardCleanupTimer = setInterval(async () => {
    try {
      const removed = await cleanupExpiredLeaderboards();
      if (removed > 0) console.log(`[LeaderboardCleanup] Removed ${removed} expired entries`);
    } catch (err) {
      console.error('[LeaderboardCleanup] Error:', err);
    }
  }, 6 * 60 * 60 * 1000);

  // ─── Start Server ───────────────────────────────────────────────────────────

  await app.listen({
    port: env.API_PORT,
    host: env.API_HOST,
  });

  console.log(`TONPLAY API server running on http://${env.API_HOST}:${env.API_PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    try {
      // Stop cleanup timers
      clearInterval(cleanupTimer);
      clearInterval(leaderboardCleanupTimer);
      clearInterval(tournamentTimer);
      console.log('Cleanup timers stopped');

      // Close the score verification worker
      await scoreVerifyWorker.close();
      console.log('Score verify worker closed');

      // Close Fastify (HTTP server)
      await app.close();
      console.log('HTTP server closed');

      // Disconnect from services
      await disconnectRedis();
      await disconnectDatabase();

      console.log('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    shutdown('uncaughtException');
  });
}

main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
