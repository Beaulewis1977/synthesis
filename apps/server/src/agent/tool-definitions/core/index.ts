/**
 * Core Toolpack - Tool Definitions Index
 *
 * Phase 16F: Exports all core RAG tools with unified definitions.
 * Includes collection management, document operations, and repository ingestion.
 */

export { addDocumentTool } from './add-document.js';
export { addRepoToCollectionTool } from './add-repo-to-collection.js';
export { createCollectionTool } from './create-collection.js';
export { deleteCollectionTool } from './delete-collection.js';
export { deleteDocumentTool } from './delete-document.js';
export { fetchWebContentTool } from './fetch-web-content.js';
export { getDocumentStatusTool } from './get-document-status.js';
export { listCollectionsTool } from './list-collections.js';
export { listDocumentsTool } from './list-documents.js';
export { listReposTool } from './list-repos.js';
export { restartIngestTool } from './restart-ingest.js';
export { searchRagTool } from './search-rag.js';
export { summarizeDocumentTool } from './summarize-document.js';
export { syncRepoTool } from './sync-repo.js';

import type { UnifiedToolDefinition } from '../types.js';
import { addDocumentTool } from './add-document.js';
import { addRepoToCollectionTool } from './add-repo-to-collection.js';
import { createCollectionTool } from './create-collection.js';
import { deleteCollectionTool } from './delete-collection.js';
import { deleteDocumentTool } from './delete-document.js';
import { fetchWebContentTool } from './fetch-web-content.js';
import { getDocumentStatusTool } from './get-document-status.js';
import { listCollectionsTool } from './list-collections.js';
import { listDocumentsTool } from './list-documents.js';
import { listReposTool } from './list-repos.js';
import { restartIngestTool } from './restart-ingest.js';
import { searchRagTool } from './search-rag.js';
import { summarizeDocumentTool } from './summarize-document.js';
import { syncRepoTool } from './sync-repo.js';

/**
 * All core toolpack tool definitions (14 tools)
 */
export const CORE_TOOLS: UnifiedToolDefinition[] = [
  // Search & Discovery
  searchRagTool,
  listCollectionsTool,
  listDocumentsTool,
  getDocumentStatusTool,

  // Collection Management
  createCollectionTool,
  deleteCollectionTool, // SENSITIVE

  // Document Operations
  addDocumentTool,
  fetchWebContentTool,
  deleteDocumentTool, // SENSITIVE
  restartIngestTool,
  summarizeDocumentTool,

  // Repository Ingestion
  addRepoToCollectionTool,
  syncRepoTool,
  listReposTool,
];
