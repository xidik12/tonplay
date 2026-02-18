import Redis from 'ioredis';
import { env } from './env.js';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times: number) {
      if (times > 10) {
        console.error('Redis: max retries reached, giving up');
        return null;
      }
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    reconnectOnError(err: Error) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

/**
 * Separate connection for BullMQ workers.
 * BullMQ requires its own dedicated connection that is not shared.
 */
export function createBullMQConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times: number) {
      if (times > 10) {
        return null;
      }
      return Math.min(times * 200, 5000);
    },
  });
}

export async function connectRedis(): Promise<void> {
  if (redis.status === 'ready') {
    return;
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Redis connection timeout after 10s'));
    }, 10_000);

    redis.once('ready', () => {
      clearTimeout(timeout);
      resolve();
    });

    redis.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  console.log('Redis disconnected');
}
