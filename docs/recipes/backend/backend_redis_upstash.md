---
title: "Global Caching with Upstash Redis"
platform: backend
framework: serverless
feature_tags:
  - cache
  - redis
usage_tier: recipe
framework_version: "1.x"
tech_stack:
  - upstash
  - redis
difficulty: beginner
last_updated: 2025-12-08
recommended: true
---

# Global Caching with Upstash Redis

> **Summary:** Use Upstash Redis for serverless-friendly caching. This recipe highlights the difference between using the HTTP client (for Edge/Workers) and TCP client (for long-running Node.js services).

## Prerequisites

- [ ] Upstash Account & Database

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| @upstash/redis | Latest | HTTP Client (Edge friendly) |
| ioredis | Latest | TCP Client (Node friendly) |

## Implementation

### 1. Edge / Serverless (Cloudflare Worker or Next.js)

Use the `@upstash/redis` package. It fetches via REST API, avoiding connection limit issues common in serverless.

```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL || '',
  token: process.env.UPSTASH_REDIS_TOKEN || ''
})

export async function getCachedData(key: string) {
  try {
    // 1. Try Cache
    const cached = await redis.get(key);
    if (cached) return cached;
  } catch (error) {
    console.warn('Cache miss due to error:', error);
  }

  try {
    // 2. Fetch Fresh
    const data = await fetchFromDb();

    // 3. Set Cache (Expire in 1 hour)
    await redis.set(key, JSON.stringify(data), { ex: 3600 });

    return data;
  } catch (error) {
    console.error('Failed to fetch or cache data:', error);
    throw error;
  }
}
```

### 2. Node.js Persistence (Fastify/Background Jobs)

For long-running processes (like a BullMQ worker), a persistent TCP connection via `ioredis` is more efficient/performant than HTTP overhead.

```typescript
import IORedis from 'ioredis';
import { Queue, Worker } from 'bullmq';

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null // Required for BullMQ
});

// 1. Create a Queue
const jobQueue = new Queue('video-processing', { connection });

// 2. Add a Job
await jobQueue.add('transcode', { fileId: '123' });

// 3. Create a Worker to process jobs
const worker = new Worker('video-processing', async (job) => {
  console.log('Processing job:', job.data);
  // Perform long running task...
}, { connection });
```

## Common Pitfalls

### 1. Connection Limits

**Problem:** Using `ioredis` inside a Serverless Function (Lambda/Worker). Every function invocation opens a new DB connection, quickly hitting the Redis max connection limit.

**Solution:** ALWAYS use `@upstash/redis` (HTTP) in serverless environments.

### 2. Latency

**Problem:** Redis is in US-East but your Cloudflare Worker is running in Tokyo.

**Solution:** Use Upstash Global Database replication to read from the nearest replica.
