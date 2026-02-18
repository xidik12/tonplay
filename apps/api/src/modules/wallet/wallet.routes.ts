import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getWallet, connectWallet, disconnectWallet, initiateDeposit, initiateWithdrawal, getTransactions } from './wallet.service.js';

const connectSchema = z.object({
  tonAddress: z.string().min(1, 'tonAddress required'),
  tonConnectSession: z.unknown().optional(),
});

const depositSchema = z.object({
  currency: z.enum(['TPLAY']).default('TPLAY'),
  amount: z.number().positive('Amount must be positive'),
});

const withdrawSchema = z.object({
  currency: z.enum(['TPLAY']).default('TPLAY'),
  amount: z.number().positive('Amount must be positive'),
  toAddress: z.string().min(1, 'toAddress required'),
});

export async function walletRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/wallet', {
    schema: { description: 'Get wallet info', tags: ['wallet'] },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const data = await getWallet(userId);
      return reply.send({ success: true, data });
    },
  });

  app.post('/wallet/connect', {
    schema: { description: 'Connect TON wallet', tags: ['wallet'] },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const body = connectSchema.parse(request.body);
      const data = await connectWallet(userId, body.tonAddress, body.tonConnectSession);
      return reply.send({ success: true, data });
    },
  });

  app.post('/wallet/disconnect', {
    schema: { description: 'Disconnect wallet', tags: ['wallet'] },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      await disconnectWallet(userId);
      return reply.send({ success: true });
    },
  });

  app.post('/wallet/deposit/initiate', {
    schema: { description: 'Initiate deposit', tags: ['wallet'] },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const body = depositSchema.parse(request.body);
      const data = await initiateDeposit(userId, body.currency, body.amount);
      return reply.send({ success: true, data });
    },
  });

  app.post('/wallet/withdraw', {
    schema: { description: 'Initiate withdrawal', tags: ['wallet'] },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const body = withdrawSchema.parse(request.body);
      const data = await initiateWithdrawal(userId, body.currency, body.amount, body.toAddress);
      return reply.send({ success: true, data });
    },
  });

  app.get('/wallet/transactions', {
    schema: { description: 'Get transaction history', tags: ['wallet'] },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const query = request.query as { limit?: string };
      const data = await getTransactions(userId, parseInt(query.limit ?? '20', 10));
      return reply.send({ success: true, data });
    },
  });
}
