import mammoth from 'mammoth';
import { toString as mdastToString } from 'mdast-util-to-string';
import { pdf } from 'pdf-parse';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

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

interface PDFParseData {
  numpages: number;
  text: string;
}

/**
 * Extracts text and metadata from a PDF buffer.
 * @param buffer The PDF file content as a Buffer.
 * @returns A promise that resolves to an ExtractionResult.
 * @throws Will throw an error if PDF parsing fails.
 */
export async function extractPDF(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const data = (await pdf(buffer)) as unknown as PDFParseData;

    return {
      text: data.text,
      metadata: {
        pageCount: data.numpages,
        wordCount: data.text.split(/\s+/).length,
      },
    };
  } catch (error) {
    throw new Error(
      `PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`
    );
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

    return {
      text: result.value,
      metadata: {
        wordCount: result.value.split(/\s+/).length,
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

    return {
      text: extracted || text, // Fallback to raw text if parsing fails
      metadata: {
        wordCount: text.split(/\s+/).length,
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

  return {
    text,
    metadata: {
      wordCount: text.split(/\s+/).length,
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

  throw new Error(`Unsupported content type: ${contentType} (file: ${filename})`);
}
