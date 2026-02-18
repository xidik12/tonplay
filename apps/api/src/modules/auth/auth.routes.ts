import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyAndLogin, refreshToken } from './auth.service.js';

const loginBodySchema = z.object({
  initData: z.string().min(1, 'initData is required'),
  startParam: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /auth/login
   * Authenticate via Telegram initData.
   * Verifies HMAC, upserts user, processes referral, returns JWT.
   */
  app.post('/auth/login', {
    schema: {
      description: 'Authenticate via Telegram Mini App initData',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['initData'],
        properties: {
          initData: { type: 'string' },
          startParam: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const body = loginBodySchema.parse(request.body);

      const result = await verifyAndLogin(app, body.initData, body.startParam);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  });

  /**
   * POST /auth/refresh
   * Refresh the JWT token for an authenticated user.
   */
  app.post('/auth/refresh', {
    preHandler: [app.authenticate],
    schema: {
      description: 'Refresh JWT token',
      tags: ['auth'],
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;

      const result = await refreshToken(app, userId);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  });
}
