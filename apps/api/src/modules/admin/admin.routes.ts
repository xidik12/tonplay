import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { isAdmin, banUser, unbanUser, createTournament, createSeason, getSystemStats, listUsers } from './admin.service.js';

const adminGuard = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  if (!request.user?.userId || !isAdmin(request.user.userId)) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
  }
};

const createTournamentSchema = z.object({
  name: z.string().min(1).max(100),
  gameId: z.string().min(1),
  format: z.string().default('HIGH_SCORE'),
  entryFee: z.number().int().min(0).default(0),
  entryCurrency: z.enum(['TICKET', 'TPLAY']).default('TICKET'),
  maxEntries: z.number().int().min(2).max(10000).default(100),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

const createSeasonSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  premiumPrice: z.number().int().min(0).default(500),
  maxLevel: z.number().int().min(1).max(200).default(50),
  rewards: z.array(z.object({
    level: z.number().int().min(1),
    rewardType: z.string(),
    rewardAmount: z.number().int().positive(),
    isPremium: z.boolean().default(false),
  })).default([]),
});

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', adminGuard);

  app.post<{ Params: { id: string } }>('/admin/user/:id/ban', {
    schema: {
      description: 'Ban a user', tags: ['admin'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      await banUser(request.params.id);
      return reply.send({ success: true });
    },
  });

  app.post<{ Params: { id: string } }>('/admin/user/:id/unban', {
    schema: {
      description: 'Unban a user', tags: ['admin'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      await unbanUser(request.params.id);
      return reply.send({ success: true });
    },
  });

  app.get('/admin/users', {
    schema: { description: 'List users', tags: ['admin'] },
    handler: async (request, reply) => {
      const query = request.query as { limit?: string; offset?: string };
      const data = await listUsers(
        parseInt(query.limit ?? '20', 10),
        parseInt(query.offset ?? '0', 10),
      );
      return reply.send({ success: true, data });
    },
  });

  app.post('/admin/tournament', {
    schema: { description: 'Create tournament', tags: ['admin'] },
    handler: async (request, reply) => {
      const body = createTournamentSchema.parse(request.body);
      const data = await createTournament({
        ...body,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
      });
      return reply.send({ success: true, data });
    },
  });

  app.post('/admin/season', {
    schema: { description: 'Create season', tags: ['admin'] },
    handler: async (request, reply) => {
      const body = createSeasonSchema.parse(request.body);
      const data = await createSeason({
        ...body,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
      });
      return reply.send({ success: true, data });
    },
  });

  app.get('/admin/stats', {
    schema: { description: 'Platform statistics', tags: ['admin'] },
    handler: async (_request, reply) => {
      const data = await getSystemStats();
      return reply.send({ success: true, data });
    },
  });
}
