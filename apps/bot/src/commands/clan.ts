import { PrismaClient } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/context.js';
import pino from 'pino';

const logger = pino({ name: 'cmd:clan' });

export function createClanHandler(prisma: PrismaClient, webAppUrl: string) {
  return async (ctx: BotContext): Promise<void> => {
    const { dbUser } = ctx;
    if (!dbUser) {
      await ctx.reply('Something went wrong. Please try again later.');
      return;
    }

    try {
      const membership = await prisma.clanMember.findUnique({
        where: { userId: dbUser.id },
        include: { clan: true },
      });

      if (membership) {
        const clan = membership.clan;
        const text = [
          '⚔️ *Your Clan*',
          '',
          `🏰 *[${clan.tag}] ${clan.name}*`,
          clan.description ? `_${clan.description}_` : '',
          '',
          `⭐ Total XP: *${clan.totalXp.toLocaleString()}*`,
          `👥 Members: *${clan.memberCount}/${clan.maxMembers}*`,
          `🎖 Your Role: *${membership.role}*`,
          `💪 Your XP: *${membership.xpContributed.toLocaleString()}*`,
        ].filter(Boolean).join('\n');

        const keyboard = new InlineKeyboard()
          .webApp('🏰 View Clan', `${webAppUrl}/clan`);

        await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      } else {
        const text = [
          '⚔️ *Clans*',
          '',
          'You are not in a clan yet!',
          'Join or create a clan to compete together.',
        ].join('\n');

        const keyboard = new InlineKeyboard()
          .webApp('🏰 Browse Clans', `${webAppUrl}/clan`);

        await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
      }
    } catch (error) {
      logger.error({ error, userId: dbUser.id }, 'Failed to fetch clan info');
      await ctx.reply('Failed to load clan info. Please try again.');
    }
  };
}
