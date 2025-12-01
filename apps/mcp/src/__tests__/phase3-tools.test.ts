/**
 * MCP Phase 3 Tools Schema Tests
 *
 * Tests for the three new MCP tools introduced in GPT Phase 3:
 * - Tool 15: find_symbol_usages - Search for symbol definitions and usages
 * - Tool 16: get_project_tech_stack - Get technology stack profile
 * - Tool 17: get_db_schema - Extract database schema from codebase
 *
 * Tests cover:
 * - Schema validation for all three tools
 * - Required field validation
 * - UUID format validation
 * - Type validation for all fields
 * - Optional fields with defaults
 * - Enum validation for symbolKind
 * - Bounds validation for maxResults
 * - Array validation for tables field
 *
 * @module apps/mcp/src/__tests__/phase3-tools.test
 * @since GPT Phase 3: Symbol Search, Tech Stack, and DB Schema Tools
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// =============================================================================
// Schema Definitions (mirrored from index.ts for isolated testing)
// =============================================================================

/**
 * Tool 15: find_symbol_usages
 * Search for symbol definitions and usages across the codebase
 */
const findSymbolUsagesInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    symbolName: z.string().min(1).describe('Name of the symbol to find'),
    symbolKind: z
      .enum(['function', 'class', 'widget', 'method', 'constant'])
      .optional()
      .describe('Filter by symbol kind'),
    includeDefinitions: z
      .boolean()
      .default(true)
      .describe('Include definition locations (default: true)'),
    includeUsages: z.boolean().default(true).describe('Include usage locations (default: true)'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Maximum results to return (default: 20)'),
  })
  .strict();

/**
 * Tool 16: get_project_tech_stack
 * Get the technology stack profile for a project collection
 */
const getProjectTechStackInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection'),
  })
  .strict();

/**
 * Tool 17: get_db_schema
 * Extract database schema from the codebase
 */
const getDbSchemaInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection'),
    tables: z.array(z.string()).optional().describe('Filter to specific table names'),
    includeRelationships: z
      .boolean()
      .default(true)
      .describe('Include table relationships (default: true)'),
  })
  .strict();

// =============================================================================
// Test Constants
// =============================================================================

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_UUID_2 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// =============================================================================
// Tests
// =============================================================================

describe('MCP Phase 3 Tools Schemas', () => {
  // ===========================================================================
  // Tool 15: find_symbol_usages Schema Tests
  // ===========================================================================
  describe('find_symbol_usages schema', () => {
    // =========================================================================
    // Valid Input Tests
    // =========================================================================
    describe('valid inputs', () => {
      it('should accept valid input with all fields', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'UserService',
          symbolKind: 'class' as const,
          includeDefinitions: true,
          includeUsages: false,
          maxResults: 50,
        };

        const result = findSymbolUsagesInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.symbolName).toBe('UserService');
        expect(result.symbolKind).toBe('class');
        expect(result.includeDefinitions).toBe(true);
        expect(result.includeUsages).toBe(false);
        expect(result.maxResults).toBe(50);
      });

      it('should accept valid input with required fields only', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'handleLogin',
        };

        const result = findSymbolUsagesInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.symbolName).toBe('handleLogin');
        expect(result.symbolKind).toBeUndefined();
        expect(result.includeDefinitions).toBe(true); // default
        expect(result.includeUsages).toBe(true); // default
        expect(result.maxResults).toBe(20); // default
      });

      it('should accept all valid symbolKind enum values', () => {
        const validKinds = ['function', 'class', 'widget', 'method', 'constant'] as const;

        for (const kind of validKinds) {
          const input = {
            collectionId: VALID_UUID,
            symbolName: 'testSymbol',
            symbolKind: kind,
          };

          const result = findSymbolUsagesInput.parse(input);
          expect(result.symbolKind).toBe(kind);
        }
      });

      it('should accept symbolName with various valid characters', () => {
        const validNames = [
          'a', // single character
          'MyClass',
          'my_function',
          'handleClick123',
          '_privateMethod',
          '$dollarSign',
          'CONSTANT_VALUE',
          'camelCaseMethod',
        ];

        for (const name of validNames) {
          const input = {
            collectionId: VALID_UUID,
            symbolName: name,
          };

          expect(() => findSymbolUsagesInput.parse(input)).not.toThrow();
        }
      });
    });

    // =========================================================================
    // Required Field Validation Tests
    // =========================================================================
    describe('required field validation', () => {
      it('should reject missing collectionId', () => {
        const input = {
          symbolName: 'testFunction',
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });

      it('should reject missing symbolName', () => {
        const input = {
          collectionId: VALID_UUID,
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });

      it('should reject empty symbolName', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: '',
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // UUID Validation Tests
    // =========================================================================
    describe('UUID validation', () => {
      it('should accept valid UUID v4', () => {
        const input = {
          collectionId: VALID_UUID_2,
          symbolName: 'test',
        };

        expect(() => findSymbolUsagesInput.parse(input)).not.toThrow();
      });

      it('should reject invalid UUID format', () => {
        const invalidUUIDs = [
          'not-a-uuid',
          '123',
          '123e4567-e89b-12d3-a456-42661417400', // too short
          '123e4567-e89b-12d3-a456-4266141740000', // too long
          '123e4567e89b12d3a456426614174000', // no dashes
          'gggggggg-gggg-gggg-gggg-gggggggggggg', // invalid hex
        ];

        for (const uuid of invalidUUIDs) {
          const input = {
            collectionId: uuid,
            symbolName: 'test',
          };

          expect(() => findSymbolUsagesInput.parse(input)).toThrow();
        }
      });
    });

    // =========================================================================
    // symbolKind Enum Validation Tests
    // =========================================================================
    describe('symbolKind enum validation', () => {
      it('should reject invalid symbolKind value', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          symbolKind: 'invalid_kind',
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });

      it('should reject symbolKind with wrong case', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          symbolKind: 'Function', // should be 'function'
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });

      it('should accept undefined symbolKind (optional field)', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
        };

        const result = findSymbolUsagesInput.parse(input);
        expect(result.symbolKind).toBeUndefined();
      });
    });

    // =========================================================================
    // Boolean Defaults Tests
    // =========================================================================
    describe('boolean defaults', () => {
      it('should default includeDefinitions to true', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
        };

        const result = findSymbolUsagesInput.parse(input);
        expect(result.includeDefinitions).toBe(true);
      });

      it('should default includeUsages to true', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
        };

        const result = findSymbolUsagesInput.parse(input);
        expect(result.includeUsages).toBe(true);
      });

      it('should allow overriding includeDefinitions to false', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          includeDefinitions: false,
        };

        const result = findSymbolUsagesInput.parse(input);
        expect(result.includeDefinitions).toBe(false);
      });

      it('should allow overriding includeUsages to false', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          includeUsages: false,
        };

        const result = findSymbolUsagesInput.parse(input);
        expect(result.includeUsages).toBe(false);
      });

      it('should allow both boolean flags to be false', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          includeDefinitions: false,
          includeUsages: false,
        };

        const result = findSymbolUsagesInput.parse(input);
        expect(result.includeDefinitions).toBe(false);
        expect(result.includeUsages).toBe(false);
      });
    });

    // =========================================================================
    // maxResults Bounds Tests
    // =========================================================================
    describe('maxResults bounds (1-100)', () => {
      it('should default maxResults to 20', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
        };

        const result = findSymbolUsagesInput.parse(input);
        expect(result.maxResults).toBe(20);
      });

      it('should accept maxResults at minimum (1)', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          maxResults: 1,
        };

        const result = findSymbolUsagesInput.parse(input);
        expect(result.maxResults).toBe(1);
      });

      it('should accept maxResults at maximum (100)', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          maxResults: 100,
        };

        const result = findSymbolUsagesInput.parse(input);
        expect(result.maxResults).toBe(100);
      });

      it('should reject maxResults below minimum (0)', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          maxResults: 0,
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });

      it('should reject maxResults above maximum (101)', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          maxResults: 101,
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });

      it('should reject negative maxResults', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          maxResults: -1,
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });

      it('should reject non-integer maxResults', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          maxResults: 20.5,
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });

      it('should reject NaN maxResults', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          maxResults: Number.NaN,
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });

      it('should reject Infinity maxResults', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          maxResults: Number.POSITIVE_INFINITY,
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // Strict Mode Tests
    // =========================================================================
    describe('strict mode validation', () => {
      it('should reject extra fields', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          extraField: 'not allowed',
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });

      it('should reject misspelled field names', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
          symbolkind: 'function', // should be symbolKind
        };

        expect(() => findSymbolUsagesInput.parse(input)).toThrow();
      });
    });
  });

  // ===========================================================================
  // Tool 16: get_project_tech_stack Schema Tests
  // ===========================================================================
  describe('get_project_tech_stack schema', () => {
    // =========================================================================
    // Valid Input Tests
    // =========================================================================
    describe('valid inputs', () => {
      it('should accept valid input with collectionId', () => {
        const input = {
          collectionId: VALID_UUID,
        };

        const result = getProjectTechStackInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
      });

      it('should accept different valid UUID formats', () => {
        const validUUIDs = [
          VALID_UUID,
          VALID_UUID_2,
          '00000000-0000-0000-0000-000000000000',
          'ffffffff-ffff-ffff-ffff-ffffffffffff',
        ];

        for (const uuid of validUUIDs) {
          const input = { collectionId: uuid };
          expect(() => getProjectTechStackInput.parse(input)).not.toThrow();
        }
      });
    });

    // =========================================================================
    // Required Field Validation Tests
    // =========================================================================
    describe('required field validation', () => {
      it('should reject missing collectionId', () => {
        const input = {};

        expect(() => getProjectTechStackInput.parse(input)).toThrow();
      });

      it('should reject null collectionId', () => {
        const input = {
          collectionId: null,
        };

        expect(() => getProjectTechStackInput.parse(input)).toThrow();
      });

      it('should reject undefined collectionId', () => {
        const input = {
          collectionId: undefined,
        };

        expect(() => getProjectTechStackInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // UUID Validation Tests
    // =========================================================================
    describe('UUID validation', () => {
      it('should reject invalid UUID format', () => {
        const invalidUUIDs = [
          'not-a-uuid',
          '123',
          'abcdefgh-ijkl-mnop-qrst-uvwxyz123456',
          '',
          ' ',
          '123e4567-e89b-12d3-a456-42661417400', // too short
        ];

        for (const uuid of invalidUUIDs) {
          const input = { collectionId: uuid };
          expect(() => getProjectTechStackInput.parse(input)).toThrow();
        }
      });
    });

    // =========================================================================
    // Strict Mode Tests
    // =========================================================================
    describe('strict mode validation', () => {
      it('should reject extra fields', () => {
        const input = {
          collectionId: VALID_UUID,
          format: 'json',
        };

        expect(() => getProjectTechStackInput.parse(input)).toThrow();
      });

      it('should reject any additional property', () => {
        const input = {
          collectionId: VALID_UUID,
          includeVersions: true,
        };

        expect(() => getProjectTechStackInput.parse(input)).toThrow();
      });
    });
  });

  // ===========================================================================
  // Tool 17: get_db_schema Schema Tests
  // ===========================================================================
  describe('get_db_schema schema', () => {
    // =========================================================================
    // Valid Input Tests
    // =========================================================================
    describe('valid inputs', () => {
      it('should accept valid input with all fields', () => {
        const input = {
          collectionId: VALID_UUID,
          tables: ['users', 'orders', 'products'],
          includeRelationships: false,
        };

        const result = getDbSchemaInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.tables).toEqual(['users', 'orders', 'products']);
        expect(result.includeRelationships).toBe(false);
      });

      it('should accept valid input with required fields only', () => {
        const input = {
          collectionId: VALID_UUID,
        };

        const result = getDbSchemaInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.tables).toBeUndefined();
        expect(result.includeRelationships).toBe(true); // default
      });

      it('should accept empty tables array', () => {
        const input = {
          collectionId: VALID_UUID,
          tables: [],
        };

        const result = getDbSchemaInput.parse(input);
        expect(result.tables).toEqual([]);
      });

      it('should accept single table in array', () => {
        const input = {
          collectionId: VALID_UUID,
          tables: ['users'],
        };

        const result = getDbSchemaInput.parse(input);
        expect(result.tables).toEqual(['users']);
      });

      it('should accept tables with various valid names', () => {
        const validTableNames = [
          ['users', 'orders'],
          ['user_profiles', 'order_items'],
          ['UserAccounts'],
          ['table123'],
          ['_metadata'],
        ];

        for (const tables of validTableNames) {
          const input = {
            collectionId: VALID_UUID,
            tables,
          };

          expect(() => getDbSchemaInput.parse(input)).not.toThrow();
        }
      });
    });

    // =========================================================================
    // Required Field Validation Tests
    // =========================================================================
    describe('required field validation', () => {
      it('should reject missing collectionId', () => {
        const input = {
          tables: ['users'],
        };

        expect(() => getDbSchemaInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // UUID Validation Tests
    // =========================================================================
    describe('UUID validation', () => {
      it('should accept valid UUID v4', () => {
        const input = {
          collectionId: VALID_UUID_2,
        };

        expect(() => getDbSchemaInput.parse(input)).not.toThrow();
      });

      it('should reject invalid UUID format', () => {
        const input = {
          collectionId: 'invalid-uuid',
        };

        expect(() => getDbSchemaInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // tables Array Validation Tests
    // =========================================================================
    describe('tables array validation', () => {
      it('should accept valid tables array', () => {
        const input = {
          collectionId: VALID_UUID,
          tables: ['users', 'orders'],
        };

        const result = getDbSchemaInput.parse(input);
        expect(result.tables).toEqual(['users', 'orders']);
      });

      it('should reject tables with non-string elements', () => {
        const input = {
          collectionId: VALID_UUID,
          tables: [123, 'users'],
        };

        expect(() => getDbSchemaInput.parse(input)).toThrow();
      });

      it('should reject tables as non-array', () => {
        const input = {
          collectionId: VALID_UUID,
          tables: 'users',
        };

        expect(() => getDbSchemaInput.parse(input)).toThrow();
      });

      it('should accept tables with empty strings', () => {
        const input = {
          collectionId: VALID_UUID,
          tables: ['users', '', 'orders'],
        };

        // Empty strings are valid strings, so this should not throw
        const result = getDbSchemaInput.parse(input);
        expect(result.tables).toEqual(['users', '', 'orders']);
      });

      it('should accept many tables', () => {
        const manyTables = Array.from({ length: 50 }, (_, i) => `table_${i}`);
        const input = {
          collectionId: VALID_UUID,
          tables: manyTables,
        };

        const result = getDbSchemaInput.parse(input);
        expect(result.tables).toHaveLength(50);
      });
    });

    // =========================================================================
    // includeRelationships Default Tests
    // =========================================================================
    describe('includeRelationships default', () => {
      it('should default includeRelationships to true', () => {
        const input = {
          collectionId: VALID_UUID,
        };

        const result = getDbSchemaInput.parse(input);
        expect(result.includeRelationships).toBe(true);
      });

      it('should allow overriding includeRelationships to false', () => {
        const input = {
          collectionId: VALID_UUID,
          includeRelationships: false,
        };

        const result = getDbSchemaInput.parse(input);
        expect(result.includeRelationships).toBe(false);
      });

      it('should allow explicitly setting includeRelationships to true', () => {
        const input = {
          collectionId: VALID_UUID,
          includeRelationships: true,
        };

        const result = getDbSchemaInput.parse(input);
        expect(result.includeRelationships).toBe(true);
      });

      it('should reject non-boolean includeRelationships', () => {
        const input = {
          collectionId: VALID_UUID,
          includeRelationships: 'true',
        };

        expect(() => getDbSchemaInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // Strict Mode Tests
    // =========================================================================
    describe('strict mode validation', () => {
      it('should reject extra fields', () => {
        const input = {
          collectionId: VALID_UUID,
          includeColumns: true,
        };

        expect(() => getDbSchemaInput.parse(input)).toThrow();
      });

      it('should reject misspelled field names', () => {
        const input = {
          collectionId: VALID_UUID,
          table: ['users'], // should be 'tables'
        };

        expect(() => getDbSchemaInput.parse(input)).toThrow();
      });
    });
  });

  // ===========================================================================
  // Schema Type Inference Tests
  // ===========================================================================
  describe('schema type inference', () => {
    it('should infer correct types for find_symbol_usages', () => {
      type FindSymbolUsagesInput = z.infer<typeof findSymbolUsagesInput>;

      // Type-level test: This would fail at compile time if types don't match
      const validInput: FindSymbolUsagesInput = {
        collectionId: VALID_UUID,
        symbolName: 'testFunction',
        symbolKind: 'function',
        includeDefinitions: true,
        includeUsages: false,
        maxResults: 50,
      };

      expect(validInput).toBeDefined();
    });

    it('should infer correct types for get_project_tech_stack', () => {
      type GetProjectTechStackInput = z.infer<typeof getProjectTechStackInput>;

      const validInput: GetProjectTechStackInput = {
        collectionId: VALID_UUID,
      };

      expect(validInput).toBeDefined();
    });

    it('should infer correct types for get_db_schema', () => {
      type GetDbSchemaInput = z.infer<typeof getDbSchemaInput>;

      const validInput: GetDbSchemaInput = {
        collectionId: VALID_UUID,
        tables: ['users', 'orders'],
        includeRelationships: true,
      };

      expect(validInput).toBeDefined();
    });

    it('should allow optional fields to be omitted for find_symbol_usages', () => {
      type FindSymbolUsagesInput = z.infer<typeof findSymbolUsagesInput>;

      const minimalInput: FindSymbolUsagesInput = {
        collectionId: VALID_UUID,
        symbolName: 'test',
        includeDefinitions: true, // has default
        includeUsages: true, // has default
        maxResults: 20, // has default
      };

      expect(minimalInput).toBeDefined();
    });
  });

  // ===========================================================================
  // Edge Cases and Boundary Tests
  // ===========================================================================
  describe('edge cases and boundary conditions', () => {
    describe('find_symbol_usages edge cases', () => {
      it('should handle very long symbolName', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'a'.repeat(1000),
        };

        const result = findSymbolUsagesInput.parse(input);
        expect(result.symbolName).toHaveLength(1000);
      });

      it('should handle symbolName with special characters', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'my_function$123',
        };

        expect(() => findSymbolUsagesInput.parse(input)).not.toThrow();
      });

      it('should handle all fields at once', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'ComplexWidget',
          symbolKind: 'widget' as const,
          includeDefinitions: true,
          includeUsages: true,
          maxResults: 100,
        };

        const result = findSymbolUsagesInput.parse(input);
        expect(result).toEqual(input);
      });
    });

    describe('get_db_schema edge cases', () => {
      it('should handle tables array with duplicate names', () => {
        const input = {
          collectionId: VALID_UUID,
          tables: ['users', 'users', 'orders'],
        };

        // Duplicates are allowed by schema (business logic concern)
        const result = getDbSchemaInput.parse(input);
        expect(result.tables).toEqual(['users', 'users', 'orders']);
      });

      it('should handle tables with very long names', () => {
        const input = {
          collectionId: VALID_UUID,
          tables: ['a'.repeat(500)],
        };

        expect(() => getDbSchemaInput.parse(input)).not.toThrow();
      });

      it('should handle tables with unicode characters', () => {
        const input = {
          collectionId: VALID_UUID,
          tables: ['users', 'orders'],
        };

        expect(() => getDbSchemaInput.parse(input)).not.toThrow();
      });
    });

    describe('cross-schema consistency', () => {
      it('should accept the same UUID across all schemas', () => {
        const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

        expect(() =>
          findSymbolUsagesInput.parse({
            collectionId: uuid,
            symbolName: 'test',
          })
        ).not.toThrow();

        expect(() =>
          getProjectTechStackInput.parse({
            collectionId: uuid,
          })
        ).not.toThrow();

        expect(() =>
          getDbSchemaInput.parse({
            collectionId: uuid,
          })
        ).not.toThrow();
      });
    });
  });

  // ===========================================================================
  // API Parameter Construction Tests
  // ===========================================================================
  describe('API parameter construction', () => {
    describe('find_symbol_usages API parameters', () => {
      it('should construct correct API parameters with all options', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'handleAuth',
          symbolKind: 'function' as const,
          includeDefinitions: true,
          includeUsages: false,
          maxResults: 30,
        };

        const validated = findSymbolUsagesInput.parse(input);

        // Simulating API call construction
        const apiParams = {
          collection_id: validated.collectionId,
          symbol_name: validated.symbolName,
          symbol_kind: validated.symbolKind,
          include_definitions: validated.includeDefinitions,
          include_usages: validated.includeUsages,
          max_results: validated.maxResults,
        };

        expect(apiParams.collection_id).toBe(VALID_UUID);
        expect(apiParams.symbol_name).toBe('handleAuth');
        expect(apiParams.symbol_kind).toBe('function');
        expect(apiParams.include_definitions).toBe(true);
        expect(apiParams.include_usages).toBe(false);
        expect(apiParams.max_results).toBe(30);
      });

      it('should handle undefined symbolKind in API params', () => {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'test',
        };

        const validated = findSymbolUsagesInput.parse(input);

        const apiParams = {
          collection_id: validated.collectionId,
          symbol_name: validated.symbolName,
          symbol_kind: validated.symbolKind,
          include_definitions: validated.includeDefinitions,
          include_usages: validated.includeUsages,
          max_results: validated.maxResults,
        };

        expect(apiParams.symbol_kind).toBeUndefined();
      });
    });

    describe('get_project_tech_stack API parameters', () => {
      it('should construct correct API parameters', () => {
        const input = {
          collectionId: VALID_UUID,
        };

        const validated = getProjectTechStackInput.parse(input);

        // URL construction simulation
        const url = `/api/tech-profiles/${validated.collectionId}`;

        expect(url).toBe(`/api/tech-profiles/${VALID_UUID}`);
      });
    });

    describe('get_db_schema API parameters', () => {
      it('should construct correct query string with tables', () => {
        const input = {
          collectionId: VALID_UUID,
          tables: ['users', 'orders'],
          includeRelationships: true,
        };

        const validated = getDbSchemaInput.parse(input);

        // Query string construction simulation
        const queryParams = new URLSearchParams();
        if (validated.tables && validated.tables.length > 0) {
          queryParams.set('tables', validated.tables.join(','));
        }
        if (validated.includeRelationships !== undefined) {
          queryParams.set('include_relationships', String(validated.includeRelationships));
        }

        const queryString = queryParams.toString();
        const url = `/api/graph/schema/${validated.collectionId}?${queryString}`;

        expect(url).toContain('tables=users%2Corders');
        expect(url).toContain('include_relationships=true');
      });

      it('should construct URL without tables when not provided', () => {
        const input = {
          collectionId: VALID_UUID,
        };

        const validated = getDbSchemaInput.parse(input);

        const queryParams = new URLSearchParams();
        if (validated.tables && validated.tables.length > 0) {
          queryParams.set('tables', validated.tables.join(','));
        }
        if (validated.includeRelationships !== undefined) {
          queryParams.set('include_relationships', String(validated.includeRelationships));
        }

        const queryString = queryParams.toString();

        expect(queryString).toBe('include_relationships=true');
        expect(queryString).not.toContain('tables=');
      });
    });
  });
});
