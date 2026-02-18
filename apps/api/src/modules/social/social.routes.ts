import type { FastifyInstance } from 'fastify';
import {
  getStreak,
  claimStreak,
  getUserMissions,
  claimMissionReward,
  getReferralStats,
} from './social.service.js';

export async function socialRoutes(app: FastifyInstance): Promise<void> {
  // All social routes require authentication
  app.addHook('preHandler', app.authenticate);

  /**
   * GET /social/streak
   * Get the authenticated user's daily streak info.
   */
  app.get('/social/streak', {
    schema: {
      description: 'Get daily streak info',
      tags: ['social'],
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const streak = await getStreak(userId);

      return reply.send({
        success: true,
        data: streak,
      });
    },
  });

  /**
   * POST /social/streak/claim
   * Claim the daily streak reward.
   */
  app.post('/social/streak/claim', {
    schema: {
      description: 'Claim daily streak reward',
      tags: ['social'],
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const streak = await claimStreak(userId);

      return reply.send({
        success: true,
        data: streak,
      });
    },
  });

  /**
   * GET /social/missions
   * Get today's daily missions for the authenticated user.
   */
  app.get('/social/missions', {
    schema: {
      description: 'Get daily missions',
      tags: ['social'],
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const missions = await getUserMissions(userId);

      return reply.send({
        success: true,
        data: missions,
      });
    },
  });

  /**
   * POST /social/missions/:id/claim
   * Claim a completed mission's reward.
   */
  app.post<{ Params: { id: string } }>('/social/missions/:id/claim', {
    schema: {
      description: 'Claim mission reward',
      tags: ['social'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const { id } = request.params;
      const mission = await claimMissionReward(userId, id);

      return reply.send({
        success: true,
        data: mission,
      });
    },
  });

  /**
   * GET /social/referrals
   * Get referral statistics for the authenticated user.
   */
  app.get('/social/referrals', {
    schema: {
      description: 'Get referral statistics',
      tags: ['social'],
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const stats = await getReferralStats(userId);

      return reply.send({
        success: true,
        data: stats,
      });
    },
  });
}
