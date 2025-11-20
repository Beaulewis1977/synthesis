import net from 'node:net';
import { createDocument, deleteDocumentChunks, getDocument } from '@synthesis/db';
import type { Pool } from 'pg';
import { chromium } from 'playwright';
import TurndownService from 'turndown';
import { deleteFileIfExists, inferTitle, writeDocumentFile } from '../agent/utils/storage.js';
import { ingestDocument } from '../pipeline/orchestrator.js';

export interface FetchWebContentParams {
  url: string;
  collectionId: string;
  mode?: 'single' | 'crawl';
  maxPages?: number;
  titlePrefix?: string;
}

export interface FetchWebContentResult {
  processed: Array<{
    docId: string;
    url: string;
    title: string;
  }>;
}

export interface DeleteDocumentParams {
  docId: string;
}

export interface DeleteDocumentResult {
  docId: string;
  title: string;
}

export class DocumentNotFoundError extends Error {
  public readonly code = 'DOCUMENT_NOT_FOUND';

  constructor(docId: string) {
    super(`Document ${docId} not found`);
    this.name = 'DocumentNotFoundError';
  }
}

const DEFAULT_MAX_PAGES = 25;

export async function fetchWebContent(
  db: Pool,
  params: FetchWebContentParams
): Promise<FetchWebContentResult> {
  const collectionId = params.collectionId;
  const mode = params.mode ?? 'single';
  const maxPages = params.maxPages ?? DEFAULT_MAX_PAGES;

  const turndownService = createTurndownService();
  const initialUrl = normalizeUrl(params.url);
  if (!isPublicUrl(initialUrl)) {
    throw new Error('Initial URL is not a public URL');
  }
  const queue = [initialUrl];
  const pending = new Set(queue);
  const visited = new Set<string>();
  const processed: Array<{ docId: string; url: string; title: string }> = [];

  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    while (queue.length > 0 && processed.length < maxPages) {
      const nextUrl = queue.shift();
      if (!nextUrl) {
        break;
      }
      pending.delete(nextUrl);

      const normalizedUrl = normalizeUrl(nextUrl);

      if (!isPublicUrl(normalizedUrl)) {
        console.warn(`Skipping non-public URL: ${normalizedUrl}`);
        continue;
      }

      if (visited.has(normalizedUrl)) {
        continue;
      }

      visited.add(normalizedUrl);
      if (processed.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      try {
        await page.goto(normalizedUrl, { waitUntil: 'networkidle', timeout: 30_000 });
      } catch {
        continue;
      }

      const title = await page.title();
      const content = await page.evaluate(() => {
        type ElementLike = {
          innerHTML?: string;
          innerText?: string;
        } | null;

        const selectors = ['main', 'article', '.content', '#content'];
        const doc = document as unknown as {
          querySelector: (selector: string) => ElementLike;
          body: ElementLike;
          documentElement: ElementLike;
        };

        if (!doc) {
          return { html: '', text: '' };
        }

        const candidate = selectors
          .map((selector) => doc.querySelector(selector) as ElementLike)
          .find((node) => node && typeof node.innerText === 'string' && node.innerText.trim());

        const element =
          candidate ?? (doc.body as ElementLike) ?? (doc.documentElement as ElementLike);

        return {
          html: element?.innerHTML ?? '',
          text: element?.innerText ?? '',
        };
      });

      const markdown = convertHtmlToMarkdown(content.html, turndownService);
      const textFallback = (content.text ?? '').trim();

      if (!markdown && !textFallback) {
        continue;
      }

      const cleanedTitle = params.titlePrefix
        ? `${params.titlePrefix} - ${title || inferTitle(normalizedUrl)}`
        : title || inferTitle(normalizedUrl);

      const contentBuffer = Buffer.from(markdown || textFallback, 'utf-8');
      const document = await createDocument({
        collection_id: collectionId,
        title: cleanedTitle,
        file_path: undefined,
        content_type: 'text/markdown',
        file_size: contentBuffer.length,
        source_url: normalizedUrl,
      });

      const filePath = await writeDocumentFile(collectionId, document.id, '.md', contentBuffer);
      await updateDocumentStatus(db, document.id, 'pending', undefined, filePath);

      ingestDocument(document.id).catch((error: unknown) => {
        console.error(`Ingestion failed for ${document.id}`, error);
      });

      processed.push({ docId: document.id, url: normalizedUrl, title: cleanedTitle });

      if (mode === 'crawl') {
        const discovered = await page.$$eval(
          'a[href]',
          (anchors, origin) => {
            const baseUrl = new URL(origin);
            const originHost = baseUrl.origin;

            return anchors
              .map((anchor) => {
                try {
                  type AnchorLike = {
                    href?: string;
                    getAttribute?: (attr: string) => string | null;
                  };
                  const node = anchor as AnchorLike;
                  const candidate: string | null =
                    typeof node.href === 'string'
                      ? node.href
                      : typeof node.getAttribute === 'function'
                        ? node.getAttribute('href')
                        : null;

                  if (!candidate) {
                    return null;
                  }

                  return new URL(candidate, origin).href;
                } catch {
                  return null;
                }
              })
              .filter((href): href is string => typeof href === 'string')
              .filter((href) => href.startsWith(originHost));
          },
          normalizedUrl
        );

        for (const link of discovered) {
          const normalizedLink = normalizeUrl(link);
          if (!isPublicUrl(normalizedLink)) {
            continue;
          }
          if (!visited.has(normalizedLink) && !pending.has(normalizedLink)) {
            queue.push(normalizedLink);
            pending.add(normalizedLink);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  return { processed };
}

export async function deleteDocumentById(
  db: Pool,
  params: DeleteDocumentParams
): Promise<DeleteDocumentResult> {
  const document = await getDocument(params.docId);
  if (!document) {
    throw new DocumentNotFoundError(params.docId);
  }

  // Store file path for deletion after transaction
  const filePath = document.file_path;

  const client = await db.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await deleteDocumentChunks(document.id, client);
    await client.query('DELETE FROM documents WHERE id = $1', [document.id]);
    await client.query('COMMIT');
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }

  // Delete file only after successful transaction commit
  if (filePath) {
    try {
      await deleteFileIfExists(filePath);
    } catch (error) {
      // Log but don't fail the operation if file deletion fails
      console.error(`Failed to delete file ${filePath}:`, error);
    }
  }

  return {
    docId: document.id,
    title: document.title,
  };
}

function createTurndownService(): TurndownService {
  return new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });
}

function convertHtmlToMarkdown(html: string | null | undefined, service: TurndownService): string {
  const trimmed = (html ?? '').trim();
  if (!trimmed) {
    return '';
  }

  try {
    return service.turndown(trimmed).trim();
  } catch (error) {
    console.warn('Failed to convert HTML to Markdown', error);
    return '';
  }
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return url;
    }

    parsed.hash = '';
    parsed.searchParams.sort();

    if (parsed.pathname && parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+/g, '/');
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
      if (parsed.pathname === '') {
        parsed.pathname = '/';
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function isPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    let hostname = parsed.hostname;

    // Special case: localhost by name
    if (hostname === 'localhost') {
      return false;
    }

    // Strip brackets from IPv6 addresses
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }

    // Determine if this is an IP address (IPv4=4, IPv6=6, not IP=0)
    const ipType = net.isIP(hostname);

    if (ipType === 0) {
      // It's a domain name, not an IP - allow it (public domains are fine)
      return true;
    }

    if (ipType === 4) {
      // IPv4 address - check private ranges
      const parts = hostname.split('.');
      if (parts.length !== 4) {
        return false;
      }

      // Parse octets and validate they're valid integers in 0-255 range
      const octets: number[] = [];
      for (const part of parts) {
        const num = Number.parseInt(part, 10);
        if (!Number.isInteger(num) || num < 0 || num > 255 || Number.isNaN(num)) {
          // Invalid octet - not a valid IPv4, don't reject based on private ranges
          return false;
        }
        octets.push(num);
      }

      const [octet1, octet2] = octets;

      // Loopback: 127.0.0.0/8
      if (octet1 === 127) {
        return false;
      }

      // Private: 10.0.0.0/8
      if (octet1 === 10) {
        return false;
      }

      // Private: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
        return false;
      }

      // Private: 192.168.0.0/16
      if (octet1 === 192 && octet2 === 168) {
        return false;
      }

      // Link-local: 169.254.0.0/16
      if (octet1 === 169 && octet2 === 254) {
        return false;
      }

      return true;
    }

    if (ipType === 6) {
      // IPv6 address - check private ranges
      const normalized = hostname.toLowerCase();

      // Loopback: ::1
      if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
        return false;
      }

      // Extract first hextet for range checks
      const parts = normalized.split(':');
      if (parts.length === 0) {
        return false;
      }

      // Handle compressed notation (::)
      let firstHextet = parts[0];
      if (firstHextet === '') {
        // Leading :: compression
        firstHextet = parts[1] || '0';
      }

      // Parse first hextet as hex number
      const firstHextetNum = Number.parseInt(firstHextet || '0', 16);
      if (Number.isNaN(firstHextetNum)) {
        return false;
      }

      // Link-local: fe80::/10 (fe80 - febf)
      // First hextet: 0xfe80 to 0xfebf
      if (firstHextetNum >= 0xfe80 && firstHextetNum <= 0xfebf) {
        return false;
      }

      // Unique local: fc00::/7 (fc00 - fdff)
      // First hextet: 0xfc00 to 0xfdff
      if (firstHextetNum >= 0xfc00 && firstHextetNum <= 0xfdff) {
        return false;
      }

      return true;
    }

    // Unknown IP type
    return false;
  } catch {
    return false;
  }
}

async function updateDocumentStatus(
  db: Pool,
  documentId: string,
  status: string,
  errorMessage?: string,
  filePath?: string
): Promise<void> {
  await db.query(
    `UPDATE documents
       SET status = $1,
           error_message = $2,
           updated_at = NOW(),
           processed_at = CASE WHEN $1 = 'complete' THEN NOW() ELSE processed_at END,
           file_path = COALESCE($3, file_path)
     WHERE id = $4`,
    [status, errorMessage ?? null, filePath ?? null, documentId]
  );
}
