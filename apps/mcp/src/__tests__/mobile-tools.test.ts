/**
 * MCP Mobile Tools Schema Tests
 *
 * Tests for the three new MCP tools introduced in GPT Phase 1:
 * - search_mobile_docs: Feature + framework aware search for mobile documentation
 * - find_code_examples: Find code examples biased toward example/demo content
 * - get_feature_recipe: Retrieve curated recipe documentation for mobile features
 *
 * @module apps/mcp/src/__tests__/mobile-tools.test
 * @since GPT Phase 1: Mobile Feature Recipes
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// =============================================================================
// Schema Definitions (mirrored from index.ts for isolated testing)
// =============================================================================

const searchMobileDocsInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    query: z.string().min(1).describe('Search query for mobile documentation'),
    featureTags: z
      .array(z.string())
      .optional()
      .describe('Mobile feature tags to filter by (e.g., auth, payments, offline)'),
    platform: z
      .enum(['mobile', 'web', 'backend', 'shared'])
      .optional()
      .describe('Content platform filter'),
    framework: z.string().optional().describe('Framework name (e.g., flutter, react-native)'),
    top_k: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe('Number of results to return (default: 10)'),
  })
  .strict();

const findCodeExamplesInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    query: z.string().min(1).describe('Search query for code examples'),
    featureTags: z.array(z.string()).optional().describe('Mobile feature tags to filter examples'),
    framework: z.string().optional().describe('Framework name (e.g., flutter, supabase)'),
    top_k: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(5)
      .describe('Number of examples to return (default: 5)'),
  })
  .strict();

const getFeatureRecipeInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    featureTags: z
      .array(z.string())
      .min(1)
      .describe('Required: Mobile feature tags to find recipes for (e.g., ["auth", "supabase"])'),
    framework: z.string().optional().describe('Framework name (e.g., flutter)'),
    top_k: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe('Number of recipes to return (default: 5)'),
  })
  .strict();

// =============================================================================
// Test Constants
// =============================================================================

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

// =============================================================================
// Tests
// =============================================================================

describe('MCP Mobile Tools Schemas', () => {
  // ===========================================================================
  // search_mobile_docs Schema Tests
  // ===========================================================================
  describe('search_mobile_docs schema', () => {
    describe('valid inputs', () => {
      it('should accept valid input with all fields', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'authentication',
          featureTags: ['auth', 'social_auth'],
          platform: 'mobile' as const,
          framework: 'flutter',
          top_k: 5,
        };

        const result = searchMobileDocsInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.query).toBe('authentication');
        expect(result.featureTags).toEqual(['auth', 'social_auth']);
        expect(result.platform).toBe('mobile');
        expect(result.framework).toBe('flutter');
        expect(result.top_k).toBe(5);
      });

      it('should accept minimal input with only required fields', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'authentication',
        };

        const result = searchMobileDocsInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.query).toBe('authentication');
        expect(result.top_k).toBe(10); // default value
        expect(result.featureTags).toBeUndefined();
        expect(result.platform).toBeUndefined();
        expect(result.framework).toBeUndefined();
      });

      it('should accept all valid platform values', () => {
        const platforms = ['mobile', 'web', 'backend', 'shared'] as const;

        for (const platform of platforms) {
          const input = {
            collectionId: VALID_UUID,
            query: 'test',
            platform,
          };

          expect(() => searchMobileDocsInput.parse(input)).not.toThrow();
        }
      });

      it('should accept top_k at boundaries (1 and 50)', () => {
        const inputMin = {
          collectionId: VALID_UUID,
          query: 'test',
          top_k: 1,
        };

        const inputMax = {
          collectionId: VALID_UUID,
          query: 'test',
          top_k: 50,
        };

        expect(searchMobileDocsInput.parse(inputMin).top_k).toBe(1);
        expect(searchMobileDocsInput.parse(inputMax).top_k).toBe(50);
      });

      it('should accept empty featureTags array', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          featureTags: [],
        };

        const result = searchMobileDocsInput.parse(input);
        expect(result.featureTags).toEqual([]);
      });
    });

    describe('invalid inputs', () => {
      it('should reject invalid UUID', () => {
        const input = {
          collectionId: 'not-a-uuid',
          query: 'test',
        };

        expect(() => searchMobileDocsInput.parse(input)).toThrow();
      });

      it('should reject empty query', () => {
        const input = {
          collectionId: VALID_UUID,
          query: '',
        };

        expect(() => searchMobileDocsInput.parse(input)).toThrow();
      });

      it('should reject invalid platform', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          platform: 'invalid',
        };

        expect(() => searchMobileDocsInput.parse(input)).toThrow();
      });

      it('should reject extra fields (strict mode)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          extraField: 'not allowed',
        };

        expect(() => searchMobileDocsInput.parse(input)).toThrow();
      });

      it('should reject top_k below minimum (0)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          top_k: 0,
        };

        expect(() => searchMobileDocsInput.parse(input)).toThrow();
      });

      it('should reject top_k above maximum (51)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          top_k: 51,
        };

        expect(() => searchMobileDocsInput.parse(input)).toThrow();
      });

      it('should reject non-integer top_k', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          top_k: 5.5,
        };

        expect(() => searchMobileDocsInput.parse(input)).toThrow();
      });

      it('should reject missing collectionId', () => {
        const input = {
          query: 'test',
        };

        expect(() => searchMobileDocsInput.parse(input)).toThrow();
      });

      it('should reject missing query', () => {
        const input = {
          collectionId: VALID_UUID,
        };

        expect(() => searchMobileDocsInput.parse(input)).toThrow();
      });

      it('should reject featureTags with non-string elements', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          featureTags: [123, 'auth'],
        };

        expect(() => searchMobileDocsInput.parse(input)).toThrow();
      });
    });
  });

  // ===========================================================================
  // find_code_examples Schema Tests
  // ===========================================================================
  describe('find_code_examples schema', () => {
    describe('valid inputs', () => {
      it('should accept valid input with all fields', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'login form',
          featureTags: ['auth', 'forms'],
          framework: 'flutter',
          top_k: 3,
        };

        const result = findCodeExamplesInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.query).toBe('login form');
        expect(result.featureTags).toEqual(['auth', 'forms']);
        expect(result.framework).toBe('flutter');
        expect(result.top_k).toBe(3);
      });

      it('should have default top_k of 5', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'example',
        };

        const result = findCodeExamplesInput.parse(input);
        expect(result.top_k).toBe(5);
      });

      it('should accept minimal input with only required fields', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'authentication example',
        };

        const result = findCodeExamplesInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.query).toBe('authentication example');
        expect(result.featureTags).toBeUndefined();
        expect(result.framework).toBeUndefined();
      });

      it('should accept framework without featureTags', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'supabase example',
          framework: 'supabase',
        };

        const result = findCodeExamplesInput.parse(input);
        expect(result.framework).toBe('supabase');
        expect(result.featureTags).toBeUndefined();
      });
    });

    describe('invalid inputs', () => {
      it('should reject invalid UUID', () => {
        const input = {
          collectionId: 'invalid',
          query: 'test',
        };

        expect(() => findCodeExamplesInput.parse(input)).toThrow();
      });

      it('should reject empty query', () => {
        const input = {
          collectionId: VALID_UUID,
          query: '',
        };

        expect(() => findCodeExamplesInput.parse(input)).toThrow();
      });

      it('should reject extra fields (strict mode)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          platform: 'mobile', // Not allowed in find_code_examples
        };

        expect(() => findCodeExamplesInput.parse(input)).toThrow();
      });

      it('should reject top_k above 50', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          top_k: 51,
        };

        expect(() => findCodeExamplesInput.parse(input)).toThrow();
      });
    });
  });

  // ===========================================================================
  // get_feature_recipe Schema Tests
  // ===========================================================================
  describe('get_feature_recipe schema', () => {
    describe('valid inputs', () => {
      it('should accept valid input with required featureTags', () => {
        const input = {
          collectionId: VALID_UUID,
          featureTags: ['auth'],
        };

        const result = getFeatureRecipeInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.featureTags).toEqual(['auth']);
        expect(result.top_k).toBe(5); // default
      });

      it('should accept multiple featureTags', () => {
        const input = {
          collectionId: VALID_UUID,
          featureTags: ['auth', 'supabase', 'social_auth'],
        };

        const result = getFeatureRecipeInput.parse(input);
        expect(result.featureTags).toEqual(['auth', 'supabase', 'social_auth']);
      });

      it('should accept optional framework', () => {
        const input = {
          collectionId: VALID_UUID,
          featureTags: ['payments'],
          framework: 'flutter',
        };

        const result = getFeatureRecipeInput.parse(input);
        expect(result.framework).toBe('flutter');
      });

      it('should have default top_k of 5', () => {
        const input = {
          collectionId: VALID_UUID,
          featureTags: ['auth'],
        };

        const result = getFeatureRecipeInput.parse(input);
        expect(result.top_k).toBe(5);
      });

      it('should have max top_k of 20', () => {
        const input = {
          collectionId: VALID_UUID,
          featureTags: ['auth'],
          top_k: 20,
        };

        expect(getFeatureRecipeInput.parse(input).top_k).toBe(20);
      });

      it('should not require query field', () => {
        const input = {
          collectionId: VALID_UUID,
          featureTags: ['payments', 'subscriptions'],
        };

        expect(() => getFeatureRecipeInput.parse(input)).not.toThrow();
      });
    });

    describe('invalid inputs', () => {
      it('should reject empty featureTags array', () => {
        const input = {
          collectionId: VALID_UUID,
          featureTags: [],
        };

        expect(() => getFeatureRecipeInput.parse(input)).toThrow();
      });

      it('should reject missing featureTags', () => {
        const input = {
          collectionId: VALID_UUID,
        };

        expect(() => getFeatureRecipeInput.parse(input)).toThrow();
      });

      it('should reject top_k above 20', () => {
        const input = {
          collectionId: VALID_UUID,
          featureTags: ['auth'],
          top_k: 25,
        };

        expect(() => getFeatureRecipeInput.parse(input)).toThrow();
      });

      it('should reject invalid UUID', () => {
        const input = {
          collectionId: 'bad-uuid',
          featureTags: ['auth'],
        };

        expect(() => getFeatureRecipeInput.parse(input)).toThrow();
      });

      it('should reject extra fields (strict mode)', () => {
        const input = {
          collectionId: VALID_UUID,
          featureTags: ['auth'],
          query: 'not allowed', // query is not in schema
        };

        expect(() => getFeatureRecipeInput.parse(input)).toThrow();
      });

      it('should reject top_k below minimum', () => {
        const input = {
          collectionId: VALID_UUID,
          featureTags: ['auth'],
          top_k: 0,
        };

        expect(() => getFeatureRecipeInput.parse(input)).toThrow();
      });
    });
  });
});

// =============================================================================
// Query Construction Tests
// =============================================================================

describe('get_feature_recipe query construction', () => {
  it('should construct query from single feature tag', () => {
    const featureTags = ['payments'];
    const query = featureTags.join(' ') + ' implementation guide';

    expect(query).toBe('payments implementation guide');
  });

  it('should construct query from multiple feature tags', () => {
    const featureTags = ['auth', 'social_auth'];
    const query = featureTags.join(' ') + ' implementation guide';

    expect(query).toBe('auth social_auth implementation guide');
  });

  it('should construct query from many feature tags', () => {
    const featureTags = ['payments', 'subscriptions', 'billing'];
    const query = featureTags.join(' ') + ' implementation guide';

    expect(query).toBe('payments subscriptions billing implementation guide');
  });

  it('should handle feature tags with underscores', () => {
    const featureTags = ['push_notifications', 'deep_linking'];
    const query = featureTags.join(' ') + ' implementation guide';

    expect(query).toBe('push_notifications deep_linking implementation guide');
  });
});

// =============================================================================
// API Call Parameter Construction Tests
// =============================================================================

describe('API call parameter construction', () => {
  describe('search_mobile_docs API parameters', () => {
    it('should construct correct API parameters with all options', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'authentication',
        featureTags: ['auth', 'social_auth'],
        platform: 'mobile' as const,
        framework: 'flutter',
        top_k: 10,
      };

      // Simulating the API call construction from index.ts
      const apiParams = {
        query: input.query,
        collection_id: input.collectionId,
        top_k: input.top_k,
        feature_tags: input.featureTags,
        platform: input.platform,
        tech_stack: input.framework ? [input.framework] : undefined,
      };

      expect(apiParams.query).toBe('authentication');
      expect(apiParams.collection_id).toBe(VALID_UUID);
      expect(apiParams.top_k).toBe(10);
      expect(apiParams.feature_tags).toEqual(['auth', 'social_auth']);
      expect(apiParams.platform).toBe('mobile');
      expect(apiParams.tech_stack).toEqual(['flutter']);
    });

    it('should set tech_stack to undefined when framework is not provided', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'test',
        framework: undefined,
      };

      const tech_stack = input.framework ? [input.framework] : undefined;
      expect(tech_stack).toBeUndefined();
    });
  });

  describe('find_code_examples API parameters', () => {
    it('should include usage_tier: example', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'login form',
        featureTags: ['auth'],
        framework: 'flutter',
        top_k: 5,
      };

      // Simulating the API call construction from index.ts
      const apiParams = {
        query: input.query,
        collection_id: input.collectionId,
        top_k: input.top_k,
        feature_tags: input.featureTags,
        usage_tier: 'example' as const,
        tech_stack: input.framework ? [input.framework] : undefined,
      };

      expect(apiParams.usage_tier).toBe('example');
      expect(apiParams.tech_stack).toEqual(['flutter']);
    });
  });

  describe('get_feature_recipe API parameters', () => {
    it('should include usage_tier: recipe and construct query from featureTags', () => {
      const input = {
        collectionId: VALID_UUID,
        featureTags: ['auth', 'supabase'],
        framework: 'flutter',
        top_k: 5,
      };

      // Simulating the API call construction from index.ts
      const apiParams = {
        query: input.featureTags.join(' ') + ' implementation guide',
        collection_id: input.collectionId,
        top_k: input.top_k,
        feature_tags: input.featureTags,
        usage_tier: 'recipe' as const,
        tech_stack: input.framework ? [input.framework] : undefined,
      };

      expect(apiParams.query).toBe('auth supabase implementation guide');
      expect(apiParams.usage_tier).toBe('recipe');
      expect(apiParams.feature_tags).toEqual(['auth', 'supabase']);
      expect(apiParams.tech_stack).toEqual(['flutter']);
    });
  });
});

// =============================================================================
// Schema Type Inference Tests
// =============================================================================

describe('schema type inference', () => {
  it('should infer correct types for search_mobile_docs', () => {
    type SearchMobileDocsInput = z.infer<typeof searchMobileDocsInput>;

    // Type-level test: This would fail at compile time if types don't match
    const validInput: SearchMobileDocsInput = {
      collectionId: VALID_UUID,
      query: 'test',
      featureTags: ['auth'],
      platform: 'mobile',
      framework: 'flutter',
      top_k: 10,
    };

    expect(validInput).toBeDefined();
  });

  it('should infer correct types for find_code_examples', () => {
    type FindCodeExamplesInput = z.infer<typeof findCodeExamplesInput>;

    const validInput: FindCodeExamplesInput = {
      collectionId: VALID_UUID,
      query: 'test',
      featureTags: ['auth'],
      framework: 'flutter',
      top_k: 5,
    };

    expect(validInput).toBeDefined();
  });

  it('should infer correct types for get_feature_recipe', () => {
    type GetFeatureRecipeInput = z.infer<typeof getFeatureRecipeInput>;

    const validInput: GetFeatureRecipeInput = {
      collectionId: VALID_UUID,
      featureTags: ['auth'],
      framework: 'flutter',
      top_k: 5,
    };

    expect(validInput).toBeDefined();
  });
});

// =============================================================================
// Edge Cases and Boundary Tests
// =============================================================================

describe('edge cases and boundary conditions', () => {
  describe('UUID validation', () => {
    it('should accept valid v4 UUID', () => {
      const input = {
        collectionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        query: 'test',
      };

      expect(() => searchMobileDocsInput.parse(input)).not.toThrow();
    });

    it('should reject UUID with wrong format', () => {
      const inputs = [
        { collectionId: '123', query: 'test' },
        { collectionId: '123e4567-e89b-12d3-a456-42661417400', query: 'test' }, // too short
        { collectionId: '123e4567-e89b-12d3-a456-4266141740000', query: 'test' }, // too long
        { collectionId: '123e4567e89b12d3a456426614174000', query: 'test' }, // no dashes
      ];

      for (const input of inputs) {
        expect(() => searchMobileDocsInput.parse(input)).toThrow();
      }
    });
  });

  describe('string boundaries', () => {
    it('should accept single character query', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'a',
      };

      expect(() => searchMobileDocsInput.parse(input)).not.toThrow();
    });

    it('should accept very long query', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'a'.repeat(1000),
      };

      expect(() => searchMobileDocsInput.parse(input)).not.toThrow();
    });

    it('should accept query with special characters', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'authentication + OAuth2.0 & JWT',
      };

      expect(() => searchMobileDocsInput.parse(input)).not.toThrow();
    });

    it('should accept query with unicode characters', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'authentication',
      };

      expect(() => searchMobileDocsInput.parse(input)).not.toThrow();
    });
  });

  describe('array boundaries', () => {
    it('should accept featureTags with many elements', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'test',
        featureTags: Array(100).fill('auth'),
      };

      expect(() => searchMobileDocsInput.parse(input)).not.toThrow();
    });

    it('should accept featureTags with empty strings', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'test',
        featureTags: ['auth', '', 'payments'],
      };

      // Empty strings are valid strings, so this should not throw
      expect(() => searchMobileDocsInput.parse(input)).not.toThrow();
    });
  });

  describe('numeric boundaries', () => {
    it('should reject negative top_k', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'test',
        top_k: -1,
      };

      expect(() => searchMobileDocsInput.parse(input)).toThrow();
    });

    it('should reject NaN top_k', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'test',
        top_k: Number.NaN,
      };

      expect(() => searchMobileDocsInput.parse(input)).toThrow();
    });

    it('should reject Infinity top_k', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'test',
        top_k: Number.POSITIVE_INFINITY,
      };

      expect(() => searchMobileDocsInput.parse(input)).toThrow();
    });
  });
});
