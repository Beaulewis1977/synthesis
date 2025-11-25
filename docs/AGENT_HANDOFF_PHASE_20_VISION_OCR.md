# Agent Handoff: Phase 20 - Claude Vision OCR for Scanned PDFs

**Created:** 2025-11-24  
**Status:** Ready for Implementation  
**Priority:** High  
**Estimated Effort:** 4-6 hours

---

## Overview

Implement automatic OCR fallback using Claude Vision API when `pdf-parse` fails to extract text from scanned/image-based PDFs.

## Problem Statement

Currently, when users upload scanned PDFs or image-based PDFs:
1. `pdf-parse` correctly reads the PDF structure (page count)
2. But extracts 0 words because text is embedded in images
3. The system throws an error: "PDF extraction produced no text (X pages)"
4. Users cannot use these documents in the RAG system

## Proposed Solution

### Flow Diagram

```
PDF Upload
    │
    ▼
pdf-parse extracts text
    │
    ├── Text found (wordCount > 0)
    │       │
    │       ▼
    │   Continue normal pipeline
    │   (chunking → embedding → storage)
    │
    └── No text found (wordCount === 0)
            │
            ▼
        Convert PDF pages to images
        (using pdf-to-img or pdf2pic)
            │
            ▼
        Send each page image to Claude Vision
        (claude-3-5-haiku-latest or claude-3-5-sonnet)
            │
            ▼
        Concatenate extracted text from all pages
            │
            ▼
        Continue normal pipeline
        (chunking → embedding → storage)
```

## Implementation Details

### 1. Dependencies to Add

```bash
pnpm --filter @synthesis/server add pdf-to-img
# OR
pnpm --filter @synthesis/server add pdf2pic
```

**Note:** `pdf-to-img` uses `pdfjs-dist` (pure JS), while `pdf2pic` uses GraphicsMagick/ImageMagick (requires system deps).

### 2. New File: `apps/server/src/pipeline/vision-ocr.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { addLog } from '../services/cost-tracker.js';

const anthropic = new Anthropic();

// Model for OCR - Haiku is cost-effective for text extraction
const OCR_MODEL = 'claude-3-5-haiku-20241022';

interface OCRResult {
  text: string;
  pageCount: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Extract text from a PDF page image using Claude Vision
 */
async function extractTextFromImage(
  imageBase64: string,
  pageNum: number,
  totalPages: number
): Promise<string> {
  const response = await anthropic.messages.create({
    model: OCR_MODEL,
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
                   Output ONLY the extracted text, no commentary.`,
          },
        ],
      },
    ],
  });

  // Track cost
  addLog('vision-ocr', OCR_MODEL, response.usage.input_tokens, response.usage.output_tokens);

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock?.text ?? '';
}

/**
 * Convert PDF buffer to images and extract text using Claude Vision
 */
export async function extractTextWithVision(
  pdfBuffer: Buffer,
  options?: { maxPages?: number }
): Promise<OCRResult> {
  const { pdf2img } = await import('pdf-to-img');
  
  const maxPages = options?.maxPages ?? 50; // Limit for cost control
  const pages: string[] = [];
  let pageCount = 0;

  console.info('[Vision OCR] Converting PDF to images...');

  // Convert PDF pages to images
  for await (const image of pdf2img(pdfBuffer, { scale: 2.0 })) {
    pageCount++;
    if (pageCount > maxPages) {
      console.warn(`[Vision OCR] Reached max pages limit (${maxPages}), stopping`);
      break;
    }
    
    // Convert to base64
    const base64 = image.toString('base64');
    
    console.info(`[Vision OCR] Processing page ${pageCount}...`);
    const pageText = await extractTextFromImage(base64, pageCount, pageCount);
    pages.push(pageText);
  }

  const combinedText = pages.join('\n\n--- Page Break ---\n\n');
  const wordCount = combinedText.split(/\s+/).length;

  console.info(
    `[Vision OCR] Extracted ${wordCount} words from ${pageCount} pages`
  );

  return {
    text: combinedText,
    pageCount,
    confidence: wordCount > 100 ? 'high' : wordCount > 20 ? 'medium' : 'low',
  };
}
```

### 3. Modify `apps/server/src/pipeline/extract.ts`

Update `extractPDF` to fall back to Vision OCR:

```typescript
import { extractTextWithVision } from './vision-ocr.js';

export async function extractPDF(buffer: Buffer): Promise<ExtractionResult> {
  try {
    // ... existing validation code ...

    const data = await pdf(buffer);
    const pageCount = data.total ?? 0;
    const text = data.text?.trim() ?? '';
    const wordCount = text === '' ? 0 : text.split(/\s+/).length;

    // If no text extracted, try Vision OCR
    if (wordCount === 0 && pageCount > 0) {
      console.info(
        `[PDF Extract] No text found in ${pageCount} pages, attempting Vision OCR...`
      );
      
      const visionResult = await extractTextWithVision(buffer);
      
      if (visionResult.text.length > 0) {
        console.info(
          `[PDF Extract] Vision OCR successful: ${visionResult.pageCount} pages, ` +
          `${visionResult.text.split(/\s+/).length} words`
        );
        
        return {
          text: visionResult.text,
          metadata: {
            pageCount: visionResult.pageCount,
            wordCount: visionResult.text.split(/\s+/).length,
            extractionMethod: 'vision-ocr',
            confidence: visionResult.confidence,
          },
        };
      }
      
      // Vision OCR also failed
      throw new Error(
        `PDF extraction failed: Neither text extraction nor Vision OCR produced results. ` +
        `The PDF may be corrupted or contain only non-text content.`
      );
    }

    // ... rest of existing code ...
  } catch (error) {
    // ... existing error handling ...
  }
}
```

### 4. Environment Variables

Add to `.env.example`:

```env
# Vision OCR Settings
VISION_OCR_ENABLED=true
VISION_OCR_MAX_PAGES=50
VISION_OCR_MODEL=claude-3-5-haiku-20241022
```

### 5. Cost Tracking

Update `cost-tracker.ts` to track Vision OCR costs separately:

```typescript
// Add to pricing object
'claude-3-5-haiku-20241022': {
  input: 0.0008,  // per 1K tokens
  output: 0.004,  // per 1K tokens
  // Note: Image tokens are calculated differently
  // ~1,334 tokens per 1024x1024 image tile
}
```

## Testing Plan

### Unit Tests

1. Test Vision OCR with mock images
2. Test fallback logic in `extractPDF`
3. Test cost tracking for Vision API calls

### Integration Tests

1. Upload a known scanned PDF
2. Verify text extraction succeeds
3. Verify chunks are created
4. Verify document is searchable

### Manual Testing

1. Upload the test PDFs that were failing:
   - `civilwar-catalyst.pdf` (11 pages)
   - `techno-libertarianism.pdf` (11 pages)
   - `Democratic Governance in the Age of Tech Power.pdf` (8 pages)

## Cost Considerations

### Estimated Costs per PDF

| Pages | Image Tokens | Text Tokens | Estimated Cost |
|-------|--------------|-------------|----------------|
| 10    | ~13,340      | ~5,000      | ~$0.03         |
| 50    | ~66,700      | ~25,000     | ~$0.15         |
| 100   | ~133,400     | ~50,000     | ~$0.30         |

### Cost Controls

1. **Max pages limit** (default: 50)
2. **User confirmation** for large PDFs (optional UI feature)
3. **Daily/monthly budget limits** (optional)

## Rollback Plan

If Vision OCR causes issues:

1. Set `VISION_OCR_ENABLED=false` in environment
2. The system will revert to throwing errors for scanned PDFs
3. No data migration needed

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `apps/server/src/pipeline/vision-ocr.ts` | Create | New Vision OCR module |
| `apps/server/src/pipeline/extract.ts` | Modify | Add fallback to Vision OCR |
| `apps/server/src/services/cost-tracker.ts` | Modify | Add Vision OCR cost tracking |
| `.env.example` | Modify | Add Vision OCR env vars |
| `apps/server/package.json` | Modify | Add `pdf-to-img` dependency |

## Success Criteria

- [ ] Scanned PDFs are successfully processed
- [ ] Text is extracted with reasonable accuracy
- [ ] Documents are searchable in RAG queries
- [ ] Costs are tracked and logged
- [ ] Error handling is graceful
- [ ] Feature can be disabled via env var

## Future Enhancements

1. **Batch processing** - Process multiple pages in parallel
2. **Caching** - Cache OCR results to avoid re-processing
3. **Quality detection** - Auto-detect if PDF needs OCR before trying pdf-parse
4. **Alternative models** - Support GPT-4V or Gemini Vision as fallbacks
5. **Local OCR fallback** - Add Tesseract as free fallback option

---

## References

- [Anthropic Vision API Docs](https://docs.anthropic.com/en/docs/build-with-claude/vision)
- [pdf-to-img npm package](https://www.npmjs.com/package/pdf-to-img)
- [Claude 3.5 Haiku Pricing](https://www.anthropic.com/pricing)
