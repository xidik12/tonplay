import { PrismaClient } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/context.js';
import pino from 'pino';

const logger = pino({ name: 'cmd:battlepass' });

export function createBattlePassHandler(prisma: PrismaClient, webAppUrl: string) {
  return async (ctx: BotContext): Promise<void> => {
    const { dbUser } = ctx;
    if (!dbUser) {
      await ctx.reply('Something went wrong. Please try again later.');
      return;
    }

    try {
      const season = await prisma.season.findFirst({
        where: { isActive: true },
        orderBy: { startDate: 'desc' },
      });

      if (!season) {
        await ctx.reply('🎖 *Battle Pass*\n\nNo active season right now. Check back soon!', { parse_mode: 'Markdown' });
        return;
      }

      const bp = await prisma.userBattlePass.findFirst({
        where: { userId: dbUser.id, seasonId: season.id },
      });

      const level = bp?.currentLevel ?? 0;
      const xp = bp?.xp ?? 0;
      const isPremium = bp?.isPremium ?? false;
      const xpToNext = 100 - (xp % 100);

      const progressBar = '█'.repeat(Math.floor((xp % 100) / 10)) + '░'.repeat(10 - Math.floor((xp % 100) / 10));

      const text = [
        `🎖 *Battle Pass — ${season.name}*`,
        '',
        `Level: *${level}* / ${season.maxLevel}`,
        `XP: *${xp}* (${xpToNext} to next level)`,
        `[${progressBar}]`,
        '',
        isPremium ? '⭐ *Premium* unlocked!' : `💎 Upgrade to Premium: *${season.premiumPrice} tickets*`,
        '',
        `Ends: ${new Date(season.endDate).toLocaleDateString()}`,
      ].join('\n');

      const keyboard = new InlineKeyboard()
        .webApp('🎖 View Battle Pass', `${webAppUrl}/battlepass`);

      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch (error) {
      logger.error({ error, userId: dbUser.id }, 'Failed to fetch battle pass');
      await ctx.reply('Failed to load battle pass info. Please try again.');
    }
  };
}
