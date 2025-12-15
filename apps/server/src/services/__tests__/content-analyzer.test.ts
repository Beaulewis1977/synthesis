import type { ContentProfile } from '@synthesis/db';
import { describe, expect, it } from 'vitest';
import { determineOptimalSettings, shouldTriggerAnalysis } from '../content-analyzer.js';

describe('Content Analyzer', () => {
  describe('determineOptimalSettings', () => {
    it('should recommend voyage-code-3 for code-heavy collections', () => {
      const profile: ContentProfile = {
        codeFileRatio: 0.8,
        docFileRatio: 0.2,
        totalFiles: 50,
        codeFiles: 40,
        docFiles: 10,
        confidence: 'high',
      };

      const settings = determineOptimalSettings(profile);

      expect(settings.embeddingProvider).toBe('voyage');
      expect(settings.embeddingModel).toBe('voyage-code-3');
      expect(settings.searchMode).toBe('vector');
      expect(settings.reasoning).toContain('Code-heavy');
      expect(settings.reasoning).toContain('80%');
      expect(settings.confidence).toBe('high');
      expect(settings.fileCount).toBe(50);
      expect(settings.analyzedAt).toBeInstanceOf(Date);
    });

    it('should recommend nomic-embed-text for doc-heavy collections', () => {
      const profile: ContentProfile = {
        codeFileRatio: 0.1,
        docFileRatio: 0.9,
        totalFiles: 30,
        codeFiles: 3,
        docFiles: 27,
        confidence: 'high',
      };

      const settings = determineOptimalSettings(profile);

      expect(settings.embeddingProvider).toBe('ollama');
      expect(settings.embeddingModel).toBe('nomic-embed-text');
      expect(settings.searchMode).toBe('vector');
      expect(settings.reasoning).toContain('Documentation-heavy');
      expect(settings.reasoning).toContain('90%');
    });

    it('should recommend hybrid search for mixed collections', () => {
      const profile: ContentProfile = {
        codeFileRatio: 0.5,
        docFileRatio: 0.5,
        totalFiles: 40,
        codeFiles: 20,
        docFiles: 20,
        confidence: 'medium',
      };

      const settings = determineOptimalSettings(profile);

      expect(settings.embeddingProvider).toBe('voyage');
      expect(settings.embeddingModel).toBe('voyage-code-3');
      expect(settings.searchMode).toBe('hybrid');
      expect(settings.reasoning).toContain('Mixed content');
      expect(settings.confidence).toBe('medium');
    });

    it('should handle edge case at 60% code threshold', () => {
      const profile: ContentProfile = {
        codeFileRatio: 0.6,
        docFileRatio: 0.4,
        totalFiles: 100,
        codeFiles: 60,
        docFiles: 40,
        confidence: 'high',
      };

      const settings = determineOptimalSettings(profile);

      // Exactly 60% code should trigger code-heavy rule
      expect(settings.embeddingProvider).toBe('voyage');
      expect(settings.embeddingModel).toBe('voyage-code-3');
      expect(settings.searchMode).toBe('vector');
    });

    it('should handle edge case at 60% doc threshold', () => {
      const profile: ContentProfile = {
        codeFileRatio: 0.4,
        docFileRatio: 0.6,
        totalFiles: 100,
        codeFiles: 40,
        docFiles: 60,
        confidence: 'high',
      };

      const settings = determineOptimalSettings(profile);

      // Exactly 60% docs should trigger doc-heavy rule
      expect(settings.embeddingProvider).toBe('ollama');
      expect(settings.embeddingModel).toBe('nomic-embed-text');
      expect(settings.searchMode).toBe('vector');
    });

    it('should handle just below 60% thresholds as mixed', () => {
      const profile: ContentProfile = {
        codeFileRatio: 0.59,
        docFileRatio: 0.41,
        totalFiles: 100,
        codeFiles: 59,
        docFiles: 41,
        confidence: 'high',
      };

      const settings = determineOptimalSettings(profile);

      // Below 60% code, below 60% doc = mixed
      expect(settings.searchMode).toBe('hybrid');
    });

    it('should handle empty collections', () => {
      const profile: ContentProfile = {
        codeFileRatio: 0,
        docFileRatio: 0,
        totalFiles: 0,
        codeFiles: 0,
        docFiles: 0,
        confidence: 'low',
      };

      const settings = determineOptimalSettings(profile);

      // Empty collection defaults to mixed (hybrid mode)
      expect(settings.searchMode).toBe('hybrid');
      expect(settings.confidence).toBe('low');
      expect(settings.fileCount).toBe(0);
    });

    it('should handle collection with unknown file types', () => {
      // If most files are unknown (.xyz, .abc, etc.), both ratios will be low
      const profile: ContentProfile = {
        codeFileRatio: 0.1,
        docFileRatio: 0.1,
        totalFiles: 100,
        codeFiles: 10,
        docFiles: 10,
        confidence: 'high',
      };

      const settings = determineOptimalSettings(profile);

      // Neither code nor doc heavy, so mixed
      expect(settings.searchMode).toBe('hybrid');
    });

    it('should preserve confidence level from profile', () => {
      const lowConfidence: ContentProfile = {
        codeFileRatio: 0.8,
        docFileRatio: 0.2,
        totalFiles: 3,
        codeFiles: 2,
        docFiles: 1,
        confidence: 'low',
      };

      const mediumConfidence: ContentProfile = {
        codeFileRatio: 0.8,
        docFileRatio: 0.2,
        totalFiles: 15,
        codeFiles: 12,
        docFiles: 3,
        confidence: 'medium',
      };

      expect(determineOptimalSettings(lowConfidence).confidence).toBe('low');
      expect(determineOptimalSettings(mediumConfidence).confidence).toBe('medium');
    });
  });

  describe('shouldTriggerAnalysis', () => {
    it('should trigger at milestone counts', () => {
      expect(shouldTriggerAnalysis(1)).toBe(true);
      expect(shouldTriggerAnalysis(5)).toBe(true);
      expect(shouldTriggerAnalysis(20)).toBe(true);
      expect(shouldTriggerAnalysis(50)).toBe(true);
    });

    it('should trigger every 50 after 50', () => {
      expect(shouldTriggerAnalysis(100)).toBe(true);
      expect(shouldTriggerAnalysis(150)).toBe(true);
      expect(shouldTriggerAnalysis(200)).toBe(true);
      expect(shouldTriggerAnalysis(500)).toBe(true);
    });

    it('should not trigger between milestones', () => {
      expect(shouldTriggerAnalysis(2)).toBe(false);
      expect(shouldTriggerAnalysis(3)).toBe(false);
      expect(shouldTriggerAnalysis(4)).toBe(false);
      expect(shouldTriggerAnalysis(10)).toBe(false);
      expect(shouldTriggerAnalysis(15)).toBe(false);
      expect(shouldTriggerAnalysis(30)).toBe(false);
      expect(shouldTriggerAnalysis(40)).toBe(false);
    });

    it('should not trigger at non-50 intervals after 50', () => {
      expect(shouldTriggerAnalysis(75)).toBe(false);
      expect(shouldTriggerAnalysis(125)).toBe(false);
      expect(shouldTriggerAnalysis(160)).toBe(false);
    });

    it('should handle zero files', () => {
      expect(shouldTriggerAnalysis(0)).toBe(false);
    });

    it('should handle negative numbers gracefully', () => {
      expect(shouldTriggerAnalysis(-1)).toBe(false);
      expect(shouldTriggerAnalysis(-50)).toBe(false);
    });
  });
});
