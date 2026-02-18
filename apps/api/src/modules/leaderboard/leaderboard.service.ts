import { redis } from '../../config/redis.js';
import { prisma } from '../../config/database.js';
import { AppError } from '../../middleware/error-handler.js';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string | null;
  firstName: string;
  score: number;
}

export interface UserRank {
  rank: number | null;
  score: number;
  totalPlayers: number;
}

type Period = 'global' | 'daily' | 'weekly';

/**
 * Returns the Redis key for a leaderboard based on game slug and time period.
 */
function getLeaderboardKey(gameSlug: string, period: Period): string {
  const now = new Date();

  switch (period) {
    case 'daily': {
      const day = now.toISOString().slice(0, 10); // YYYY-MM-DD
      return `lb:${gameSlug}:daily:${day}`;
    }
    case 'weekly': {
      // ISO week: get Monday of the current week
      const monday = new Date(now);
      const dayOfWeek = monday.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      monday.setDate(monday.getDate() + diff);
      const week = monday.toISOString().slice(0, 10);
      return `lb:${gameSlug}:weekly:${week}`;
    }
    case 'global':
    default:
      return `lb:${gameSlug}:global`;
  }
}

/**
 * Updates a user's score on the leaderboard.
 * Uses ZADD with GT flag to only update if the new score is higher.
 */
export async function updateScore(
  gameSlug: string,
  userId: string,
  score: number
): Promise<void> {
  const periods: Period[] = ['global', 'daily', 'weekly'];

  const pipeline = redis.pipeline();

  for (const period of periods) {
    const key = getLeaderboardKey(gameSlug, period);
    // ZADD with GT: only update if new score > current score
    pipeline.zadd(key, 'GT', score, userId);

    // Set TTL for time-bounded leaderboards
    if (period === 'daily') {
      pipeline.expire(key, 86400 * 2); // 2 days
    } else if (period === 'weekly') {
      pipeline.expire(key, 86400 * 14); // 2 weeks
    }
  }

  await pipeline.exec();
}

/**
 * Gets the top N entries from a leaderboard.
 */
export async function getLeaderboard(
  gameSlug: string,
  period: Period = 'global',
  limit: number = 50,
  offset: number = 0
): Promise<LeaderboardEntry[]> {
  // Validate game exists
  const game = await prisma.game.findUnique({
    where: { slug: gameSlug },
    select: { id: true },
  });

  if (!game) {
    throw AppError.notFound('Game');
  }

  const key = getLeaderboardKey(gameSlug, period);

  // ZREVRANGE returns members with highest scores first
  const results = await redis.zrevrange(key, offset, offset + limit - 1, 'WITHSCORES');

  if (results.length === 0) {
    return [];
  }

  // Parse results: [member1, score1, member2, score2, ...]
  const userIds: string[] = [];
  const scores: Map<string, number> = new Map();

  for (let i = 0; i < results.length; i += 2) {
    const memberId = results[i];
    const score = parseFloat(results[i + 1]);
    userIds.push(memberId);
    scores.set(memberId, score);
  }

  // Fetch user details from database
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      username: true,
      firstName: true,
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  // Build leaderboard entries preserving Redis order
  const entries: LeaderboardEntry[] = userIds.map((id, index) => {
    const user = userMap.get(id);
    return {
      rank: offset + index + 1,
      userId: id,
      username: user?.username ?? null,
      firstName: user?.firstName ?? 'Unknown',
      score: scores.get(id) ?? 0,
    };
  });

  return entries;
}

/**
 * Gets a specific user's rank and score on a leaderboard.
 */
export async function getUserRank(
  gameSlug: string,
  userId: string,
  period: Period = 'global'
): Promise<UserRank> {
  const game = await prisma.game.findUnique({
    where: { slug: gameSlug },
    select: { id: true },
  });

  if (!game) {
    throw AppError.notFound('Game');
  }

  const key = getLeaderboardKey(gameSlug, period);

  const pipeline = redis.pipeline();
  pipeline.zrevrank(key, userId); // 0-indexed rank (highest score = rank 0)
  pipeline.zscore(key, userId);
  pipeline.zcard(key);

  const results = await pipeline.exec();

  if (!results) {
    return { rank: null, score: 0, totalPlayers: 0 };
  }

  const [rankResult, scoreResult, cardResult] = results;

  const rank = rankResult[1] as number | null;
  const score = scoreResult[1] ? parseFloat(scoreResult[1] as string) : 0;
  const totalPlayers = (cardResult[1] as number) ?? 0;

  return {
    rank: rank !== null ? rank + 1 : null, // Convert 0-indexed to 1-indexed
    score,
    totalPlayers,
  };
}

/**
 * Removes expired daily and weekly leaderboard entries.
 * Called periodically by a scheduled job.
 */
export async function cleanupExpiredLeaderboards(): Promise<number> {
  // Redis TTL handles this automatically via EXPIRE, but we can
  // also scan for orphaned keys if needed.
  const pattern = 'lb:*:daily:*';
  let cursor = '0';
  let cleaned = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;

    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        // No TTL set, set one (2 days for daily)
        await redis.expire(key, 86400 * 2);
        cleaned++;
      }
    }
  } while (cursor !== '0');

  return cleaned;
}
