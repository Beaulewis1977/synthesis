/**
 * Web Toolpack Index
 *
 * Exports all tools in the web toolpack for real-time information retrieval.
 */

import type { UnifiedToolDefinition } from '../types.js';
import { webSearchTool } from './web-search.js';

/**
 * Web toolpack tools (1 tool)
 */
export const WEB_TOOLS: UnifiedToolDefinition[] = [webSearchTool];

export { webSearchTool };
