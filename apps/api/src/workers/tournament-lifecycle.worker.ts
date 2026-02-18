import { prisma } from '../config/database.js';
import { distributePrizes } from '../modules/tournament/tournament.service.js';
import { emitTournamentUpdate } from '../websocket/handler.js';

export function startTournamentLifecycle(): NodeJS.Timeout {
  const timer = setInterval(async () => {
    try {
      const now = new Date();

      // Activate upcoming tournaments that have started
      const toActivate = await prisma.tournament.findMany({
        where: { status: 'UPCOMING', startTime: { lte: now } },
      });
      for (const t of toActivate) {
        await prisma.tournament.update({ where: { id: t.id }, data: { status: 'ACTIVE' } });
        emitTournamentUpdate(t.id, { status: 'ACTIVE', message: 'Tournament has started!' });
        console.log(`[TournamentLifecycle] Activated: ${t.name}`);
      }

      // End active tournaments that have expired
      const toEnd = await prisma.tournament.findMany({
        where: { status: 'ACTIVE', endTime: { lte: now } },
      });
      for (const t of toEnd) {
        await prisma.tournament.update({ where: { id: t.id }, data: { status: 'ENDED' } });
        await distributePrizes(t.id);
        console.log(`[TournamentLifecycle] Ended and distributed prizes: ${t.name}`);
      }
    } catch (err) {
      console.error('[TournamentLifecycle] Error:', err);
    }
  }, 60_000); // Check every minute

  console.log('[TournamentLifecycle] Worker started');
  return timer;
}
