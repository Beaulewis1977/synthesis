/**
 * LLM-as-Judge Evaluator
 *
 * Uses Claude to evaluate the quality of RAG-generated answers.
 * This enables automated evaluation of generation quality without
 * requiring expensive human annotation.
 *
 * Metrics evaluated:
 * - Faithfulness: Is the answer grounded in the retrieved context?
 * - Relevancy: Does the answer address the query?
 * - Completeness: Are all key points covered?
 * - Coherence: Is the answer well-structured and readable?
 * - Citation Accuracy: Are sources referenced correctly?
 */

import Anthropic from '@anthropic-ai/sdk';
import type { GenerationMetrics } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface LLMJudgeOptions {
  /** Anthropic client (optional, will create if not provided) */
  anthropic?: Anthropic;

  /** Model to use for judging (default: claude-3-5-sonnet-20241022) */
  model?: string;

  /** Whether to include detailed reasoning in results */
  includeReasoning?: boolean;
}

interface JudgeResponse {
  faithfulness: number;
  relevancy: number;
  completeness: number;
  coherence: number;
  citation_accuracy: number;
  reasoning: string;
}

// =============================================================================
// LLM Judge
// =============================================================================

/**
 * Create an LLM judge function for evaluating generation quality
 */
export function createLLMJudge(options: LLMJudgeOptions = {}) {
  const anthropic = options.anthropic ?? new Anthropic();
  const model = options.model ?? 'claude-3-5-sonnet-20241022';
  const includeReasoning = options.includeReasoning ?? true;

  /**
   * Judge function that evaluates a single response
   */
  return async function judge(
    query: string,
    context: string,
    answer: string
  ): Promise<GenerationMetrics> {
    const startTime = Date.now();

    const prompt = buildJudgePrompt(query, context, answer);

    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const latencyMs = Date.now() - startTime;

    // Parse response
    if (!response.content || response.content.length === 0) {
      throw new Error('Empty response content from judge');
    }
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from judge');
    }

    const parsed = parseJudgeResponse(content.text);

    return {
      faithfulness: parsed.faithfulness / 10, // Normalize to 0-1
      relevancy: parsed.relevancy / 10,
      completeness: parsed.completeness / 10,
      coherence: parsed.coherence / 10,
      citation_accuracy: parsed.citation_accuracy / 10,
      latency_ms: latencyMs,
      response_tokens: response.usage.output_tokens,
      reasoning: includeReasoning ? parsed.reasoning : '',
    };
  };
}

// =============================================================================
// Prompt Building
// =============================================================================

/**
 * Build the judge prompt
 */
function buildJudgePrompt(query: string, context: string, answer: string): string {
  return `You are an expert evaluator assessing the quality of a RAG (Retrieval-Augmented Generation) system's response.

## User Query
${query}

## Retrieved Context
${context}

## Generated Answer
${answer}

## Evaluation Criteria

Rate each dimension on a scale of 0-10:

### 1. Faithfulness (0-10)
Does the answer contain ONLY information that is directly supported by the retrieved context?
- 10: Every claim is explicitly supported by the context
- 7-9: Most claims are supported, minor extrapolations that are reasonable
- 4-6: Some unsupported claims or mild hallucinations
- 1-3: Significant unsupported claims or hallucinations
- 0: Answer is mostly fabricated

### 2. Relevancy (0-10)
Does the answer directly address what the user asked?
- 10: Perfectly addresses the query with no tangents
- 7-9: Addresses the query well, minor tangents
- 4-6: Partially addresses the query, missing key aspects
- 1-3: Barely relevant to the query
- 0: Completely off-topic

### 3. Completeness (0-10)
Does the answer cover all important aspects that a user would expect?
- 10: Comprehensive coverage of all relevant points
- 7-9: Covers most important points
- 4-6: Covers some points but misses important ones
- 1-3: Very incomplete
- 0: Missing essential information

### 4. Coherence (0-10)
Is the answer well-structured, clear, and readable?
- 10: Excellent structure, flows logically, easy to understand
- 7-9: Good structure, minor issues
- 4-6: Adequate but could be clearer
- 1-3: Poorly organized, hard to follow
- 0: Incoherent

### 5. Citation Accuracy (0-10)
If sources are cited, are they accurate? If no citations, rate based on whether key claims are attributable.
- 10: All citations accurate, or all major claims clearly attributable to context
- 7-9: Most citations/attributions are correct
- 4-6: Some inaccuracies
- 1-3: Many inaccuracies
- 0: Citations/attributions are wrong or misleading

## Output Format

Respond with a JSON object ONLY (no other text):
{
  "faithfulness": <0-10>,
  "relevancy": <0-10>,
  "completeness": <0-10>,
  "coherence": <0-10>,
  "citation_accuracy": <0-10>,
  "reasoning": "<brief explanation of scores, 2-3 sentences>"
}`;
}

// =============================================================================
// Response Parsing
// =============================================================================

/**
 * Parse the judge's response
 */
function parseJudgeResponse(text: string): JudgeResponse {
  try {
    // Extract JSON from response (handle potential markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText) as JudgeResponse;

    // Validate scores are in range
    const validateScore = (score: number, name: string): number => {
      if (typeof score !== 'number' || score < 0 || score > 10) {
        console.warn(`Invalid ${name} score: ${score}, clamping to 0-10`);
        return Math.max(0, Math.min(10, score || 0));
      }
      return score;
    };

    return {
      faithfulness: validateScore(parsed.faithfulness, 'faithfulness'),
      relevancy: validateScore(parsed.relevancy, 'relevancy'),
      completeness: validateScore(parsed.completeness, 'completeness'),
      coherence: validateScore(parsed.coherence, 'coherence'),
      citation_accuracy: validateScore(parsed.citation_accuracy, 'citation_accuracy'),
      reasoning: parsed.reasoning || '',
    };
  } catch (error) {
    throw new Error(
      `Failed to parse judge response: ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`
    );
  }
}

// =============================================================================
// Batch Evaluation
// =============================================================================

export interface BatchJudgeInput {
  id: string;
  query: string;
  context: string;
  answer: string;
}

export interface BatchJudgeResult {
  id: string;
  metrics: GenerationMetrics | null;
  error?: string;
}

/**
 * Evaluate multiple responses in parallel with rate limiting
 */
export async function batchJudge(
  inputs: BatchJudgeInput[],
  options: LLMJudgeOptions & {
    /** Max concurrent requests (default: 3) */
    concurrency?: number;
    /** Progress callback */
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<BatchJudgeResult[]> {
  const judge = createLLMJudge(options);
  const concurrency = options.concurrency ?? 3;
  const results: BatchJudgeResult[] = [];

  let completed = 0;

  // Process in batches
  for (let i = 0; i < inputs.length; i += concurrency) {
    const batch = inputs.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (input) => {
        try {
          const metrics = await judge(input.query, input.context, input.answer);
          return { id: input.id, metrics };
        } catch (error) {
          return {
            id: input.id,
            metrics: null,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    results.push(...batchResults);
    completed += batch.length;

    if (options.onProgress) {
      options.onProgress(completed, inputs.length);
    }
  }

  return results;
}

// =============================================================================
// Quick Evaluation Functions
// =============================================================================

/**
 * Quick faithfulness check - is the answer grounded in context?
 */
export async function checkFaithfulness(
  context: string,
  answer: string,
  anthropic?: Anthropic
): Promise<{ score: number; issues: string[] }> {
  const client = anthropic ?? new Anthropic();

  const prompt = `Check if this answer is faithful to the given context.

Context:
${context}

Answer:
${answer}

List any claims in the answer that are NOT supported by the context.
If all claims are supported, respond with "FAITHFUL".

Format:
- If faithful: {"score": 1.0, "issues": []}
- If issues: {"score": <0-1>, "issues": ["unsupported claim 1", "unsupported claim 2"]}`;

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  if (!response.content || response.content.length === 0) {
    throw new Error('Empty response content');
  }
  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  try {
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(jsonText) as { score: number; issues: string[] };
  } catch {
    // Fallback parsing
    if (content.text.includes('FAITHFUL')) {
      return { score: 1.0, issues: [] };
    }
    return { score: 0.5, issues: ['Could not parse response'] };
  }
}

/**
 * Quick relevancy check - does the answer address the query?
 */
export async function checkRelevancy(
  query: string,
  answer: string,
  anthropic?: Anthropic
): Promise<{ score: number; reasoning: string }> {
  const client = anthropic ?? new Anthropic();

  const prompt = `Rate how well this answer addresses the user's query.

Query: ${query}

Answer: ${answer}

Respond with JSON:
{"score": <0.0-1.0>, "reasoning": "<brief explanation>"}`;

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  if (!response.content || response.content.length === 0) {
    throw new Error('Empty response content');
  }
  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  try {
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(jsonText) as { score: number; reasoning: string };
  } catch {
    return { score: 0.5, reasoning: 'Could not parse response' };
  }
}
