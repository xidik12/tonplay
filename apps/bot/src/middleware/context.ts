import { Context } from 'grammy';

/**
 * Database user record attached to the context by the user-sync middleware.
 * Mirrors the Prisma User model shape with fields relevant to the bot.
 */
export interface DbUser {
  id: string;
  telegramId: bigint;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string;
  isPremium: boolean;
  ticketBalance: number;
  tplayBalance: unknown;
  xp: number;
  level: number;
  isBanned: boolean;
  referralCode: string;
  referredById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Custom context flavor that includes the database user record.
 * Every handler downstream of the user-sync middleware can access `ctx.dbUser`.
 */
export interface BotContextFlavor {
  dbUser: DbUser;
}

/**
 * The fully-typed custom context used across all bot handlers.
 */
export type BotContext = Context & BotContextFlavor;
