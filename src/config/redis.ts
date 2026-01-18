import Redis from 'ioredis';
import logger from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true
});

// Event handlers
redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (error) => {
  logger.error('Redis error', error);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

// Connection health check
export async function checkRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    logger.info('Redis connection verified');
    return true;
  } catch (error) {
    logger.error('Redis connection failed', error as Error);
    return false;
  }
}

// Session store helpers
export async function setSession(sessionId: string, data: Record<string, unknown>, ttl = 86400): Promise<void> {
  await redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
}

export async function getSession(sessionId: string): Promise<Record<string, unknown> | null> {
  const data = await redis.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await redis.del(`session:${sessionId}`);
}

// Rate limiting helpers
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);
  const redisKey = `ratelimit:${key}`;

  // Remove old entries
  await redis.zremrangebyscore(redisKey, 0, windowStart);

  // Count current entries
  const count = await redis.zcard(redisKey);

  if (count >= limit) {
    const oldestEntry = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
    const resetAt = oldestEntry.length >= 2 ? parseInt(oldestEntry[1]) + (windowSeconds * 1000) : now + (windowSeconds * 1000);
    return { allowed: false, remaining: 0, resetAt };
  }

  // Add new entry
  await redis.zadd(redisKey, now, `${now}`);
  await redis.expire(redisKey, windowSeconds);

  return { allowed: true, remaining: limit - count - 1, resetAt: now + (windowSeconds * 1000) };
}

// Cache helpers
export async function setCache(key: string, data: unknown, ttl = 3600): Promise<void> {
  await redis.setex(`cache:${key}`, ttl, JSON.stringify(data));
}

export async function getCache<T>(key: string): Promise<T | null> {
  const data = await redis.get(`cache:${key}`);
  return data ? JSON.parse(data) : null;
}

export async function deleteCache(key: string): Promise<void> {
  await redis.del(`cache:${key}`);
}

export async function clearCachePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(`cache:${pattern}`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Graceful shutdown
export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('Redis disconnected');
  } catch (error) {
    logger.error('Error disconnecting Redis', error as Error);
  }
}

export default redis;
