import type { FastifyInstance } from 'fastify';
import { getCurrentSeason, getProgress, claimReward, upgradeToPremium } from './progression.service.js';

export async function progressionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/season/current', {
    schema: { description: 'Get current season', tags: ['progression'] },
    handler: async (_request, reply) => {
      const data = await getCurrentSeason();
      return reply.send({ success: true, data });
    },
  });

  app.get('/season/progress', {
    schema: { description: 'Get battle pass progress', tags: ['progression'] },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const data = await getProgress(userId);
      return reply.send({ success: true, data });
    },
  });

  app.post<{ Params: { level: string } }>('/season/claim/:level', {
    schema: {
      description: 'Claim level reward', tags: ['progression'],
      params: { type: 'object', required: ['level'], properties: { level: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      await claimReward(userId, parseInt(request.params.level, 10));
      return reply.send({ success: true });
    },
  });

  app.post('/season/upgrade', {
    schema: { description: 'Upgrade to premium', tags: ['progression'] },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      await upgradeToPremium(userId);
      return reply.send({ success: true });
    },
  });
}
