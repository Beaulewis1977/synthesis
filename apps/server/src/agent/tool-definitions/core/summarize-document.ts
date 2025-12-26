/**
 * Summarize Document Tool Definition
 *
 * Phase 16F: Unified tool definition for summarize_document.
 * Summarizes a document using Claude based on its stored chunks.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getDocument, getDocumentChunks, getPool } from '@synthesis/db';
import { z } from 'zod';
import { getModelConfigService } from '../../../services/model-config-service.js';
import { resolveSummaryProviderCredentials } from '../../utils/provider-credentials.js';
import { createToolResponse } from '../adapters.js';
import type { UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const summarizeDocumentInputSchema = z.object({
  doc_id: z.string().uuid().describe('Document ID'),
  max_chunks: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe('Max chunks to include (default: 10)'),
});

type SummarizeDocumentInput = z.infer<typeof summarizeDocumentInputSchema>;

// =============================================================================
// Helper Functions
// =============================================================================

function extractTextContent(
  response: Awaited<ReturnType<Anthropic['messages']['create']>>
): string {
  if (!('content' in response) || !Array.isArray(response.content)) {
    return '';
  }
  const textParts: string[] = [];
  for (const block of response.content) {
    if (
      block &&
      typeof block === 'object' &&
      block.type === 'text' &&
      typeof block.text === 'string'
    ) {
      textParts.push(block.text);
    }
  }
  return textParts.join('\n').trim();
}

// =============================================================================
// Tool Definition
// =============================================================================

export const summarizeDocumentTool: UnifiedToolDefinition = {
  name: 'summarize_document',
  description: 'Summarize a document using Claude based on its stored chunks.',
  inputSchema: summarizeDocumentInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: () => async (input: unknown) => {
    const parsed = summarizeDocumentInputSchema.parse(input) as SummarizeDocumentInput;

    // Get summary model configuration
    const db = getPool();
    const modelConfigService = getModelConfigService(db);
    const summaryConfig = await modelConfigService.getSummaryModelConfig();

    const credentials = await resolveSummaryProviderCredentials(
      summaryConfig.provider,
      db,
      createToolResponse
    );
    if ('errorResponse' in credentials) {
      return credentials.errorResponse;
    }
    const apiKey = credentials.apiKey;

    const document = await getDocument(parsed.doc_id);
    if (!document) {
      return createToolResponse(`Document ${parsed.doc_id} not found.`);
    }

    const chunks = await getDocumentChunks(document.id);
    if (chunks.length === 0) {
      return createToolResponse(`Document ${document.title} has no chunks to summarize.`);
    }

    const selectedChunks = chunks.slice(0, parsed.max_chunks ?? 10);
    const combinedText = selectedChunks.map((chunk) => chunk.text).join('\n\n');

    const client = new Anthropic({
      apiKey,
    });

    const response = await client.messages.create({
      model: summaryConfig.model,
      max_tokens: 512,
      system:
        'You are a documentation assistant that summarizes technical documents concisely with key points and citations when possible.',
      messages: [
        {
          role: 'user',
          content: `Summarize the following document titled "${document.title}". Highlight the main points and include section references if provided.\n\n${combinedText}`,
        },
      ],
    });

    const summary = extractTextContent(response);

    return createToolResponse(`Summary generated for document ${document.title}.`, {
      doc_id: document.id,
      title: document.title,
      summary,
    });
  },
};
