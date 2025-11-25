import Anthropic from '@anthropic-ai/sdk';

/**
 * Vision OCR Module
 *
 * Extracts text from scanned/image-based PDFs using Claude Vision API.
 * This is used as a fallback when pdf-parse fails to extract text.
 */

// Environment configuration (read dynamically to support testing)
function getVisionOCRConfig() {
  return {
    enabled: process.env.VISION_OCR_ENABLED !== 'false',
    maxPages: Number.parseInt(process.env.VISION_OCR_MAX_PAGES || '50', 10),
    model: process.env.VISION_OCR_MODEL || 'claude-3-5-haiku-20241022',
  };
}

// Anthropic client (lazy initialization)
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

/**
 * Result from Vision OCR extraction
 */
export interface VisionOCRResult {
  /** Extracted text content */
  text: string;
  /** Number of pages processed */
  pageCount: number;
  /** Confidence level based on word count */
  confidence: 'high' | 'medium' | 'low';
  /** Total input tokens used */
  inputTokens: number;
  /** Total output tokens used */
  outputTokens: number;
}

/**
 * Options for Vision OCR extraction
 */
export interface VisionOCROptions {
  /** Maximum number of pages to process (default: 50) */
  maxPages?: number;
  /** Image scale factor for conversion (default: 2.0) */
  scale?: number;
  /** Model to use for OCR (default: claude-3-5-haiku-20241022) */
  model?: string;
}

/**
 * Check if Vision OCR is enabled
 */
export function isVisionOCREnabled(): boolean {
  return getVisionOCRConfig().enabled;
}

/**
 * Extract text from a single PDF page image using Claude Vision
 */
async function extractTextFromImage(
  imageBase64: string,
  pageNum: number,
  totalPages: number,
  model: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Extract ALL text from this document page (page ${pageNum} of ${totalPages}). 
Preserve the original structure, paragraphs, and formatting as much as possible.
Include headers, footers, captions, and any visible text.
Output ONLY the extracted text, no commentary or explanations.`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  const text = textBlock && 'text' in textBlock ? textBlock.text : '';

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

/**
 * Convert PDF buffer to images and extract text using Claude Vision
 *
 * @param pdfBuffer - The PDF file as a Buffer
 * @param options - Configuration options
 * @returns Promise<VisionOCRResult> - Extracted text and metadata
 * @throws Error if Vision OCR is disabled or extraction fails
 */
export async function extractTextWithVision(
  pdfBuffer: Buffer,
  options?: VisionOCROptions
): Promise<VisionOCRResult> {
  const config = getVisionOCRConfig();

  if (!config.enabled) {
    throw new Error('Vision OCR is disabled. Set VISION_OCR_ENABLED=true to enable.');
  }

  const maxPages = options?.maxPages ?? config.maxPages;
  const scale = options?.scale ?? 2.0;
  const model = options?.model ?? config.model;

  console.info('[Vision OCR] Starting PDF to image conversion...');
  console.info(`[Vision OCR] Config: maxPages=${maxPages}, scale=${scale}, model=${model}`);

  // Dynamic import of pdf-to-img (ESM module)
  const { pdf } = await import('pdf-to-img');

  const pages: string[] = [];
  let pageCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    // Convert PDF to document (returns async iterable)
    const pdfDocument = await pdf(pdfBuffer, { scale });

    // Convert PDF pages to images and process each one
    for await (const image of pdfDocument) {
      pageCount++;

      if (pageCount > maxPages) {
        console.warn(`[Vision OCR] Reached max pages limit (${maxPages}), stopping`);
        break;
      }

      // Convert image buffer to base64
      const base64 = image.toString('base64');

      console.info(`[Vision OCR] Processing page ${pageCount}...`);

      const result = await extractTextFromImage(base64, pageCount, pageCount, model);
      pages.push(result.text);
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;

      console.info(
        `[Vision OCR] Page ${pageCount}: ${result.text.split(/\s+/).length} words, ` +
          `${result.inputTokens} input tokens, ${result.outputTokens} output tokens`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Vision OCR] PDF conversion failed: ${message}`);
    throw new Error(`Vision OCR failed during PDF conversion: ${message}`);
  }

  if (pageCount === 0) {
    throw new Error('Vision OCR failed: No pages found in PDF');
  }

  // Combine all pages with page break markers
  const combinedText = pages.join('\n\n--- Page Break ---\n\n');
  const wordCount = combinedText.trim() === '' ? 0 : combinedText.split(/\s+/).length;

  // Determine confidence based on word count
  let confidence: 'high' | 'medium' | 'low';
  if (wordCount > 100) {
    confidence = 'high';
  } else if (wordCount > 20) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  console.info(
    `[Vision OCR] Complete: ${wordCount} words from ${pageCount} pages ` +
      `(${totalInputTokens} input tokens, ${totalOutputTokens} output tokens, confidence: ${confidence})`
  );

  return {
    text: combinedText,
    pageCount,
    confidence,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}

/**
 * Calculate estimated cost for Vision OCR
 *
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - Model used (default: claude-3-5-haiku-20241022)
 * @returns Estimated cost in USD
 */
export function calculateVisionOCRCost(
  inputTokens: number,
  outputTokens: number,
  model?: string
): number {
  const modelName = model ?? getVisionOCRConfig().model;

  // Pricing per 1K tokens (as of 2024-11)
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-3-5-haiku-20241022': { input: 0.0008, output: 0.004 },
    'claude-3-5-haiku-latest': { input: 0.0008, output: 0.004 },
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
    'claude-3-5-sonnet-latest': { input: 0.003, output: 0.015 },
  };

  const modelPricing = pricing[modelName] ?? pricing['claude-3-5-haiku-20241022'];

  const inputCost = (inputTokens / 1000) * modelPricing.input;
  const outputCost = (outputTokens / 1000) * modelPricing.output;

  return inputCost + outputCost;
}
