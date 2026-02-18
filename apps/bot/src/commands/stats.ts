import { PrismaClient } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/context.js';
import pino from 'pino';

const logger = pino({ name: 'cmd:stats' });

/**
 * Creates the /stats command handler.
 *
 * Queries the user's aggregated game statistics from the database
 * and presents them in a formatted message with a link to the
 * full profile page in the Mini App.
 */
export function createStatsHandler(prisma: PrismaClient, webAppUrl: string) {
  return async (ctx: BotContext): Promise<void> => {
    const { dbUser } = ctx;

    if (!dbUser) {
      await ctx.reply('Something went wrong. Please try again later.');
      return;
    }

    try {
      // Aggregate game session stats from the database
      const stats = await prisma.gameSession.aggregate({
        where: {
          userId: dbUser.id,
          status: { in: ['verified', 'completed'] },
        },
        _count: { _all: true },
        _sum: {
          wagerAmount: true,
          score: true,
        },
        _max: {
          score: true,
        },
      });

      // Get current streak data
      const streak = await prisma.userStreak.findUnique({
        where: { userId: dbUser.id },
      });

      const gamesPlayed = stats._count?._all ?? 0;
      const totalWagered = stats._sum?.wagerAmount ?? 0;
      const totalWon = stats._sum?.score ?? 0;
      const biggestWin = stats._max?.score ?? 0;
      const currentStreak = streak?.currentStreak ?? 0;

      // Calculate win rate
      let winCount = 0;
      if (gamesPlayed > 0) {
        winCount = await prisma.gameSession.count({
          where: {
            userId: dbUser.id,
            status: 'verified',
            score: { gt: 0 },
          },
        });
      }
      const winRate = gamesPlayed > 0 ? ((winCount / gamesPlayed) * 100).toFixed(1) : '0.0';

      const text = [
        '📊 *Your Stats*',
        '',
        `👤 *${dbUser.firstName}* — Level ${dbUser.level}`,
        `⭐ XP: *${dbUser.xp.toLocaleString()}*`,
        '',
        '🎮 *Gameplay:*',
        `  Games Played: *${gamesPlayed.toLocaleString()}*`,
        `  Total Wagered: *${totalWagered.toLocaleString()} tickets*`,
        `  Total Won: *${totalWon.toLocaleString()} tickets*`,
        `  Biggest Win: *${biggestWin.toLocaleString()} tickets*`,
        `  Win Rate: *${winRate}%*`,
        '',
        `🔥 Current Streak: *${currentStreak} days*`,
      ].join('\n');

      const keyboard = new InlineKeyboard()
        .webApp('📈 View Full Stats', `${webAppUrl}/profile`);

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      logger.error({ error, userId: dbUser.id }, 'Failed to fetch user stats');

      // Fallback: show basic profile info from the user record
      const text = [
        '📊 *Your Stats*',
        '',
        `👤 *${dbUser.firstName}* — Level ${dbUser.level}`,
        `⭐ XP: *${dbUser.xp.toLocaleString()}*`,
        `🎟 Tickets: *${dbUser.ticketBalance.toLocaleString()}*`,
        '',
        '_Detailed stats are temporarily unavailable. Please try again later._',
      ].join('\n');

      const keyboard = new InlineKeyboard()
        .webApp('📈 View Full Stats', `${webAppUrl}/profile`);

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    }
  };
}
