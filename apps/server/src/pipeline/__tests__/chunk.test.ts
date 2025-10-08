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
    const paragraph = `${buildLongString('a', 750)}. ${buildLongString('b', 600)}.`;
    const chunks = chunkText(paragraph, { maxSize: 400, overlap: 50 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(450);
    }

    const boundaryIndex = chunks.findIndex((chunk) => chunk.text.trimEnd().endsWith('.'));
    expect(boundaryIndex).toBeGreaterThanOrEqual(0);

    const boundaryChunk = chunks[boundaryIndex];
    const followingChunk = chunks[boundaryIndex + 1];
    expect(followingChunk).toBeDefined();
    expect(followingChunk?.text.trimStart().startsWith('b'.repeat(5))).toBe(true);
    expect(followingChunk?.metadata.startOffset).toBe(boundaryChunk.metadata.endOffset);
  });
});
