import { Worker, type Job, type ConnectionOptions } from 'bullmq';
import { prisma } from '../config/database.js';
import { createBullMQConnection } from '../config/redis.js';
import { updateScore } from '../modules/leaderboard/leaderboard.service.js';
import { creditTickets } from '../modules/economy/economy.service.js';

interface ScoreVerifyJobData {
  sessionId: string;
  userId: string;
  gameId: string;
  score: number;
  durationMs: number;
  replayHash: string | null;
}

interface VerificationResult {
  passed: boolean;
  confidence: number;
  checks: {
    name: string;
    passed: boolean;
    details: string;
  }[];
}

/**
 * Performs duration bounds check.
 * Ensures the game duration falls within the acceptable range.
 */
function checkDurationBounds(
  durationMs: number,
  minDurationMs: number,
  maxDurationMs: number
): { passed: boolean; details: string } {
  // Allow 10% grace on max duration for network latency
  const maxWithGrace = maxDurationMs * 1.1;

  if (durationMs < minDurationMs) {
    return {
      passed: false,
      details: `Duration ${durationMs}ms is below minimum ${minDurationMs}ms`,
    };
  }

  if (durationMs > maxWithGrace) {
    return {
      passed: false,
      details: `Duration ${durationMs}ms exceeds maximum ${maxWithGrace}ms`,
    };
  }

  return {
    passed: true,
    details: `Duration ${durationMs}ms is within bounds [${minDurationMs}, ${maxWithGrace}]`,
  };
}

/**
 * Checks if the score exceeds the game's maximum possible score.
 */
function checkScoreCeiling(
  score: number,
  maxScore: number
): { passed: boolean; details: string } {
  if (score > maxScore) {
    return {
      passed: false,
      details: `Score ${score} exceeds max score ${maxScore}`,
    };
  }

  return {
    passed: true,
    details: `Score ${score} is within ceiling of ${maxScore}`,
  };
}

/**
 * Checks if the score/duration ratio is suspiciously high.
 * A very high score achieved in very little time is suspicious.
 */
function checkScoreRate(
  score: number,
  durationMs: number,
  maxScore: number,
  maxDurationMs: number
): { passed: boolean; details: string } {
  if (durationMs <= 0) {
    return { passed: false, details: 'Duration is zero or negative' };
  }

  const scorePerSecond = score / (durationMs / 1000);

  // Calculate the maximum expected rate: max score achieved in minimum reasonable time
  // Use 1/4 of max duration as minimum reasonable time for max score
  const minReasonableTime = maxDurationMs / 4 / 1000;
  const maxReasonableRate = maxScore / minReasonableTime;

  // Allow 150% of max reasonable rate to account for variance
  const threshold = maxReasonableRate * 1.5;

  if (scorePerSecond > threshold) {
    return {
      passed: false,
      details: `Score rate ${scorePerSecond.toFixed(2)}/s exceeds threshold ${threshold.toFixed(2)}/s`,
    };
  }

  return {
    passed: true,
    details: `Score rate ${scorePerSecond.toFixed(2)}/s is within threshold ${threshold.toFixed(2)}/s`,
  };
}

/**
 * Performs statistical anomaly detection using z-score against the user's history.
 * Flags scores that are significantly higher than the user's average.
 */
async function checkStatisticalAnomaly(
  userId: string,
  gameId: string,
  score: number
): Promise<{ passed: boolean; details: string }> {
  // Get user's historical scores for this game
  const historicalSessions = await prisma.gameSession.findMany({
    where: {
      userId,
      gameId,
      status: 'verified',
      score: { not: null },
    },
    select: { score: true },
    orderBy: { completedAt: 'desc' },
    take: 50, // Use last 50 games for statistics
  });

  const scores = historicalSessions
    .map((s) => s.score)
    .filter((s): s is number => s !== null);

  // If fewer than 5 historical games, skip this check (not enough data)
  if (scores.length < 5) {
    return {
      passed: true,
      details: `Insufficient history (${scores.length} games). Skipping statistical check.`,
    };
  }

  // Calculate mean and standard deviation
  const n = scores.length;
  const mean = scores.reduce((sum, s) => sum + s, 0) / n;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Avoid division by zero (all scores identical)
  if (stdDev === 0) {
    const isAnomaly = score > mean * 1.5;
    return {
      passed: !isAnomaly,
      details: isAnomaly
        ? `Score ${score} significantly higher than constant history of ${mean}`
        : `Score ${score} is consistent with constant history of ${mean}`,
    };
  }

  // Calculate z-score
  const zScore = (score - mean) / stdDev;

  // Flag if z-score exceeds 3.5 (very unlikely under normal play)
  const threshold = 3.5;
  const passed = zScore <= threshold;

  return {
    passed,
    details: `Z-score: ${zScore.toFixed(2)} (mean: ${mean.toFixed(1)}, stdDev: ${stdDev.toFixed(1)}, threshold: ${threshold})`,
  };
}

/**
 * Runs all verification checks and computes a confidence score.
 */
async function verifyScore(
  data: ScoreVerifyJobData,
  game: { maxScore: number; maxDurationMs: number; minDurationMs: number; slug: string }
): Promise<VerificationResult> {
  const checks: VerificationResult['checks'] = [];

  // 1. Duration bounds check
  const durationCheck = checkDurationBounds(
    data.durationMs,
    game.minDurationMs,
    game.maxDurationMs
  );
  checks.push({ name: 'duration_bounds', ...durationCheck });

  // 2. Score ceiling check
  const ceilingCheck = checkScoreCeiling(data.score, game.maxScore);
  checks.push({ name: 'score_ceiling', ...ceilingCheck });

  // 3. Score rate check
  const rateCheck = checkScoreRate(
    data.score,
    data.durationMs,
    game.maxScore,
    game.maxDurationMs
  );
  checks.push({ name: 'score_rate', ...rateCheck });

  // 4. Statistical anomaly detection
  const anomalyCheck = await checkStatisticalAnomaly(
    data.userId,
    data.gameId,
    data.score
  );
  checks.push({ name: 'statistical_anomaly', ...anomalyCheck });

  // Calculate confidence score (0-1)
  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.passed).length;

  // Weight the checks: duration and ceiling are critical, rate and anomaly are softer
  const weights = {
    duration_bounds: 0.3,
    score_ceiling: 0.3,
    score_rate: 0.2,
    statistical_anomaly: 0.2,
  };

  let confidence = 0;
  for (const check of checks) {
    const weight = weights[check.name as keyof typeof weights] ?? 0.25;
    if (check.passed) {
      confidence += weight;
    }
  }

  // Clamp to [0, 1]
  confidence = Math.max(0, Math.min(1, confidence));

  // All critical checks must pass for overall pass
  const criticalPassed = checks
    .filter((c) => c.name === 'duration_bounds' || c.name === 'score_ceiling')
    .every((c) => c.passed);

  return {
    passed: criticalPassed && confidence >= 0.6,
    confidence,
    checks,
  };
}

/**
 * Calculates rewards based on score and wager.
 * Higher scores yield higher multipliers.
 */
function calculateRewards(
  score: number,
  maxScore: number,
  wagerAmount: number
): { ticketReward: number; xpReward: number } {
  // Score percentage (0 to 1)
  const scorePct = Math.min(score / maxScore, 1);

  // Reward multiplier curve: gentle at low scores, steeper at high scores
  // Uses a quadratic curve: multiplier = 0.5 + 2.5 * (scorePct ^ 1.5)
  const multiplier = 0.5 + 2.5 * Math.pow(scorePct, 1.5);

  const ticketReward = Math.floor(wagerAmount * multiplier);
  const xpReward = Math.floor(10 + score * 0.1); // Base 10 XP + 10% of score

  return { ticketReward, xpReward };
}

/**
 * Creates and starts the score verification BullMQ worker.
 */
export function createScoreVerifyWorker(): Worker {
  const worker = new Worker<ScoreVerifyJobData>(
    'score-verify',
    async (job: Job<ScoreVerifyJobData>) => {
      const data = job.data;
      console.log(`[ScoreVerify] Processing session ${data.sessionId}`);

      // Fetch the session and game details
      const session = await prisma.gameSession.findUnique({
        where: { id: data.sessionId },
        include: { game: true },
      });

      if (!session) {
        console.error(`[ScoreVerify] Session ${data.sessionId} not found`);
        return;
      }

      if (session.status !== 'completed') {
        console.warn(
          `[ScoreVerify] Session ${data.sessionId} is in status "${session.status}", expected "completed"`
        );
        return;
      }

      // Run verification
      const result = await verifyScore(data, session.game);

      console.log(
        `[ScoreVerify] Session ${data.sessionId}: passed=${result.passed}, confidence=${result.confidence.toFixed(3)}`
      );

      if (result.passed) {
        // Calculate rewards
        const { ticketReward, xpReward } = calculateRewards(
          data.score,
          session.game.maxScore,
          session.wagerAmount
        );

        // Update session as verified with rewards
        await prisma.$transaction(async (tx) => {
          await tx.gameSession.update({
            where: { id: data.sessionId },
            data: {
              status: 'verified',
              verificationScore: result.confidence,
              verifiedAt: new Date(),
              rewards: {
                ticketReward,
                xpReward,
                checks: result.checks,
              },
            },
          });

          // Award XP
          await tx.user.update({
            where: { id: data.userId },
            data: { xp: { increment: xpReward } },
          });
        });

        // Credit ticket rewards (uses its own transaction)
        if (ticketReward > 0) {
          await creditTickets(
            data.userId,
            ticketReward,
            'GAME_REWARD',
            `Reward for ${session.game.name} (score: ${data.score})`,
            data.sessionId
          );
        }

        // Update leaderboard
        await updateScore(session.game.slug, data.userId, data.score);

        console.log(
          `[ScoreVerify] Session ${data.sessionId} verified. Awarded ${ticketReward} tickets, ${xpReward} XP`
        );
      } else {
        // Mark session as rejected
        await prisma.gameSession.update({
          where: { id: data.sessionId },
          data: {
            status: 'rejected',
            verificationScore: result.confidence,
            verifiedAt: new Date(),
            rewards: {
              ticketReward: 0,
              xpReward: 0,
              checks: result.checks,
              rejectionReason: result.checks
                .filter((c) => !c.passed)
                .map((c) => `${c.name}: ${c.details}`)
                .join('; '),
            },
          },
        });

        console.warn(
          `[ScoreVerify] Session ${data.sessionId} REJECTED. Failed checks: ${result.checks
            .filter((c) => !c.passed)
            .map((c) => c.name)
            .join(', ')}`
        );
      }
    },
    {
      connection: createBullMQConnection() as unknown as ConnectionOptions,
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 60_000, // 100 jobs per minute
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[ScoreVerify] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[ScoreVerify] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[ScoreVerify] Worker error:', err.message);
  });

  console.log('[ScoreVerify] Worker started');

  return worker;
}
