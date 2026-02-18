import { Bot, webhookCallback } from 'grammy';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';

import { BotContext } from './middleware/context.js';
import { createUserSyncMiddleware } from './middleware/user-sync.js';
import { createStartHandler } from './commands/start.js';
import { createPlayHandler } from './commands/play.js';
import { createWalletHandler } from './commands/wallet.js';
import { createStatsHandler } from './commands/stats.js';
import { createReferralHandler } from './commands/referral.js';
import { createMainMenu } from './menus/main-menu.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN environment variable is required');
}

const WEBAPP_URL = process.env.WEBAPP_URL ?? 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const WEBHOOK_URL = process.env.WEBHOOK_URL; // e.g. https://api.tonplay.io/bot/webhook
const PORT = parseInt(process.env.BOT_PORT ?? '3001', 10);

const logger = pino({
  name: 'tonplay-bot',
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    NODE_ENV === 'development'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();
const bot = new Bot<BotContext>(BOT_TOKEN);

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

bot.catch((err) => {
  const ctx = err.ctx;
  const e = err.error;

  logger.error(
    {
      updateId: ctx.update.update_id,
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    },
    'Bot error'
  );
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Sync Telegram user to database on every update
bot.use(createUserSyncMiddleware(prisma));

// ---------------------------------------------------------------------------
// Menus
// ---------------------------------------------------------------------------

// Resolve bot username for referral links
let botUsername = '';

const mainMenu = createMainMenu(prisma, WEBAPP_URL, () => botUsername);

// Register the menu (referral handler lazily resolves botUsername via getter)
bot.use(mainMenu);

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

bot.command('start', createStartHandler(prisma, WEBAPP_URL));
bot.command('play', createPlayHandler(WEBAPP_URL));
bot.command('wallet', createWalletHandler(WEBAPP_URL));
bot.command('stats', createStatsHandler(prisma, WEBAPP_URL));
bot.command('referral', async (ctx) => {
  // Use the resolved bot username (available after init)
  const handler = createReferralHandler(prisma, botUsername);
  await handler(ctx);
});

// ---------------------------------------------------------------------------
// Callback query handlers (for inline keyboard buttons)
// ---------------------------------------------------------------------------

bot.callbackQuery('cmd:stats', async (ctx) => {
  await ctx.answerCallbackQuery();
  const handler = createStatsHandler(prisma, WEBAPP_URL);
  await handler(ctx);
});

bot.callbackQuery('cmd:wallet', async (ctx) => {
  await ctx.answerCallbackQuery();
  const handler = createWalletHandler(WEBAPP_URL);
  await handler(ctx);
});

bot.callbackQuery('cmd:referral', async (ctx) => {
  await ctx.answerCallbackQuery();
  const handler = createReferralHandler(prisma, botUsername);
  await handler(ctx);
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
  // Connect to the database
  await prisma.$connect();
  logger.info('Database connected');

  // Resolve bot info (username, id, etc.)
  const me = await bot.api.getMe();
  botUsername = me.username;
  logger.info({ botUsername: me.username, botId: me.id }, 'Bot identity resolved');

  // Set bot commands for the Telegram menu
  await bot.api.setMyCommands([
    { command: 'start', description: 'Start the bot & main menu' },
    { command: 'play', description: 'Open the game lobby' },
    { command: 'wallet', description: 'View balances & wallet' },
    { command: 'stats', description: 'View your game statistics' },
    { command: 'referral', description: 'Invite friends & earn' },
  ]);

  if (NODE_ENV === 'production' && WEBHOOK_URL) {
    // --- Production: Webhook mode ---
    logger.info({ webhookUrl: WEBHOOK_URL }, 'Starting in webhook mode');

    // Set the webhook URL with Telegram
    await bot.api.setWebhook(WEBHOOK_URL, {
      drop_pending_updates: true,
    });

    // Create a minimal HTTP server for the webhook endpoint
    const { createServer } = await import('http');
    const handleUpdate = webhookCallback(bot, 'http');

    const server = createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/webhook') {
        try {
          await handleUpdate(req, res);
        } catch (error) {
          logger.error({ error }, 'Webhook handler error');
          res.writeHead(500);
          res.end('Internal Server Error');
        }
      } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', bot: me.username }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(PORT, () => {
      logger.info({ port: PORT }, 'Webhook server listening');
    });
  } else {
    // --- Development: Long polling mode ---
    logger.info('Starting in long polling mode');

    // Delete any existing webhook before starting long polling
    await bot.api.deleteWebhook({ drop_pending_updates: true });

    await bot.start({
      onStart: (botInfo) => {
        logger.info(
          { username: botInfo.username, id: botInfo.id },
          'Bot started with long polling'
        );
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down gracefully...');

  try {
    bot.stop();
    await prisma.$disconnect();
    logger.info('Cleanup complete, exiting');
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
  }

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start the bot
start().catch((error) => {
  logger.fatal({ error }, 'Failed to start bot');
  process.exit(1);
});
