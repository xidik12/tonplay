import { PrismaClient } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/context.js';
import pino from 'pino';

const logger = pino({ name: 'cmd:start' });

/**
 * Creates the /start command handler.
 *
 * Responsibilities:
 * - Process referral codes passed via deep link (`?start=<referralCode>`)
 * - Create tier-1 and tier-2 referral relationships
 * - Send a welcome message with the Mini App launch keyboard
 */
export function createStartHandler(prisma: PrismaClient, webAppUrl: string) {
  return async (ctx: BotContext): Promise<void> => {
    logger.info({ from: ctx.from?.id }, '/start command received');
    const { dbUser } = ctx;

    if (!dbUser) {
      logger.error({ from: ctx.from?.id }, 'dbUser is missing in /start');
      await ctx.reply('Something went wrong. Please try again later.');
      return;
    }
    logger.info({ userId: dbUser.id, tickets: dbUser.ticketBalance }, 'Sending welcome message');

    // --- Referral processing ---
    const startParam = ctx.match; // grammy sets ctx.match for /start <payload>

    if (startParam && typeof startParam === 'string' && startParam.length > 0) {
      await processReferral(prisma, dbUser.id, startParam);
    }

    // --- Welcome message ---
    const keyboard = new InlineKeyboard()
      .webApp('🎮 Play Now', webAppUrl)
      .row()
      .text('📊 My Stats', 'cmd:stats')
      .text('💰 Wallet', 'cmd:wallet')
      .row()
      .text('👥 Invite Friends', 'cmd:referral');

    const welcomeText = [
      '🎮 *Welcome to TONPLAY!*',
      '',
      'The ultimate arcade gaming platform on TON.',
      'Play skill-based games, earn tickets, compete in tournaments, and win real rewards!',
      '',
      `🎟 *Starting Balance:* ${dbUser.ticketBalance} tickets`,
      '',
      'Tap *Play Now* to jump into the action!',
    ].join('\n');

    await ctx.reply(welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  };
}

/**
 * Processes a referral code from the /start deep link.
 * Creates a tier-1 referral between the referrer and the new user,
 * and a tier-2 referral if the referrer themselves was referred by someone.
 */
async function processReferral(
  prisma: PrismaClient,
  newUserId: string,
  referralCode: string
): Promise<void> {
  try {
    // Find the referrer by their referral code
    const referrer = await prisma.user.findFirst({
      where: { referralCode },
    });

    if (!referrer) {
      logger.warn({ referralCode }, 'Invalid referral code');
      return;
    }

    // Prevent self-referral
    if (referrer.id === newUserId) {
      logger.warn({ newUserId }, 'Self-referral attempt');
      return;
    }

    // Check if a referral relationship already exists
    const existingReferral = await prisma.referral.findFirst({
      where: {
        referredId: newUserId,
        tier: 1,
      },
    });

    if (existingReferral) {
      logger.info({ newUserId }, 'User already has a tier-1 referrer');
      return;
    }

    // Create tier-1 referral (direct)
    await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: newUserId,
        tier: 1,
        totalEarnings: 0,
      },
    });

    logger.info(
      { referrerId: referrer.id, referredId: newUserId },
      'Tier-1 referral created'
    );

    // Check if the referrer has their own referrer (for tier-2)
    const tier1OfReferrer = await prisma.referral.findFirst({
      where: {
        referredId: referrer.id,
        tier: 1,
      },
    });

    if (tier1OfReferrer) {
      // The referrer's referrer gets a tier-2 relationship with the new user
      await prisma.referral.create({
        data: {
          referrerId: tier1OfReferrer.referrerId,
          referredId: newUserId,
          tier: 2,
          totalEarnings: 0,
        },
      });

      logger.info(
        {
          tier2ReferrerId: tier1OfReferrer.referrerId,
          referredId: newUserId,
        },
        'Tier-2 referral created'
      );
    }
  } catch (error) {
    logger.error({ error, referralCode, newUserId }, 'Failed to process referral');
  }
}
