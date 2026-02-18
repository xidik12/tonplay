import type { FastifyInstance } from 'fastify';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from './notification.service.js';

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/notifications', {
    schema: {
      description: 'Get notifications',
      tags: ['notification'],
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const query = request.query as { limit?: string; offset?: string };
      const limit = parseInt(query.limit ?? '20', 10);
      const offset = parseInt(query.offset ?? '0', 10);
      const data = await getNotifications(userId, limit, offset);
      return reply.send({ success: true, data });
    },
  });

  app.post<{ Params: { id: string } }>('/notifications/read/:id', {
    schema: {
      description: 'Mark notification as read',
      tags: ['notification'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const { id } = request.params;
      await markAsRead(userId, id);
      return reply.send({ success: true });
    },
  });

  app.post('/notifications/read-all', {
    schema: {
      description: 'Mark all notifications as read',
      tags: ['notification'],
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const count = await markAllAsRead(userId);
      return reply.send({ success: true, data: { markedRead: count } });
    },
  });

  app.get('/notifications/unread-count', {
    schema: {
      description: 'Get unread notification count',
      tags: ['notification'],
    },
    handler: async (request, reply) => {
      const { userId } = request.user!;
      const count = await getUnreadCount(userId);
      return reply.send({ success: true, data: { count } });
    },
  });
}
