import { InlineKeyboard } from 'grammy';
import { BotContext } from '../middleware/context.js';

/**
 * Truncates a TON wallet address for display purposes.
 * Shows the first 6 and last 4 characters with an ellipsis.
 */
function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Creates the /wallet command handler.
 *
 * Displays the user's current balances (tickets and $TPLAY),
 * shows their connected TON wallet address (if any),
 * and provides action buttons for wallet management.
 */
export function createWalletHandler(webAppUrl: string) {
  return async (ctx: BotContext): Promise<void> => {
    const { dbUser } = ctx;

    if (!dbUser) {
      await ctx.reply('Something went wrong. Please try again later.');
      return;
    }

    const lines: string[] = [
      '💰 *Your Wallet*',
      '',
      '📊 *Balances:*',
      `  🎟 Tickets: *${dbUser.ticketBalance.toLocaleString()}*`,
      `  🪙 $TPLAY: *${dbUser.tplayBalance.toLocaleString()}*`,
      '',
    ];

    if (dbUser.walletAddress) {
      lines.push(`🔗 *TON Wallet:* \`${truncateAddress(dbUser.walletAddress)}\``);
    } else {
      lines.push('🔗 *TON Wallet:* Not connected');
    }

    const keyboard = new InlineKeyboard();

    if (!dbUser.walletAddress) {
      keyboard.webApp('🔗 Connect Wallet', `${webAppUrl}/wallet/connect`);
      keyboard.row();
    }

    keyboard
      .webApp('📥 Deposit', `${webAppUrl}/wallet/deposit`)
      .webApp('📤 Withdraw', `${webAppUrl}/wallet/withdraw`);

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  };
}
