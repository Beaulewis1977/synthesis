/**
 * Anthropic Chat Provider
 *
 * Phase 16B: Anthropic implementation using Claude Agent SDK with MCP tools.
 * Adapts the agent.ts pattern to the ChatProvider interface.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Pool } from 'pg';
import { MCP_SERVER_NAME, MCP_TOOL_NAMES, buildAgentMcpServer } from '../../agent/tools.js';
import { getProviderApiKey } from './index.js';
import type {
  ChatMessage,
  ChatParams,
  ChatProvider,
  ChatResponse,
  ChatStopReason,
  ChatToolCall,
  ProviderCapabilities,
  ToolContext,
} from './types.js';

// =============================================================================
// Constants
// =============================================================================

/** Path to Claude CLI executable (required for SDK on WSL2) */
const CLAUDE_CLI_PATH = process.env.CLAUDE_CLI_PATH || 'claude';

const BASE_SYSTEM_PROMPT = `You are an autonomous RAG assistant helping a developer manage documentation for multiple projects.

Your capabilities:
- Search the knowledge base across collections
- Add documents from file paths or URLs
- Fetch and process web documentation (crawl pages)
- List and manage collections and documents
- Provide answers with specific citations

Guidelines:
- Always cite sources with document title and page/section when available
- When asked to add docs, proactively fetch and process them without asking for confirmation
- If documentation is outdated, offer to update it
- Be concise but thorough in your responses
- Confirm destructive actions (delete) before executing
- Use multiple tools in sequence when needed to complete a task
- Context-Aware Responses: Before responding, review the recent conversation history. Do not repeat basic metadata (e.g., file size, chunk count, token count, creation date) if it has already been presented to the user in a previous turn. Instead, focus on providing new, substantive information, such as a content summary, unless the user explicitly asks for the metadata again.

IMPORTANT - Tool Selection for Web Content:
- For WEB PAGES (HTML documentation sites like supabase.com, docs.flutter.dev, etc.): ALWAYS use \`fetch_web_content\` tool. This uses Playwright to render JavaScript and extracts clean markdown content.
- For RAW FILES (PDFs, markdown files, code files from raw.githubusercontent.com, etc.): Use \`add_document\` tool. This downloads the file directly.
- For GITHUB REPOSITORIES: Use \`fetch_web_content\` with mode='crawl' to capture multiple pages, OR use raw.githubusercontent.com URLs with \`add_document\` for specific files.
- NEVER use \`add_document\` for HTML web pages - it will save raw HTML with JavaScript/CSS noise instead of readable content.

Current context:
- You have access to multiple project collections (Flutter, Supabase, etc.)
- All operations are collection-scoped
- The user can switch between collections in the UI

MCP Tool Selection:
- Feature design (patterns/best practices): Use \`get_feature_recipe\` first for curated guides
- Code examples (working samples): Use \`find_code_examples\` to find demo implementations
- Framework-specific docs: Use \`search_mobile_docs\` with framework/featureTags filters
- General search: Use \`search_rag\` for broad collection searches
- Project analysis: Use \`get_project_tech_stack\` and \`get_db_schema\` to understand existing projects
- Code tracing: Use \`graph_expand_context\` and \`find_symbol_usages\` to trace code flow

For complex tasks, chain tools: get_feature_recipe → find_code_examples → search_mobile_docs`;

// =============================================================================
// Helper Types
// =============================================================================

interface SdkToolCall {
  id: string;
  tool: string;
  input: unknown;
  status: 'started' | 'completed' | 'error';
  result?: unknown;
  serverName?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract the tool name without the MCP prefix
 */
function extractToolName(fullName: string): string {
  // Format: mcp__synthesis-rag-tools__search_rag → search_rag
  const prefix = `mcp__${MCP_SERVER_NAME}__`;
  return fullName.startsWith(prefix) ? fullName.slice(prefix.length) : fullName;
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

/**
 * Convert SDK tool calls to ChatToolCall format
 */
function convertToolCalls(sdkToolCalls: SdkToolCall[]): ChatToolCall[] {
  return sdkToolCalls.map((tc) => ({
    id: tc.id,
    name: tc.tool,
    input: tc.input,
  }));
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
   * Send chat message using Claude Agent SDK query()
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    // Build MCP server with all RAG tools
    const mcpServer = buildAgentMcpServer(this.db, this.context);

    // Build system prompt with collection context
    const systemPrompt = params.systemPrompt
      ? `${params.systemPrompt}\n\nActive collection ID: ${this.context.collectionId}`
      : `${BASE_SYSTEM_PROMPT}\n\nActive collection ID: ${this.context.collectionId}`;

    // Build user prompt with history context
    const prompt = buildPrompt(params, this.context.collectionId);

    // Track tool calls and results
    const toolCalls: SdkToolCall[] = [];
    let assistantMessage = '';
    let totalUsage: {
      input_tokens?: number;
      output_tokens?: number;
      total_cost_usd?: number;
      num_turns?: number;
      duration_ms?: number;
    } = {};
    let stopReason: ChatStopReason = 'end_turn';

    try {
      // Use Claude Agent SDK query()
      // Note: Claude Agent SDK Options doesn't support temperature/maxTokens directly
      // Those are handled by the underlying Claude API within the SDK
      const response = query({
        prompt,
        options: {
          pathToClaudeCodeExecutable: CLAUDE_CLI_PATH,
          systemPrompt,
          model: params.model,
          mcpServers: {
            [MCP_SERVER_NAME]: mcpServer,
          },
          allowedTools: [...MCP_TOOL_NAMES],
          permissionMode: 'bypassPermissions',
          maxTurns: 10,
        },
      });

      // Process streaming response
      for await (const message of response) {
        switch (message.type) {
          case 'system':
            // Session initialization - could store session_id for future use
            if (message.subtype === 'init') {
              // Session started
            }
            break;

          case 'assistant':
            // Extract text content from assistant message
            if (typeof message.message?.content === 'string') {
              assistantMessage = message.message.content;
            } else if (Array.isArray(message.message?.content)) {
              const textBlocks = message.message.content.filter(
                (block: { type: string }) => block.type === 'text'
              );
              assistantMessage = textBlocks
                .map((block: { type: string; text?: string }) => block.text ?? '')
                .join('\n')
                .trim();
            }
            break;

          case 'user':
            // Tool results from user turns
            if (message.message?.content && Array.isArray(message.message.content)) {
              for (const block of message.message.content) {
                if (block.type === 'tool_result') {
                  // Find the matching tool call and update its result
                  const toolCall = toolCalls.find(
                    (tc) => tc.id === block.tool_use_id && tc.status === 'started'
                  );
                  if (toolCall) {
                    toolCall.status = block.is_error ? 'error' : 'completed';
                    // Extract text from content array
                    if (Array.isArray(block.content)) {
                      const textParts = block.content
                        .filter((c: { type: string }) => c.type === 'text')
                        .map((c: { type: string; text?: string }) => c.text ?? '');
                      toolCall.result = textParts.join('\n');
                    } else {
                      toolCall.result = block.content;
                    }
                  }
                } else if (block.type === 'tool_use') {
                  // Track tool call start
                  toolCalls.push({
                    id: block.id,
                    tool: extractToolName(block.name),
                    input: block.input,
                    status: 'started',
                    serverName: MCP_SERVER_NAME,
                  });
                }
              }
            }
            break;

          case 'result':
            // Final result with usage stats
            if (message.subtype === 'success') {
              if (message.result && typeof message.result === 'string') {
                // Use result as final message if we don't have one
                if (!assistantMessage) {
                  assistantMessage = message.result;
                }
              }
              // Capture usage statistics
              totalUsage = {
                input_tokens: message.usage?.input_tokens ?? 0,
                output_tokens: message.usage?.output_tokens ?? 0,
                total_cost_usd: message.total_cost_usd ?? 0,
                num_turns: message.num_turns ?? 0,
                duration_ms: message.duration_ms ?? 0,
              };
              stopReason = 'end_turn';
            } else if (message.subtype === 'error_max_turns') {
              // Max turns reached, still capture what we have
              totalUsage = {
                input_tokens: message.usage?.input_tokens ?? 0,
                output_tokens: message.usage?.output_tokens ?? 0,
                num_turns: message.num_turns ?? 0,
              };
              stopReason = 'max_tokens';
            }
            break;

          default:
            // Handle other message types as needed
            break;
        }
      }

      // Detect if tool use occurred
      if (toolCalls.length > 0) {
        stopReason = 'tool_use';
      }
    } catch (error) {
      console.error('Anthropic chat failed:', error);
      throw error;
    }

    // Build ChatResponse
    return {
      content: assistantMessage,
      toolCalls: convertToolCalls(toolCalls),
      stopReason,
      usage: {
        inputTokens: totalUsage.input_tokens ?? 0,
        outputTokens: totalUsage.output_tokens ?? 0,
        totalTokens: (totalUsage.input_tokens ?? 0) + (totalUsage.output_tokens ?? 0),
      },
      model: params.model,
      provider: 'anthropic',
    };
  }

  /**
   * Check if Anthropic is configured (has API key)
   */
  async isConfigured(): Promise<boolean> {
    const apiKey = await getProviderApiKey(this.db, 'anthropic');
    return apiKey !== null;
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
