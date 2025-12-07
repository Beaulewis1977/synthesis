/**
 * Gateway Toolpack - Tool Definitions Index
 *
 * Phase 16F: Exports gateway tools for dynamic tool management.
 * These tools are always enabled and cannot be disabled.
 */

export { discoverToolsTool } from './discover-tools.js';
export { enableToolsTool } from './enable-tools.js';

import type { UnifiedToolDefinition } from '../types.js';
import { discoverToolsTool } from './discover-tools.js';
import { enableToolsTool } from './enable-tools.js';

/**
 * All gateway toolpack tool definitions
 */
export const GATEWAY_TOOLS: UnifiedToolDefinition[] = [discoverToolsTool, enableToolsTool];
