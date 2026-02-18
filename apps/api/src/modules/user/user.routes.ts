import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getUserById,
  getPublicProfile,
  getUserStats,
  updateUserProfile,
} from './user.service.js';

const updateProfileSchema = z.object({
  languageCode: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid language code format')
    .optional(),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // All user routes require authentication
  app.addHook('preHandler', app.authenticate);

  /**
   * GET /user/me
   * Get the authenticated user's full profile.
   */
  app.get('/user/me', {
    schema: {
      description: 'Get own profile',
      tags: ['user'],
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const profile = await getUserById(userId);

      return reply.send({
        success: true,
        data: profile,
      });
    },
  });

  /**
   * GET /user/me/stats
   * Get the authenticated user's aggregated stats.
   */
  app.get('/user/me/stats', {
    schema: {
      description: 'Get own stats',
      tags: ['user'],
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const stats = await getUserStats(userId);

      return reply.send({
        success: true,
        data: stats,
      });
    },
  });

  /**
   * PATCH /user/me
   * Update allowed profile fields.
   */
  app.patch('/user/me', {
    schema: {
      description: 'Update own profile',
      tags: ['user'],
      body: {
        type: 'object',
        properties: {
          languageCode: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const updates = updateProfileSchema.parse(request.body);
      const profile = await updateUserProfile(userId, updates);

      return reply.send({
        success: true,
        data: profile,
      });
    },
  });

  /**
   * GET /user/:id
   * Get a public profile of another user.
   */
  app.get<{ Params: { id: string } }>('/user/:id', {
    schema: {
      description: 'Get public profile of a user',
      tags: ['user'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const profile = await getPublicProfile(id);

      return reply.send({
        success: true,
        data: profile,
      });
    },
  });
}
