import type { FastifyRequest } from 'fastify';

export interface JwtPayload {
  userId: string;
  telegramId: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: JwtPayload;
}

/**
 * Telegram user data extracted from initData.
 */
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

/**
 * Parsed Telegram WebApp initData.
 */
export interface TelegramInitData {
  query_id?: string;
  user?: TelegramUser;
  auth_date: number;
  hash: string;
  start_param?: string;
}

/**
 * Standard API response envelope.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    cursor?: string;
  };
}

/**
 * Socket.IO authenticated socket data.
 */
export interface SocketData {
  userId: string;
  telegramId: string;
}

/**
 * WebSocket event types for real-time features.
 */
export type WsEvent =
  | 'leaderboard:update'
  | 'session:verified'
  | 'notification:new'
  | 'economy:balance_update'
  | 'tournament:update';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
