#!/usr/bin/env tsx
/**
 * GPT Phase 1: Mobile Recipe Ingestion Script
 *
 * This script ingests curated Flutter/mobile recipe markdown files from
 * docs/recipes/mobile/ into a dedicated collection. It parses YAML frontmatter
 * to extract mobile metadata (platform, feature_tags, usage_tier, etc.) and
 * stores them with proper metadata for feature-aware RAG retrieval.
 *
 * Usage:
 *   pnpm --filter @synthesis/server tsx src/scripts/ingest-mobile-recipes.ts
 *
 * Environment variables:
 *   DATABASE_URL - PostgreSQL connection string
 *   STORAGE_PATH - Path for storing files (default: ./storage)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  closePool,
  createCollection,
  createDocument,
  getPool,
  query,
  updateDocumentStatus,
} from '@synthesis/db';
import type {
  ContentPlatform,
  DocumentMetadata,
  MobileFeatureTag,
  UsageTier,
} from '@synthesis/shared';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { ingestDocument } from '../pipeline/orchestrator.js';

// Constants
const RECIPES_DIR = path.resolve(process.cwd(), '../../docs/recipes/mobile');
const COLLECTION_NAME = 'mobile-recipes';
const COLLECTION_DESCRIPTION =
  'Curated Flutter and mobile development recipes with step-by-step implementation guides';

// Recipe frontmatter schema
interface RecipeFrontmatter {
  title: string;
  platform: ContentPlatform;
  framework: string;
  framework_version?: string;
  feature_tags: MobileFeatureTag[];
  usage_tier: UsageTier;
  tech_stack: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  last_updated?: string;
  recommended?: boolean;
  sdk_constraints?: string;
  tested_versions?: string[];
}

interface RecipeFile {
  filePath: string;
  filename: string;
  frontmatter: RecipeFrontmatter;
  content: string;
}

interface ParsedMarkdown {
  // biome-ignore lint/suspicious/noExplicitAny: frontmatter shape is validated separately
  data: any;
  content: string;
}

/**
 * Safely parses YAML frontmatter from a markdown string.
 *
 * - Normalizes line endings and strips BOMs
 * - Rejects unsupported frontmatter languages (e.g. `js`, `coffee`)
 * - Forces the gray-matter engine to use YAML only
 * - Uses js-yaml for parsing without any JavaScript execution
 */
function parseFrontmatterSafely(markdown: string, filePath: string): ParsedMarkdown {
  // Basic sanitization/normalization of untrusted markdown input
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

  const firstNewlineIndex = normalized.indexOf('\n');
  const firstLine = firstNewlineIndex === -1 ? normalized : normalized.slice(0, firstNewlineIndex);

  if (!firstLine.trim().startsWith('---')) {
    return { data: {}, content: normalized };
  }

  const languageTag = firstLine.trim().slice(3).trim().toLowerCase();
  const allowedLanguages = new Set(['', 'yaml', 'yml']);

  // Explicitly reject unsupported languages like js/coffee to avoid invoking
  // gray-matter's JavaScript or CoffeeScript engines.
  if (languageTag && !allowedLanguages.has(languageTag)) {
    console.warn(
      `[Recipe Ingest] Unsupported frontmatter language "${languageTag}" in ` +
        `${path.basename(filePath)}, treating file as plain markdown`
    );
    return { data: {}, content: normalized };
  }

  try {
    const { data, content } = matter(normalized, {
      language: 'yaml',
      engines: {
        // Only allow YAML parsing via js-yaml. No JavaScript execution.
        yaml: (src: string) => {
          const parsed = yaml.load(src);
          if (parsed && typeof parsed === 'object') {
            return parsed as object;
          }
          return {};
        },
      },
    });

    return { data, content };
  } catch (error) {
    console.warn(
      `[Recipe Ingest] Failed to parse frontmatter in ${path.basename(
        filePath
      )}: ${(error as Error).message}`
    );
    return { data: {}, content: normalized };
  }
}

/**
 * Validates that frontmatter has required fields for a recipe
 */
function isValidRecipeFrontmatter(data: unknown): data is RecipeFrontmatter {
  if (!data || typeof data !== 'object') return false;

  const fm = data as Record<string, unknown>;

  // Required fields
  if (typeof fm.title !== 'string') return false;
  if (typeof fm.platform !== 'string') return false;
  if (typeof fm.framework !== 'string') return false;
  if (!Array.isArray(fm.feature_tags)) return false;
  if (typeof fm.usage_tier !== 'string') return false;
  if (!Array.isArray(fm.tech_stack)) return false;

  return true;
}

/**
 * Discovers all markdown recipe files in the recipes directory
 */
async function discoverRecipeFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(RECIPES_DIR);
    return files
      .filter((f) => f.endsWith('.md') && f !== 'TEMPLATE.md')
      .map((f) => path.join(RECIPES_DIR, f));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`[Recipe Ingest] Recipes directory not found: ${RECIPES_DIR}`);
      return [];
    }
    throw error;
  }
}

/**
 * Parses a recipe markdown file and extracts frontmatter
 */
async function parseRecipeFile(filePath: string): Promise<RecipeFile | null> {
  const content = await fs.readFile(filePath, 'utf-8');
  const { data: frontmatter, content: markdown } = parseFrontmatterSafely(content, filePath);

  if (!isValidRecipeFrontmatter(frontmatter)) {
    console.warn(`[Recipe Ingest] Invalid frontmatter in ${path.basename(filePath)}, skipping`);
    return null;
  }

  return {
    filePath,
    filename: path.basename(filePath),
    frontmatter,
    content: markdown,
  };
}

/**
 * Gets or creates the mobile-recipes collection
 */
async function getOrCreateRecipeCollection(): Promise<string> {
  const pool = getPool();

  // Check if collection exists
  const { rows } = await pool.query('SELECT id FROM collections WHERE name = $1', [
    COLLECTION_NAME,
  ]);

  if (rows.length > 0) {
    console.info(`[Recipe Ingest] Found existing collection: ${COLLECTION_NAME}`);
    return rows[0].id;
  }

  // Create new collection
  const collection = await createCollection(COLLECTION_NAME, COLLECTION_DESCRIPTION);
  console.info(`[Recipe Ingest] Created new collection: ${COLLECTION_NAME} (${collection.id})`);
  return collection.id;
}

/**
 * Builds document metadata from recipe frontmatter
 */
function buildRecipeMetadata(recipe: RecipeFile): DocumentMetadata {
  const fm = recipe.frontmatter;

  // Only use framework if it's a valid DocumentFramework
  const validFrameworks = [
    'flutter',
    'dart',
    'fastify',
    'postgres',
    'supabase',
    'firebase',
    'fastapi',
    'django',
    'flask',
    'spring',
    'android',
    'react',
    'reactnative',
    'nextjs',
    'express',
    'nestjs',
    'redis',
    'gin',
    'echo',
    'actix',
    'tokio',
    'pytorch',
    'tensorflow',
  ] as const;

  type ValidFramework = (typeof validFrameworks)[number];
  const framework = validFrameworks.includes(fm.framework as ValidFramework)
    ? (fm.framework as ValidFramework)
    : undefined;

  return {
    // Core document metadata
    doc_type: 'recipe',
    source_url: `file://${recipe.filePath}`,
    source_type: 'file',
    source_quality: 'official', // Curated recipes are official

    // Mobile feature metadata (GPT Phase 1)
    platform: fm.platform,
    feature_tags: fm.feature_tags,
    usage_tier: fm.usage_tier,
    recommended: fm.recommended ?? false,

    // Additional recipe context
    framework,
    framework_version: fm.framework_version,
    tech_stack: fm.tech_stack,
    difficulty: fm.difficulty,
    sdk_constraints: fm.sdk_constraints,
    tested_versions: fm.tested_versions,

    // Timestamps
    last_updated: fm.last_updated,
    ingested_at: new Date().toISOString(),
  };
}

/**
 * Copies recipe file to storage and creates document record
 */
async function ingestRecipe(
  collectionId: string,
  recipe: RecipeFile,
  storagePath: string
): Promise<string> {
  // Prepare storage path
  const collectionStoragePath = path.join(storagePath, collectionId);
  await fs.mkdir(collectionStoragePath, { recursive: true });

  // Create document record first to get ID
  const metadata = buildRecipeMetadata(recipe);
  const doc = await createDocument({
    collection_id: collectionId,
    title: recipe.frontmatter.title,
    content_type: 'text/markdown',
    source_url: `file://${recipe.filePath}`,
  });

  // Copy file to storage
  const destPath = path.join(collectionStoragePath, `${doc.id}.md`);
  try {
    await fs.copyFile(recipe.filePath, destPath);

    // Update document with file path and metadata
    await query('UPDATE documents SET file_path = $1, metadata = $2 WHERE id = $3', [
      destPath,
      metadata,
      doc.id,
    ]);
  } catch (error) {
    console.error(
      `[Recipe Ingest] ✗ Failed to copy recipe file for document ${doc.id} ` +
        `from ${recipe.filePath} to ${destPath}: ${(error as Error).message}`
    );

    // Best-effort cleanup of any partially written destination file
    await fs.rm(destPath, { force: true }).catch(() => {});

    // Mark the document as failed so it does not get processed further
    try {
      await updateDocumentStatus(
        doc.id,
        'error',
        `File copy failed for recipe ${recipe.filename}: ${(error as Error).message}`
      );
    } catch (statusError) {
      console.error(
        `[Recipe Ingest] ✗ Failed to update document status for ${doc.id}: ` +
          `${(statusError as Error).message}`
      );
    }

    // Rethrow so the caller can count this recipe as failed
    throw error;
  }

  console.info(
    `[Recipe Ingest] Created document: ${recipe.frontmatter.title} ` +
      `(${doc.id}) - tags: [${recipe.frontmatter.feature_tags.join(', ')}]`
  );

  return doc.id;
}

/**
 * Checks if a recipe has already been ingested
 */
async function isAlreadyIngested(collectionId: string, sourceUrl: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT id FROM documents WHERE collection_id = $1 AND source_url = $2',
    [collectionId, sourceUrl]
  );
  return rows.length > 0;
}

/**
 * Main ingestion function
 */
async function main(): Promise<void> {
  console.info('='.repeat(60));
  console.info('[Recipe Ingest] GPT Phase 1: Mobile Recipe Ingestion');
  console.info('='.repeat(60));

  const storagePath = process.env.STORAGE_PATH || path.resolve(process.cwd(), 'storage');
  const skipExisting = process.argv.includes('--skip-existing');
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.info('[Recipe Ingest] DRY RUN MODE - no changes will be made');
  }

  // Discover recipe files
  const recipeFiles = await discoverRecipeFiles();
  console.info(`[Recipe Ingest] Found ${recipeFiles.length} recipe files in ${RECIPES_DIR}`);

  if (recipeFiles.length === 0) {
    console.info('[Recipe Ingest] No recipes to ingest');
    return;
  }

  // Parse all recipes
  const recipes: RecipeFile[] = [];
  for (const filePath of recipeFiles) {
    const recipe = await parseRecipeFile(filePath);
    if (recipe) {
      recipes.push(recipe);
    }
  }

  console.info(`[Recipe Ingest] Parsed ${recipes.length} valid recipes`);

  if (dryRun) {
    console.info('\n[Recipe Ingest] Recipes to be ingested:');
    for (const recipe of recipes) {
      console.info(
        `  - ${recipe.frontmatter.title} ` +
          `[${recipe.frontmatter.platform}] ` +
          `[${recipe.frontmatter.feature_tags.join(', ')}]`
      );
    }
    return;
  }

  // Get or create collection
  const collectionId = await getOrCreateRecipeCollection();

  // Ingest each recipe
  const results = {
    created: 0,
    skipped: 0,
    embedded: 0,
    failed: 0,
  };

  for (const recipe of recipes) {
    const sourceUrl = `file://${recipe.filePath}`;

    // Check if already ingested
    if (skipExisting && (await isAlreadyIngested(collectionId, sourceUrl))) {
      console.info(`[Recipe Ingest] Skipping (already exists): ${recipe.frontmatter.title}`);
      results.skipped++;
      continue;
    }

    try {
      // Create document and copy file
      const docId = await ingestRecipe(collectionId, recipe, storagePath);
      results.created++;

      // Run full ingestion pipeline (extract, chunk, embed)
      try {
        await ingestDocument(docId);
        results.embedded++;
        console.info(`[Recipe Ingest] ✓ Embedded: ${recipe.frontmatter.title}`);
      } catch (embedError) {
        console.error(
          `[Recipe Ingest] ✗ Embedding failed for ${recipe.frontmatter.title}: ` +
            (embedError as Error).message
        );
      }
    } catch (error) {
      console.error(
        `[Recipe Ingest] ✗ Failed to ingest ${recipe.filename}: ` + (error as Error).message
      );
      results.failed++;
    }
  }

  // Summary
  console.info('\n' + '='.repeat(60));
  console.info('[Recipe Ingest] Summary:');
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
    console.error('[Recipe Ingest] Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    closePool();
  });
