/**
 * Agent Chat Orchestrator
 *
 * Phase 16B: Refactored to use ChatProvider abstraction for multi-provider support.
 * Supports Anthropic (Claude Agent SDK), OpenAI (manual tool loop), and Ollama (basic chat).
 */

import type { Pool } from 'pg';
import {
  type ChatMessage,
  type ChatTool,
  type ToolContext,
  getConfiguredChatProvider,
} from '../services/chat-providers/index.js';
import { getModelConfigService } from '../services/model-config-service.js';
import { buildAgentTools } from './tools.js';

// =============================================================================
// Types
// =============================================================================

export interface AgentConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentChatParams {
  message: string;
  collectionId: string;
  history?: AgentConversationMessage[];
  /** Optional session ID for dynamic tool filtering (Phase 16F) */
  sessionId?: string;
}

export interface AgentToolCall {
  id: string;
  tool: string;
  input: unknown;
  status: 'started' | 'completed' | 'error';
  result?: unknown;
  serverName?: string;
}

export interface AgentChatResult {
  message: string;
  toolCalls: AgentToolCall[];
  history: AgentConversationMessage[];
  usage?: Record<string, unknown>;
}

// =============================================================================
// Configuration
// =============================================================================

export const BASE_SYSTEM_PROMPT = `You are an autonomous RAG assistant helping a developer manage documentation for multiple projects.

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
// Helper Functions
// =============================================================================

/**
 * Build chat messages from agent params and history
 */
function buildChatMessages(params: AgentChatParams): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // Add conversation history
  for (const entry of params.history ?? []) {
    messages.push({
      role: entry.role,
      content: entry.content,
    });
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: params.message,
  });

  return messages;
}

/**
 * Convert tool definitions to ChatTool format
 */
function buildChatTools(db: Pool, context: ToolContext): ChatTool[] {
  const { tools } = buildAgentTools(db, context);

  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? '',
    inputSchema: tool.input_schema as ChatTool['inputSchema'],
  }));
}

// =============================================================================
// Main Agent Function
// =============================================================================

/**
 * Run an agent chat using the configured ChatProvider.
 *
 * Phase 16B: Uses ChatProvider abstraction for multi-provider support.
 * - Anthropic: Uses Claude Agent SDK with MCP tools
 * - OpenAI: Uses manual tool execution loop
 * - Ollama: Basic chat without tools
 */
export async function runAgentChat(db: Pool, params: AgentChatParams): Promise<AgentChatResult> {
  const context: ToolContext = {
    collectionId: params.collectionId,
    sessionId: params.sessionId, // Phase 16F: Pass session ID for dynamic tool filtering
  };
  const history = params.history ?? [];

  // Get the configured chat provider
  const provider = await getConfiguredChatProvider(db, context);

  // Get model configuration
  const modelConfigService = getModelConfigService(db);
  const chatConfig = await modelConfigService.getChatModelConfig();

  // Build messages from history and current message
  const messages = buildChatMessages(params);

  // Build system prompt with collection context
  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nActive collection ID: ${params.collectionId}`;

  // Build tools if provider supports them
  const chatTools = provider.capabilities.supportsTools ? buildChatTools(db, context) : undefined;

  // Check if RAG features are needed but provider doesn't support tools
  if (!provider.capabilities.supportsTools) {
    // Warn user that RAG features are limited
    console.warn(
      `[Agent] Provider '${provider.name}' does not support tool calling. ` +
        'RAG search and document management will not be available. ' +
        'Consider switching to Anthropic or OpenAI for full functionality.'
    );
  }

  try {
    // Call the provider
    const response = await provider.chat({
      messages,
      model: chatConfig.model,
      systemPrompt,
      tools: chatTools,
      maxTokens: 4096,
    });

    // Build updated conversation history
    const updatedHistory: AgentConversationMessage[] = [
      ...history,
      { role: 'user', content: params.message },
      { role: 'assistant', content: response.content },
    ];

    // Convert tool calls to agent format
    const agentToolCalls: AgentToolCall[] = response.toolCalls.map((tc) => ({
      id: tc.id,
      tool: tc.name,
      input: tc.input,
      status: 'completed' as const,
      result: undefined, // Tool results are embedded in the response flow
    }));

    return {
      message: response.content,
      toolCalls: agentToolCalls,
      history: updatedHistory,
      usage: {
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
        total_tokens: response.usage.totalTokens,
        provider: response.provider,
        model: response.model,
      },
    };
  } catch (error) {
    // Handle provider-specific errors
    console.error(`[Agent] Chat failed with provider '${provider.name}':`, error);

    // Re-throw with context
    if (error instanceof Error) {
      throw new Error(`Chat provider '${provider.name}' error: ${error.message}`);
    }
    throw error;
  }
}
