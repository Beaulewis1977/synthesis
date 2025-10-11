import Anthropic from '@anthropic-ai/sdk';
import type { ContentBlock, MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages.js';
import type { Pool } from 'pg';
import { buildAgentTools } from './tools.js';

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

Current context:
- You have access to multiple project collections (Flutter, Supabase, etc.)
- All operations are collection-scoped
- The user can switch between collections in the UI`;

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

function extractTextFromContent(content: ContentBlock[]): string {
  const textParts: string[] = [];
  for (const block of content) {
    if (block.type === 'text') {
      textParts.push(block.text);
    }
  }
  return textParts.join('\n').trim();
}

function convertHistoryToMessages(history: AgentConversationMessage[]): MessageParam[] {
  return history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

export async function runAgentChat(db: Pool, params: AgentChatParams): Promise<AgentChatResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable must be set to use the agent.');
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const history = params.history ?? [];
  const { tools: toolDefinitions, toolExecutors } = buildAgentTools(db, {
    collectionId: params.collectionId,
  });

  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nActive collection ID: ${params.collectionId}`;
  const messages: MessageParam[] = [
    ...convertHistoryToMessages(history),
    { role: 'user', content: buildPrompt(params.message, params.collectionId, history) },
  ];

  const toolCalls: AgentToolCall[] = [];
  let assistantMessage = '';
  let totalUsage: Record<string, unknown> = {};

  const maxTurns = 10;
  let turn = 0;

  while (turn < maxTurns) {
    turn++;

    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: toolDefinitions as Tool[],
    });

    // Accumulate usage
    if (response.usage) {
      totalUsage = {
        input_tokens:
          ((totalUsage.input_tokens as number) ?? 0) + (response.usage.input_tokens ?? 0),
        output_tokens:
          ((totalUsage.output_tokens as number) ?? 0) + (response.usage.output_tokens ?? 0),
      };
    }

    // Extract text content
    const textContent = extractTextFromContent(response.content);
    if (textContent) {
      assistantMessage = textContent;
    }

    // Check for tool uses
    const toolUseBlocks = response.content.filter((block) => block.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      // No tools called, conversation is complete
      break;
    }

    // Add assistant's response with tool calls to messages
    messages.push({
      role: 'assistant',
      content: response.content,
    });

    // Execute tools and collect results
    const toolResults: Array<{
      type: 'tool_result';
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.type !== 'tool_use') continue;

      const toolCall: AgentToolCall = {
        id: toolUse.id,
        tool: toolUse.name,
        input: toolUse.input,
        status: 'started',
      };

      toolCalls.push(toolCall);

      try {
        const executor = toolExecutors[toolUse.name];
        if (!executor) {
          throw new Error(`Tool ${toolUse.name} not found`);
        }

        const result = await executor(toolUse.input);
        const resultText = extractToolResultContent(result);

        toolCall.status = 'completed';
        toolCall.result = resultText;

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: resultText,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toolCall.status = 'error';
        toolCall.result = errorMessage;

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: errorMessage,
          is_error: true,
        });
      }
    }

    // Add tool results to messages
    messages.push({
      role: 'user',
      content: toolResults,
    });

    // If this was the last turn, get one more response from Claude
    if (turn === maxTurns) {
      const finalResponse = await anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
        tools: toolDefinitions as Tool[],
      });

      if (finalResponse.usage) {
        totalUsage = {
          input_tokens:
            ((totalUsage.input_tokens as number) ?? 0) + (finalResponse.usage.input_tokens ?? 0),
          output_tokens:
            ((totalUsage.output_tokens as number) ?? 0) + (finalResponse.usage.output_tokens ?? 0),
        };
      }

      const finalText = extractTextFromContent(finalResponse.content);
      if (finalText) {
        assistantMessage = finalText;
      }
      break;
    }
  }

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

function extractToolResultContent(result: string | { content?: unknown }): string {
  if (typeof result === 'string') {
    return result;
  }

  if (result && typeof result === 'object') {
    if (result.content && Array.isArray(result.content)) {
      const textParts: string[] = [];
      for (const block of result.content) {
        if (
          block &&
          typeof block === 'object' &&
          block.type === 'text' &&
          typeof block.text === 'string'
        ) {
          textParts.push(block.text);
        }
      }
      const combined = textParts.join('\n').trim();
      if (combined) {
        return combined;
      }
    }

    // Fallback to JSON stringify
    return JSON.stringify(result, null, 2);
  }

  return String(result);
}
