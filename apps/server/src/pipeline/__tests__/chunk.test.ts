import { describe, expect, it } from 'vitest';
import { chunkText } from '../chunk.js';

function buildLongString(char: string, length: number): string {
  return Array.from({ length }, () => char).join('');
}

describe('chunkText', () => {
  it('returns empty array for empty input', () => {
    expect(chunkText('   ')).toEqual([]);
  });

  it('produces chunks within max size and with configured overlap', () => {
    const text = buildLongString('a', 2000);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(800);
    }

    for (let i = 0; i < chunks.length - 1; i += 1) {
      const current = chunks[i];
      const next = chunks[i + 1];
      expect(current.text.slice(-150)).toEqual(next.text.slice(0, 150));
      expect(next.metadata.startOffset).toBeGreaterThanOrEqual(current.metadata.startOffset);
      expect(next.metadata.endOffset).toBeGreaterThan(next.metadata.startOffset);
    }
  });

  it('keeps paragraphs together until the max size is reached, then splits at boundary', () => {
    const paragraphs = [
      'First paragraph contains insight but remains relatively short.',
      'Second paragraph continues the discussion and ideally stays with the first paragraph when possible.',
      'Third paragraph introduces additional detail and is long enough that it should begin a new chunk once the limit is reached.',
    ];
    const text = paragraphs.join('\n\n');

    const chunks = chunkText(text, { maxSize: 260, overlap: 30 });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].text).toContain(paragraphs[0]);
    expect(chunks[0].text).toContain(paragraphs[1]);
    expect(chunks[0].text).not.toContain(paragraphs[2]);

    const remainderText = chunks
      .slice(1)
      .map((chunk) => chunk.text)
      .join(' ');
    expect(remainderText).toContain(paragraphs[2].slice(0, 30));

    const overlap = chunks[0].metadata.endOffset - chunks[1].metadata.startOffset;
    expect(overlap).toBeGreaterThanOrEqual(0);
    expect(overlap).toBeLessThanOrEqual(35);
  });

  it('extracts heading metadata when applicable', () => {
    const text = ['Introduction', '', 'This section contains important details.'].join('\n');
    const [firstChunk] = chunkText(text, { maxSize: 120, overlap: 20 });

    expect(firstChunk.metadata.heading).toBe('Introduction');
    expect(firstChunk.metadata.startOffset).toBe(0);
    expect(firstChunk.metadata.endOffset).toBeGreaterThan(firstChunk.metadata.startOffset);
  });

  it('throws when overlap is invalid', () => {
    expect(() => chunkText('content', { maxSize: 150, overlap: 200 })).toThrow(
      /overlap must be smaller than maxSize/
    );
    expect(() => chunkText('content', { maxSize: 0 })).toThrow(/greater than zero/);
    expect(() => chunkText('content', { overlap: -1 })).toThrow(/cannot be negative/);
  });

  it('handles extremely long paragraphs by splitting on sentence boundaries', () => {
    // Use legacy mode for this test since it tests the original behavior
    const paragraph = `${buildLongString('a', 750)}. ${buildLongString('b', 600)}.`;
    const chunks = chunkText(paragraph, { maxSize: 400, overlap: 50, sentenceSplitMode: 'legacy' });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(450);
    }

    const boundaryIndex = chunks.findIndex((chunk) => chunk.text.trimEnd().endsWith('.'));
    expect(boundaryIndex).toBeGreaterThanOrEqual(0);

    const boundaryChunk = chunks[boundaryIndex];
    const followingChunk = chunks[boundaryIndex + 1];
    expect(followingChunk).toBeDefined();
    if (!followingChunk) {
      throw new Error('Expected subsequent chunk when validating sentence boundary split');
    }

    expect(followingChunk.text.trimStart().startsWith('b'.repeat(5))).toBe(true);
    const overlap = boundaryChunk.metadata.endOffset - followingChunk.metadata.startOffset;
    expect(followingChunk.metadata.startOffset).toBeLessThanOrEqual(
      boundaryChunk.metadata.endOffset
    );
    expect(overlap).toBeGreaterThanOrEqual(0);
    expect(overlap).toBeLessThanOrEqual(50);
  });

  // Phase 11: Text Chunking Heuristics - Edge Case Tests
  describe('Phase 11: Improved sentence boundary detection', () => {
    it('does not split on abbreviations like Dr.', () => {
      const text =
        'Dr. Smith is a renowned scientist. He has published many papers. His work is influential.';
      const chunks = chunkText(text, { maxSize: 60, overlap: 10 });

      // First chunk should contain "Dr. Smith" together, not split at "Dr."
      expect(chunks[0].text).toContain('Dr. Smith');
      expect(chunks[0].text).not.toMatch(/^Smith/);
    });

    it('does not split on version numbers', () => {
      const text =
        'Use Flutter 3.24.5 for this project. It has many improvements. The API is stable.';
      const chunks = chunkText(text, { maxSize: 50, overlap: 10 });

      // Should not split at version number decimals
      const allText = chunks.map((c) => c.text).join(' ');
      expect(allText).toContain('3.24.5');
    });

    it('does not split on decimal numbers', () => {
      const text =
        'The value of pi is 3.14159 approximately. It is used in many calculations. Math is fun.';
      const chunks = chunkText(text, { maxSize: 60, overlap: 10 });

      // Should not split at decimal point
      const allText = chunks.map((c) => c.text).join(' ');
      expect(allText).toContain('3.14159');
    });

    it('preserves inline code blocks', () => {
      const text =
        'Call the `foo.bar()` method to start. It returns a promise. Then await the result.';
      const chunks = chunkText(text, { maxSize: 50, overlap: 10 });

      // Inline code should not be split
      const allText = chunks.map((c) => c.text).join(' ');
      expect(allText).toContain('`foo.bar()`');
    });

    it('handles multiple abbreviations in sequence', () => {
      const text =
        'Mr. and Mrs. Jones visited Dr. Smith at St. Mary Hospital. They discussed treatment options.';
      const chunks = chunkText(text, { maxSize: 100, overlap: 20 });

      // All abbreviations should be preserved
      expect(chunks[0].text).toContain('Mr.');
      expect(chunks[0].text).toContain('Mrs.');
      expect(chunks[0].text).toContain('Dr.');
      expect(chunks[0].text).toContain('St.');
    });

    it('handles URLs correctly', () => {
      const text =
        'Visit https://flutter.dev for documentation. The site has tutorials. They are helpful.';
      const chunks = chunkText(text, { maxSize: 60, overlap: 10 });

      // URL should not be split at dots
      const allText = chunks.map((c) => c.text).join(' ');
      expect(allText).toContain('https://flutter.dev');
    });

    it('handles initials correctly', () => {
      const text = 'J.K. Rowling wrote Harry Potter. The books became famous. Millions read them.';
      const chunks = chunkText(text, { maxSize: 50, overlap: 10 });

      // Initials should not cause split
      const allText = chunks.map((c) => c.text).join(' ');
      expect(allText).toContain('J.K.');
    });

    it('supports legacy mode for backwards compatibility', () => {
      const text = 'Dr. Smith went home. He was tired.';
      const chunks = chunkText(text, { maxSize: 25, overlap: 5, sentenceSplitMode: 'legacy' });

      // Legacy mode should use simple regex (may split on Dr.)
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('supports custom abbreviations', () => {
      const text = 'See Ref. 42 for details. It explains the algorithm. The proof is elegant.';
      const chunks = chunkText(text, {
        maxSize: 40,
        overlap: 10,
        customAbbreviations: ['Ref'],
      });

      // Custom abbreviation should be respected
      const allText = chunks.map((c) => c.text).join(' ');
      expect(allText).toContain('Ref.');
    });

    it('handles ellipsis correctly', () => {
      const text = 'Wait... then continue the process. The result will appear. Check the output.';
      const chunks = chunkText(text, { maxSize: 50, overlap: 10 });

      // Ellipsis should not cause multiple splits
      const allText = chunks.map((c) => c.text).join(' ');
      expect(allText).toContain('Wait...');
    });

    it('handles fenced code blocks', () => {
      const text = `Here is an example:
\`\`\`typescript
const x = foo.bar();
const y = baz.qux();
\`\`\`
This code demonstrates the pattern. It is commonly used.`;

      const chunks = chunkText(text, { maxSize: 100, overlap: 20 });

      // Code block should be preserved
      const allText = chunks.map((c) => c.text).join(' ');
      expect(allText).toContain('foo.bar()');
      expect(allText).toContain('baz.qux()');
    });

    it('handles Latin abbreviations', () => {
      const text =
        'See e.g. the documentation for examples. Also check i.e. the API reference. Both are useful.';
      const chunks = chunkText(text, { maxSize: 60, overlap: 10 });

      // Latin abbreviations should not cause splits
      const allText = chunks.map((c) => c.text).join(' ');
      expect(allText).toContain('e.g.');
      expect(allText).toContain('i.e.');
    });

    it('handles file paths', () => {
      const text =
        'Edit the src/main.ts file to add the feature. Then run the build. Check for errors.';
      const chunks = chunkText(text, { maxSize: 50, overlap: 10 });

      // File path should not be split
      const allText = chunks.map((c) => c.text).join(' ');
      expect(allText).toContain('src/main.ts');
    });
  });
});
