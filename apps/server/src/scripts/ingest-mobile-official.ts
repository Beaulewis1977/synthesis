#!/usr/bin/env tsx
/**
 * GPT Phase 1: Official Mobile Documentation Ingestion Script
 *
 * This script ingests official documentation from Flutter/mobile SDKs
 * (Supabase, Firebase, Stripe, etc.) using the Playwright scraper.
 * It extracts content, applies mobile metadata, and stores documents
 * for feature-aware RAG retrieval.
 *
 * Usage:
 *   pnpm --filter @synthesis/server tsx src/scripts/ingest-mobile-official.ts
 *   pnpm --filter @synthesis/server tsx src/scripts/ingest-mobile-official.ts --dry-run
 *   pnpm --filter @synthesis/server tsx src/scripts/ingest-mobile-official.ts --provider supabase
 *
 * Environment variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   STORAGE_PATH - Path for storing files (default: ./storage)
 *   DISABLE_BROWSER_SANDBOX - Set to 'true' in container environments
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { closePool, createCollection, createDocument, getPool, query } from '@synthesis/db';
import type {
  ContentPlatform,
  DocumentMetadata,
  MobileFeatureTag,
  UsageTier,
} from '@synthesis/shared';
import { type ScrapedPage, scrapeUrl } from '../ingestion-agent/scraper.js';
import { ingestDocument } from '../pipeline/orchestrator.js';

// Collection configuration
const COLLECTION_NAME = 'mobile-official-docs';
const COLLECTION_DESCRIPTION =
  'Official documentation from Flutter SDK providers (Supabase, Firebase, Stripe, RevenueCat, etc.)';

// Documentation source definitions
interface DocSource {
  provider: string;
  name: string;
  urls: DocUrl[];
  platform: ContentPlatform;
  featureTags: MobileFeatureTag[];
  usageTier: UsageTier;
}

interface DocUrl {
  url: string;
  title: string;
  featureTags?: MobileFeatureTag[]; // Override provider tags
}

// Official documentation sources with curated URLs
const DOC_SOURCES: DocSource[] = [
  {
    provider: 'supabase',
    name: 'Supabase Flutter',
    platform: 'mobile',
    featureTags: ['auth', 'realtime'],
    usageTier: 'reference',
    urls: [
      {
        url: 'https://supabase.com/docs/guides/getting-started/quickstarts/flutter',
        title: 'Supabase Flutter Quickstart',
      },
      {
        url: 'https://supabase.com/docs/guides/auth/auth-helpers/flutter-auth',
        title: 'Supabase Flutter Auth',
        featureTags: ['auth', 'social_auth'],
      },
      {
        url: 'https://supabase.com/docs/guides/realtime/broadcast?framework=flutter',
        title: 'Supabase Realtime for Flutter',
        featureTags: ['realtime', 'sync'],
      },
      {
        url: 'https://supabase.com/docs/reference/dart/introduction',
        title: 'Supabase Dart Client Reference',
      },
    ],
  },
  {
    provider: 'firebase',
    name: 'Firebase Flutter',
    platform: 'mobile',
    featureTags: ['auth', 'push_notifications'],
    usageTier: 'reference',
    urls: [
      {
        url: 'https://firebase.google.com/docs/flutter/setup',
        title: 'Firebase Flutter Setup',
      },
      {
        url: 'https://firebase.google.com/docs/auth/flutter/start',
        title: 'Firebase Auth for Flutter',
        featureTags: ['auth'],
      },
      {
        url: 'https://firebase.google.com/docs/cloud-messaging/flutter/client',
        title: 'Firebase Cloud Messaging Flutter Client',
        featureTags: ['push_notifications', 'realtime'],
      },
      {
        url: 'https://firebase.google.com/docs/cloud-messaging/flutter/receive',
        title: 'Firebase Cloud Messaging - Receive Messages',
        featureTags: ['push_notifications'],
      },
    ],
  },
  {
    provider: 'stripe',
    name: 'Stripe Flutter',
    platform: 'mobile',
    featureTags: ['payments', 'billing'],
    usageTier: 'reference',
    urls: [
      {
        url: 'https://stripe.com/docs/payments/accept-a-payment?platform=flutter',
        title: 'Stripe Accept Payment - Flutter',
        featureTags: ['payments'],
      },
      {
        url: 'https://pub.dev/packages/flutter_stripe',
        title: 'flutter_stripe Package',
        featureTags: ['payments'],
      },
    ],
  },
  {
    provider: 'revenuecat',
    name: 'RevenueCat Flutter',
    platform: 'mobile',
    featureTags: ['subscriptions', 'billing', 'payments'],
    usageTier: 'reference',
    urls: [
      {
        url: 'https://www.revenuecat.com/docs/getting-started/installation/flutter',
        title: 'RevenueCat Flutter Installation',
        featureTags: ['subscriptions'],
      },
      {
        url: 'https://www.revenuecat.com/docs/making-purchases/flutter',
        title: 'RevenueCat Making Purchases - Flutter',
        featureTags: ['subscriptions', 'payments'],
      },
      {
        url: 'https://www.revenuecat.com/docs/subscription-guidance/subscription-offers/flutter',
        title: 'RevenueCat Subscription Offers - Flutter',
        featureTags: ['subscriptions', 'billing'],
      },
    ],
  },
  {
    provider: 'isar',
    name: 'Isar Database',
    platform: 'mobile',
    featureTags: ['offline', 'local_storage', 'sync'],
    usageTier: 'reference',
    urls: [
      {
        url: 'https://isar.dev/tutorials/quickstart.html',
        title: 'Isar Quickstart',
        featureTags: ['offline', 'local_storage'],
      },
      {
        url: 'https://isar.dev/queries.html',
        title: 'Isar Queries',
        featureTags: ['offline', 'local_storage'],
      },
      {
        url: 'https://isar.dev/transactions.html',
        title: 'Isar Transactions',
        featureTags: ['offline', 'sync'],
      },
    ],
  },
];

/**
 * Gets or creates the official docs collection
 */
async function getOrCreateDocsCollection(): Promise<string> {
  const pool = getPool();

  // Check if collection exists
  const { rows } = await pool.query('SELECT id FROM collections WHERE name = $1', [
    COLLECTION_NAME,
  ]);

  if (rows.length > 0) {
    console.info(`[Official Docs] Found existing collection: ${COLLECTION_NAME}`);
    return rows[0].id;
  }

  // Create new collection
  const collection = await createCollection(COLLECTION_NAME, COLLECTION_DESCRIPTION);
  console.info(`[Official Docs] Created new collection: ${COLLECTION_NAME} (${collection.id})`);
  return collection.id;
}

/**
 * Generates a URL hash for deduplication
 */
function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}

/**
 * Checks if URL has already been ingested
 */
async function isAlreadyIngested(collectionId: string, url: string): Promise<boolean> {
  const pool = getPool();
  const urlHash = hashUrl(url);

  const { rows } = await pool.query(
    'SELECT id FROM documents WHERE collection_id = $1 AND source_url_hash = $2',
    [collectionId, urlHash]
  );

  return rows.length > 0;
}

/**
 * Builds document metadata for official docs
 */
function buildOfficialDocsMetadata(
  source: DocSource,
  docUrl: DocUrl,
  scrapedPage: ScrapedPage
): DocumentMetadata {
  // Use URL-specific feature tags if provided, otherwise use provider defaults
  const featureTags = docUrl.featureTags ?? source.featureTags;

  return {
    // Core document metadata
    doc_type: 'official_doc', // Must match DocumentType union
    source_url: docUrl.url,
    source_type: 'web', // Added to SourceType in shared types
    source_quality: 'official',

    // Mobile feature metadata (GPT Phase 1)
    platform: source.platform,
    feature_tags: featureTags,
    usage_tier: source.usageTier,
    recommended: true, // Official docs are recommended

    // Provider context
    provider: source.provider,
    provider_name: source.name,

    // Scraped metadata
    page_title: scrapedPage.title,
    page_description: scrapedPage.description,

    // Timestamps
    ingested_at: new Date().toISOString(),
    last_verified: new Date().toISOString(),
  };
}

/**
 * Ingests a single URL from official docs
 */
async function ingestOfficialUrl(
  collectionId: string,
  source: DocSource,
  docUrl: DocUrl,
  storagePath: string
): Promise<string | null> {
  // Scrape the URL
  console.info(`[Official Docs] Scraping: ${docUrl.url}`);

  let scrapedPage: ScrapedPage;
  try {
    scrapedPage = await scrapeUrl(docUrl.url);
  } catch (error) {
    console.error(`[Official Docs] Failed to scrape ${docUrl.url}: ${(error as Error).message}`);
    return null;
  }

  if (!scrapedPage.content || scrapedPage.content.trim().length < 100) {
    console.warn(`[Official Docs] Insufficient content from ${docUrl.url}, skipping`);
    return null;
  }

  // Prepare storage path
  const collectionStoragePath = path.join(storagePath, collectionId);
  await fs.mkdir(collectionStoragePath, { recursive: true });

  // Create document record
  const metadata = buildOfficialDocsMetadata(source, docUrl, scrapedPage);
  const urlHash = hashUrl(docUrl.url);

  const doc = await createDocument({
    collection_id: collectionId,
    title: docUrl.title || scrapedPage.title,
    content_type: 'text/markdown',
    source_url: docUrl.url,
  });

  // Write content to file
  const destPath = path.join(collectionStoragePath, `${doc.id}.md`);
  await fs.writeFile(destPath, scrapedPage.content, 'utf-8');

  // Update document with file path, metadata, and URL hash
  await query(
    'UPDATE documents SET file_path = $1, metadata = $2, source_url_hash = $3, file_size = $4 WHERE id = $5',
    [destPath, metadata, urlHash, Buffer.byteLength(scrapedPage.content, 'utf-8'), doc.id]
  );

  console.info(
    `[Official Docs] Created document: ${docUrl.title} (${doc.id}) ` +
      `- provider: ${source.provider}, tags: [${metadata.feature_tags?.join(', ')}]`
  );

  return doc.id;
}

/**
 * Main ingestion function
 */
async function main(): Promise<void> {
  console.info('='.repeat(60));
  console.info('[Official Docs] GPT Phase 1: Official Mobile Documentation Ingestion');
  console.info('='.repeat(60));

  const storagePath = process.env.STORAGE_PATH || path.resolve(process.cwd(), 'storage');
  const skipExisting = process.argv.includes('--skip-existing');
  const dryRun = process.argv.includes('--dry-run');

  // Parse provider filter
  const providerArg = process.argv.find((arg) => arg.startsWith('--provider='));
  const providerFilter = providerArg?.split('=')[1]?.toLowerCase();

  // Filter sources if provider specified
  let sources = DOC_SOURCES;
  if (providerFilter) {
    sources = DOC_SOURCES.filter((s) => s.provider === providerFilter);
    if (sources.length === 0) {
      console.error(
        `[Official Docs] Unknown provider: ${providerFilter}. ` +
          `Available: ${DOC_SOURCES.map((s) => s.provider).join(', ')}`
      );
      process.exit(1);
    }
    console.info(`[Official Docs] Filtering to provider: ${providerFilter}`);
  }

  // Count total URLs
  const totalUrls = sources.reduce((sum, s) => sum + s.urls.length, 0);
  console.info(`[Official Docs] ${sources.length} providers, ${totalUrls} URLs to process`);

  if (dryRun) {
    console.info('\n[Official Docs] DRY RUN - URLs to be ingested:');
    for (const source of sources) {
      console.info(`\n  ${source.name} (${source.provider}):`);
      for (const docUrl of source.urls) {
        const tags = docUrl.featureTags ?? source.featureTags;
        console.info(`    - ${docUrl.title}`);
        console.info(`      URL: ${docUrl.url}`);
        console.info(`      Tags: [${tags.join(', ')}]`);
      }
    }
    return;
  }

  // Get or create collection
  const collectionId = await getOrCreateDocsCollection();

  // Track results
  const results = {
    created: 0,
    embedded: 0,
    skipped: 0,
    failed: 0,
  };

  // Process each source
  for (const source of sources) {
    console.info(`\n[Official Docs] Processing: ${source.name}`);

    for (const docUrl of source.urls) {
      // Check if already ingested
      if (skipExisting && (await isAlreadyIngested(collectionId, docUrl.url))) {
        console.info(`[Official Docs] Skipping (already exists): ${docUrl.title}`);
        results.skipped++;
        continue;
      }

      try {
        // Ingest the URL
        const docId = await ingestOfficialUrl(collectionId, source, docUrl, storagePath);

        if (!docId) {
          results.failed++;
          continue;
        }

        results.created++;

        // Run full ingestion pipeline (extract, chunk, embed)
        try {
          await ingestDocument(docId);
          results.embedded++;
          console.info(`[Official Docs] ✓ Embedded: ${docUrl.title}`);
        } catch (embedError) {
          console.error(
            `[Official Docs] ✗ Embedding failed for ${docUrl.title}: ` +
              (embedError as Error).message
          );
        }

        // Rate limiting - be nice to servers
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (error) {
        console.error(
          `[Official Docs] ✗ Failed to ingest ${docUrl.url}: ${(error as Error).message}`
        );
        results.failed++;
      }
    }
  }

  // Summary
  console.info('\n' + '='.repeat(60));
  console.info('[Official Docs] Summary:');
  console.info(`  Collection: ${COLLECTION_NAME} (${collectionId})`);
  console.info(`  Created: ${results.created}`);
  console.info(`  Embedded: ${results.embedded}`);
  console.info(`  Skipped: ${results.skipped}`);
  console.info(`  Failed: ${results.failed}`);
  console.info('='.repeat(60));
}

// Run
main()
  .catch((error) => {
    console.error('[Official Docs] Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    closePool();
  });
