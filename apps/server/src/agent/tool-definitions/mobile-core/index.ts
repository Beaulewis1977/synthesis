/**
 * Mobile Core Toolpack
 *
 * Phase 16F: Mobile-specific search and documentation tools.
 * Exports all tools in the mobile_core toolpack.
 */

export { searchMobileDocsTool } from './search-mobile-docs.js';
export { findCodeExamplesTool } from './find-code-examples.js';
export { getFeatureRecipeTool } from './get-feature-recipe.js';

import type { UnifiedToolDefinition } from '../types.js';
import { findCodeExamplesTool } from './find-code-examples.js';
import { getFeatureRecipeTool } from './get-feature-recipe.js';
import { searchMobileDocsTool } from './search-mobile-docs.js';

export const MOBILE_CORE_TOOLS: UnifiedToolDefinition[] = [
  searchMobileDocsTool,
  findCodeExamplesTool,
  getFeatureRecipeTool,
];
