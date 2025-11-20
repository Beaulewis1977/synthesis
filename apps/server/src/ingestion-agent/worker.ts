import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createDocument,
  createIngestionJob,
  createIngestionJobUrls,
  getIngestionJob,
  getNextPendingUrl,
  updateDocumentStatus,
  updateIngestionJobStatus,
  updateIngestionJobUrlStatus,
} from '@synthesis/db';
import yaml from 'js-yaml';
import { ingestDocument } from '../pipeline/orchestrator.js';
import { scrapeUrl } from './scraper.js';
import { searchGoogle } from './search.js';

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

export async function startIngestionJob(collectionId: string, topic: string) {
  // 1. Create Job
  const job = await createIngestionJob(collectionId, topic);

  // 2. Start processing in background (don't await)
  processJob(job.id).catch((err) => {
    console.error(`Job ${job.id} failed critically:`, err);
    updateIngestionJobStatus(job.id, 'failed', String(err));
  });

  return job;
}

async function processJob(jobId: string) {
  try {
    const job = await getIngestionJob(jobId);
    if (!job) return;

    // 3. Perform Search
    console.info(`[Agent] Searching for "${job.topic}"...`);
    const searchResults = await searchGoogle(job.topic);
    const urls = searchResults.map((r) => r.link);

    if (urls.length === 0) {
      await updateIngestionJobStatus(jobId, 'completed', 'No URLs found');
      return;
    }

    // 4. Add URLs to DB
    await createIngestionJobUrls(jobId, urls);

    // 5. Process URLs
    let pendingUrl = await getNextPendingUrl(jobId);
    while (pendingUrl) {
      console.info(`[Agent] Processing URL: ${pendingUrl.url}`);

      try {
        // Scrape
        const scraped = await scrapeUrl(pendingUrl.url);

        await updateIngestionJobUrlStatus(pendingUrl.id, 'scraped', {
          content_hash: String(scraped.content.length), // Simple hash for now
        });

        // Create File
        const collectionDir = path.join(STORAGE_PATH, job.collection_id);
        await fs.mkdir(collectionDir, { recursive: true });

        const sanitizedTitle = scraped.title.replace(/[^a-z0-9]/gi, '_').substring(0, 100);
        const fileName = `agent_${pendingUrl.id}_${sanitizedTitle}.md`;
        const filePath = path.join(collectionDir, fileName);

        const frontmatter = {
          title: scraped.title,
          url: scraped.url,
          description: scraped.description,
          source: 'ingestion-agent',
        };

        const yamlFrontmatter = yaml.dump(frontmatter, { noRefs: true });
        const fileContent = `---\n${yamlFrontmatter}---\n\n${scraped.content}`;

        await fs.writeFile(filePath, fileContent);

        // Create Document
        const document = await createDocument({
          collection_id: job.collection_id,
          title: scraped.title,
          content_type: 'text/markdown',
          file_size: fileContent.length,
          source_url: scraped.url,
          file_path: filePath,
        });

        // Update URL record
        await updateIngestionJobUrlStatus(pendingUrl.id, 'ingested', {
          document_id: document.id,
        });

        // Trigger Pipeline
        await updateDocumentStatus(document.id, 'pending', undefined, filePath);
        await ingestDocument(document.id);
      } catch (error) {
        console.error(`[Agent] Failed to process URL ${pendingUrl.url}:`, error);
        await updateIngestionJobUrlStatus(pendingUrl.id, 'failed', {
          notes: error instanceof Error ? error.message : String(error),
          failure_count: pendingUrl.failure_count + 1,
        });
      }

      // Get next
      pendingUrl = await getNextPendingUrl(jobId);
    }

    await updateIngestionJobStatus(jobId, 'completed');
  } catch (error) {
    console.error('[Agent] Job processing error:', error);
    await updateIngestionJobStatus(jobId, 'failed', String(error));
  }
}
