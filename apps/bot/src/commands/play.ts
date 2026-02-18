import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/context.js';

/**
 * Creates the /play command handler.
 *
 * Sends an inline keyboard with a button that opens the Mini App
 * directly to the game lobby.
 */
export function createPlayHandler(webAppUrl: string) {
  return async (ctx: BotContext): Promise<void> => {
    const { dbUser } = ctx;

    if (!dbUser) {
      await ctx.reply('Something went wrong. Please try again later.');
      return;
    }

    const keyboard = new InlineKeyboard()
      .webApp('🎮 Open Game Lobby', `${webAppUrl}/lobby`);

    const text = [
      '🎮 *Choose your game!*',
      '',
      `🎟 Your balance: *${dbUser.ticketBalance} tickets*`,
      '',
      'Tap below to open the game lobby and pick from 15+ arcade and skill games.',
    ].join('\n');

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  };
}
