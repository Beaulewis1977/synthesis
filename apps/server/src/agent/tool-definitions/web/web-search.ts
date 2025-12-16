/**
 * Web Search Tool Definition
 *
 * Searches the web using Perplexity AI for real-time information.
 * Supports three modes: quick (simple lookups), reason (complex questions),
 * and deep_research (comprehensive analysis).
 */

import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const webSearchInputSchema = z.object({
  query: z.string().min(2, 'query must be at least 2 characters').describe('Search query'),
  mode: z
    .enum(['quick', 'reason', 'deep_research'])
    .optional()
    .default('quick')
    .describe(
      'Search depth: quick for simple lookups (default), reason for complex questions, deep_research for comprehensive analysis'
    ),
});

type WebSearchInput = z.infer<typeof webSearchInputSchema>;

// =============================================================================
// Perplexity API Types
// =============================================================================

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  citations?: string[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the Perplexity model based on search mode
 */
function getPerplexityModel(mode: WebSearchInput['mode']): string {
  switch (mode) {
    case 'deep_research':
      return 'sonar-deep-research';
    case 'reason':
      return 'sonar-reasoning-pro';
    default:
      return 'sonar-pro';
  }
}

/**
 * Call the Perplexity API with timeout
 */
async function callPerplexityApi(
  query: string,
  model: string,
  apiKey: string
): Promise<PerplexityResponse> {
  const controller = new AbortController();
  // Longer timeout for deep research mode
  const timeoutMs = model === 'sonar-deep-research' ? 120000 : 60000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const messages: PerplexityMessage[] = [
    {
      role: 'system',
      content:
        'You are a helpful research assistant. Provide accurate, well-sourced information. Include relevant details and cite your sources.',
    },
    {
      role: 'user',
      content: query,
    },
  ];

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: model === 'sonar-deep-research' ? 4096 : 2048,
        return_citations: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as PerplexityResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Perplexity API timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

export const webSearchTool: UnifiedToolDefinition = {
  name: 'web_search',
  description:
    'Search the web for current information using Perplexity AI. Use mode=quick for simple lookups (default), mode=reason for complex questions requiring analysis, mode=deep_research for comprehensive research topics. Returns results with sources/citations.',
  inputSchema: webSearchInputSchema,
  metadata: {
    toolpack: 'web',
    category: 'web',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: () => async (input: unknown) => {
    const parsed = webSearchInputSchema.parse(input) as WebSearchInput;
    const apiKey = process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
      return createToolResponse(
        'Web search unavailable: PERPLEXITY_API_KEY environment variable is not set.',
        {
          error: 'missing_api_key',
          message: 'PERPLEXITY_API_KEY is required for web search functionality.',
        }
      );
    }

    try {
      const model = getPerplexityModel(parsed.mode);
      const result = await callPerplexityApi(parsed.query, model, apiKey);

      const content = result.choices[0]?.message?.content ?? 'No results found.';
      const citations = result.citations ?? [];

      const payload = {
        query: parsed.query,
        mode: parsed.mode,
        model: result.model,
        content,
        citations,
        usage: result.usage,
      };

      const citationSummary = citations.length > 0 ? ` Found ${citations.length} source(s).` : '';

      return createToolResponse(
        `Web search (${parsed.mode}) completed for "${parsed.query}".${citationSummary}`,
        payload
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return createToolResponse(`Web search failed: ${errorMessage}`, {
        error: 'search_failed',
        query: parsed.query,
        mode: parsed.mode,
        message: errorMessage,
      });
    }
  },
};
