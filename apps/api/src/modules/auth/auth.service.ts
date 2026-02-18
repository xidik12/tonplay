import type { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { verifyTelegramInitData, generateReferralCode } from '../../lib/crypto.js';
import { AppError } from '../../middleware/error-handler.js';
import type { TelegramUser, JwtPayload } from '../../types/index.js';

export interface LoginResult {
  token: string;
  user: {
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
  };
  isNewUser: boolean;
}

/**
 * Verifies Telegram initData, upserts the user, processes referral if applicable,
 * and returns a signed JWT along with the user profile.
 */
export async function verifyAndLogin(
  app: FastifyInstance,
  initData: string,
  startParam?: string
): Promise<LoginResult> {
  // Verify the Telegram initData HMAC signature
  const parsed = verifyTelegramInitData(initData, env.BOT_TOKEN);
  if (!parsed) {
    throw AppError.unauthorized('Invalid or expired Telegram init data');
  }

  // Parse the user object from initData
  const userDataStr = parsed.user;
  if (!userDataStr) {
    throw AppError.badRequest('Missing user data in init data');
  }

  let telegramUser: TelegramUser;
  try {
    telegramUser = JSON.parse(userDataStr);
  } catch {
    throw AppError.badRequest('Invalid user data format');
  }

  if (!telegramUser.id || !telegramUser.first_name) {
    throw AppError.badRequest('Missing required user fields (id, first_name)');
  }

  const telegramId = BigInt(telegramUser.id);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { telegramId },
  });

  const isNewUser = !existingUser;

  // Upsert user with latest Telegram profile data
  const user = await prisma.user.upsert({
    where: { telegramId },
    update: {
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name ?? null,
      languageCode: telegramUser.language_code ?? 'en',
      isPremium: telegramUser.is_premium ?? false,
    },
    create: {
      telegramId,
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name ?? null,
      languageCode: telegramUser.language_code ?? 'en',
      isPremium: telegramUser.is_premium ?? false,
      referralCode: generateReferralCode(),
      ticketBalance: 500, // Welcome bonus
    },
  });

  // Process referral for new users
  if (isNewUser && startParam) {
    await processReferral(user.id, startParam);
  }

  // Generate JWT
  const payload: JwtPayload = {
    userId: user.id,
    telegramId: telegramId.toString(),
  };

  const token = app.jwt.sign(payload, { expiresIn: env.JWT_EXPIRY });

  return {
    token,
    user: {
      id: user.id,
      telegramId: telegramId.toString(),
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
    },
    isNewUser,
  };
}

/**
 * Processes a referral link. The startParam is expected to be a referral code.
 * Awards tickets to both the referrer and the new user.
 */
async function processReferral(newUserId: string, referralCode: string): Promise<void> {
  try {
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
    });

    if (!referrer) {
      // Invalid referral code, silently ignore
      return;
    }

    // Prevent self-referral
    if (referrer.id === newUserId) {
      return;
    }

    // Check if this referral already exists
    const existingReferral = await prisma.referral.findUnique({
      where: {
        referrerId_referredId: {
          referrerId: referrer.id,
          referredId: newUserId,
        },
      },
    });

    if (existingReferral) {
      return;
    }

    const referrerBonus = 100; // Tickets awarded to referrer
    const referredBonus = 50;  // Extra tickets for referred user

    await prisma.$transaction([
      // Create referral record
      prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: newUserId,
          tier: 1,
          totalEarnings: referrerBonus,
        },
      }),
      // Update referred_by on the new user
      prisma.user.update({
        where: { id: newUserId },
        data: { referredById: referrer.id },
      }),
      // Award bonus to referrer
      prisma.user.update({
        where: { id: referrer.id },
        data: { ticketBalance: { increment: referrerBonus } },
      }),
      // Award bonus to referred user
      prisma.user.update({
        where: { id: newUserId },
        data: { ticketBalance: { increment: referredBonus } },
      }),
      // Log referrer transaction
      prisma.transaction.create({
        data: {
          userId: referrer.id,
          type: 'REFERRAL_BONUS',
          currency: 'TICKET',
          amount: referrerBonus,
          direction: 'CREDIT',
          balanceBefore: referrer.ticketBalance,
          balanceAfter: referrer.ticketBalance + referrerBonus,
          memo: `Referral bonus for inviting user ${newUserId}`,
        },
      }),
    ]);
  } catch (error) {
    // Log but do not fail the login if referral processing fails
    console.error('Failed to process referral:', error);
  }
}

/**
 * Refreshes a JWT token for an existing authenticated user.
 */
export async function refreshToken(
  app: FastifyInstance,
  userId: string
): Promise<{ token: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw AppError.notFound('User');
  }

  if (user.isBanned) {
    throw AppError.forbidden('Account is banned');
  }

  const payload: JwtPayload = {
    userId: user.id,
    telegramId: user.telegramId.toString(),
  };

  const token = app.jwt.sign(payload, { expiresIn: env.JWT_EXPIRY });

  return { token };
}
