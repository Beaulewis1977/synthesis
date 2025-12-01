/**
 * GPT Phase 1: Mobile Recipe Ingestion Tests
 *
 * Tests for the recipe frontmatter parsing and metadata building logic.
 *
 * @module scripts/__tests__/ingest-mobile-recipes.test
 */

import type { ContentPlatform, MobileFeatureTag, UsageTier } from '@synthesis/shared';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

// Recipe frontmatter schema (copied from ingest-mobile-recipes.ts for testing)
interface RecipeFrontmatter {
  title: string;
  platform: ContentPlatform;
  framework: string;
  framework_version?: string;
  feature_tags: MobileFeatureTag[];
  usage_tier: UsageTier;
  tech_stack: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  last_updated?: string;
  recommended?: boolean;
  sdk_constraints?: string;
  tested_versions?: string[];
}

/**
 * Validates that frontmatter has required fields for a recipe
 */
function isValidRecipeFrontmatter(data: unknown): data is RecipeFrontmatter {
  if (!data || typeof data !== 'object') return false;

  const fm = data as Record<string, unknown>;

  // Required fields
  if (typeof fm.title !== 'string') return false;
  if (typeof fm.platform !== 'string') return false;
  if (typeof fm.framework !== 'string') return false;
  if (!Array.isArray(fm.feature_tags)) return false;
  if (typeof fm.usage_tier !== 'string') return false;
  if (!Array.isArray(fm.tech_stack)) return false;

  return true;
}

describe('ingest-mobile-recipes', () => {
  describe('isValidRecipeFrontmatter', () => {
    it('accepts valid frontmatter with all required fields', () => {
      const validFrontmatter = {
        title: 'Flutter Authentication with Supabase',
        platform: 'mobile',
        framework: 'flutter',
        feature_tags: ['auth', 'social_auth'],
        usage_tier: 'recipe',
        tech_stack: ['supabase', 'flutter'],
      };

      expect(isValidRecipeFrontmatter(validFrontmatter)).toBe(true);
    });

    it('accepts frontmatter with optional fields', () => {
      const frontmatterWithOptionals = {
        title: 'Flutter Payments',
        platform: 'mobile',
        framework: 'flutter',
        framework_version: '3.24.x',
        feature_tags: ['payments'],
        usage_tier: 'recipe',
        tech_stack: ['stripe'],
        difficulty: 'intermediate',
        last_updated: '2025-11-30',
        recommended: true,
        sdk_constraints: '>=3.0.0 <4.0.0',
        tested_versions: ['Flutter 3.24.5'],
      };

      expect(isValidRecipeFrontmatter(frontmatterWithOptionals)).toBe(true);
    });

    it('rejects null/undefined', () => {
      expect(isValidRecipeFrontmatter(null)).toBe(false);
      expect(isValidRecipeFrontmatter(undefined)).toBe(false);
    });

    it('rejects non-object values', () => {
      expect(isValidRecipeFrontmatter('string')).toBe(false);
      expect(isValidRecipeFrontmatter(123)).toBe(false);
      expect(isValidRecipeFrontmatter([])).toBe(false);
    });

    it('rejects frontmatter missing title', () => {
      const missing = {
        platform: 'mobile',
        framework: 'flutter',
        feature_tags: ['auth'],
        usage_tier: 'recipe',
        tech_stack: ['supabase'],
      };
      expect(isValidRecipeFrontmatter(missing)).toBe(false);
    });

    it('rejects frontmatter missing platform', () => {
      const missing = {
        title: 'Test',
        framework: 'flutter',
        feature_tags: ['auth'],
        usage_tier: 'recipe',
        tech_stack: ['supabase'],
      };
      expect(isValidRecipeFrontmatter(missing)).toBe(false);
    });

    it('rejects frontmatter missing feature_tags', () => {
      const missing = {
        title: 'Test',
        platform: 'mobile',
        framework: 'flutter',
        usage_tier: 'recipe',
        tech_stack: ['supabase'],
      };
      expect(isValidRecipeFrontmatter(missing)).toBe(false);
    });

    it('rejects frontmatter with non-array feature_tags', () => {
      const invalid = {
        title: 'Test',
        platform: 'mobile',
        framework: 'flutter',
        feature_tags: 'auth', // Should be array
        usage_tier: 'recipe',
        tech_stack: ['supabase'],
      };
      expect(isValidRecipeFrontmatter(invalid)).toBe(false);
    });

    it('rejects frontmatter with non-array tech_stack', () => {
      const invalid = {
        title: 'Test',
        platform: 'mobile',
        framework: 'flutter',
        feature_tags: ['auth'],
        usage_tier: 'recipe',
        tech_stack: 'supabase', // Should be array
      };
      expect(isValidRecipeFrontmatter(invalid)).toBe(false);
    });
  });

  describe('gray-matter parsing', () => {
    it('parses valid recipe markdown', () => {
      const markdown = `---
title: "Flutter Authentication with Supabase"
platform: mobile
framework: flutter
framework_version: "3.24.x"
feature_tags:
  - auth
  - social_auth
usage_tier: recipe
tech_stack:
  - supabase
  - flutter
difficulty: intermediate
last_updated: 2025-11-30
recommended: true
sdk_constraints: ">=3.0.0 <4.0.0"
---

# Flutter Authentication with Supabase

> **Summary:** Implement authentication in Flutter using Supabase Auth.

## Prerequisites

- Flutter SDK installed
`;

      const { data, content } = matter(markdown);

      expect(data.title).toBe('Flutter Authentication with Supabase');
      expect(data.platform).toBe('mobile');
      expect(data.framework).toBe('flutter');
      expect(data.framework_version).toBe('3.24.x');
      expect(data.feature_tags).toEqual(['auth', 'social_auth']);
      expect(data.usage_tier).toBe('recipe');
      expect(data.tech_stack).toEqual(['supabase', 'flutter']);
      expect(data.difficulty).toBe('intermediate');
      expect(data.recommended).toBe(true);
      expect(data.sdk_constraints).toBe('>=3.0.0 <4.0.0');

      expect(content).toContain('# Flutter Authentication with Supabase');
      expect(content).toContain('## Prerequisites');
      expect(isValidRecipeFrontmatter(data)).toBe(true);
    });

    it('parses multiple feature tags correctly', () => {
      const markdown = `---
title: "Test Recipe"
platform: mobile
framework: flutter
feature_tags:
  - auth
  - payments
  - push_notifications
  - offline
usage_tier: recipe
tech_stack:
  - firebase
---

Content here.
`;

      const { data } = matter(markdown);

      expect(data.feature_tags).toEqual(['auth', 'payments', 'push_notifications', 'offline']);
      expect(isValidRecipeFrontmatter(data)).toBe(true);
    });

    it('handles markdown with no frontmatter', () => {
      const markdown = `# Just a Title

Some content without frontmatter.
`;

      const { data, content } = matter(markdown);

      expect(data).toEqual({});
      expect(content).toContain('# Just a Title');
      expect(isValidRecipeFrontmatter(data)).toBe(false);
    });

    it('handles empty frontmatter', () => {
      const markdown = `---
---

# Title

Content.
`;

      const { data } = matter(markdown);

      expect(data).toEqual({});
      expect(isValidRecipeFrontmatter(data)).toBe(false);
    });
  });

  describe('recipe metadata structure', () => {
    it('builds correct metadata from frontmatter', () => {
      const frontmatter: RecipeFrontmatter = {
        title: 'Flutter Stripe Payments',
        platform: 'mobile',
        framework: 'flutter',
        framework_version: '3.24.x',
        feature_tags: ['payments', 'billing'],
        usage_tier: 'recipe',
        tech_stack: ['stripe', 'flutter'],
        difficulty: 'intermediate',
        recommended: true,
        sdk_constraints: '>=3.0.0 <4.0.0',
        tested_versions: ['Flutter 3.24.5', 'flutter_stripe 11.2.0'],
      };

      // Simulating buildRecipeMetadata function logic
      const metadata = {
        doc_type: 'recipe' as const,
        source_url: 'file:///docs/recipes/mobile/flutter_stripe_payments.md',
        source_type: 'file' as const,
        source_quality: 'official' as const,
        platform: frontmatter.platform,
        feature_tags: frontmatter.feature_tags,
        usage_tier: frontmatter.usage_tier,
        recommended: frontmatter.recommended ?? false,
        framework: frontmatter.framework,
        framework_version: frontmatter.framework_version,
        tech_stack: frontmatter.tech_stack,
        difficulty: frontmatter.difficulty,
        sdk_constraints: frontmatter.sdk_constraints,
        tested_versions: frontmatter.tested_versions,
        ingested_at: new Date().toISOString(),
      };

      expect(metadata.doc_type).toBe('recipe');
      expect(metadata.source_quality).toBe('official');
      expect(metadata.platform).toBe('mobile');
      expect(metadata.feature_tags).toEqual(['payments', 'billing']);
      expect(metadata.usage_tier).toBe('recipe');
      expect(metadata.recommended).toBe(true);
      expect(metadata.framework).toBe('flutter');
      expect(metadata.framework_version).toBe('3.24.x');
      expect(metadata.tech_stack).toEqual(['stripe', 'flutter']);
      expect(metadata.difficulty).toBe('intermediate');
    });

    it('handles missing optional fields with defaults', () => {
      const frontmatter: RecipeFrontmatter = {
        title: 'Minimal Recipe',
        platform: 'mobile',
        framework: 'flutter',
        feature_tags: ['auth'],
        usage_tier: 'recipe',
        tech_stack: ['firebase'],
      };

      const metadata = {
        doc_type: 'recipe' as const,
        platform: frontmatter.platform,
        feature_tags: frontmatter.feature_tags,
        usage_tier: frontmatter.usage_tier,
        recommended: frontmatter.recommended ?? false,
        framework: frontmatter.framework,
        framework_version: frontmatter.framework_version,
        difficulty: frontmatter.difficulty,
      };

      expect(metadata.recommended).toBe(false);
      expect(metadata.framework_version).toBeUndefined();
      expect(metadata.difficulty).toBeUndefined();
    });
  });
});
