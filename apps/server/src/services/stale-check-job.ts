/**
 * Background job for checking stale documents
 * Runs periodically to detect documents whose source URLs have changed
 */

import crypto from 'node:crypto';
import { type Document, getPool } from '@synthesis/db';

// Configuration
const BATCH_SIZE = Number.parseInt(process.env.STALE_CHECK_BATCH_SIZE || '500', 10);
const MAX_PARALLEL_WORKERS = Number.parseInt(process.env.STALE_CHECK_WORKERS || '5', 10);
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.STALE_CHECK_TIMEOUT || '10000', 10);
const RATE_LIMIT_PER_HOST = Number.parseInt(process.env.STALE_CHECK_RATE_LIMIT || '5', 10); // requests per second per host
// TODO: Implement retry logic with these constants
// const MAX_RETRIES = 3;
// const RETRY_DELAYS = [60000, 300000, 900000]; // 1min, 5min, 15min

interface StaleCheckResult {
  documentId: string;
  isStale: boolean;
  newHash?: string;
  error?: string;
  errorType?: 'transient' | 'permanent';
}

interface JobStats {
  total: number;
  checked: number;
  stale: number;
  unchanged: number;
  errors: number;
  startedAt: Date;
  endedAt?: Date;
}

// Rate limiter per host
const hostLastRequest = new Map<string, number>();

async function waitForRateLimit(host: string): Promise<void> {
  const now = Date.now();
  const lastRequest = hostLastRequest.get(host) || 0;
  const minInterval = 1000 / RATE_LIMIT_PER_HOST;
  const waitTime = Math.max(0, lastRequest + minInterval - now);

  if (waitTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  hostLastRequest.set(host, Date.now());
}

function getHostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Synthesis-StaleChecker/1.0',
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeContent(content: string): string {
  // Normalize: trim whitespace, lowercase headers, remove tracking params
  return content.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
}

function computeContentHash(content: string): string {
  const normalized = normalizeContent(content);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function checkDocument(doc: Document): Promise<StaleCheckResult> {
  if (!doc.source_url) {
    return { documentId: doc.id, isStale: false };
  }

  const host = getHostFromUrl(doc.source_url);
  await waitForRateLimit(host);

  try {
    const response = await fetchWithTimeout(doc.source_url, FETCH_TIMEOUT_MS);

    // Classify HTTP errors
    if (!response.ok) {
      const status = response.status;

      // Permanent failures (4xx except 429/408)
      if (status >= 400 && status < 500 && status !== 429 && status !== 408) {
        return {
          documentId: doc.id,
          isStale: false,
          error: `HTTP ${status}`,
          errorType: 'permanent',
        };
      }

      // Transient failures (5xx, 429, 408)
      return {
        documentId: doc.id,
        isStale: false,
        error: `HTTP ${status}`,
        errorType: 'transient',
      };
    }

    const content = await response.text();
    const newHash = computeContentHash(content);

    // Compare with stored hash
    const isStale = doc.source_url_hash !== null && doc.source_url_hash !== newHash;

    return {
      documentId: doc.id,
      isStale,
      newHash,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Network errors are transient
    return {
      documentId: doc.id,
      isStale: false,
      error: message,
      errorType: 'transient',
    };
  }
}

async function processDocumentBatch(
  documents: Document[],
  stats: JobStats,
  onProgress?: (stats: JobStats) => void
): Promise<void> {
  const pool = getPool();

  // Process in parallel with worker limit
  const chunks: Document[][] = [];
  for (let i = 0; i < documents.length; i += MAX_PARALLEL_WORKERS) {
    chunks.push(documents.slice(i, i + MAX_PARALLEL_WORKERS));
  }

  for (const chunk of chunks) {
    const results = await Promise.all(chunk.map(checkDocument));

    for (const result of results) {
      stats.checked++;

      if (result.error) {
        stats.errors++;

        // Log error but continue
        console.warn(`Stale check error for ${result.documentId}: ${result.error}`);

        // Update document with error status if permanent
        if (result.errorType === 'permanent') {
          await pool.query(
            `UPDATE documents 
             SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{source_status}', '"invalid"'),
                 last_checked_at = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [result.documentId]
          );
        }
      } else if (result.isStale) {
        stats.stale++;

        // Mark document as stale
        await pool.query(
          `UPDATE documents 
           SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{is_stale}', 'true'),
               last_checked_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [result.documentId]
        );

        console.info(`Document ${result.documentId} marked as stale`);
      } else {
        stats.unchanged++;

        // Update last_checked_at and hash
        await pool.query(
          `UPDATE documents 
           SET source_url_hash = COALESCE($2, source_url_hash),
               last_checked_at = NOW(),
               updated_at = NOW(),
               metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{is_stale}', 'false')
           WHERE id = $1`,
          [result.documentId, result.newHash]
        );
      }
    }

    if (onProgress) {
      onProgress(stats);
    }
  }
}

/**
 * Run the stale document check job
 * @param onProgress Optional callback for progress updates
 * @returns Job statistics
 */
export async function runStaleCheckJob(onProgress?: (stats: JobStats) => void): Promise<JobStats> {
  const pool = getPool();
  const stats: JobStats = {
    total: 0,
    checked: 0,
    stale: 0,
    unchanged: 0,
    errors: 0,
    startedAt: new Date(),
  };

  console.info('Starting stale document check job...');

  try {
    // Get total count of documents with source URLs
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM documents WHERE source_url IS NOT NULL'
    );
    stats.total = Number.parseInt(countResult.rows[0].count, 10);

    console.info(`Found ${stats.total} documents with source URLs to check`);

    // Process in batches, ordered by last_checked_at (oldest first)
    let offset = 0;

    while (offset < stats.total) {
      const batchResult = await pool.query<Document>(
        `SELECT * FROM documents 
         WHERE source_url IS NOT NULL 
         ORDER BY last_checked_at ASC NULLS FIRST, created_at ASC
         LIMIT $1 OFFSET $2`,
        [BATCH_SIZE, offset]
      );

      if (batchResult.rows.length === 0) break;

      await processDocumentBatch(batchResult.rows, stats, onProgress);

      offset += batchResult.rows.length;

      console.info(`Processed ${stats.checked}/${stats.total} documents`);
    }

    stats.endedAt = new Date();

    console.info('Stale check job completed:', {
      total: stats.total,
      checked: stats.checked,
      stale: stats.stale,
      unchanged: stats.unchanged,
      errors: stats.errors,
      duration: `${(stats.endedAt.getTime() - stats.startedAt.getTime()) / 1000}s`,
    });

    return stats;
  } catch (error) {
    stats.endedAt = new Date();
    console.error('Stale check job failed:', error);
    throw error;
  }
}

// Cron-style scheduler
let scheduledJob: NodeJS.Timeout | null = null;

/**
 * Start the scheduled stale check job
 * Default: runs daily at 2:00 AM UTC
 */
export function startStaleCheckScheduler(): void {
  const cronSchedule = process.env.STALE_CHECK_CRON || '0 2 * * *';

  // Simple cron parser for daily jobs
  // Format: minute hour * * * (we only support daily for now)
  // Validate cron expression: must be "minute hour * * *"
  let minute = 0;
  let hour = 2;
  const cronParts = cronSchedule.trim().split(/\s+/);

  if (cronParts.length === 5) {
    const parsedMinute = Number.parseInt(cronParts[0], 10);
    const parsedHour = Number.parseInt(cronParts[1], 10);
    if (
      Number.isInteger(parsedMinute) &&
      parsedMinute >= 0 &&
      parsedMinute <= 59 &&
      Number.isInteger(parsedHour) &&
      parsedHour >= 0 &&
      parsedHour <= 23 &&
      cronParts[2] === '*' &&
      cronParts[3] === '*' &&
      cronParts[4] === '*'
    ) {
      minute = parsedMinute;
      hour = parsedHour;
    } else {
      console.error(
        `Invalid STALE_CHECK_CRON format: "${cronSchedule}". Falling back to default "0 2 * * *" (2:00 AM UTC daily).`
      );
    }
  } else {
    console.error(
      `Invalid STALE_CHECK_CRON format: "${cronSchedule}". Falling back to default "0 2 * * *" (2:00 AM UTC daily).`
    );
  }

  function scheduleNextRun() {
    const now = new Date();
    const next = new Date();
    next.setUTCHours(hour, minute, 0, 0);

    // If we've passed today's run time, schedule for tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    const delay = next.getTime() - now.getTime();

    console.info(`Next stale check scheduled for ${next.toISOString()}`);

    scheduledJob = setTimeout(async () => {
      try {
        await runStaleCheckJob();
      } catch (error) {
        console.error('Scheduled stale check failed:', error);
      }

      // Schedule next run
      scheduleNextRun();
    }, delay);
  }

  scheduleNextRun();
}

/**
 * Stop the scheduled stale check job
 */
export function stopStaleCheckScheduler(): void {
  if (scheduledJob) {
    clearTimeout(scheduledJob);
    scheduledJob = null;
    console.info('Stale check scheduler stopped');
  }
}

/**
 * Get stale documents for a collection
 */
export async function getStaleDocuments(collectionId?: string): Promise<Document[]> {
  const pool = getPool();

  let sql = `
    SELECT * FROM documents 
    WHERE source_url IS NOT NULL 
    AND metadata->>'is_stale' = 'true'
  `;
  const params: string[] = [];

  if (collectionId) {
    sql += ' AND collection_id = $1';
    params.push(collectionId);
  }

  sql += ' ORDER BY updated_at DESC';

  const result = await pool.query<Document>(sql, params);
  return result.rows;
}
