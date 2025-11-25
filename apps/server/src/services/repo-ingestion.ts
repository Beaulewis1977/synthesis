import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createDocument,
  getPool,
  getRepoSource,
  listDocuments,
  updateDocumentMetadata,
  updateRepoSyncStatus,
} from '@synthesis/db';
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
 * Compute content hash for change detection
 */
function computeContentHash(content: Buffer | string): string {
  return crypto
    .createHash('sha256')
    .update(Buffer.isBuffer(content) ? content : Buffer.from(content))
    .digest('hex');
}

/**
 * Get changed files between two commits using git diff
 */
async function getChangedFiles(
  repoPath: string,
  fromCommit: string | null,
  toCommit: string
): Promise<{ added: string[]; modified: string[]; deleted: string[] }> {
  const git = simpleGit(repoPath);

  if (!fromCommit) {
    // First sync - all files are "added"
    const files = await git.raw(['ls-tree', '-r', '--name-only', toCommit]);
    return {
      added: files.split('\n').filter(Boolean),
      modified: [],
      deleted: [],
    };
  }

  // Get diff between commits
  const diff = await git.diffSummary([fromCommit, toCommit]);

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const file of diff.files) {
    // DiffResultTextFile has 'file' property
    const filePath = 'file' in file ? file.file : '';
    if (!filePath) continue;

    // Type guard for text files with insertions/deletions
    const isTextFile = 'insertions' in file && 'deletions' in file;

    if (isTextFile) {
      const textFile = file as { insertions: number; deletions: number; binary?: boolean };
      if (textFile.insertions > 0 && textFile.deletions === 0 && !textFile.binary) {
        // New file
        added.push(filePath);
      } else if (textFile.deletions > 0 && textFile.insertions === 0) {
        // Deleted file
        deleted.push(filePath);
      } else {
        // Modified file
        modified.push(filePath);
      }
    } else {
      // Binary or name-status file - treat as modified
      modified.push(filePath);
    }
  }

  return { added, modified, deleted };
}

/**
 * Sync a repository with incremental updates using git diff
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
    // Create directory for repo
    const repoDir = path.join(process.cwd(), 'storage', 'repos', repoSourceId);
    await fs.mkdir(repoDir, { recursive: true });

    const previousCommit = repoSource.last_synced_commit;

    // Clone or pull repo (without --depth 1 for incremental sync)
    const git = simpleGit();
    let currentCommit: string;

    try {
      await fs.access(path.join(repoDir, '.git'));
      // Directory exists, fetch and pull
      console.info(`Fetching latest changes for ${repoSource.repo_url}`);
      const repoGit = simpleGit(repoDir);
      await repoGit.fetch(['--all']);
      await repoGit.checkout(repoSource.default_branch);
      await repoGit.pull('origin', repoSource.default_branch);
      const log = await repoGit.log({ maxCount: 1 });
      currentCommit = log.latest?.hash || '';
    } catch {
      // Clone fresh
      console.info(`Cloning repository ${repoSource.repo_url}`);
      await git.clone(repoSource.repo_url, repoDir, ['--branch', repoSource.default_branch]);
      const repoGit = simpleGit(repoDir);
      const log = await repoGit.log({ maxCount: 1 });
      currentCommit = log.latest?.hash || '';
    }

    console.info(`Repository at commit ${currentCommit} (previous: ${previousCommit || 'none'})`);

    // Check if there are any changes
    if (previousCommit === currentCommit) {
      console.info('No changes detected, skipping sync');
      await updateRepoSyncStatus(repoSourceId, {
        syncStatus: 'idle',
        lastSyncedAt: new Date(),
      });
      return;
    }

    // Get changed files using git diff
    const { added, modified, deleted } = await getChangedFiles(
      repoDir,
      previousCommit,
      currentCommit
    );

    console.info(
      `Changes detected: ${added.length} added, ${modified.length} modified, ${deleted.length} deleted`
    );

    // Get existing documents for this repo
    const existingDocs = await listDocuments(repoSource.collection_id);
    const existingDocsByPath = new Map(
      existingDocs
        .filter((doc) => doc.metadata?.repoFilePath)
        .map((doc) => [doc.metadata.repoFilePath as string, doc])
    );

    const ignoredPatterns =
      repoSource.ignored_paths.length > 0 ? repoSource.ignored_paths : DEFAULT_IGNORED_PATTERNS;

    const pool = getPool();

    // Process deleted files - mark documents as deleted or remove
    for (const filePath of deleted) {
      if (shouldIgnoreFile(filePath, ignoredPatterns)) continue;

      const existingDoc = existingDocsByPath.get(filePath);
      if (existingDoc) {
        console.info(`Marking deleted: ${filePath}`);
        await updateDocumentMetadata(existingDoc.id, {
          deleted_from_repo: true,
          deleted_at_commit: currentCommit,
        });
      }
    }

    // Process added files
    const filesToProcess = [...added, ...modified].filter(
      (f) => !shouldIgnoreFile(f, ignoredPatterns)
    );

    const batchSize = 10;
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (relativePath) => {
          try {
            const fullPath = path.join(repoDir, relativePath);

            // Check if file exists (might have been deleted in a later commit)
            try {
              await fs.access(fullPath);
            } catch {
              console.info(`File no longer exists: ${relativePath}`);
              return;
            }

            // Read file content
            const content = await fs.readFile(fullPath);

            // Skip binary files
            if (content.includes(0)) {
              console.info(`Skipping binary file: ${relativePath}`);
              return;
            }

            const contentHash = computeContentHash(content);
            const existingDoc = existingDocsByPath.get(relativePath);

            // Check if content actually changed (for modified files)
            if (existingDoc && existingDoc.metadata?.contentHash === contentHash) {
              console.info(`Content unchanged, skipping: ${relativePath}`);
              return;
            }

            if (existingDoc) {
              // Update existing document - delete old chunks and re-ingest
              console.info(`Updating: ${relativePath}`);
              await pool.query('DELETE FROM chunks WHERE doc_id = $1', [existingDoc.id]);
              await updateDocumentMetadata(existingDoc.id, {
                contentHash,
                lastSyncedCommit: currentCommit,
                version: (existingDoc.version || 1) + 1,
              });
              // Re-ingest the document
              ingestDocument(existingDoc.id).catch((error: unknown) => {
                console.error(`Re-ingestion failed for ${existingDoc.id}:`, error);
              });
            } else {
              // Create new document
              console.info(`Adding: ${relativePath}`);
              const title = path.basename(relativePath);
              const contentType = getContentType(relativePath);

              const document = await createDocument({
                collection_id: repoSource.collection_id,
                title,
                content_type: contentType,
                file_size: content.length,
              });

              // Save file content
              const fileExtension = path.extname(relativePath) || '.txt';
              await writeDocumentFile(
                repoSource.collection_id,
                document.id,
                fileExtension,
                content
              );

              // Update document with metadata
              await updateDocumentMetadata(document.id, {
                repoFilePath: relativePath,
                repoSourceId,
                contentHash,
                lastSyncedCommit: currentCommit,
              });

              // Trigger ingestion
              ingestDocument(document.id).catch((error: unknown) => {
                console.error(`Ingestion failed for ${document.id}:`, error);
              });
            }
          } catch (error) {
            console.error(`Failed to process ${relativePath}:`, error);
          }
        })
      );
    }

    // Update status to idle
    await updateRepoSyncStatus(repoSourceId, {
      syncStatus: 'idle',
      lastSyncedCommit: currentCommit,
      lastSyncedAt: new Date(),
    });

    console.info(`Successfully synced repository ${repoSource.repo_url}`);
    console.info(
      `  Added: ${added.length}, Modified: ${modified.length}, Deleted: ${deleted.length}`
    );
  } catch (error) {
    console.error(`Failed to sync repository ${repoSourceId}:`, error);
    await updateRepoSyncStatus(repoSourceId, {
      syncStatus: 'error',
      syncError: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
