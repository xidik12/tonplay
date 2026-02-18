import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { generateServerSeed, hashSeed, sha256 } from '../../lib/crypto.js';
import { AppError } from '../../middleware/error-handler.js';
import { Queue } from 'bullmq';
import { createBullMQConnection } from '../../config/redis.js';

// BullMQ queue for score verification jobs
const scoreVerifyQueue = new Queue('score-verify', {
  connection: createBullMQConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export interface GameInfo {
  id: string;
  slug: string;
  name: string;
  description: string;
  thumbnailUrl: string | null;
  category: string;
  entryCostMin: number;
  entryCostMax: number;
  maxScore: number;
  maxDurationMs: number;
}

export interface SessionStartResult {
  sessionId: string;
  serverSeedHash: string;
  status: string;
}

export interface SessionDetails {
  id: string;
  gameId: string;
  gameSlug: string;
  status: string;
  wagerAmount: number;
  wagerCurrency: string;
  serverSeedHash: string;
  serverSeed: string | null; // Only revealed after verification
  clientSeed: string | null;
  score: number | null;
  verificationScore: number | null;
  rewards: unknown;
  startedAt: Date;
  activatedAt: Date | null;
  completedAt: Date | null;
  verifiedAt: Date | null;
}

/**
 * Lists all enabled games.
 */
export async function listGames(): Promise<GameInfo[]> {
  // Try cache first
  const cached = await redis.get('games:enabled');
  if (cached) {
    return JSON.parse(cached);
  }

  const games = await prisma.game.findMany({
    where: { enabled: true },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      thumbnailUrl: true,
      category: true,
      entryCostMin: true,
      entryCostMax: true,
      maxScore: true,
      maxDurationMs: true,
    },
    orderBy: { name: 'asc' },
  });

  // Cache for 5 minutes
  await redis.set('games:enabled', JSON.stringify(games), 'EX', 300);

  return games;
}

/**
 * Starts a new game session.
 * Validates the game exists, checks wager bounds, deducts the wager,
 * generates provably fair seeds, and creates the session.
 */
export async function startSession(
  userId: string,
  gameSlug: string,
  wagerAmount: number,
  wagerCurrency: string = 'TICKET'
): Promise<SessionStartResult> {
  // Find the game
  const game = await prisma.game.findUnique({
    where: { slug: gameSlug },
  });

  if (!game || !game.enabled) {
    throw AppError.notFound('Game');
  }

  // Validate wager bounds
  if (wagerAmount < game.entryCostMin || wagerAmount > game.entryCostMax) {
    throw AppError.badRequest(
      `Wager must be between ${game.entryCostMin} and ${game.entryCostMax}`
    );
  }

  // Check for existing active sessions (prevent multi-session abuse)
  const activeSession = await prisma.gameSession.findFirst({
    where: {
      userId,
      status: { in: ['pending', 'active'] },
    },
  });

  if (activeSession) {
    throw AppError.conflict(
      'You already have an active game session. Complete or abandon it first.'
    );
  }

  // Generate provably fair seeds
  const serverSeed = generateServerSeed();
  const serverSeedHash = hashSeed(serverSeed);

  // Deduct wager and create session atomically
  const session = await prisma.$transaction(async (tx) => {
    // Check balance
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { ticketBalance: true, tplayBalance: true },
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    if (wagerCurrency === 'TICKET') {
      if (user.ticketBalance < wagerAmount) {
        throw AppError.insufficientBalance('TICKET');
      }

      // Deduct tickets
      await tx.user.update({
        where: { id: userId },
        data: { ticketBalance: { decrement: wagerAmount } },
      });

      // Log transaction
      await tx.transaction.create({
        data: {
          userId,
          type: 'GAME_WAGER',
          currency: 'TICKET',
          amount: wagerAmount,
          direction: 'DEBIT',
          balanceBefore: user.ticketBalance,
          balanceAfter: user.ticketBalance - wagerAmount,
          memo: `Wager for ${game.name}`,
        },
      });
    } else if (wagerCurrency === 'TPLAY') {
      const tplayBalance = Number(user.tplayBalance);
      if (tplayBalance < wagerAmount) {
        throw AppError.insufficientBalance('TPLAY');
      }

      await tx.user.update({
        where: { id: userId },
        data: { tplayBalance: { decrement: wagerAmount } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'GAME_WAGER',
          currency: 'TPLAY',
          amount: wagerAmount,
          direction: 'DEBIT',
          balanceBefore: tplayBalance,
          balanceAfter: tplayBalance - wagerAmount,
          memo: `Wager for ${game.name}`,
        },
      });
    } else {
      throw AppError.badRequest(`Unsupported wager currency: ${wagerCurrency}`);
    }

    // Create session
    const newSession = await tx.gameSession.create({
      data: {
        userId,
        gameId: game.id,
        status: 'pending',
        wagerAmount,
        wagerCurrency,
        serverSeed,
        serverSeedHash,
      },
    });

    return newSession;
  });

  return {
    sessionId: session.id,
    serverSeedHash: session.serverSeedHash,
    status: session.status,
  };
}

/**
 * Activates a pending session after the client provides their seed.
 * The session transitions from "pending" to "active".
 */
export async function activateSession(
  userId: string,
  sessionId: string,
  clientSeed: string
): Promise<{ status: string }> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw AppError.notFound('Game session');
  }

  if (session.userId !== userId) {
    throw AppError.forbidden('This is not your session');
  }

  if (session.status !== 'pending') {
    throw AppError.gameSessionInvalid(
      `Session cannot be activated from status "${session.status}"`
    );
  }

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      clientSeed,
      status: 'active',
      activatedAt: new Date(),
    },
  });

  return { status: 'active' };
}

/**
 * Completes a game session by submitting the score and optional replay data.
 * Enqueues a score verification job.
 */
export async function completeSession(
  userId: string,
  sessionId: string,
  score: number,
  replayData?: Buffer
): Promise<{ status: string; sessionId: string }> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { game: true },
  });

  if (!session) {
    throw AppError.notFound('Game session');
  }

  if (session.userId !== userId) {
    throw AppError.forbidden('This is not your session');
  }

  if (session.status !== 'active') {
    throw AppError.gameSessionInvalid(
      `Session cannot be completed from status "${session.status}"`
    );
  }

  // Basic server-side validation
  if (score < 0) {
    throw AppError.badRequest('Score cannot be negative');
  }

  if (score > session.game.maxScore) {
    throw AppError.badRequest(`Score exceeds maximum of ${session.game.maxScore}`);
  }

  // Check duration bounds
  const now = new Date();
  const durationMs = now.getTime() - (session.activatedAt?.getTime() ?? session.startedAt.getTime());

  if (durationMs < session.game.minDurationMs) {
    throw AppError.gameSessionInvalid('Game completed too quickly');
  }

  if (durationMs > session.game.maxDurationMs * 1.1) {
    // 10% grace for network latency
    throw AppError.gameSessionInvalid('Game session has expired');
  }

  // Compute replay hash if replay data is provided
  const replayHash = replayData ? sha256(replayData) : null;

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: {
      status: 'completed',
      score,
      replayData: replayData ?? null,
      replayHash,
      completedAt: now,
    },
  });

  // Enqueue score verification job
  await scoreVerifyQueue.add(
    'verify',
    {
      sessionId,
      userId,
      gameId: session.gameId,
      score,
      durationMs,
      replayHash,
    },
    {
      priority: 1,
    }
  );

  return { status: 'completed', sessionId };
}

/**
 * Gets session details. Reveals the server seed only if the session is verified.
 */
export async function getSessionDetails(
  userId: string,
  sessionId: string
): Promise<SessionDetails> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { game: { select: { slug: true } } },
  });

  if (!session) {
    throw AppError.notFound('Game session');
  }

  if (session.userId !== userId) {
    throw AppError.forbidden('This is not your session');
  }

  return {
    id: session.id,
    gameId: session.gameId,
    gameSlug: session.game.slug,
    status: session.status,
    wagerAmount: session.wagerAmount,
    wagerCurrency: session.wagerCurrency,
    serverSeedHash: session.serverSeedHash,
    // Only reveal the server seed after verification for provable fairness
    serverSeed: session.status === 'verified' ? session.serverSeed : null,
    clientSeed: session.clientSeed,
    score: session.score,
    verificationScore: session.verificationScore,
    rewards: session.rewards,
    startedAt: session.startedAt,
    activatedAt: session.activatedAt,
    completedAt: session.completedAt,
    verifiedAt: session.verifiedAt,
  };
}
