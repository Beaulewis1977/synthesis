import { describe, expect, it } from 'vitest';
import {
  findFirstSentenceBoundary,
  findLastSentenceBoundary,
  splitIntoSentences,
  validateSentenceSplitter,
} from '../sentence-splitter';

describe('sentence-splitter', () => {
  describe('findLastSentenceBoundary', () => {
    it('finds simple sentence boundary', () => {
      const text = 'Hello world. This is a test.';
      const boundary = findLastSentenceBoundary(text, 0, text.length);
      expect(boundary).toBeGreaterThan(0);
      expect(text.slice(0, boundary).trim()).toBe('Hello world.');
    });

    it('returns -1 when no boundary exists', () => {
      const text = 'Hello world without punctuation';
      const boundary = findLastSentenceBoundary(text, 0, text.length);
      expect(boundary).toBe(-1);
    });

    it('handles exclamation marks', () => {
      const text = 'Hello world! This is exciting.';
      const boundary = findLastSentenceBoundary(text, 0, text.length);
      expect(boundary).toBeGreaterThan(0);
    });

    it('handles question marks', () => {
      const text = 'Is this working? Yes it is.';
      const boundary = findLastSentenceBoundary(text, 0, text.length);
      expect(boundary).toBeGreaterThan(0);
    });

    it('handles closing quotes after punctuation', () => {
      const text = 'She said "Hello world" loudly. Then we continued.';
      const boundary = findLastSentenceBoundary(text, 0, text.length);
      // Should find boundary after "loudly."
      expect(boundary).toBeGreaterThan(0);
      expect(text.slice(0, boundary).trim()).toContain('loudly');
    });
  });

  describe('findFirstSentenceBoundary', () => {
    it('finds first sentence boundary', () => {
      const text = 'Hello world. This is a test. Another sentence.';
      const boundary = findFirstSentenceBoundary(text, 0, text.length);
      expect(boundary).toBeGreaterThan(0);
      expect(text.slice(0, boundary).trim()).toBe('Hello world.');
    });

    it('returns -1 when no boundary in range', () => {
      const text = 'Hello world. This is a test.';
      const boundary = findFirstSentenceBoundary(text, 0, 5);
      expect(boundary).toBe(-1);
    });
  });

  describe('abbreviation handling', () => {
    it('does not split on Dr.', () => {
      const text = 'Dr. Smith went home. He was tired.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Dr. Smith went home.');
      expect(sentences[1]).toBe('He was tired.');
    });

    it('does not split on Mr.', () => {
      const text = 'Mr. Jones arrived. He was early.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Mr. Jones arrived.');
    });

    it('does not split on Mrs.', () => {
      const text = 'Mrs. Smith called. She was happy.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Mrs. Smith called.');
    });

    it('does not split on Ms.', () => {
      const text = 'Ms. Johnson spoke. She was eloquent.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Ms. Johnson spoke.');
    });

    it('does not split on Prof.', () => {
      const text = 'Prof. Williams lectured. It was interesting.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Prof. Williams lectured.');
    });

    it('does not split on multiple abbreviations', () => {
      const text = 'Mr. and Mrs. Jones arrived. They were happy.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Mr. and Mrs. Jones arrived.');
    });

    it('does not split on e.g.', () => {
      const text = 'See e.g. the documentation. It explains everything.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('See e.g. the documentation.');
    });

    it('does not split on i.e.', () => {
      const text = 'The result i.e. the output was correct. It worked.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('The result i.e. the output was correct.');
    });

    it('does not split on etc.', () => {
      const text = 'Apples, oranges, etc. are fruits. They are healthy.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Apples, oranges, etc. are fruits.');
    });

    it('does not split on vs.', () => {
      const text = 'React vs. Vue is a common debate. Both are good.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('React vs. Vue is a common debate.');
    });

    it('does not split on month abbreviations', () => {
      const text = 'On Jan. 20, the event occurred. It was memorable.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('On Jan. 20, the event occurred.');
    });

    it('does not split on Inc.', () => {
      const text = 'Apple Inc. announced new products. They were innovative.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Apple Inc. announced new products.');
    });

    it('does not split on St.', () => {
      const text = 'Visit St. Louis next week. It is a great city.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Visit St. Louis next week.');
    });
  });

  describe('version number handling', () => {
    it('does not split on version numbers', () => {
      const text = 'Use Flutter 3.24.5 for this project. It works well.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Use Flutter 3.24.5 for this project.');
    });

    it('does not split on semantic versions', () => {
      const text = 'Version 2.0.1 was released. It has new features.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Version 2.0.1 was released.');
    });

    it('does not split on version with v prefix', () => {
      const text = 'Install v1.2.3 now. It is stable.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Install v1.2.3 now.');
    });

    it('does not split on complex version numbers', () => {
      const text = 'Use version 14.3.0-canary.87 for testing. It has fixes.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Use version 14.3.0-canary.87 for testing.');
    });
  });

  describe('decimal number handling', () => {
    it('does not split on decimal numbers', () => {
      const text = 'The value is 3.14 radians. That is pi.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('The value is 3.14 radians.');
    });

    it('does not split on negative decimals', () => {
      const text = 'The temperature is -2.5 degrees. It is cold.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('The temperature is -2.5 degrees.');
    });

    it('does not split on small decimals', () => {
      const text = 'The probability is 0.95 percent. It is high.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('The probability is 0.95 percent.');
    });
  });

  describe('URL handling', () => {
    it('does not split on URLs', () => {
      const text = 'Visit https://example.com for info. Then click login.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Visit https://example.com for info.');
    });

    it('does not split on URLs with paths', () => {
      const text = 'See https://docs.flutter.dev/get-started/install for details. It is helpful.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('See https://docs.flutter.dev/get-started/install for details.');
    });

    it('does not split on www URLs', () => {
      const text = 'Go to www.example.com for more info. It has documentation.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Go to www.example.com for more info.');
    });
  });

  describe('code handling', () => {
    it('does not split on inline code', () => {
      const text = 'Call `foo.bar()` method. It returns null.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Call `foo.bar()` method.');
    });

    it('does not split on inline code with multiple dots', () => {
      const text = 'Use `obj.prop.value` syntax. It is clean.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Use `obj.prop.value` syntax.');
    });

    it('preserves fenced code blocks', () => {
      const text =
        'Here is code:\n```\nfoo.bar();\nbaz.qux();\n```\nThat was the example. It is useful.';
      const sentences = splitIntoSentences(text);
      // Code blocks are preserved, sentences split correctly after
      expect(sentences.length).toBeGreaterThanOrEqual(1);
      const allText = sentences.join(' ');
      expect(allText).toContain('foo.bar()');
      expect(allText).toContain('baz.qux()');
    });

    it('handles file paths', () => {
      const text = 'Edit src/main.ts file. It contains the entry point.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Edit src/main.ts file.');
    });
  });

  describe('initials handling', () => {
    it('does not split on initials in middle of sentence', () => {
      const text = 'The author J.K. Rowling wrote books. They were popular.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('The author J.K. Rowling wrote books.');
    });

    it('does not split on U.S.', () => {
      const text = 'The U.S. economy grew. It was unexpected.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('The U.S. economy grew.');
    });

    it('does not split on U.S.A.', () => {
      const text = 'Visit the U.S.A. next year. It is beautiful.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Visit the U.S.A. next year.');
    });

    it('splits correctly when single letter precedes sentence starter', () => {
      // "X." followed by "The" should split - "The" is a sentence starter, not a name
      const text = 'Download file X. The next step is important.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Download file X.');
      expect(sentences[1]).toBe('The next step is important.');
    });
  });

  describe('ellipsis handling', () => {
    it('handles ellipsis at sentence boundary', () => {
      const text = 'Wait... and see. The story goes on.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('Wait... and see.');
    });

    it('handles ellipsis mid-sentence', () => {
      const text = 'The story continues... and then it ended. That was nice.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('The story continues... and then it ended.');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const sentences = splitIntoSentences('');
      expect(sentences).toHaveLength(0);
    });

    it('handles whitespace only', () => {
      const sentences = splitIntoSentences('   \n\t  ');
      expect(sentences).toHaveLength(0);
    });

    it('handles single sentence without period', () => {
      const sentences = splitIntoSentences('Hello world');
      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toBe('Hello world');
    });

    it('handles multiple spaces between sentences', () => {
      const text = 'First sentence.    Second sentence.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
    });

    it('handles newlines between sentences', () => {
      const text = 'First sentence.\nSecond sentence.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(2);
    });

    it('handles mixed punctuation', () => {
      const text = 'Is this working? Yes! It is great.';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(3);
    });
  });

  describe('custom abbreviations', () => {
    it('respects custom abbreviations', () => {
      const text = 'See Ref. 42 for details. It explains more.';
      const sentences = splitIntoSentences(text, { customAbbreviations: ['Ref'] });
      expect(sentences).toHaveLength(2);
      expect(sentences[0]).toBe('See Ref. 42 for details.');
    });
  });

  describe('validateSentenceSplitter', () => {
    it('passes all validation tests', () => {
      const result = validateSentenceSplitter();
      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });
  });

  describe('integration with chunk boundary detection', () => {
    it('finds correct boundary with abbreviations', () => {
      const text = 'Dr. Smith went to the store. He bought apples. Then he went home.';
      const boundary = findLastSentenceBoundary(text, 0, 50);
      // Should find boundary after "store." not after "Dr."
      expect(boundary).toBeGreaterThan(20);
      const extracted = text.slice(0, boundary).trim();
      expect(extracted).toContain('Dr. Smith');
      expect(extracted).toContain('store');
    });

    it('finds correct boundary with version numbers', () => {
      const text = 'Use Flutter 3.24.5 for best results. It has many features.';
      const boundary = findLastSentenceBoundary(text, 0, 50);
      expect(boundary).toBeGreaterThan(30);
      const extracted = text.slice(0, boundary).trim();
      expect(extracted).toContain('3.24.5');
      expect(extracted).toContain('results');
    });

    it('finds first boundary correctly', () => {
      const text = 'Dr. Smith said hello. Mrs. Jones replied. They talked.';
      const boundary = findFirstSentenceBoundary(text, 0, text.length);
      expect(boundary).toBeGreaterThan(15);
      const extracted = text.slice(0, boundary).trim();
      expect(extracted).toContain('Dr. Smith');
      expect(extracted).toContain('hello');
    });
  });
});
