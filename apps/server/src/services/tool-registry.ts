/**
 * Dynamic Tool Registry Service
 *
 * Phase 16F: Server-side tool registry for dynamic tool management.
 * Manages tool enable/disable state per session with optional Redis persistence.
 */

import type { Pool } from 'pg';
import {
  buildAgentToolsFromDefinitions,
  buildChatToolsFromDefinitions,
} from '../agent/tool-definitions/adapters.js';
import {
  GATEWAY_TOOL_NAMES,
  PROFILES,
  TOOLPACKS,
  isValidProfile,
  isValidToolpack,
} from '../agent/tool-definitions/toolpacks.js';
import type {
  BuiltAgentTools,
  BuiltChatTools,
  EnableDisableResult,
  ProfileName,
  SessionToolState,
  ToolContext,
  ToolMetadata,
  ToolState,
  UnifiedToolDefinition,
} from '../agent/tool-definitions/types.js';
import type { ToolpackName } from '../agent/tool-definitions/types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Callback for tool state changes
 */
export type ToolStateChangeCallback = (
  sessionId: string,
  enabledTools: string[],
  changedTools: string[]
) => void;

/**
 * Registry snapshot for inspection
 */
export interface RegistrySnapshot {
  tools: ToolState[];
  enabledCount: number;
  totalCount: number;
  activeProfile: ProfileName;
}

/**
 * Configuration for the registry
 */
export interface ToolRegistryConfig {
  /** Default profile for new sessions */
  defaultProfile: ProfileName;
  /** Session expiry time in milliseconds (default: 30 minutes) */
  sessionExpiryMs: number;
  /** Cleanup interval in milliseconds (default: 5 minutes) */
  cleanupIntervalMs: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: ToolRegistryConfig = {
  defaultProfile: 'core',
  sessionExpiryMs: 30 * 60 * 1000, // 30 minutes
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
};

// =============================================================================
// DynamicToolRegistry Class
// =============================================================================

/**
 * Dynamic Tool Registry for managing tool availability per session.
 *
 * Features:
 * - Session-scoped tool enable/disable
 * - Profile-based default tool sets
 * - Gateway tools (always enabled)
 * - Toolpack enable/disable
 * - Change callbacks for provider integration
 */
export class DynamicToolRegistry {
  /** All registered tool definitions */
  private readonly toolDefinitions: Map<string, UnifiedToolDefinition> = new Map();

  /** Session state storage */
  private readonly sessions: Map<string, SessionToolState> = new Map();

  /** Tool call statistics */
  private readonly toolStats: Map<string, ToolState> = new Map();

  /** State change callbacks */
  private readonly callbacks: Set<ToolStateChangeCallback> = new Set();

  /** Registry configuration */
  private readonly config: ToolRegistryConfig;

  /** Cleanup interval handle */
  private cleanupInterval: NodeJS.Timeout | null = null;

  /** Set of gateway tool names (always enabled) */
  private readonly gatewayTools: Set<string>;

  constructor(config: Partial<ToolRegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.gatewayTools = new Set(GATEWAY_TOOL_NAMES);

    // Start cleanup interval
    this.startCleanup();
  }

  // ===========================================================================
  // Tool Registration
  // ===========================================================================

  /**
   * Register a tool definition
   */
  registerTool(definition: UnifiedToolDefinition): void {
    this.toolDefinitions.set(definition.name, definition);

    // Initialize tool statistics
    this.toolStats.set(definition.name, {
      name: definition.name,
      enabled: true,
      enabledAt: new Date(),
      callCount: 0,
      lastCalledAt: undefined,
    });
  }

  /**
   * Register multiple tool definitions
   */
  registerTools(definitions: UnifiedToolDefinition[]): void {
    for (const def of definitions) {
      this.registerTool(def);
    }
  }

  /**
   * Get a tool definition by name
   */
  getToolDefinition(name: string): UnifiedToolDefinition | undefined {
    return this.toolDefinitions.get(name);
  }

  /**
   * Get all registered tool definitions
   */
  getAllToolDefinitions(): UnifiedToolDefinition[] {
    return Array.from(this.toolDefinitions.values());
  }

  /**
   * Get total registered tool count
   */
  get size(): number {
    return this.toolDefinitions.size;
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  /**
   * Get or create a session
   */
  getOrCreateSession(sessionId: string): SessionToolState {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = this.createSession(sessionId);
      this.sessions.set(sessionId, session);
    } else {
      // Update last activity
      session.lastActivityAt = new Date();
    }

    return session;
  }

  /**
   * Create a new session with default profile
   */
  private createSession(sessionId: string): SessionToolState {
    const profile = PROFILES[this.config.defaultProfile];
    const enabledTools = new Set<string>();

    // Always enable gateway tools
    for (const tool of GATEWAY_TOOL_NAMES) {
      enabledTools.add(tool);
    }

    // Enable tools from profile toolpacks
    for (const toolpackName of profile.toolpacks) {
      const toolpack = TOOLPACKS[toolpackName];
      if (toolpack) {
        for (const tool of toolpack.tools) {
          if (this.toolDefinitions.has(tool)) {
            enabledTools.add(tool);
          }
        }
      }
    }

    // Enable additional profile tools
    for (const tool of profile.additionalTools) {
      if (this.toolDefinitions.has(tool)) {
        enabledTools.add(tool);
      }
    }

    return {
      sessionId,
      enabledTools,
      activeProfile: this.config.defaultProfile,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  // ===========================================================================
  // Enable/Disable Operations
  // ===========================================================================

  /**
   * Enable a tool for a session
   */
  enableTool(sessionId: string, toolName: string): EnableDisableResult {
    const session = this.getOrCreateSession(sessionId);

    if (!this.toolDefinitions.has(toolName)) {
      return { ok: false, reason: 'not_found' };
    }

    if (session.enabledTools.has(toolName)) {
      return { ok: false, reason: 'already_enabled' };
    }

    session.enabledTools.add(toolName);
    this.notifyChange(sessionId, [toolName]);

    return { ok: true };
  }

  /**
   * Disable a tool for a session
   */
  disableTool(sessionId: string, toolName: string): EnableDisableResult {
    const session = this.getOrCreateSession(sessionId);

    // Gateway tools cannot be disabled
    if (this.gatewayTools.has(toolName)) {
      return { ok: false, reason: 'gateway_protected' };
    }

    if (!this.toolDefinitions.has(toolName)) {
      return { ok: false, reason: 'not_found' };
    }

    if (!session.enabledTools.has(toolName)) {
      return { ok: false, reason: 'already_disabled' };
    }

    session.enabledTools.delete(toolName);
    this.notifyChange(sessionId, [toolName]);

    return { ok: true };
  }

  /**
   * Enable all tools in a toolpack for a session
   */
  enableToolpack(sessionId: string, toolpackName: ToolpackName): string[] {
    if (!isValidToolpack(toolpackName)) {
      return [];
    }

    const session = this.getOrCreateSession(sessionId);
    const toolpack = TOOLPACKS[toolpackName];
    const enabled: string[] = [];

    for (const toolName of toolpack.tools) {
      if (this.toolDefinitions.has(toolName) && !session.enabledTools.has(toolName)) {
        session.enabledTools.add(toolName);
        enabled.push(toolName);
      }
    }

    if (enabled.length > 0) {
      this.notifyChange(sessionId, enabled);
    }

    return enabled;
  }

  /**
   * Disable all tools in a toolpack for a session
   */
  disableToolpack(sessionId: string, toolpackName: ToolpackName): string[] {
    if (!isValidToolpack(toolpackName)) {
      return [];
    }

    const session = this.getOrCreateSession(sessionId);
    const toolpack = TOOLPACKS[toolpackName];
    const disabled: string[] = [];

    for (const toolName of toolpack.tools) {
      // Skip gateway tools
      if (this.gatewayTools.has(toolName)) {
        continue;
      }

      if (session.enabledTools.has(toolName)) {
        session.enabledTools.delete(toolName);
        disabled.push(toolName);
      }
    }

    if (disabled.length > 0) {
      this.notifyChange(sessionId, disabled);
    }

    return disabled;
  }

  /**
   * Apply a profile to a session
   */
  applyProfile(sessionId: string, profileName: ProfileName): void {
    if (!isValidProfile(profileName)) {
      throw new Error(`Invalid profile: ${profileName}`);
    }

    const session = this.getOrCreateSession(sessionId);
    const profile = PROFILES[profileName];
    const previousTools = new Set(session.enabledTools);

    // Clear all non-gateway tools
    session.enabledTools.clear();

    // Always enable gateway tools
    for (const tool of GATEWAY_TOOL_NAMES) {
      session.enabledTools.add(tool);
    }

    // Enable tools from profile toolpacks
    for (const toolpackName of profile.toolpacks) {
      const toolpack = TOOLPACKS[toolpackName];
      if (toolpack) {
        for (const tool of toolpack.tools) {
          if (this.toolDefinitions.has(tool)) {
            session.enabledTools.add(tool);
          }
        }
      }
    }

    // Enable additional profile tools
    for (const tool of profile.additionalTools) {
      if (this.toolDefinitions.has(tool)) {
        session.enabledTools.add(tool);
      }
    }

    session.activeProfile = profileName;

    // Calculate changed tools
    const changed: string[] = [];
    for (const tool of previousTools) {
      if (!session.enabledTools.has(tool)) {
        changed.push(tool);
      }
    }
    for (const tool of session.enabledTools) {
      if (!previousTools.has(tool)) {
        changed.push(tool);
      }
    }

    if (changed.length > 0) {
      this.notifyChange(sessionId, changed);
    }
  }

  /**
   * Apply collection-specific toolpacks to a session.
   * This resets the session to only include gateway tools and the specified toolpacks.
   * Gateway is always included regardless of the toolpacks array.
   *
   * @param sessionId - Session to configure
   * @param toolpackNames - Array of toolpack names to enable
   * @returns Object with applied tools and any failures
   */
  applyCollectionToolpacks(
    sessionId: string,
    toolpackNames: ToolpackName[]
  ): { applied: string[]; failed: { name: string; reason: string }[] } {
    const session = this.getOrCreateSession(sessionId);
    const previousTools = new Set(session.enabledTools);

    // Clear all non-gateway tools
    session.enabledTools.clear();

    // Always enable gateway tools
    for (const tool of GATEWAY_TOOL_NAMES) {
      session.enabledTools.add(tool);
    }

    const applied: string[] = [];
    const failed: { name: string; reason: string }[] = [];

    // Apply each toolpack
    for (const toolpackName of toolpackNames) {
      if (!isValidToolpack(toolpackName)) {
        failed.push({ name: toolpackName, reason: 'Invalid toolpack name' });
        continue;
      }

      const toolpack = TOOLPACKS[toolpackName];
      if (toolpack) {
        for (const tool of toolpack.tools) {
          if (this.toolDefinitions.has(tool) && !session.enabledTools.has(tool)) {
            session.enabledTools.add(tool);
            applied.push(tool);
          }
        }
      }
    }

    // Mark profile as custom since we're using collection-specific toolpacks
    session.activeProfile = 'core'; // Closest match, though not exact

    // Calculate changed tools for notification
    const changed: string[] = [];
    for (const tool of previousTools) {
      if (!session.enabledTools.has(tool)) {
        changed.push(tool);
      }
    }
    for (const tool of session.enabledTools) {
      if (!previousTools.has(tool)) {
        changed.push(tool);
      }
    }

    if (changed.length > 0) {
      this.notifyChange(sessionId, changed);
    }

    return { applied, failed };
  }

  /**
   * Check if a tool is enabled for a session
   */
  isToolEnabled(sessionId: string, toolName: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.enabledTools.has(toolName) ?? false;
  }

  /**
   * Get enabled tool names for a session
   */
  getEnabledTools(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session ? Array.from(session.enabledTools) : [];
  }

  /**
   * Get enabled tool count for a session
   */
  getEnabledToolCount(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    return session?.enabledTools.size ?? 0;
  }

  // ===========================================================================
  // Tool Building
  // ===========================================================================

  /**
   * Build agent tools for a session (Anthropic SDK format)
   */
  buildAgentToolsForSession(sessionId: string, db: Pool, context: ToolContext): BuiltAgentTools {
    const enabledNames = this.getEnabledTools(sessionId);
    const definitions = enabledNames
      .map((name) => this.toolDefinitions.get(name))
      .filter((def): def is UnifiedToolDefinition => def !== undefined);

    return buildAgentToolsFromDefinitions(definitions, db, context);
  }

  /**
   * Build chat tools for a session (ChatProvider format)
   */
  buildChatToolsForSession(sessionId: string, db: Pool, context: ToolContext): BuiltChatTools {
    const enabledNames = this.getEnabledTools(sessionId);
    const definitions = enabledNames
      .map((name) => this.toolDefinitions.get(name))
      .filter((def): def is UnifiedToolDefinition => def !== undefined);

    return buildChatToolsFromDefinitions(definitions, db, context);
  }

  // ===========================================================================
  // Statistics & Monitoring
  // ===========================================================================

  /**
   * Record a tool call for statistics
   */
  recordToolCall(toolName: string): void {
    const stats = this.toolStats.get(toolName);
    if (stats) {
      stats.callCount++;
      stats.lastCalledAt = new Date();
    }
  }

  /**
   * Get a snapshot of registry state for a session
   */
  getSnapshot(sessionId: string): RegistrySnapshot {
    const session = this.sessions.get(sessionId);
    const tools: ToolState[] = [];

    for (const [name] of this.toolDefinitions) {
      const stats = this.toolStats.get(name);
      tools.push({
        name,
        enabled: session?.enabledTools.has(name) ?? false,
        enabledAt: stats?.enabledAt,
        callCount: stats?.callCount ?? 0,
        lastCalledAt: stats?.lastCalledAt,
      });
    }

    return {
      tools,
      enabledCount: session?.enabledTools.size ?? 0,
      totalCount: this.toolDefinitions.size,
      activeProfile: session?.activeProfile ?? this.config.defaultProfile,
    };
  }

  /**
   * Get tool metadata for discovery
   */
  getToolMetadata(toolName: string): ToolMetadata | undefined {
    const def = this.toolDefinitions.get(toolName);
    return def?.metadata;
  }

  /**
   * Get all tool metadata grouped by toolpack
   */
  getToolpackSummary(): Record<string, { description: string; tools: string[]; enabled?: number }> {
    const summary: Record<string, { description: string; tools: string[]; enabled?: number }> = {};

    for (const [name, toolpack] of Object.entries(TOOLPACKS)) {
      const registeredTools = toolpack.tools.filter((t) => this.toolDefinitions.has(t));
      summary[name] = {
        description: toolpack.description,
        tools: registeredTools,
      };
    }

    return summary;
  }

  // ===========================================================================
  // Change Callbacks
  // ===========================================================================

  /**
   * Register a callback for tool state changes
   */
  onToolStateChange(callback: ToolStateChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Notify callbacks of tool state change
   */
  private notifyChange(sessionId: string, changedTools: string[]): void {
    const enabledTools = this.getEnabledTools(sessionId);
    for (const callback of this.callbacks) {
      try {
        callback(sessionId, enabledTools, changedTools);
      } catch (error) {
        console.error('[ToolRegistry] Callback error:', error);
      }
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Start session cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiryMs = this.config.sessionExpiryMs;
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivityAt.getTime() > expiryMs) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.info(`[ToolRegistry] Cleaned up ${cleaned} expired session(s)`);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopCleanup();
    this.sessions.clear();
    this.callbacks.clear();
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let registryInstance: DynamicToolRegistry | null = null;

/**
 * Get the global tool registry instance
 */
export function getToolRegistry(config?: Partial<ToolRegistryConfig>): DynamicToolRegistry {
  if (!registryInstance) {
    registryInstance = new DynamicToolRegistry(config);
  } else if (config) {
    console.warn('[ToolRegistry] Config provided but registry already initialized - ignoring');
  }
  return registryInstance;
}

/**
 * Reset the global registry instance (for testing)
 */
export function resetToolRegistry(): void {
  if (registryInstance) {
    registryInstance.destroy();
    registryInstance = null;
  }
}
