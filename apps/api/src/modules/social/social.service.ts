import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';
import { STREAK_REWARDS } from '@tonplay/shared';

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastClaimDate: Date | null;
  nextReward: number;
}

export interface MissionInfo {
  id: string;
  missionId: string;
  slug: string;
  title: string;
  description: string;
  type: string;
  targetValue: number;
  progress: number;
  isCompleted: boolean;
  claimedAt: Date | null;
  rewardType: string;
  rewardAmount: number;
}

export interface ReferralStats {
  totalReferrals: number;
  totalEarnings: number;
}

/**
 * Gets or creates a user's streak record and returns streak info.
 */
export async function getStreak(userId: string): Promise<StreakInfo> {
  let streak = await prisma.userStreak.findUnique({
    where: { userId },
  });

  if (!streak) {
    streak = await prisma.userStreak.create({
      data: { userId },
    });
  }

  return {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastClaimDate: streak.lastClaimDate,
    nextReward: STREAK_REWARDS[(streak.currentStreak) % 7],
  };
}

/**
 * Claims a daily streak reward.
 * Increments the streak if within 1 day of last claim, resets if gap > 1 day.
 * Awards tickets based on the streak day.
 */
export async function claimStreak(userId: string): Promise<StreakInfo> {
  return await prisma.$transaction(async (tx) => {
    let streak = await tx.userStreak.findUnique({
      where: { userId },
    });

    if (!streak) {
      streak = await tx.userStreak.create({
        data: { userId },
      });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (streak.lastClaimDate) {
      const lastClaim = new Date(streak.lastClaimDate);
      const lastClaimDay = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());

      // Already claimed today
      if (lastClaimDay.getTime() === today.getTime()) {
        throw AppError.conflict('Daily streak already claimed today');
      }

      // Check if the gap is more than 1 day (missed a day)
      const diffMs = today.getTime() - lastClaimDay.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays > 1) {
        // Reset streak
        streak = await tx.userStreak.update({
          where: { userId },
          data: {
            currentStreak: 1,
            lastClaimDate: now,
          },
        });
      } else {
        // Increment streak
        const newStreak = streak.currentStreak + 1;
        const newLongest = Math.max(newStreak, streak.longestStreak);
        streak = await tx.userStreak.update({
          where: { userId },
          data: {
            currentStreak: newStreak,
            longestStreak: newLongest,
            lastClaimDate: now,
          },
        });
      }
    } else {
      // First ever claim
      streak = await tx.userStreak.update({
        where: { userId },
        data: {
          currentStreak: 1,
          longestStreak: Math.max(1, streak.longestStreak),
          lastClaimDate: now,
        },
      });
    }

    // Award tickets atomically within the same transaction
    const rewardIndex = (streak.currentStreak - 1) % 7;
    const reward = STREAK_REWARDS[rewardIndex];

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { ticketBalance: true },
    });
    if (!user) throw AppError.notFound('User');

    await tx.user.update({
      where: { id: userId },
      data: { ticketBalance: { increment: reward } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'STREAK_REWARD',
        currency: 'TICKET',
        amount: reward,
        direction: 'CREDIT',
        balanceBefore: user.ticketBalance,
        balanceAfter: user.ticketBalance + reward,
        memo: `Daily streak reward (day ${streak.currentStreak})`,
      },
    });

    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastClaimDate: streak.lastClaimDate,
      nextReward: STREAK_REWARDS[streak.currentStreak % 7],
    };
  });
}

/**
 * Gets the user's daily missions. Auto-assigns 3 daily missions if none exist for today.
 */
export async function getUserMissions(userId: string): Promise<MissionInfo[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Check for existing daily missions assigned today
  let userMissions = await prisma.userMission.findMany({
    where: {
      userId,
      assignedAt: {
        gte: todayStart,
        lt: todayEnd,
      },
      mission: {
        isDaily: true,
      },
    },
    include: {
      mission: true,
    },
  });

  // If no daily missions for today, auto-assign 3
  if (userMissions.length === 0) {
    const dailyMissions = await prisma.mission.findMany({
      where: {
        isDaily: true,
        enabled: true,
      },
    });

    if (dailyMissions.length > 0) {
      // Shuffle and pick up to 3
      const shuffled = dailyMissions.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 3);

      for (const mission of selected) {
        await prisma.userMission.create({
          data: {
            userId,
            missionId: mission.id,
            assignedAt: now,
          },
        }).catch(() => {
          // Ignore unique constraint errors (mission already assigned)
        });
      }

      // Re-fetch after assignment
      userMissions = await prisma.userMission.findMany({
        where: {
          userId,
          assignedAt: {
            gte: todayStart,
            lt: todayEnd,
          },
          mission: {
            isDaily: true,
          },
        },
        include: {
          mission: true,
        },
      });
    }
  }

  return userMissions.map(um => ({
    id: um.id,
    missionId: um.missionId,
    slug: um.mission.slug,
    title: um.mission.title,
    description: um.mission.description,
    type: um.mission.type,
    targetValue: um.mission.targetValue,
    progress: um.progress,
    isCompleted: um.isCompleted,
    claimedAt: um.claimedAt,
    rewardType: um.mission.rewardType,
    rewardAmount: um.mission.rewardAmount,
  }));
}

/**
 * Claims a completed mission's reward.
 */
export async function claimMissionReward(userId: string, missionId: string): Promise<MissionInfo> {
  return await prisma.$transaction(async (tx) => {
    const userMission = await tx.userMission.findFirst({
      where: {
        id: missionId,
        userId,
      },
      include: {
        mission: true,
      },
    });

    if (!userMission) {
      throw AppError.notFound('Mission');
    }

    if (!userMission.isCompleted) {
      throw AppError.badRequest('Mission is not completed yet');
    }

    if (userMission.claimedAt) {
      throw AppError.conflict('Mission reward already claimed');
    }

    // Credit reward atomically within the same transaction
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { ticketBalance: true },
    });
    if (!user) throw AppError.notFound('User');

    await tx.user.update({
      where: { id: userId },
      data: { ticketBalance: { increment: userMission.mission.rewardAmount } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'MISSION_REWARD',
        currency: 'TICKET',
        amount: userMission.mission.rewardAmount,
        direction: 'CREDIT',
        balanceBefore: user.ticketBalance,
        balanceAfter: user.ticketBalance + userMission.mission.rewardAmount,
        memo: `Mission reward: ${userMission.mission.title}`,
      },
    });

    // Mark as claimed
    const updated = await tx.userMission.update({
      where: { id: missionId },
      data: { claimedAt: new Date() },
      include: { mission: true },
    });

    return {
      id: updated.id,
      missionId: updated.missionId,
      slug: updated.mission.slug,
      title: updated.mission.title,
      description: updated.mission.description,
      type: updated.mission.type,
      targetValue: updated.mission.targetValue,
      progress: updated.progress,
      isCompleted: updated.isCompleted,
      claimedAt: updated.claimedAt,
      rewardType: updated.mission.rewardType,
      rewardAmount: updated.mission.rewardAmount,
    };
  });
}

/**
 * Updates progress on matching uncompleted daily missions for a given type.
 */
export async function updateMissionProgress(
  userId: string,
  type: string,
  incrementValue: number
): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Find matching uncompleted daily missions
  const missions = await prisma.userMission.findMany({
    where: {
      userId,
      isCompleted: false,
      assignedAt: {
        gte: todayStart,
        lt: todayEnd,
      },
      mission: {
        type,
        isDaily: true,
      },
    },
    include: {
      mission: true,
    },
  });

  for (const um of missions) {
    const newProgress = um.progress + incrementValue;
    const isComplete = newProgress >= um.mission.targetValue;

    await prisma.userMission.update({
      where: { id: um.id },
      data: {
        progress: newProgress,
        isCompleted: isComplete,
      },
    });
  }
}

/**
 * Gets referral statistics for a user.
 */
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    select: { totalEarnings: true },
  });

  const totalReferrals = referrals.length;
  const totalEarnings = referrals.reduce((sum, r) => sum + r.totalEarnings, 0);

  return {
    totalReferrals,
    totalEarnings,
  };
}
