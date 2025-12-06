import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Pool } from 'pg';
import { getModelConfigService } from '../services/model-config-service.js';
import { MCP_SERVER_NAME, MCP_TOOL_NAMES, buildAgentMcpServer } from './tools.js';

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
// Helper Functions
// =============================================================================

/**
 * Build the prompt with context for the agent
 */
function buildPrompt(
  message: string,
  collectionId: string,
  history: AgentConversationMessage[]
): string {
  const sections: string[] = [
    `Active collection ID: ${collectionId}`,
    'When you need additional context, call the `search_rag` tool to retrieve relevant chunks before answering.',
  ];

  if (history.length > 0) {
    const formattedHistory = history
      .map((entry) => `${entry.role === 'assistant' ? 'Assistant' : 'User'}: ${entry.content}`)
      .join('\n');
    sections.push(`Conversation so far:\n${formattedHistory}`);
  }

  sections.push(`Current user message:\n${message}`);
  return sections.join('\n\n');
}

/**
 * Extract the tool name without the MCP prefix
 */
function extractToolName(fullName: string): string {
  // Format: mcp__synthesis-rag-tools__search_rag → search_rag
  const prefix = `mcp__${MCP_SERVER_NAME}__`;
  return fullName.startsWith(prefix) ? fullName.slice(prefix.length) : fullName;
}

// =============================================================================
// Main Agent Function
// =============================================================================

/**
 * Run an agent chat using the Claude Agent SDK.
 *
 * This replaces the manual 10-turn agentic loop with the SDK's query() function,
 * which handles tool execution automatically.
 */
export async function runAgentChat(db: Pool, params: AgentChatParams): Promise<AgentChatResult> {
  // Get chat model configuration
  const modelConfigService = getModelConfigService(db);
  const chatConfig = await modelConfigService.getChatModelConfig();

  // Validate API key for Anthropic provider
  if (chatConfig.provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable must be set to use the agent.');
  }

  const history = params.history ?? [];

  // Build MCP server with all RAG tools
  const mcpServer = buildAgentMcpServer(db, { collectionId: params.collectionId });

  // Build system prompt with collection context
  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nActive collection ID: ${params.collectionId}`;

  // Build user prompt with history context
  const prompt = buildPrompt(params.message, params.collectionId, history);

  // Track tool calls and results
  const toolCalls: AgentToolCall[] = [];
  let assistantMessage = '';
  let totalUsage: Record<string, unknown> = {};

  try {
    // Use Claude Agent SDK query()
    const response = query({
      prompt,
      options: {
        pathToClaudeCodeExecutable: CLAUDE_CLI_PATH,
        systemPrompt,
        model: chatConfig.model,
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
          } else if (message.subtype === 'error_max_turns') {
            // Max turns reached, still capture what we have
            totalUsage = {
              input_tokens: message.usage?.input_tokens ?? 0,
              output_tokens: message.usage?.output_tokens ?? 0,
              num_turns: message.num_turns ?? 0,
            };
          }
          break;

        default:
          // Handle other message types as needed
          break;
      }
    }
  } catch (error) {
    console.error('Agent query failed:', error);
    throw error;
  }

  // Build updated conversation history
  const updatedHistory: AgentConversationMessage[] = [
    ...history,
    { role: 'user', content: params.message },
    { role: 'assistant', content: assistantMessage },
  ];

  return {
    message: assistantMessage,
    toolCalls,
    history: updatedHistory,
    usage: totalUsage,
  };
}
