import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error-handler.js';

const adminIds = new Set(
  env.ADMIN_USER_IDS
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
);

export function isAdmin(userId: string): boolean {
  return adminIds.has(userId);
}

export async function banUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User');
  await prisma.user.update({ where: { id: userId }, data: { isBanned: true } });
}

export async function unbanUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User');
  await prisma.user.update({ where: { id: userId }, data: { isBanned: false } });
}

export async function createTournament(data: {
  name: string;
  gameId: string;
  format: string;
  entryFee: number;
  entryCurrency: string;
  maxEntries: number;
  startTime: Date;
  endTime: Date;
}): Promise<unknown> {
  return prisma.tournament.create({
    data: {
      name: data.name,
      gameId: data.gameId,
      format: data.format,
      entryFee: data.entryFee,
      entryCurrency: data.entryCurrency,
      maxEntries: data.maxEntries,
      startTime: data.startTime,
      endTime: data.endTime,
      status: 'UPCOMING',
      prizePool: 0,
    },
  });
}

export async function createSeason(data: {
  name: string;
  startDate: Date;
  endDate: Date;
  premiumPrice: number;
  maxLevel: number;
  rewards: Array<{ level: number; rewardType: string; rewardAmount: number; isPremium: boolean }>;
}): Promise<unknown> {
  return prisma.$transaction(async (tx) => {
    const season = await tx.season.create({
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        premiumPrice: data.premiumPrice,
        maxLevel: data.maxLevel,
        isActive: true,
      },
    });

    if (data.rewards.length > 0) {
      await tx.seasonReward.createMany({
        data: data.rewards.map(r => ({
          seasonId: season.id,
          level: r.level,
          rewardType: r.rewardType,
          rewardAmount: r.rewardAmount,
          isPremium: r.isPremium,
        })),
      });
    }

    return season;
  });
}

export async function getSystemStats(): Promise<{
  totalUsers: number;
  bannedUsers: number;
  totalSessions: number;
  activeSessions: number;
  totalTransactions: number;
  totalClans: number;
  activeTournaments: number;
}> {
  const [totalUsers, bannedUsers, totalSessions, activeSessions, totalTransactions, totalClans, activeTournaments] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.gameSession.count(),
      prisma.gameSession.count({ where: { status: 'active' } }),
      prisma.transaction.count(),
      prisma.clan.count(),
      prisma.tournament.count({ where: { status: 'ACTIVE' } }),
    ]);

  return { totalUsers, bannedUsers, totalSessions, activeSessions, totalTransactions, totalClans, activeTournaments };
}

export async function listUsers(limit: number = 20, offset: number = 0) {
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        ticketBalance: true,
        tplayBalance: true,
        level: true,
        isBanned: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      skip: offset,
    }),
    prisma.user.count(),
  ]);

  return {
    users: users.map(u => ({ ...u, telegramId: u.telegramId.toString(), tplayBalance: u.tplayBalance.toString() })),
    total,
  };
}
