import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';
import { creditTickets } from '../economy/economy.service.js';
import { emitTournamentUpdate } from '../../websocket/handler.js';

export interface TournamentInfo {
  id: string;
  name: string;
  gameId: string;
  status: string;
  format: string;
  entryFee: number;
  entryCurrency: string;
  prizePool: number;
  maxEntries: number;
  startTime: Date;
  endTime: Date;
  entryCount: number;
}

export interface TournamentEntryInfo {
  userId: string;
  bestScore: number;
  attempts: number;
  rank: number | null;
  prizeAmount: number | null;
}

export async function listTournaments(status?: string): Promise<TournamentInfo[]> {
  const where = status ? { status } : {};
  const tournaments = await prisma.tournament.findMany({
    where,
    include: { _count: { select: { entries: true } } },
    orderBy: { startTime: 'desc' },
    take: 20,
  });
  return tournaments.map(t => ({
    id: t.id,
    name: t.name,
    gameId: t.gameId,
    status: t.status,
    format: t.format,
    entryFee: t.entryFee,
    entryCurrency: t.entryCurrency,
    prizePool: t.prizePool,
    maxEntries: t.maxEntries,
    startTime: t.startTime,
    endTime: t.endTime,
    entryCount: t._count.entries,
  }));
}

export async function getTournament(tournamentId: string): Promise<TournamentInfo & { entries: TournamentEntryInfo[] }> {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      _count: { select: { entries: true } },
      entries: { orderBy: { bestScore: 'desc' }, take: 50 },
    },
  });
  if (!t) throw AppError.notFound('Tournament');
  return {
    id: t.id, name: t.name, gameId: t.gameId, status: t.status, format: t.format,
    entryFee: t.entryFee, entryCurrency: t.entryCurrency, prizePool: t.prizePool,
    maxEntries: t.maxEntries, startTime: t.startTime, endTime: t.endTime,
    entryCount: t._count.entries,
    entries: t.entries.map((e, i) => ({
      userId: e.userId, bestScore: e.bestScore, attempts: e.attempts,
      rank: i + 1, prizeAmount: e.prizeAmount,
    })),
  };
}

export async function joinTournament(userId: string, tournamentId: string): Promise<void> {
  // All checks + mutations in a single transaction to prevent TOCTOU races
  await prisma.$transaction(async (tx) => {
    const t = await tx.tournament.findUnique({
      where: { id: tournamentId },
      include: { _count: { select: { entries: true } } },
    });
    if (!t) throw AppError.notFound('Tournament');
    if (t.status !== 'ACTIVE' && t.status !== 'UPCOMING') throw AppError.badRequest('Tournament not open for entry');
    if (t._count.entries >= t.maxEntries) throw AppError.conflict('Tournament is full');

    const existing = await tx.tournamentEntry.findFirst({ where: { tournamentId, userId } });
    if (existing) throw AppError.conflict('Already registered');

    if (t.entryFee > 0) {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { ticketBalance: true } });
      if (!user || user.ticketBalance < t.entryFee) throw AppError.insufficientBalance('TICKET');
      await tx.user.update({ where: { id: userId }, data: { ticketBalance: { decrement: t.entryFee } } });
      await tx.tournament.update({ where: { id: tournamentId }, data: { prizePool: { increment: t.entryFee } } });
    }
    await tx.tournamentEntry.create({ data: { tournamentId, userId } });
  });
}

export async function submitTournamentScore(userId: string, tournamentId: string, sessionId: string): Promise<void> {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) throw AppError.notFound('Tournament');
  if (t.status !== 'ACTIVE') throw AppError.badRequest('Tournament is not active');

  const entry = await prisma.tournamentEntry.findFirst({ where: { tournamentId, userId } });
  if (!entry) throw AppError.badRequest('Not registered for this tournament');

  // Verify the session belongs to this user and game, and is verified
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) throw AppError.badRequest('Invalid session');
  if (session.gameId !== t.gameId) throw AppError.badRequest('Session game does not match tournament game');
  if (session.status !== 'verified') throw AppError.badRequest('Session not verified');

  const score = session.score ?? 0;
  const update: Record<string, unknown> = { attempts: { increment: 1 } };
  if (score > entry.bestScore) update.bestScore = score;

  await prisma.tournamentEntry.update({ where: { id: entry.id }, data: update });

  // Emit leaderboard update
  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId },
    orderBy: { bestScore: 'desc' },
    take: 10,
  });
  emitTournamentUpdate(tournamentId, {
    leaderboard: entries.map((e, i) => ({ userId: e.userId, score: e.bestScore, rank: i + 1 })),
  });
}

export async function distributePrizes(tournamentId: string): Promise<void> {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { entries: { orderBy: { bestScore: 'desc' } } },
  });
  if (!t || t.entries.length === 0) return;

  const pool = t.prizePool;
  const splits = [0.5, 0.3, 0.2]; // 50/30/20

  for (let i = 0; i < Math.min(3, t.entries.length); i++) {
    const prize = Math.floor(pool * splits[i]);
    if (prize > 0) {
      await creditTickets(t.entries[i].userId, prize, 'TOURNAMENT_PRIZE', `${t.name} — Rank ${i + 1}`);
      await prisma.tournamentEntry.update({ where: { id: t.entries[i].id }, data: { rank: i + 1, prizeAmount: prize } });
    }
  }

  emitTournamentUpdate(tournamentId, { status: 'ENDED', message: 'Prizes distributed!' });
}
