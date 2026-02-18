import { PrismaClient } from '@prisma/client';
import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/context.js';
import pino from 'pino';

const logger = pino({ name: 'cmd:tournament' });

export function createTournamentHandler(prisma: PrismaClient, webAppUrl: string) {
  return async (ctx: BotContext): Promise<void> => {
    const { dbUser } = ctx;
    if (!dbUser) {
      await ctx.reply('Something went wrong. Please try again later.');
      return;
    }

    try {
      const activeTournaments = await prisma.tournament.findMany({
        where: { status: { in: ['ACTIVE', 'UPCOMING'] } },
        include: { _count: { select: { entries: true } } },
        orderBy: { startTime: 'asc' },
        take: 5,
      });

      if (activeTournaments.length === 0) {
        const text = [
          '🏆 *Tournaments*',
          '',
          'No active tournaments right now.',
          'Check back soon for new competitions!',
        ].join('\n');

        const keyboard = new InlineKeyboard()
          .webApp('🏆 View All', `${webAppUrl}/tournaments`);

        await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      }

      const lines = ['🏆 *Active Tournaments*', ''];
      for (const t of activeTournaments) {
        const statusEmoji = t.status === 'ACTIVE' ? '🟢' : '🟡';
        lines.push(`${statusEmoji} *${t.name}*`);
        lines.push(`  Prize: *${t.prizePool.toLocaleString()}* | Players: *${t._count.entries}/${t.maxEntries}*`);
        lines.push(`  Entry: ${t.entryFee > 0 ? `*${t.entryFee} tickets*` : '*Free*'}`);
        lines.push('');
      }

      const keyboard = new InlineKeyboard()
        .webApp('🏆 Join Tournament', `${webAppUrl}/tournaments`);

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch (error) {
      logger.error({ error, userId: dbUser.id }, 'Failed to fetch tournaments');
      await ctx.reply('Failed to load tournaments. Please try again.');
    }
  };
}
