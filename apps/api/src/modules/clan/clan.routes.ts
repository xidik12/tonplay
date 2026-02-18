import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listClans, createClan, getClan, joinClan, leaveClan, kickMember, promoteMember, getClanLeaderboard } from './clan.service.js';

const createClanSchema = z.object({
  name: z.string().min(2).max(30),
  tag: z.string().min(2).max(6),
  description: z.string().max(200).optional(),
});

export async function clanRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/clans', {
    schema: { description: 'List clans', tags: ['clan'] },
    handler: async (request, reply) => {
      const data = await listClans();
      return reply.send({ success: true, data });
    },
  });

  // Leaderboard MUST come before /:id to avoid matching "leaderboard" as an id
  app.get('/clan/leaderboard', {
    schema: { description: 'Clan leaderboard', tags: ['clan'] },
    handler: async (request, reply) => {
      const data = await getClanLeaderboard();
      return reply.send({ success: true, data });
    },
  });

  app.post('/clan/create', {
    schema: { description: 'Create a clan', tags: ['clan'] },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const body = createClanSchema.parse(request.body);
      const data = await createClan(userId, body.name, body.tag, body.description);
      return reply.send({ success: true, data });
    },
  });

  app.get<{ Params: { id: string } }>('/clan/:id', {
    schema: {
      description: 'Get clan details', tags: ['clan'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const data = await getClan(request.params.id);
      return reply.send({ success: true, data });
    },
  });

  app.post<{ Params: { id: string } }>('/clan/:id/join', {
    schema: {
      description: 'Join a clan', tags: ['clan'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      await joinClan(userId, request.params.id);
      return reply.send({ success: true });
    },
  });

  app.post<{ Params: { id: string } }>('/clan/:id/leave', {
    schema: {
      description: 'Leave a clan', tags: ['clan'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      await leaveClan(userId, request.params.id);
      return reply.send({ success: true });
    },
  });

  app.post<{ Params: { id: string; userId: string } }>('/clan/:id/kick/:userId', {
    schema: {
      description: 'Kick a member', tags: ['clan'],
      params: { type: 'object', required: ['id', 'userId'], properties: { id: { type: 'string' }, userId: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const requesterId = request.user!.userId;
      await kickMember(requesterId, request.params.id, request.params.userId);
      return reply.send({ success: true });
    },
  });

  app.post<{ Params: { id: string; userId: string } }>('/clan/:id/promote/:userId', {
    schema: {
      description: 'Promote a member', tags: ['clan'],
      params: { type: 'object', required: ['id', 'userId'], properties: { id: { type: 'string' }, userId: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const requesterId = request.user!.userId;
      await promoteMember(requesterId, request.params.id, request.params.userId);
      return reply.send({ success: true });
    },
  });
}
