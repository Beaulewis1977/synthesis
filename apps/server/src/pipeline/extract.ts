import mammoth from 'mammoth';
import { toString as mdastToString } from 'mdast-util-to-string';
import { pdf } from 'pdf-parse';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { calculateVisionOCRCost, extractTextWithVision, isVisionOCREnabled } from './vision-ocr.js';

/**
 * Represents the result of a text extraction operation.
 */
export interface ExtractionResult {
  /** The extracted text content. */
  text: string;
  /** Metadata associated with the extraction. */
  metadata: {
    /** The number of pages, if applicable (e.g., for PDFs). */
    pageCount?: number;
    /** The number of words in the extracted text. */
    wordCount?: number;
    /** Any other extractor-specific metadata. */
    // biome-ignore lint/suspicious/noExplicitAny: Metadata can be any shape
    [key: string]: any;
  };
}

/**
 * pdf-parse v2.x TextResult interface
 */
interface PDFParseResult {
  pages: Array<{ num: number; text: string }>;
  text: string;
  total: number;
  info?: object;
  metadata?: object;
}

/**
 * Extracts text and metadata from a PDF buffer.
 * @param buffer The PDF file content as a Buffer.
 * @returns A promise that resolves to an ExtractionResult.
 * @throws Will throw an error if PDF parsing fails or produces no text.
 */
export async function extractPDF(buffer: Buffer): Promise<ExtractionResult> {
  try {
    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty PDF buffer provided');
    }

    // Check PDF magic bytes (PDF files start with %PDF)
    const header = buffer.slice(0, 5).toString('ascii');
    if (!header.startsWith('%PDF')) {
      throw new Error(
        `Invalid PDF file: expected %PDF header, got "${header.slice(0, 4)}". File may be corrupted or not a PDF.`
      );
    }

    console.info(`[PDF Extract] Processing PDF buffer (${buffer.length} bytes)`);

    const data = (await pdf(buffer)) as unknown as PDFParseResult;

    // pdf-parse v2.x uses 'total' for page count, v1.x used 'numpages'
    const pageCount = data.total ?? 0;
    const text = data.text?.trim() ?? '';
    const wordCount = text === '' ? 0 : text.split(/\s+/).length;

    console.info(
      `[PDF Extract] Extracted ${pageCount} pages, ${wordCount} words, ${text.length} characters`
    );

    // If no text extracted, try Vision OCR as fallback
    if (wordCount === 0 && pageCount > 0) {
      console.warn(
        `[PDF Extract] WARNING: PDF has ${pageCount} pages but extracted 0 words. ` +
          'This PDF may be scanned/image-based.'
      );

      // Check if Vision OCR is enabled
      if (!isVisionOCREnabled()) {
        throw new Error(
          `PDF extraction produced no text (${pageCount} pages). ` +
            'The PDF may be scanned/image-based. Enable Vision OCR (VISION_OCR_ENABLED=true) to process such documents.'
        );
      }

      console.info('[PDF Extract] Attempting Vision OCR fallback...');

      try {
        const visionResult = await extractTextWithVision(buffer);

        if (visionResult.text.trim().length === 0) {
          throw new Error(
            'PDF extraction failed: Neither text extraction nor Vision OCR produced results. ' +
              'The PDF may be corrupted or contain only non-text content.'
          );
        }

        const visionWordCount = visionResult.text.split(/\s+/).length;
        const estimatedCost = calculateVisionOCRCost(
          visionResult.inputTokens,
          visionResult.outputTokens
        );

        console.info(
          `[PDF Extract] Vision OCR successful: ${visionResult.pageCount} pages, ` +
            `${visionWordCount} words, confidence: ${visionResult.confidence}, ` +
            `estimated cost: $${estimatedCost.toFixed(4)}`
        );

        return {
          text: visionResult.text,
          metadata: {
            pageCount: visionResult.pageCount,
            wordCount: visionWordCount,
            extractionMethod: 'vision-ocr',
            confidence: visionResult.confidence,
            visionOCR: {
              inputTokens: visionResult.inputTokens,
              outputTokens: visionResult.outputTokens,
              estimatedCost,
            },
          },
        };
      } catch (visionError) {
        const visionMessage =
          visionError instanceof Error ? visionError.message : String(visionError);
        console.error(`[PDF Extract] Vision OCR failed: ${visionMessage}`);
        throw new Error(
          `PDF extraction failed: Text extraction found no text, and Vision OCR failed: ${visionMessage}`
        );
      }
    }

    // Warn if very low text density (possible partial extraction)
    const avgWordsPerPage = wordCount / Math.max(pageCount, 1);
    if (avgWordsPerPage < 10 && pageCount > 1) {
      console.warn(
        `[PDF Extract] WARNING: Low text density (${avgWordsPerPage.toFixed(1)} words/page). ` +
          'Some pages may be images or have extraction issues.'
      );
    }

    return {
      text: data.text,
      metadata: {
        pageCount,
        wordCount,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[PDF Extract] FAILED: ${message}`);
    throw new Error(`PDF extraction failed: ${message}`);
  }
}

/**
 * Extracts text from a DOCX buffer.
 * @param buffer The DOCX file content as a Buffer.
 * @returns A promise that resolves to an ExtractionResult.
 * @throws Will throw an error if DOCX parsing fails.
 */
export async function extractDOCX(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });

    const wordCount =
      !result.value || result.value.trim() === '' ? 0 : result.value.trim().split(/\s+/).length;

    return {
      text: result.value,
      metadata: {
        wordCount,
      },
    };
  } catch (error) {
    throw new Error(
      `DOCX extraction failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extracts text from a Markdown buffer.
 * It parses the Markdown and returns the plain text content.
 * @param buffer The Markdown file content as a Buffer.
 * @returns A promise that resolves to an ExtractionResult.
 * @throws Will throw an error if Markdown parsing fails.
 */
export async function extractMarkdown(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const text = buffer.toString('utf-8');
    const processor = unified().use(remarkParse);
    const tree = processor.parse(text);
    const extracted = mdastToString(tree);

    const wordCount = !text || text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

    return {
      text: extracted || text, // Fallback to raw text if parsing fails
      metadata: {
        wordCount,
      },
    };
  } catch (error) {
    throw new Error(
      `Markdown extraction failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extracts text from a plain text buffer.
 * @param buffer The plain text file content as a Buffer.
 * @returns An ExtractionResult.
 */
export function extractPlainText(buffer: Buffer): ExtractionResult {
  const text = buffer.toString('utf-8');

  const wordCount = !text || text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

  return {
    text,
    metadata: {
      wordCount,
    },
  };
}

/**
 * Dynamically extracts text from a buffer based on its content type or filename.
 * It routes the buffer to the appropriate extractor (PDF, DOCX, Markdown, or plain text).
 * @param buffer The file content as a Buffer.
 * @param contentType The MIME type of the file (e.g., 'application/pdf').
 * @param filename The original filename, used as a fallback to determine the file type.
 * @returns A promise that resolves to an ExtractionResult.
 * @throws Will throw an error if the content type is unsupported.
 */
export async function extract(
  buffer: Buffer,
  contentType: string,
  filename?: string
): Promise<ExtractionResult> {
  // Normalize content type
  const type = contentType.toLowerCase();

  // Also check file extension as fallback
  const ext = filename ? filename.toLowerCase().split('.').pop() : '';

  if (type.includes('pdf') || type === 'application/pdf' || ext === 'pdf') {
    return extractPDF(buffer);
  }

  if (
    type.includes('word') ||
    type.includes('officedocument') ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    return extractDOCX(buffer);
  }

  if (
    type.includes('markdown') ||
    type === 'text/markdown' ||
    type === 'text/x-markdown' ||
    ext === 'md' ||
    ext === 'markdown'
  ) {
    return extractMarkdown(buffer);
  }

  if (type.includes('text/') || ext === 'txt') {
    return extractPlainText(buffer);
  }

  // Fallback for code files (prevents "Unsupported content type" errors)
  if (['dart', 'ts', 'tsx', 'js', 'jsx', 'sql', 'yaml', 'yml', 'json'].includes(ext || '')) {
    return extractPlainText(buffer);
  }

  throw new Error(`Unsupported content type: ${contentType} (file: ${filename})`);
}
