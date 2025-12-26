import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPool } from '@synthesis/db';
import OpenAI from 'openai';
import { getApiKeyService } from '../services/api-key-service.js';
import { PROVIDER_PRICING } from '../services/cost-tracker.js';
import { getModelConfigService } from '../services/model-config-service.js';

/**
 * Vision OCR Module
 *
 * Phase 17B: Multi-provider Vision OCR
 * Extracts text from scanned/image-based PDFs using vision-capable LLMs.
 * Supports: Anthropic (Claude), OpenAI (GPT-4V), Google (Gemini Pro Vision)
 * This is used as a fallback when pdf-parse fails to extract text.
 */

// Environment configuration (read dynamically to support testing)
function getVisionOCRConfig() {
  return {
    enabled: process.env.VISION_OCR_ENABLED === 'true',
    maxPages: Number.parseInt(process.env.VISION_OCR_MAX_PAGES || '50', 10),
    // Model is now fetched from ModelConfigService, but keep env fallback for backward compatibility
    model: process.env.VISION_OCR_MODEL || 'claude-3-5-haiku-20241022',
  };
}

/**
 * Get OCR model config from ModelConfigService (async)
 * Falls back to environment/default if service unavailable
 */
async function getOCRModelConfig(): Promise<{ provider: string; model: string }> {
  try {
    const db = getPool();
    const modelConfigService = getModelConfigService(db);
    const config = await modelConfigService.getOCRModelConfig();
    return { provider: config.provider, model: config.model };
  } catch {
    // Fall back to environment config if service unavailable
    return { provider: 'anthropic', model: getVisionOCRConfig().model };
  }
}

// =============================================================================
// Provider-specific API key retrieval
// =============================================================================

/**
 * Get API key for a provider using the API key service
 * Supports both DB-configured and environment variable keys
 */
async function getProviderApiKey(provider: string): Promise<string | null> {
  try {
    const db = getPool();
    const apiKeyService = getApiKeyService(db);
    return await apiKeyService.getKey(provider);
  } catch {
    // Fall back to environment variable
    const envVarMap: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      google: 'GOOGLE_API_KEY',
    };
    const envVar = envVarMap[provider];
    return envVar ? (process.env[envVar] ?? null) : null;
  }
}

/**
 * Get OAuth token for Anthropic (if OAuth mode is enabled)
 */
async function getAnthropicOAuthToken(): Promise<string | null> {
  try {
    const db = getPool();
    const apiKeyService = getApiKeyService(db);
    return await apiKeyService.getOAuthToken('anthropic');
  } catch {
    return process.env.CLAUDE_CODE_OAUTH_TOKEN ?? null;
  }
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

// =============================================================================
// Provider-specific Vision OCR implementations
// =============================================================================

const OCR_PROMPT = (pageNum: number) => `Extract ALL text from this document page (page ${pageNum}).
Preserve the original structure, paragraphs, and formatting as much as possible.
Include headers, footers, captions, and any visible text.
Output ONLY the extracted text, no commentary or explanations.`;

/**
 * Extract text from image using Anthropic Claude Vision
 */
async function extractTextWithAnthropic(
  imageBase64: string,
  pageNum: number,
  model: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  // Try OAuth token first, then API key
  const oauthToken = await getAnthropicOAuthToken();
  const apiKey = oauthToken || (await getProviderApiKey('anthropic'));

  if (!apiKey) {
    throw new Error(
      'Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable or configure in Settings > API Keys.'
    );
  }

  // Create client with appropriate auth
  const anthropic = oauthToken
    ? new Anthropic({ apiKey: oauthToken }) // OAuth token passed as apiKey
    : new Anthropic({ apiKey });

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
            text: OCR_PROMPT(pageNum),
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
 * Extract text from image using OpenAI GPT-4 Vision
 */
async function extractTextWithOpenAI(
  imageBase64: string,
  pageNum: number,
  model: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = await getProviderApiKey('openai');

  if (!apiKey) {
    throw new Error(
      'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable or configure in Settings > API Keys.'
    );
  }

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
            },
          },
          {
            type: 'text',
            text: OCR_PROMPT(pageNum),
          },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';

  return {
    text,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

/**
 * Extract text from image using Google Gemini Vision
 */
async function extractTextWithGoogle(
  imageBase64: string,
  pageNum: number,
  model: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = await getProviderApiKey('google');

  if (!apiKey) {
    throw new Error(
      'Google API key not configured. Please set GOOGLE_API_KEY environment variable or configure in Settings > API Keys.'
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  const response = await geminiModel.generateContent([
    {
      inlineData: {
        mimeType: 'image/png',
        data: imageBase64,
      },
    },
    OCR_PROMPT(pageNum),
  ]);

  const result = await response.response;
  const text = result.text();

  return {
    text,
    inputTokens: result.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: result.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/**
 * Extract text from a single PDF page image using the configured vision provider
 * Routes to Anthropic, OpenAI, or Google based on model config
 */
async function extractTextFromImage(
  imageBase64: string,
  pageNum: number,
  provider: string,
  model: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  switch (provider) {
    case 'openai':
      return extractTextWithOpenAI(imageBase64, pageNum, model);
    case 'google':
      return extractTextWithGoogle(imageBase64, pageNum, model);
    default:
      return extractTextWithAnthropic(imageBase64, pageNum, model);
  }
}

/**
 * Convert PDF buffer to images and extract text using Vision LLM
 *
 * Phase 17B: Multi-provider support
 * Supports Anthropic (Claude), OpenAI (GPT-4V), and Google (Gemini)
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

  // Get provider and model from config service (or options)
  let provider: string;
  let model: string;

  if (options?.model) {
    // If model is provided, infer provider from model name
    model = options.model;
    if (model.startsWith('gpt-')) {
      provider = 'openai';
    } else if (model.startsWith('gemini-')) {
      provider = 'google';
    } else {
      provider = 'anthropic';
    }
  } else {
    // Get from config service
    const ocrConfig = await getOCRModelConfig();
    provider = ocrConfig.provider;
    model = ocrConfig.model;
  }

  console.info('[Vision OCR] Starting PDF to image conversion...');
  console.info(
    `[Vision OCR] Config: maxPages=${maxPages}, scale=${scale}, provider=${provider}, model=${model}`
  );

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

      console.info(`[Vision OCR] Processing page ${pageCount} with ${provider}...`);

      const result = await extractTextFromImage(base64, pageCount, provider, model);
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
 * Infer provider from model name
 */
function inferProviderFromModel(model: string): string {
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('gemini-')) return 'google';
  if (model.startsWith('claude-')) return 'anthropic';
  return 'anthropic'; // default
}

/**
 * Calculate estimated cost for Vision OCR
 *
 * Phase 17B: Multi-provider support
 *
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - Model used (default: claude-3-5-haiku-20241022)
 * @param provider - Provider used (if not specified, inferred from model)
 * @returns Estimated cost in USD
 */
export function calculateVisionOCRCost(
  inputTokens: number,
  outputTokens: number,
  model?: string,
  provider?: string
): number {
  const modelName = model ?? getVisionOCRConfig().model;
  const providerName = provider ?? inferProviderFromModel(modelName);

  // Pricing per 1K tokens uses shared provider pricing from CostTracker
  const inputPricingTable = PROVIDER_PRICING[providerName] ?? PROVIDER_PRICING.anthropic ?? {};
  const outputPricingTable =
    PROVIDER_PRICING[`${providerName}-output`] ?? PROVIDER_PRICING['anthropic-output'] ?? {};

  const defaultModels: Record<string, string> = {
    anthropic: 'claude-3-5-haiku-20241022',
    openai: 'gpt-4o-mini',
    google: 'gemini-1.5-flash',
  };
  const defaultModel = defaultModels[providerName] ?? 'claude-3-5-haiku-20241022';

  const inputRate =
    (modelName && inputPricingTable[modelName]) || inputPricingTable[defaultModel] || 0;
  const outputRate =
    (modelName && outputPricingTable[modelName]) || outputPricingTable[defaultModel] || 0;

  const inputCost = (inputTokens / 1000) * inputRate;
  const outputCost = (outputTokens / 1000) * outputRate;

  return inputCost + outputCost;
}
