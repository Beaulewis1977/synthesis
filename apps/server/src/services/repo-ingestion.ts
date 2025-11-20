import fs from 'node:fs/promises';
import path from 'node:path';
import { createDocument, getRepoSource, listDocuments, updateRepoSyncStatus } from '@synthesis/db';
import type { Pool } from 'pg';
import { simpleGit } from 'simple-git';
import { writeDocumentFile } from '../agent/utils/storage.js';
import { ingestDocument } from '../pipeline/orchestrator.js';

const DEFAULT_IGNORED_PATTERNS = [
  'node_modules/',
  '.git/',
  'dist/',
  'build/',
  '*.log',
  '.DS_Store',
  'coverage/',
  '.next/',
  '.turbo/',
  '__pycache__/',
  '*.pyc',
  '.pytest_cache/',
];

/**
 * Clone or pull a Git repository to a local path
 */
export async function cloneOrPullRepo(
  repoUrl: string,
  localPath: string,
  branch: string
): Promise<string> {
  const git = simpleGit();

  // Check if directory exists and has .git folder
  try {
    await fs.access(path.join(localPath, '.git'));
    // Directory exists, pull latest
    console.info(`Pulling latest changes for ${repoUrl}`);
    const repoGit = simpleGit(localPath);
    await repoGit.fetch();
    await repoGit.checkout(branch);
    await repoGit.pull('origin', branch);
    const log = await repoGit.log({ maxCount: 1 });
    return log.latest?.hash || '';
  } catch {
    // Directory doesn't exist or no .git, clone
    console.info(`Cloning repository ${repoUrl}`);
    await fs.mkdir(localPath, { recursive: true });
    await git.clone(repoUrl, localPath, ['--depth', '1', '--branch', branch]);
    const repoGit = simpleGit(localPath);
    const log = await repoGit.log({ maxCount: 1 });
    return log.latest?.hash || '';
  }
}

/**
 * Check if a file should be ignored based on patterns
 */
function shouldIgnoreFile(filePath: string, ignoredPatterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of ignoredPatterns) {
    if (pattern.endsWith('/')) {
      // Directory pattern
      if (normalizedPath.includes(pattern)) {
        return true;
      }
    } else if (pattern.startsWith('*.')) {
      // Extension pattern
      const ext = pattern.slice(1);
      if (normalizedPath.endsWith(ext)) {
        return true;
      }
    } else if (normalizedPath.includes(pattern)) {
      // Simple string match
      return true;
    }
  }

  return false;
}

/**
 * Recursively walk repository files
 */
export async function walkRepoFiles(
  repoPath: string,
  ignoredPatterns: string[],
  baseDir: string = repoPath
): Promise<Array<{ relativePath: string; fullPath: string }>> {
  const files: Array<{ relativePath: string; fullPath: string }> = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (shouldIgnoreFile(relativePath, ignoredPatterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push({ relativePath, fullPath });
      }
    }
  }

  await walk(repoPath);
  return files;
}

/**
 * Ingest a single repository file as a document
 */
export async function ingestRepoFile(
  collectionId: string,
  _repoSourceId: string,
  filePath: string,
  content: Buffer | string
): Promise<string> {
  const title = path.basename(filePath);
  const contentType = getContentType(filePath);

  // Create document record
  const document = await createDocument({
    collection_id: collectionId,
    title,
    content_type: contentType,
    file_size: Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content),
  });

  // Save file content
  const fileExtension = path.extname(filePath) || '.txt';
  const savedPath = await writeDocumentFile(
    collectionId,
    document.id,
    fileExtension,
    Buffer.isBuffer(content) ? content : Buffer.from(content)
  );

  // Update document with repo source and file path
  await fs.writeFile(savedPath, content);

  // Trigger ingestion
  ingestDocument(document.id).catch((error: unknown) => {
    console.error(`Ingestion failed for ${document.id}:`, error);
  });

  return document.id;
}

/**
 * Determine content type from file extension
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.js': 'text/javascript',
    '.jsx': 'text/javascript',
    '.py': 'text/x-python',
    '.java': 'text/x-java',
    '.kt': 'text/x-kotlin',
    '.swift': 'text/x-swift',
    '.go': 'text/x-go',
    '.rs': 'text/x-rust',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.toml': 'text/toml',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.css': 'text/css',
    '.sql': 'text/x-sql',
    '.sh': 'text/x-sh',
    '.txt': 'text/plain',
  };

  return contentTypeMap[ext] || 'text/plain';
}

/**
 * Sync a repository: clone/pull and ingest all files
 */
export async function syncRepository(_db: Pool, repoSourceId: string): Promise<void> {
  const repoSource = await getRepoSource(repoSourceId);

  if (!repoSource) {
    throw new Error(`Repository source ${repoSourceId} not found`);
  }

  // Update status to syncing
  await updateRepoSyncStatus(repoSourceId, {
    syncStatus: 'syncing',
    syncError: null,
  });

  try {
    // Create temp directory for repo
    const tempDir = path.join(process.cwd(), 'storage', 'repos', repoSourceId);
    await fs.mkdir(tempDir, { recursive: true });

    // Clone or pull repo
    const commitHash = await cloneOrPullRepo(
      repoSource.repo_url,
      tempDir,
      repoSource.default_branch
    );

    console.info(`Synced repo ${repoSource.repo_url} at commit ${commitHash}`);

    // Get existing documents for this repo
    const existingDocs = await listDocuments(repoSource.collection_id);
    const existingDocsByPath = new Map(
      existingDocs
        .filter((doc) => doc.metadata?.repoFilePath)
        .map((doc) => [doc.metadata.repoFilePath, doc])
    );

    // Walk repository files
    const ignoredPatterns =
      repoSource.ignored_paths.length > 0 ? repoSource.ignored_paths : DEFAULT_IGNORED_PATTERNS;
    const files = await walkRepoFiles(tempDir, ignoredPatterns);

    console.info(`Found ${files.length} files to process in ${repoSource.repo_url}`);

    // Process files in batches
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (file) => {
          try {
            // Check if document already exists
            if (existingDocsByPath.has(file.relativePath)) {
              // Document exists, skip for now (future: check if content changed)
              return;
            }

            // Read file content
            const content = await fs.readFile(file.fullPath);

            // Skip binary files (simple heuristic: check for null bytes)
            if (content.includes(0)) {
              console.info(`Skipping binary file: ${file.relativePath}`);
              return;
            }

            // Ingest file
            await ingestRepoFile(
              repoSource.collection_id,
              repoSourceId,
              file.relativePath,
              content
            );
            console.info(`Ingested: ${file.relativePath}`);
          } catch (error) {
            console.error(`Failed to ingest ${file.relativePath}:`, error);
          }
        })
      );
    }

    // Update status to idle
    await updateRepoSyncStatus(repoSourceId, {
      syncStatus: 'idle',
      lastSyncedCommit: commitHash,
      lastSyncedAt: new Date(),
    });

    console.info(`Successfully synced repository ${repoSource.repo_url}`);
  } catch (error) {
    console.error(`Failed to sync repository ${repoSourceId}:`, error);
    await updateRepoSyncStatus(repoSourceId, {
      syncStatus: 'error',
      syncError: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
