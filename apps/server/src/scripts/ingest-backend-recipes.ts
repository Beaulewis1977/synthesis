#!/usr/bin/env tsx
/**
 * Backend Recipe Ingestion Script
 *
 * Ingests curated backend recipe markdown files from docs/recipes/backend/
 * into the 'backend-recipes' collection.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  closePool,
  createCollection,
  createDocument,
  getPool,
  query,
  updateDocumentStatus,
} from '@synthesis/db';
import type {
  BackendFeatureTag,
  ContentPlatform,
  DocumentMetadata,
  UsageTier,
} from '@synthesis/shared';
import matter from 'gray-matter';
import yaml from 'js-yaml';
// Note: importing from relative path in src/scripts
import { ingestDocument } from '../pipeline/orchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');

// Constants
const RECIPES_DIR = path.join(repoRoot, 'docs/recipes/backend');
const COLLECTION_NAME = 'backend-recipes';
const COLLECTION_DESCRIPTION = 'Curated Backend, Infrastructure, and Serverless recipes';

// Recipe frontmatter schema
interface RecipeFrontmatter {
  title: string;
  platform: ContentPlatform;
  framework: string;
  framework_version?: string;
  feature_tags: BackendFeatureTag[];
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

function parseFrontmatterSafely(markdown: string, _filePath: string): ParsedMarkdown {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const firstNewlineIndex = normalized.indexOf('\n');
  const firstLine = firstNewlineIndex === -1 ? normalized : normalized.slice(0, firstNewlineIndex);

  if (!firstLine.trim().startsWith('---')) {
    return { data: {}, content: normalized };
  }

  const languageTag = firstLine.trim().slice(3).trim().toLowerCase();
  const allowedLanguages = new Set(['', 'yaml', 'yml']);

  if (languageTag && !allowedLanguages.has(languageTag)) {
    console.warn(`[Backend Ingest] Unsupported frontmatter language "${languageTag}"`);
    return { data: {}, content: normalized };
  }

  try {
    const { data, content } = matter(normalized, {
      language: 'yaml',
      engines: {
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
    console.warn(`[Backend Ingest] Failed to parse frontmatter: ${(error as Error).message}`);
    return { data: {}, content: normalized };
  }
}

function isValidRecipeFrontmatter(data: unknown): data is RecipeFrontmatter {
  if (!data || typeof data !== 'object') return false;
  const fm = data as Record<string, unknown>;

  if (typeof fm.title !== 'string') return false;
  if (typeof fm.platform !== 'string') return false;
  if (typeof fm.framework !== 'string') return false;
  if (!Array.isArray(fm.feature_tags)) return false;
  if (typeof fm.usage_tier !== 'string') return false;
  if (!Array.isArray(fm.tech_stack)) return false;

  return true;
}

async function discoverRecipeFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(RECIPES_DIR);
    return files
      .filter((f) => f.endsWith('.md') && f !== 'TEMPLATE.md')
      .map((f) => path.join(RECIPES_DIR, f));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`[Backend Ingest] Recipes directory not found: ${RECIPES_DIR}`);
      return [];
    }
    throw error;
  }
}

async function parseRecipeFile(filePath: string): Promise<RecipeFile | null> {
  const content = await fs.readFile(filePath, 'utf-8');
  const { data: frontmatter, content: markdown } = parseFrontmatterSafely(content, filePath);

  if (!isValidRecipeFrontmatter(frontmatter)) {
    console.warn(`[Backend Ingest] Invalid frontmatter in ${path.basename(filePath)}, skipping`);
    return null;
  }

  return {
    filePath,
    filename: path.basename(filePath),
    frontmatter,
    content: markdown,
  };
}

async function getOrCreateRecipeCollection(): Promise<string> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT id FROM collections WHERE name = $1', [
    COLLECTION_NAME,
  ]);

  if (rows.length > 0) {
    return rows[0].id;
  }

  const collection = await createCollection(COLLECTION_NAME, COLLECTION_DESCRIPTION);
  console.info(`[Backend Ingest] Created new collection: ${COLLECTION_NAME}`);
  return collection.id;
}

function buildRecipeMetadata(recipe: RecipeFile): DocumentMetadata {
  const fm = recipe.frontmatter;

  // Use type assertion for frameworks since we know they are valid strings from the file
  // In a real app we might validate against DocumentFramework enum strictly
  // biome-ignore lint/suspicious/noExplicitAny: convenient mapping
  const framework = fm.framework as any;

  return {
    doc_type: 'recipe',
    source_url: `file://${recipe.filePath}`,
    source_type: 'file',
    source_quality: 'official',
    platform: fm.platform,
    feature_tags: fm.feature_tags,
    usage_tier: fm.usage_tier,
    recommended: fm.recommended ?? false,
    framework,
    framework_version: fm.framework_version,
    tech_stack: fm.tech_stack,
    difficulty: fm.difficulty,
    sdk_constraints: fm.sdk_constraints,
    tested_versions: fm.tested_versions,
    last_updated: fm.last_updated,
    ingested_at: new Date().toISOString(),
  };
}

async function ingestRecipe(
  collectionId: string,
  recipe: RecipeFile,
  storagePath: string
): Promise<string> {
  const collectionStoragePath = path.join(storagePath, collectionId);
  await fs.mkdir(collectionStoragePath, { recursive: true });

  const metadata = buildRecipeMetadata(recipe);
  const sourceUrl = `file://${recipe.filePath}`;

  // Check for existing document
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT id FROM documents WHERE collection_id = $1 AND source_url = $2',
    [collectionId, sourceUrl]
  );

  let docId: string;
  let isUpdate = false;

  if (rows.length > 0) {
    // UPDATE existing
    docId = rows[0].id;
    isUpdate = true;
    console.info(`[Backend Ingest] Updating existing document: ${docId}`);

    // Reset status to pending so it gets re-embedded
    await query(
      'UPDATE documents SET title = $1, status = $2, metadata = $3, updated_at = NOW() WHERE id = $4',
      [recipe.frontmatter.title, 'pending', metadata, docId]
    );
  } else {
    // CREATE new
    const doc = await createDocument({
      collection_id: collectionId,
      title: recipe.frontmatter.title,
      content_type: 'text/markdown',
      source_url: sourceUrl,
    });
    docId = doc.id;
  }

  const destPath = path.join(collectionStoragePath, `${docId}.md`);
  try {
    await fs.copyFile(recipe.filePath, destPath);
    await query('UPDATE documents SET file_path = $1 WHERE id = $2', [destPath, docId]);
  } catch (error) {
    // Only cleanup if it was a new document, otherwise we might delete a valid file for an existing doc
    if (!isUpdate) {
      await fs.rm(destPath, { force: true }).catch(() => {});
    }
    await updateDocumentStatus(docId, 'error', `Copy failed: ${(error as Error).message}`);
    throw error;
  }

  console.info(
    `[Backend Ingest] ${isUpdate ? 'Updated' : 'Created'} document: ${recipe.frontmatter.title} (${docId})`
  );
  return docId;
}

async function isAlreadyIngested(collectionId: string, sourceUrl: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT id FROM documents WHERE collection_id = $1 AND source_url = $2',
    [collectionId, sourceUrl]
  );
  return rows.length > 0;
}

async function main(): Promise<void> {
  console.info('='.repeat(60));
  console.info('[Backend Ingest] Backend Recipe Ingestion');
  console.info('='.repeat(60));

  const storagePath = process.env.STORAGE_PATH || path.resolve(process.cwd(), 'storage');
  const skipExisting = process.argv.includes('--skip-existing');

  const recipeFiles = await discoverRecipeFiles();
  console.info(`[Backend Ingest] Found ${recipeFiles.length} recipe files`);

  if (recipeFiles.length === 0) return;

  const recipes: RecipeFile[] = [];
  for (const filePath of recipeFiles) {
    const recipe = await parseRecipeFile(filePath);
    if (recipe) recipes.push(recipe);
  }

  const collectionId = await getOrCreateRecipeCollection();

  for (const recipe of recipes) {
    const sourceUrl = `file://${recipe.filePath}`;

    if (skipExisting && (await isAlreadyIngested(collectionId, sourceUrl))) {
      console.info(`[Backend Ingest] Skipping: ${recipe.frontmatter.title}`);
      continue;
    }

    try {
      const docId = await ingestRecipe(collectionId, recipe, storagePath);
      await ingestDocument(docId);
      console.info(`[Backend Ingest] ✓ Embedded: ${recipe.frontmatter.title}`);
    } catch (error) {
      console.error(
        `[Backend Ingest] ✗ Failed: ${recipe.frontmatter.title} - ${(error as Error).message}`
      );
    }
  }
}

main()
  .catch((error) => {
    console.error('[Backend Ingest] Fatal:', error);
    process.exit(1);
  })
  .finally(() => {
    closePool();
  });
