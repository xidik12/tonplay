import { PrismaClient } from '@prisma/client';
import { Bot, type Context } from 'grammy';
import pino from 'pino';

const logger = pino({ name: 'notification-forwarder' });

/**
 * Starts a polling loop that checks for unforwarded important notifications
 * and sends them to users via Telegram.
 */
export function startNotificationForwarder<C extends Context>(prisma: PrismaClient, bot: Bot<C>): NodeJS.Timeout {
  const IMPORTANT_TYPES = ['TOURNAMENT_PRIZE', 'SEASON_REWARD', 'CLAN_INVITE', 'SYSTEM'];
  const POLL_INTERVAL = 30_000; // 30 seconds

  // Track last check time
  let lastCheck = new Date();

  const timer = setInterval(async () => {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          type: { in: IMPORTANT_TYPES },
          createdAt: { gt: lastCheck },
          isRead: false,
        },
        include: {
          user: { select: { telegramId: true } },
        },
        take: 50,
      });

      lastCheck = new Date();

      for (const notif of notifications) {
        try {
          const telegramId = notif.user.telegramId;
          if (!telegramId) continue;

          const safeTitle = notif.title.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
          const safeBody = notif.body.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');

          const text = [
            `🔔 *${safeTitle}*`,
            '',
            safeBody,
          ].join('\n');

          await bot.api.sendMessage(Number(telegramId), text, { parse_mode: 'MarkdownV2' });
        } catch (err) {
          // User may have blocked the bot
          logger.warn({ notificationId: notif.id, error: err }, 'Failed to forward notification');
        }
      }
    } catch (err) {
      logger.error({ error: err }, 'Notification forwarder error');
    }
  }, POLL_INTERVAL);

  logger.info('Notification forwarder started');
  return timer;
}
