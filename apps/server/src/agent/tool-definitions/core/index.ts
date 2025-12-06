/**
 * Core Toolpack - Tool Definitions Index
 *
 * Phase 16F: Exports all core RAG tools with unified definitions.
 */

export { addDocumentTool } from './add-document.js';
export { deleteDocumentTool } from './delete-document.js';
export { fetchWebContentTool } from './fetch-web-content.js';
export { getDocumentStatusTool } from './get-document-status.js';
export { listCollectionsTool } from './list-collections.js';
export { listDocumentsTool } from './list-documents.js';
export { restartIngestTool } from './restart-ingest.js';
export { searchRagTool } from './search-rag.js';
export { summarizeDocumentTool } from './summarize-document.js';

import type { UnifiedToolDefinition } from '../types.js';
import { addDocumentTool } from './add-document.js';
import { deleteDocumentTool } from './delete-document.js';
import { fetchWebContentTool } from './fetch-web-content.js';
import { getDocumentStatusTool } from './get-document-status.js';
import { listCollectionsTool } from './list-collections.js';
import { listDocumentsTool } from './list-documents.js';
import { restartIngestTool } from './restart-ingest.js';
import { searchRagTool } from './search-rag.js';
import { summarizeDocumentTool } from './summarize-document.js';

/**
 * All core toolpack tool definitions
 */
export const CORE_TOOLS: UnifiedToolDefinition[] = [
  searchRagTool,
  addDocumentTool,
  fetchWebContentTool,
  listCollectionsTool,
  listDocumentsTool,
  getDocumentStatusTool,
  deleteDocumentTool,
  restartIngestTool,
  summarizeDocumentTool,
];
