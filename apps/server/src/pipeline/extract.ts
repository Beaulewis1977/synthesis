import { pdf } from 'pdf-parse';
import mammoth from 'mammoth';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { toString } from 'mdast-util-to-string';

export interface ExtractionResult {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount?: number;
    [key: string]: any;
  };
}

/**
 * Extract text from PDF buffer
 */
export async function extractPDF(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const data = await pdf(buffer);
    
    return {
      text: data.text,
      metadata: {
        pageCount: data.numpages,
        wordCount: data.text.split(/\s+/).length,
      },
    };
  } catch (error) {
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract text from DOCX buffer
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
    throw new Error(`DOCX extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract text from Markdown buffer
 */
export async function extractMarkdown(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const text = buffer.toString('utf-8');
    const processor = unified().use(remarkParse);
    const tree = processor.parse(text);
    const extracted = toString(tree);
    
    return {
      text: extracted || text, // Fallback to raw text if parsing fails
      metadata: {
        wordCount: text.split(/\s+/).length,
      },
    };
  } catch (error) {
    throw new Error(`Markdown extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract text from plain text buffer
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
 * Main extraction function - routes to appropriate extractor
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
