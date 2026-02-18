import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getBalance, getTransactions } from './economy.service.js';
import { offsetPaginationSchema, paginatedResponse } from '../../lib/pagination.js';

const transactionFilterSchema = z.object({
  type: z.string().optional(),
  currency: z.enum(['TICKET', 'TPLAY']).optional(),
  direction: z.enum(['CREDIT', 'DEBIT']).optional(),
});

export async function economyRoutes(app: FastifyInstance): Promise<void> {
  // All economy routes require authentication
  app.addHook('preHandler', app.authenticate);

  /**
   * GET /economy/balance
   * Get the authenticated user's ticket and TPLAY balances.
   */
  app.get('/economy/balance', {
    schema: {
      description: 'Get current balances',
      tags: ['economy'],
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const balance = await getBalance(userId);

      return reply.send({
        success: true,
        data: balance,
      });
    },
  });

  /**
   * GET /economy/transactions
   * Get paginated transaction history with optional filters.
   */
  app.get<{ Querystring: Record<string, string> }>('/economy/transactions', {
    schema: {
      description: 'Get transaction history (paginated)',
      tags: ['economy'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          type: { type: 'string' },
          currency: { type: 'string', enum: ['TICKET', 'TPLAY'] },
          direction: { type: 'string', enum: ['CREDIT', 'DEBIT'] },
        },
      },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const pagination = offsetPaginationSchema.parse(request.query);
      const filters = transactionFilterSchema.parse(request.query);

      const { transactions, total } = await getTransactions(
        userId,
        pagination,
        filters
      );

      return reply.send(paginatedResponse(transactions, total, pagination));
    },
  });
}
