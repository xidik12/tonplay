import { PrismaClient } from '@prisma/client';
import { NextFunction } from 'grammy';
import { BotContext } from './context.js';
import { randomBytes } from 'crypto';

/**
 * Generates a unique 8-character referral code from random bytes.
 */
function generateReferralCode(): string {
  return randomBytes(4).toString('hex');
}

/**
 * Creates a user-sync middleware that upserts the Telegram user in the
 * database on every incoming update. The resulting DB record is attached
 * to `ctx.dbUser` for downstream handlers.
 *
 * If the user is banned, the middleware replies with a suspension notice
 * and does NOT call `next()`, effectively blocking all further processing.
 */
export function createUserSyncMiddleware(prisma: PrismaClient) {
  return async (ctx: BotContext, next: NextFunction): Promise<void> => {
    const telegramUser = ctx.from;

    // Ignore updates without a sender (channel posts, etc.)
    if (!telegramUser) {
      await next();
      return;
    }

    try {
      const dbUser = await prisma.user.upsert({
        where: {
          telegramId: BigInt(telegramUser.id),
        },
        update: {
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name ?? null,
          username: telegramUser.username ?? null,
          isPremium: telegramUser.is_premium ?? false,
          languageCode: telegramUser.language_code ?? 'en',
          updatedAt: new Date(),
        },
        create: {
          telegramId: BigInt(telegramUser.id),
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name ?? null,
          username: telegramUser.username ?? null,
          isPremium: telegramUser.is_premium ?? false,
          languageCode: telegramUser.language_code ?? 'en',
          referralCode: generateReferralCode(),
        },
      });

      // Check ban status before allowing further processing
      if (dbUser.isBanned) {
        await ctx.reply(
          'Your account is suspended. If you believe this is a mistake, please contact support.'
        );
        return;
      }

      // Attach the DB user record to the context for downstream handlers
      ctx.dbUser = dbUser as BotContext['dbUser'];
    } catch (error) {
      console.error('User sync failed for telegram ID:', telegramUser.id, error);
      // Don't call next() if sync failed — downstream handlers rely on ctx.dbUser
      await ctx.reply('Something went wrong. Please try again.');
      return;
    }

    await next();
  };
}
