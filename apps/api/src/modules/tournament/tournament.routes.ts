import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listTournaments, getTournament, joinTournament, submitTournamentScore } from './tournament.service.js';

const submitScoreSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
});

export async function tournamentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/tournaments', {
    schema: { description: 'List tournaments', tags: ['tournament'] },
    handler: async (request, reply) => {
      const query = request.query as { status?: string };
      const data = await listTournaments(query.status);
      return reply.send({ success: true, data });
    },
  });

  app.get<{ Params: { id: string } }>('/tournament/:id', {
    schema: {
      description: 'Get tournament details', tags: ['tournament'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const data = await getTournament(request.params.id);
      return reply.send({ success: true, data });
    },
  });

  app.post<{ Params: { id: string } }>('/tournament/:id/join', {
    schema: {
      description: 'Join tournament', tags: ['tournament'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      await joinTournament(userId, request.params.id);
      return reply.send({ success: true });
    },
  });

  app.post<{ Params: { id: string } }>('/tournament/:id/submit', {
    schema: {
      description: 'Submit tournament score', tags: ['tournament'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const { sessionId } = submitScoreSchema.parse(request.body);
      await submitTournamentScore(userId, request.params.id, sessionId);
      return reply.send({ success: true });
    },
  });
}
