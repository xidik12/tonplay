import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';

const XP_PER_LEVEL = 100;

export interface SeasonInfo {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  premiumPrice: number;
  maxLevel: number;
  isActive: boolean;
}

export interface ProgressInfo {
  seasonId: string;
  isPremium: boolean;
  currentLevel: number;
  xp: number;
  xpToNextLevel: number;
}

export async function getCurrentSeason(): Promise<SeasonInfo | null> {
  return prisma.season.findFirst({ where: { isActive: true }, orderBy: { startDate: 'desc' } });
}

export async function getProgress(userId: string): Promise<ProgressInfo | null> {
  const season = await getCurrentSeason();
  if (!season) return null;

  let bp = await prisma.userBattlePass.findFirst({ where: { userId, seasonId: season.id } });
  if (!bp) {
    bp = await prisma.userBattlePass.create({ data: { userId, seasonId: season.id } });
  }

  return {
    seasonId: bp.seasonId,
    isPremium: bp.isPremium,
    currentLevel: bp.currentLevel,
    xp: bp.xp,
    xpToNextLevel: XP_PER_LEVEL - (bp.xp % XP_PER_LEVEL),
  };
}

export async function claimReward(userId: string, level: number): Promise<void> {
  const season = await getCurrentSeason();
  if (!season) throw AppError.notFound('Active season');

  await prisma.$transaction(async (tx) => {
    const bp = await tx.userBattlePass.findFirst({ where: { userId, seasonId: season.id } });
    if (!bp) throw AppError.notFound('Battle pass');
    if (bp.currentLevel < level) throw AppError.badRequest('Level not reached yet');

    // Prevent duplicate claims — check inside transaction for atomicity
    const existingClaim = await tx.transaction.findFirst({
      where: { userId, type: 'BATTLE_PASS_REWARD', memo: `Season reward level ${level}` },
    });
    if (existingClaim) throw AppError.conflict('Reward already claimed for this level');

    const reward = await tx.seasonReward.findFirst({
      where: { seasonId: season.id, level, isPremium: false },
    });
    if (!reward) throw AppError.notFound('Reward');

    // Check premium reward too if eligible
    const rewards = [reward];
    if (bp.isPremium) {
      const premReward = await tx.seasonReward.findFirst({
        where: { seasonId: season.id, level, isPremium: true },
      });
      if (premReward) rewards.push(premReward);
    }

    for (const r of rewards) {
      if (r.rewardType === 'TICKET') {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { ticketBalance: true },
        });
        if (!user) throw AppError.notFound('User');

        await tx.user.update({
          where: { id: userId },
          data: { ticketBalance: { increment: r.rewardAmount } },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: 'BATTLE_PASS_REWARD',
            currency: 'TICKET',
            amount: r.rewardAmount,
            direction: 'CREDIT',
            balanceBefore: user.ticketBalance,
            balanceAfter: user.ticketBalance + r.rewardAmount,
            memo: `Season reward level ${level}`,
          },
        });
      }
    }
  });
}

export async function upgradeToPremium(userId: string): Promise<void> {
  const season = await getCurrentSeason();
  if (!season) throw AppError.notFound('Active season');

  await prisma.$transaction(async (tx) => {
    const bp = await tx.userBattlePass.findFirst({ where: { userId, seasonId: season.id } });
    if (!bp) throw AppError.notFound('Battle pass');
    if (bp.isPremium) throw AppError.conflict('Already premium');

    const user = await tx.user.findUnique({ where: { id: userId }, select: { ticketBalance: true } });
    if (!user || user.ticketBalance < season.premiumPrice) throw AppError.insufficientBalance('TICKET');

    await tx.user.update({ where: { id: userId }, data: { ticketBalance: { decrement: season.premiumPrice } } });
    await tx.userBattlePass.update({ where: { id: bp.id }, data: { isPremium: true, purchasedAt: new Date() } });
  });
}

export async function addBattlePassXP(userId: string, xp: number): Promise<void> {
  const season = await getCurrentSeason();
  if (!season) return;

  let bp = await prisma.userBattlePass.findFirst({ where: { userId, seasonId: season.id } });
  if (!bp) {
    bp = await prisma.userBattlePass.create({ data: { userId, seasonId: season.id } });
  }

  const newXp = bp.xp + xp;
  const newLevel = Math.min(Math.floor(newXp / XP_PER_LEVEL), season.maxLevel);

  await prisma.userBattlePass.update({
    where: { id: bp.id },
    data: { xp: newXp, currentLevel: newLevel },
  });
}
