/**
 * Types Barrel Export
 *
 * Central export for all dynamic tool management types.
 *
 * @module apps/mcp/src/types
 * @since GPT Phase 3: Sub-Phase 5.6.0
 */

// =============================================================================
// Tool Handle Types
// =============================================================================

export type {
  McpToolHandle,
  McpToolUpdateOptions,
  SynthesisToolHandle,
  ToolpackName,
  CategoryName,
  ToolState,
  RegistrySnapshot,
  DynamicToolDefinition,
  ToolResult,
} from './tool-handle.js';

export {
  isValidToolpackName,
  isValidCategoryName,
  isValidProfileName,
} from './tool-handle.js';

// =============================================================================
// Gateway Schemas (Zod)
// =============================================================================

export {
  discoverToolsInputSchema,
  enableToolsInputSchema,
  routerInputSchema,
  bridgeInputSchema,
  searchInputSchema,
  toolpackNameSchema,
  categoryNameSchema,
  toInputShape,
  GATEWAY_SCHEMAS,
  GATEWAY_TOOL_NAMES,
  GATEWAY_TOOL_DESCRIPTIONS,
  isGatewayTool,
} from './gateway-schemas.js';

export type {
  DiscoverToolsInput,
  EnableToolsInput,
  RouterInput,
  BridgeInput,
  SearchInput,
  GatewayToolName,
} from './gateway-schemas.js';

// =============================================================================
// Gateway Response Types
// =============================================================================

export type {
  ToolContentItem,
  ToolRef,
  ToolpackInfo,
  CategoryInfo,
  DiscoverResult,
  EnableResult,
  RouterMetadata,
  RouterError,
  RouterSuccess,
  RouterResult,
  BridgeResult,
  SearchChunk,
  SearchResult,
  GatewayResponse,
} from './gateway-responses.js';

export {
  isRouterError,
  isRouterSuccess,
  wrapGatewayResponse,
  toToolResult,
} from './gateway-responses.js';

// =============================================================================
// Profile Types
// =============================================================================

export type {
  ProfileName,
  RouterMode,
  Profile,
  ProfileConfig,
  DynamicToolConfig,
} from './profiles.js';

export {
  PROFILES,
  DEFAULT_PROFILE,
  getProfile,
  listProfileNames,
  isValidProfile,
  isValidRouterMode,
  parseEnvConfig,
  estimateProfileTokens,
  getSmallestProfileWithToolpack,
  CATEGORY_DESCRIPTIONS,
} from './profiles.js';
