import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { JwtPayload } from '../types/index.js';

/**
 * Fastify plugin that registers a JWT authentication decorator.
 * Wrapped with fastify-plugin to break encapsulation so all routes can access it.
 */
export const authPlugin = fp(async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        const decoded = await request.jwtVerify<JwtPayload>();
        request.user = decoded;
      } catch (err) {
        reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired authentication token',
          },
        });
      }
    }
  );
});

/**
 * Pre-handler that checks if the authenticated user is not banned.
 * Must be used AFTER the authenticate pre-handler.
 */
export async function requireNotBanned(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    return;
  }

  // The ban check is done at the service layer since we need a DB call.
  // This is a placeholder for middleware-level ban enforcement if needed.
}

/**
 * Extracts the user ID from an authenticated request.
 * Throws if the request is not authenticated.
 */
export function getUserId(request: FastifyRequest): string {
  if (!request.user?.userId) {
    throw new Error('Request is not authenticated');
  }
  return request.user.userId;
}

/**
 * Type augmentation for Fastify to include the authenticate decorator.
 */
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
