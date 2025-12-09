/**
 * Anthropic Chat Provider
 *
 * Phase 16B: Anthropic implementation using Claude Agent SDK with MCP tools.
 * Phase 17A: Added OAuth/API key authentication mode toggle.
 * Adapts the agent.ts pattern to the ChatProvider interface.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Pool } from 'pg';
import { BASE_SYSTEM_PROMPT } from '../../agent/agent.js';
import { MCP_SERVER_NAME, MCP_TOOL_NAMES, buildAgentMcpServer } from '../../agent/tools.js';
import { getApiKeyService, getProviderSettingsService } from '../../services/api-key-service.js';
import { getProviderApiKey } from './index.js';
import {
  MCP_SERVER_NAME as REGISTRY_MCP_SERVER_NAME,
  ensureRegistryInitialized,
  getSessionMcpServer,
  getSessionMcpToolNames,
} from './registry-bridge.js';
import type {
  ChatMessage,
  ChatParams,
  ChatProvider,
  ChatResponse,
  ChatStopReason,
  ChatStreamChunk,
  ChatToolCall,
  ProviderCapabilities,
  ToolContext,
} from './types.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * Get the path to Claude CLI executable.
 * Read at runtime (not module load time) to ensure dotenv has loaded.
 */
function getClaudeCliPath(): string {
  const cliPath = process.env.CLAUDE_CLI_PATH || 'claude';
  return cliPath;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract the tool name without the MCP prefix
 * @param fullName Full tool name with MCP prefix
 * @param serverName MCP server name (defaults to MCP_SERVER_NAME)
 */
function extractToolName(fullName: string, serverName: string = MCP_SERVER_NAME): string {
  // Format: mcp__synthesis-rag-tools__search_rag → search_rag
  const prefix = `mcp__${serverName}__`;
  if (fullName.startsWith(prefix)) {
    return fullName.slice(prefix.length);
  }
  // Try with registry server name as fallback
  const registryPrefix = `mcp__${REGISTRY_MCP_SERVER_NAME}__`;
  if (fullName.startsWith(registryPrefix)) {
    return fullName.slice(registryPrefix.length);
  }
  return fullName;
}

/**
 * Build conversation context from message history
 */
function buildConversationContext(messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return '';
  }

  const formattedHistory = messages
    .filter((msg) => msg.role !== 'system')
    .map((msg) => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      const content = typeof msg.content === 'string' ? msg.content : '[Complex content]';
      return `${role}: ${content}`;
    })
    .join('\n');

  return `Conversation so far:\n${formattedHistory}`;
}

/**
 * Build the complete prompt for the SDK
 */
function buildPrompt(params: ChatParams, collectionId: string): string {
  const messages = params.messages ?? [];

  if (messages.length === 0) {
    throw new Error('Anthropic chat requires at least one message');
  }

  const sections: string[] = [
    `Active collection ID: ${collectionId}`,
    'When you need additional context, call the `search_rag` tool to retrieve relevant chunks before answering.',
  ];

  // Add conversation history (exclude current message)
  const history = messages.slice(0, -1);
  if (history.length > 0) {
    sections.push(buildConversationContext(history));
  }

  // Add current user message
  const currentMessage = messages[messages.length - 1];
  const currentContent =
    typeof currentMessage.content === 'string' ? currentMessage.content : '[Complex content]';
  sections.push(`Current user message:\n${currentContent}`);

  return sections.join('\n\n');
}

// =============================================================================
// Anthropic Chat Provider Implementation
// =============================================================================

export class AnthropicChatProvider implements ChatProvider {
  readonly name = 'anthropic' as const;
  readonly capabilities: ProviderCapabilities = {
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    maxContextTokens: 200000,
  };

  constructor(
    private readonly db: Pool,
    private readonly context: ToolContext
  ) {}

  /**
   * Stream chat chunks using Claude Agent SDK query()
   */
  async *streamChat(params: ChatParams): AsyncGenerator<ChatStreamChunk, void, unknown> {
    // Initialize registry and build MCP server with session-filtered tools
    ensureRegistryInitialized();
    const mcpServer = this.context.sessionId
      ? getSessionMcpServer(this.db, this.context)
      : buildAgentMcpServer(this.db, this.context);

    // Get allowed tool names (filtered by session if available)
    const serverName = this.context.sessionId ? REGISTRY_MCP_SERVER_NAME : MCP_SERVER_NAME;
    const allowedTools = this.context.sessionId
      ? getSessionMcpToolNames(this.context.sessionId)
      : [...MCP_TOOL_NAMES];

    // Build system prompt with collection context
    const systemPrompt = params.systemPrompt
      ? `${params.systemPrompt}\n\nActive collection ID: ${this.context.collectionId}`
      : `${BASE_SYSTEM_PROMPT}\n\nActive collection ID: ${this.context.collectionId}`;

    // Build user prompt with history context
    const prompt = buildPrompt(params, this.context.collectionId);

    // Phase 17A: Configure authentication based on auth mode setting
    await this.configureAuthentication();

    // Use Claude Agent SDK query()
    const claudeCliPath = getClaudeCliPath();

    const response = query({
      prompt,
      options: {
        pathToClaudeCodeExecutable: claudeCliPath,
        systemPrompt,
        model: params.model,
        mcpServers: {
          [serverName]: mcpServer,
        },
        allowedTools,
        permissionMode: 'bypassPermissions',
        maxTurns: 25,
      },
    });

    // Track pending tool calls for matching results
    const pendingToolCalls = new Map<string, { name: string; input: unknown }>();

    let messageCount = 0;
    try {
      for await (const message of response) {
        messageCount++;
        switch (message.type) {
          case 'system':
            // Session init - no chunk to yield
            break;

          case 'assistant':
            // Extract text and yield
            if (typeof message.message?.content === 'string') {
              yield { type: 'text', text: message.message.content };
            } else if (Array.isArray(message.message?.content)) {
              for (const block of message.message.content) {
                if (block.type === 'text' && block.text) {
                  yield { type: 'text', text: block.text };
                }
              }
            }
            break;

          case 'user':
            // Tool use/result events
            if (message.message?.content && Array.isArray(message.message.content)) {
              for (const block of message.message.content) {
                if (block.type === 'tool_use') {
                  const toolName = extractToolName(block.name);
                  pendingToolCalls.set(block.id, { name: toolName, input: block.input });
                  yield {
                    type: 'tool_start',
                    toolCall: { id: block.id, name: toolName, input: block.input },
                  };
                } else if (block.type === 'tool_result') {
                  const pending = pendingToolCalls.get(block.tool_use_id);
                  yield {
                    type: 'tool_end',
                    toolCall: {
                      id: block.tool_use_id,
                      name: pending?.name,
                    },
                  };
                  pendingToolCalls.delete(block.tool_use_id);
                }
              }
            }
            break;

          case 'result':
            // Final result with usage
            if (message.subtype === 'success') {
              yield {
                type: 'done',
                usage: {
                  inputTokens: message.usage?.input_tokens ?? 0,
                  outputTokens: message.usage?.output_tokens ?? 0,
                  totalTokens:
                    (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0),
                },
                stopReason: 'end_turn',
                // Include result text as fallback when no assistant message was streamed
                fallbackText: typeof message.result === 'string' ? message.result : undefined,
              };
            } else if (message.subtype === 'error_max_turns') {
              yield {
                type: 'done',
                usage: {
                  inputTokens: message.usage?.input_tokens ?? 0,
                  outputTokens: message.usage?.output_tokens ?? 0,
                  totalTokens:
                    (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0),
                },
                stopReason: 'max_tokens',
              };
            } else if (message.subtype === 'error_during_execution') {
              // Handle tool execution errors - ensure stream properly terminates
              yield {
                type: 'done',
                usage: {
                  inputTokens: message.usage?.input_tokens ?? 0,
                  outputTokens: message.usage?.output_tokens ?? 0,
                  totalTokens:
                    (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0),
                },
                stopReason: 'tool_error',
              };
            }
            break;
        }
      }
    } catch (sdkError) {
      // Log detailed SDK error for debugging
      console.error('[AnthropicProvider] Claude Agent SDK error:', {
        error: sdkError,
        cliPath: claudeCliPath,
        messageCount,
        model: params.model,
      });
      // Wrap error with provider context before re-throwing
      throw new Error(
        `[AnthropicProvider] Claude Agent SDK error: ${sdkError instanceof Error ? sdkError.message : 'Unknown error'}`,
        { cause: sdkError }
      );
    }
  }

  /**
   * Send chat message using streamChat()
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    let content = '';
    const toolCalls: ChatToolCall[] = [];
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let stopReason: ChatStopReason = 'end_turn';
    let fallbackText: string | undefined;

    try {
      for await (const chunk of this.streamChat(params)) {
        switch (chunk.type) {
          case 'text':
            content += chunk.text ?? '';
            break;
          case 'tool_start':
            if (chunk.toolCall?.id && chunk.toolCall?.name) {
              toolCalls.push({
                id: chunk.toolCall.id,
                name: chunk.toolCall.name,
                input: chunk.toolCall.input,
              });
            }
            break;
          case 'done':
            usage = chunk.usage ?? usage;
            stopReason = chunk.stopReason ?? stopReason;
            fallbackText = chunk.fallbackText;
            break;
        }
      }
    } catch (error) {
      console.error('Anthropic chat failed:', error);
      throw error;
    }

    // Use fallback text when no content was captured from assistant messages
    const finalContent = content || fallbackText || '';

    return {
      content: finalContent,
      toolCalls,
      stopReason,
      usage,
      model: params.model,
      provider: 'anthropic',
    };
  }

  /**
   * Check if Anthropic is configured (has API key or OAuth token based on mode)
   */
  async isConfigured(): Promise<boolean> {
    const settingsService = getProviderSettingsService(this.db);
    const authMode = await settingsService.getAnthropicAuthMode();

    if (authMode === 'oauth') {
      const apiKeyService = getApiKeyService(this.db);
      const oauthToken = await apiKeyService.getOAuthToken('anthropic');
      return oauthToken !== null;
    }

    const apiKey = await getProviderApiKey(this.db, 'anthropic');
    return apiKey !== null;
  }

  /**
   * Configure authentication for the Claude Agent SDK based on auth mode.
   * Sets the appropriate environment variable before making API calls.
   *
   * Phase 17A: Supports OAuth (Claude subscription) and API key (pay-per-use) modes.
   *
   * IMPORTANT: This implementation mutates process.env to set credentials.
   * The current architecture relies on a single global auth mode shared by all
   * concurrent requests. Changing auth mode per-request is NOT supported.
   *
   * TODO: If per-request or per-user authentication is later required,
   * the configureAuthentication() + query() sequence must be synchronized
   * (e.g., with a mutex or other locking) to prevent race conditions.
   * Consider avoiding process.env mutation by passing credentials directly
   * to the SDK if it supports it in a future version.
   *
   * @returns The auth mode that was configured ('oauth' | 'api_key')
   */
  private async configureAuthentication(): Promise<'oauth' | 'api_key'> {
    const settingsService = getProviderSettingsService(this.db);
    const authMode = await settingsService.getAnthropicAuthMode();

    if (authMode === 'oauth') {
      // OAuth mode: Use CLAUDE_CODE_OAUTH_TOKEN
      const apiKeyService = getApiKeyService(this.db);
      const oauthToken = await apiKeyService.getOAuthToken('anthropic');

      if (oauthToken) {
        // Set the OAuth token environment variable for the SDK
        process.env.CLAUDE_CODE_OAUTH_TOKEN = oauthToken;
        // Clear API key to ensure OAuth is used
        process.env.ANTHROPIC_API_KEY = undefined;
        return 'oauth';
      }
      // Fall back to API key if OAuth token not available
      console.warn(
        '[AnthropicProvider] OAuth mode selected but no token available, falling back to API key'
      );
    }

    // API key mode: Use ANTHROPIC_API_KEY
    const apiKey = await getProviderApiKey(this.db, 'anthropic');
    if (apiKey) {
      // Set the API key environment variable for the SDK
      process.env.ANTHROPIC_API_KEY = apiKey;
      // Clear OAuth token to ensure API key is used
      process.env.CLAUDE_CODE_OAUTH_TOKEN = undefined;
    }

    return 'api_key';
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an Anthropic chat provider instance
 */
export function createAnthropicProvider(db: Pool, context: ToolContext): ChatProvider {
  return new AnthropicChatProvider(db, context);
}
