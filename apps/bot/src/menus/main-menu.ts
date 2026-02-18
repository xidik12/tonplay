import { Menu } from '@grammyjs/menu';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../middleware/context.js';
import { createStatsHandler } from '../commands/stats.js';
import { createWalletHandler } from '../commands/wallet.js';
import { createReferralHandler } from '../commands/referral.js';

/**
 * Creates the main interactive menu using @grammyjs/menu.
 *
 * The menu provides quick access to core bot features:
 * - Play: Opens the Mini App game lobby
 * - Stats: Displays the user's gameplay statistics
 * - Wallet: Shows balances and wallet management
 * - Invite: Shows the referral link and stats
 * - Help: Displays help information
 *
 * @param prisma - Prisma client instance for database queries
 * @param webAppUrl - Base URL for the Mini App (WEBAPP_URL env var)
 * @param getBotUsername - Getter function that returns the bot username (resolved after bot.init)
 */
export function createMainMenu(
  prisma: PrismaClient,
  webAppUrl: string,
  getBotUsername: () => string
): Menu<BotContext> {
  const statsHandler = createStatsHandler(prisma, webAppUrl);
  const walletHandler = createWalletHandler(prisma, webAppUrl);

  const menu = new Menu<BotContext>('main-menu')
    .webApp('🎮 Play', `${webAppUrl}/lobby`)
    .text('📊 Stats', async (ctx) => {
      await statsHandler(ctx);
    })
    .row()
    .text('💰 Wallet', async (ctx) => {
      await walletHandler(ctx);
    })
    .text('👥 Invite', async (ctx) => {
      // Create the referral handler lazily so it uses the resolved bot username
      const referralHandler = createReferralHandler(prisma, getBotUsername());
      await referralHandler(ctx);
    })
    .row()
    .text('ℹ️ Help', async (ctx) => {
      const helpText = [
        'ℹ️ *TONPLAY Help*',
        '',
        '*Commands:*',
        '/start — Welcome message & main menu',
        '/play — Open the game lobby',
        '/wallet — View balances & manage wallet',
        '/stats — View your gameplay statistics',
        '/referral — Get your referral link',
        '',
        '*How it works:*',
        '1. Tap *Play* to open the Mini App',
        '2. Choose a game from the lobby',
        '3. Set your wager and play',
        '4. Your score is verified server-side',
        '5. Win tickets based on your performance!',
        '',
        '*Currencies:*',
        '🎟 *Tickets* — Free-play currency (earn daily & through missions)',
        '🪙 *$TPLAY* — Platform token (trade on TON blockchain)',
        '',
        '*Referrals:*',
        'Earn a % of your friends\' game fees!',
        'Tier 1 (direct) — Higher reward',
        'Tier 2 (friend of friend) — Lower reward',
        '',
        'Need more help? Contact @tonplay\\_support',
      ].join('\n');

      await ctx.reply(helpText, { parse_mode: 'Markdown' });
    });

  return menu;
}
