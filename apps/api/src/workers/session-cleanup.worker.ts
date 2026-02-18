import { prisma } from '../config/database.js';
import { creditTickets } from '../modules/economy/economy.service.js';

export function startSessionCleanup(): NodeJS.Timeout {
  const INTERVAL = 5 * 60 * 1000; // 5 minutes
  const PENDING_TTL = 10 * 60 * 1000; // 10 minutes
  const ACTIVE_TTL_MULTIPLIER = 2;

  async function cleanup() {
    const now = new Date();

    // Expire stale pending sessions
    const stalePending = await prisma.gameSession.findMany({
      where: {
        status: 'pending',
        startedAt: { lt: new Date(now.getTime() - PENDING_TTL) },
      },
    });

    for (const session of stalePending) {
      await prisma.gameSession.update({
        where: { id: session.id },
        data: { status: 'rejected', verifiedAt: now },
      });
      // Refund wager
      if (session.wagerAmount > 0) {
        await creditTickets(session.userId, session.wagerAmount, 'GAME_REFUND', 'Session expired (pending timeout)');
      }
      console.log(`[SessionCleanup] Expired pending session ${session.id}`);
    }

    // Expire stale active sessions
    const staleActive = await prisma.gameSession.findMany({
      where: { status: 'active' },
      include: { game: { select: { maxDurationMs: true } } },
    });

    for (const session of staleActive) {
      const maxTTL = session.game.maxDurationMs * ACTIVE_TTL_MULTIPLIER;
      const activatedAt = session.activatedAt ?? session.startedAt;
      if (now.getTime() - activatedAt.getTime() > maxTTL) {
        await prisma.gameSession.update({
          where: { id: session.id },
          data: { status: 'rejected', verifiedAt: now },
        });
        if (session.wagerAmount > 0) {
          await creditTickets(session.userId, session.wagerAmount, 'GAME_REFUND', 'Session expired (active timeout)');
        }
        console.log(`[SessionCleanup] Expired active session ${session.id}`);
      }
    }
  }

  const timer = setInterval(() => {
    cleanup().catch(err => console.error('[SessionCleanup] Error:', err.message));
  }, INTERVAL);

  // Run once immediately
  cleanup().catch(err => console.error('[SessionCleanup] Initial error:', err.message));

  console.log('[SessionCleanup] Started (interval: 5 min)');
  return timer;
}
