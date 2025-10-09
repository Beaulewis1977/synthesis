import fs from 'node:fs/promises';
import path from 'node:path';

const STORAGE_ROOT = process.env.STORAGE_PATH || './storage';

const EXTENSION_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.json': 'application/json',
  '.csv': 'text/csv',
};

// Build MIME_TO_EXTENSION with preference for more common extensions
const MIME_TO_EXTENSION: Record<string, string> = {};
const PREFERRED_EXTENSIONS: Record<string, string> = {
  'text/html': '.html',
  'text/markdown': '.md',
};

for (const [ext, mime] of Object.entries(EXTENSION_TO_MIME)) {
  // If there's a preferred extension for this MIME type, use it
  if (PREFERRED_EXTENSIONS[mime]) {
    MIME_TO_EXTENSION[mime] = PREFERRED_EXTENSIONS[mime];
  } else if (!MIME_TO_EXTENSION[mime]) {
    // Otherwise, use the first one we encounter or prefer shorter extensions
    MIME_TO_EXTENSION[mime] = ext;
  } else {
    // Prefer shorter extension if current mapping is longer
    if (ext.length < MIME_TO_EXTENSION[mime].length) {
      MIME_TO_EXTENSION[mime] = ext;
    }
  }
}

export interface RemoteDownloadResult {
  buffer: Buffer;
  contentType?: string | null;
  fileName?: string | null;
}

export function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function inferContentType(source: string, explicit?: string | null): string {
  const normalized = explicit?.split(';')[0]?.trim();
  if (normalized) {
    return normalized;
  }

  const extension = path.extname(source).toLowerCase();
  if (extension && EXTENSION_TO_MIME[extension]) {
    return EXTENSION_TO_MIME[extension];
  }

  return 'application/octet-stream';
}

export function inferExtension(contentType: string | null | undefined, source?: string): string {
  if (contentType) {
    const normalized = contentType.split(';')[0]?.trim();
    if (normalized && MIME_TO_EXTENSION[normalized]) {
      return MIME_TO_EXTENSION[normalized];
    }
  }

  if (source) {
    const ext = path.extname(source);
    if (ext) {
      return ext;
    }
  }

  return '.bin';
}

export function inferTitle(source: string): string {
  if (isUrl(source)) {
    try {
      const url = new URL(source);
      const segments = url.pathname.split('/').filter(Boolean);
      const slug = segments.pop() || url.hostname;
      return decodeURIComponent(slug.replace(/[-_]/g, ' ')).trim() || url.hostname;
    } catch {
      return source;
    }
  }

  const base = path.basename(source);
  return (
    base
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]/g, ' ')
      .trim() || base
  );
}

function validateId(id: string, name: string): void {
  const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
  if (!SAFE_ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid ${name}: must contain only alphanumeric characters, underscores, and hyphens`
    );
  }
}

function validateExtension(extension: string): void {
  if (!extension.startsWith('.')) {
    throw new Error('Invalid extension: must start with a dot');
  }
  const SAFE_EXTENSION_PATTERN = /^\.[A-Za-z0-9]+$/;
  if (!SAFE_EXTENSION_PATTERN.test(extension)) {
    throw new Error('Invalid extension: must contain only alphanumeric characters after the dot');
  }
}

export async function ensureCollectionDirectory(collectionId: string): Promise<string> {
  validateId(collectionId, 'collectionId');
  const dir = path.join(STORAGE_ROOT, collectionId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function resolveDocumentPath(
  collectionId: string,
  documentId: string,
  extension: string
): string {
  validateId(collectionId, 'collectionId');
  validateId(documentId, 'documentId');
  validateExtension(extension);
  return path.join(STORAGE_ROOT, collectionId, `${documentId}${extension}`);
}

export async function writeDocumentFile(
  collectionId: string,
  documentId: string,
  extension: string,
  buffer: Buffer
): Promise<string> {
  await ensureCollectionDirectory(collectionId);
  const filePath = resolveDocumentPath(collectionId, documentId, extension);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function deleteFileIfExists(filePath: string | null | undefined): Promise<void> {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function downloadRemoteFile(url: string): Promise<RemoteDownloadResult> {
  const TIMEOUT_MS = 30000; // 30 seconds
  const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: abortController.signal });
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.length;
        if (totalBytes > MAX_BYTES) {
          abortController.abort();
          throw new Error(`File size exceeds maximum allowed size of ${MAX_BYTES} bytes`);
        }

        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    clearTimeout(timeoutId);

    const buffer = Buffer.concat(chunks);
    const contentType = response.headers.get('content-type');

    let fileName: string | null = null;
    const disposition = response.headers.get('content-disposition');
    if (disposition) {
      const match = disposition.match(/filename\*?=(?:UTF-8'')?\"?([^\";]+)/i);
      if (match) {
        fileName = decodeURIComponent(match[1]);
      }
    }

    if (!fileName) {
      try {
        const parsed = new URL(url);
        fileName = path.basename(parsed.pathname);
      } catch {
        fileName = null;
      }
    }

    return { buffer, contentType, fileName };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Download aborted: request exceeded ${TIMEOUT_MS}ms timeout or size limit`);
    }
    throw error;
  }
}

export async function readLocalFile(
  filePath: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const buffer = await fs.readFile(filePath);
  const contentType = inferContentType(filePath);
  return { buffer, contentType };
}
