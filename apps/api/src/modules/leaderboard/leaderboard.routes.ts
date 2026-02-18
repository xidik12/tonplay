import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getLeaderboard, getUserRank } from './leaderboard.service.js';

const leaderboardQuerySchema = z.object({
  period: z.enum(['global', 'daily', 'weekly']).default('global'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /leaderboard/:gameSlug
   * Get the leaderboard for a specific game.
   * Supports period filter: global, daily, weekly.
   */
  app.get<{ Params: { gameSlug: string }; Querystring: Record<string, string> }>(
    '/leaderboard/:gameSlug',
    {
      schema: {
        description: 'Get game leaderboard',
        tags: ['leaderboard'],
        params: {
          type: 'object',
          required: ['gameSlug'],
          properties: { gameSlug: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['global', 'daily', 'weekly'] },
            limit: { type: 'number' },
            offset: { type: 'number' },
          },
        },
      },
      handler: async (request, reply) => {
        const { gameSlug } = request.params;
        const query = leaderboardQuerySchema.parse(request.query);

        const entries = await getLeaderboard(
          gameSlug,
          query.period,
          query.limit,
          query.offset
        );

        return reply.send({
          success: true,
          data: entries,
          meta: {
            gameSlug,
            period: query.period,
            limit: query.limit,
            offset: query.offset,
          },
        });
      },
    }
  );

  /**
   * GET /leaderboard/:gameSlug/me
   * Get the authenticated user's rank on a leaderboard.
   */
  app.get<{ Params: { gameSlug: string }; Querystring: Record<string, string> }>(
    '/leaderboard/:gameSlug/me',
    {
      preHandler: [app.authenticate],
      schema: {
        description: 'Get own rank on a leaderboard',
        tags: ['leaderboard'],
        params: {
          type: 'object',
          required: ['gameSlug'],
          properties: { gameSlug: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['global', 'daily', 'weekly'] },
          },
        },
      },
      handler: async (request, reply) => {
        const { userId } = request.user!;
        const { gameSlug } = request.params;
        const period = (request.query as { period?: string }).period ?? 'global';
        const validPeriod = z
          .enum(['global', 'daily', 'weekly'])
          .parse(period);

        const rank = await getUserRank(gameSlug, userId, validPeriod);

        return reply.send({
          success: true,
          data: rank,
        });
      },
    }
  );
}
