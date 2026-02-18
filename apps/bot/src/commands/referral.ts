import { PrismaClient } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/context.js';
import pino from 'pino';

const logger = pino({ name: 'cmd:referral' });

/**
 * Creates the /referral command handler.
 *
 * Generates and displays the user's referral link along with their
 * referral statistics (total referrals, tier-1 and tier-2 earnings).
 * Provides a share button that creates a shareable invite message.
 */
export function createReferralHandler(prisma: PrismaClient, botUsername: string) {
  return async (ctx: BotContext): Promise<void> => {
    const { dbUser } = ctx;

    if (!dbUser) {
      await ctx.reply('Something went wrong. Please try again later.');
      return;
    }

    try {
      const referralLink = `https://t.me/${botUsername}?start=${dbUser.referralCode}`;

      // Query tier-1 referral stats
      const tier1Referrals = await prisma.referral.findMany({
        where: {
          referrerId: dbUser.id,
          tier: 1,
        },
      });

      // Query tier-2 referral stats
      const tier2Referrals = await prisma.referral.findMany({
        where: {
          referrerId: dbUser.id,
          tier: 2,
        },
      });

      const tier1Count = tier1Referrals.length;
      const tier2Count = tier2Referrals.length;
      const tier1Earnings = tier1Referrals.reduce(
        (sum, r) => sum + (r.totalEarnings ?? 0),
        0
      );
      const tier2Earnings = tier2Referrals.reduce(
        (sum, r) => sum + (r.totalEarnings ?? 0),
        0
      );
      const totalEarnings = tier1Earnings + tier2Earnings;

      const text = [
        '👥 *Invite Friends & Earn!*',
        '',
        'Share your link and earn a percentage of your friends\' game fees.',
        '',
        '🔗 *Your Referral Link:*',
        `\`${referralLink}\``,
        '',
        '📊 *Referral Stats:*',
        `  👤 Direct Referrals (Tier 1): *${tier1Count}*`,
        `  👥 Indirect Referrals (Tier 2): *${tier2Count}*`,
        '',
        '💰 *Earnings:*',
        `  Tier 1: *${tier1Earnings.toLocaleString()} tickets*`,
        `  Tier 2: *${tier2Earnings.toLocaleString()} tickets*`,
        `  Total: *${totalEarnings.toLocaleString()} tickets*`,
      ].join('\n');

      const shareText = [
        '🎮 Join me on TONPLAY — the ultimate arcade gaming platform on TON!',
        '',
        'Play skill-based games, earn tickets, and win real rewards.',
        'Get 500 free tickets when you sign up!',
        '',
        referralLink,
      ].join('\n');

      const keyboard = new InlineKeyboard()
        .switchInline('📤 Share with Friends', shareText)
        .row()
        .url('📋 Copy Link', referralLink);

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error({ error, userId: dbUser.id }, 'Failed to fetch referral stats');
      await ctx.reply('Failed to load referral stats. Please try again later.');
    }
  };
}
