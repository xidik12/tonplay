import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listGames,
  startSession,
  activateSession,
  completeSession,
  getSessionDetails,
  listUserSessions,
  abandonSession,
} from './game.service.js';

const startSessionSchema = z.object({
  gameSlug: z.string().min(1, 'gameSlug is required'),
  wagerAmount: z.number().int().positive('wagerAmount must be a positive integer'),
  wagerCurrency: z.enum(['TICKET', 'TPLAY']).default('TICKET'),
});

const activateSessionSchema = z.object({
  clientSeed: z.string().min(1, 'clientSeed is required').max(128),
});

const completeSessionSchema = z.object({
  score: z.number().int().min(0, 'score must be non-negative'),
  replayData: z.string().optional(), // Base64 encoded replay data
  replayHash: z.string().optional(),
  duration: z.number().int().min(0).optional(),
});

export async function gameRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /games
   * List all enabled games. Public endpoint (no auth required).
   */
  app.get('/games', {
    schema: {
      description: 'List all enabled games',
      tags: ['game'],
    },
    handler: async (_request, reply) => {
      const games = await listGames();

      return reply.send({
        success: true,
        data: games,
      });
    },
  });

  /**
   * POST /game/session/start
   * Start a new game session. Requires authentication.
   */
  app.post('/game/session/start', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Start a new game session with a wager',
      tags: ['game'],
      body: {
        type: 'object',
        required: ['gameSlug', 'wagerAmount'],
        properties: {
          gameSlug: { type: 'string' },
          wagerAmount: { type: 'number' },
          wagerCurrency: { type: 'string', enum: ['TICKET', 'TPLAY'] },
        },
      },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const body = startSessionSchema.parse(request.body);

      const result = await startSession(
        userId,
        body.gameSlug,
        body.wagerAmount,
        body.wagerCurrency
      );

      return reply.status(201).send({
        success: true,
        data: result,
      });
    },
  });

  /**
   * POST /game/session/:id/activate
   * Client sends their seed to activate the session.
   */
  app.post<{ Params: { id: string } }>('/game/session/:id/activate', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Activate a pending session with client seed',
      tags: ['game'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['clientSeed'],
        properties: { clientSeed: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const { id } = request.params;
      const body = activateSessionSchema.parse(request.body);

      const result = await activateSession(userId, id, body.clientSeed);

      return reply.send({
        success: true,
        data: result,
      });
    },
  });

  /**
   * POST /game/session/:id/complete
   * Submit the score and optional replay data.
   */
  app.post<{ Params: { id: string } }>('/game/session/:id/complete', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Complete a game session with score submission',
      tags: ['game'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['score'],
        properties: {
          score: { type: 'number' },
          replayData: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const { id } = request.params;
      const body = completeSessionSchema.parse(request.body);

      // Decode base64 replay data if provided
      const replayBuffer = body.replayData
        ? Buffer.from(body.replayData, 'base64')
        : undefined;

      const result = await completeSession(userId, id, body.score, replayBuffer);

      return reply.send({
        success: true,
        data: result,
      });
    },
  });

  /**
   * GET /game/session/:id
   * Get session details (reveals server seed only after verification).
   */
  app.get<{ Params: { id: string } }>('/game/session/:id', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Get game session details',
      tags: ['game'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const { id } = request.params;

      const session = await getSessionDetails(userId, id);

      return reply.send({
        success: true,
        data: session,
      });
    },
  });

  /**
   * GET /game/sessions
   * List recent game sessions for the authenticated user.
   */
  app.get<{ Querystring: Record<string, string> }>('/game/sessions', {
    preHandler: [app.authenticate],
    schema: {
      description: 'List recent game sessions',
      tags: ['game'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
        },
      },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const limit = parseInt((request.query as Record<string, string>).limit ?? '10', 10);

      const sessions = await listUserSessions(userId, limit);

      return reply.send({
        success: true,
        data: sessions,
      });
    },
  });

  /**
   * POST /game/session/:id/abandon
   * Abandon a pending or active session and refund the wager.
   */
  app.post<{ Params: { id: string } }>('/game/session/:id/abandon', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Abandon a game session',
      tags: ['game'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const { id } = request.params;

      const result = await abandonSession(userId, id);

      return reply.send({
        success: true,
        data: result,
      });
    },
  });
}
