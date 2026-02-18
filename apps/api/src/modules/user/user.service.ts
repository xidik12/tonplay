import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';

export interface UserProfile {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string;
  isPremium: boolean;
  ticketBalance: number;
  tplayBalance: string;
  xp: number;
  level: number;
  referralCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicProfile {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  level: number;
  xp: number;
  createdAt: Date;
}

export interface UserStats {
  totalGamesPlayed: number;
  totalWagered: number;
  totalWon: number;
  winRate: number;
  highestScore: number;
  currentStreak: number;
  longestStreak: number;
  referralCount: number;
  missionsCompleted: number;
  clanName: string | null;
}

/**
 * Gets the full profile of a user by their ID.
 */
export async function getUserById(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw AppError.notFound('User');
  }

  return {
    id: user.id,
    telegramId: user.telegramId.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    languageCode: user.languageCode,
    isPremium: user.isPremium,
    ticketBalance: user.ticketBalance,
    tplayBalance: user.tplayBalance.toString(),
    xp: user.xp,
    level: user.level,
    referralCode: user.referralCode,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Gets a public profile of a user (limited data visible to other users).
 */
export async function getPublicProfile(userId: string): Promise<PublicProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      level: true,
      xp: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw AppError.notFound('User');
  }

  return user;
}

/**
 * Gets aggregated stats for a user.
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userStreak: true,
      clanMembership: {
        include: {
          clan: { select: { name: true } },
        },
      },
    },
  });

  if (!user) {
    throw AppError.notFound('User');
  }

  // Count total games played (completed sessions)
  const totalGamesPlayed = await prisma.gameSession.count({
    where: { userId, status: 'verified' },
  });

  // Sum total wagered
  const wagerAgg = await prisma.gameSession.aggregate({
    where: { userId, status: 'verified' },
    _sum: { wagerAmount: true },
  });

  // Count wins (sessions with positive rewards)
  const totalWon = await prisma.gameSession.count({
    where: {
      userId,
      status: 'verified',
      score: { gt: 0 },
    },
  });

  // Get highest score
  const highestScoreAgg = await prisma.gameSession.aggregate({
    where: { userId, status: 'verified' },
    _max: { score: true },
  });

  // Count referrals
  const referralCount = await prisma.referral.count({
    where: { referrerId: userId },
  });

  // Count completed missions
  const missionsCompleted = await prisma.userMission.count({
    where: { userId, isCompleted: true },
  });

  const totalWagered = wagerAgg._sum.wagerAmount ?? 0;
  const winRate = totalGamesPlayed > 0 ? (totalWon / totalGamesPlayed) * 100 : 0;

  return {
    totalGamesPlayed,
    totalWagered,
    totalWon,
    winRate: Math.round(winRate * 100) / 100,
    highestScore: highestScoreAgg._max.score ?? 0,
    currentStreak: user.userStreak?.currentStreak ?? 0,
    longestStreak: user.userStreak?.longestStreak ?? 0,
    referralCount,
    missionsCompleted,
    clanName: user.clanMembership?.clan.name ?? null,
  };
}

/**
 * Updates allowed user profile fields (e.g., language).
 */
export async function updateUserProfile(
  userId: string,
  updates: { languageCode?: string }
): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw AppError.notFound('User');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(updates.languageCode !== undefined && { languageCode: updates.languageCode }),
    },
  });

  return {
    id: updatedUser.id,
    telegramId: updatedUser.telegramId.toString(),
    username: updatedUser.username,
    firstName: updatedUser.firstName,
    lastName: updatedUser.lastName,
    languageCode: updatedUser.languageCode,
    isPremium: updatedUser.isPremium,
    ticketBalance: updatedUser.ticketBalance,
    tplayBalance: updatedUser.tplayBalance.toString(),
    xp: updatedUser.xp,
    level: updatedUser.level,
    referralCode: updatedUser.referralCode,
    createdAt: updatedUser.createdAt,
    updatedAt: updatedUser.updatedAt,
  };
}
