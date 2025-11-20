import Redis from 'ioredis';

let cachedClient: Redis | null = null;
let redisUnavailable = false;

const DEFAULT_URL = 'redis://localhost:6379';

export function getRedisClient(): Redis | null {
  if (redisUnavailable) {
    return null;
  }

  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.REDIS_URL?.trim() || DEFAULT_URL;

  try {
    cachedClient = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });

    cachedClient.on('error', (error) => {
      console.error('[redis] connection error', error);
    });

    return cachedClient;
  } catch (error) {
    console.warn('[redis] failed to initialize client, disabling cache layer', error);
    redisUnavailable = true;
    cachedClient = null;
    return null;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (!cachedClient) {
    return;
  }

  try {
    await cachedClient.quit();
  } finally {
    cachedClient = null;
  }
}
