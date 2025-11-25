import type {
  BackendAST,
  ColumnDefinition,
  ConstraintDefinition,
  FunctionDefinition,
  IndexDefinition,
  TableDefinition,
} from '@synthesis/shared';

/**
 * PostgreSQL DDL Parser - Regex-based extraction for SQL schema files
 * Extracts tables, indexes, and constraints from PostgreSQL DDL statements
 */

type Column = ColumnDefinition & { constraints: string[] };

/**
 * Represents a table-level constraint (PRIMARY KEY, UNIQUE, CHECK, FOREIGN KEY)
 */
export interface TableConstraint extends ConstraintDefinition {
  referencedTable?: string;
  referencedColumns?: string[];
  onDelete?: string;
  onUpdate?: string;
}

const INDEX_METHODS = ['btree', 'hash', 'gist', 'gin', 'brin', 'spgist'] as const;
type IndexMethod = (typeof INDEX_METHODS)[number];

function normalizeIndexMethod(method?: string): IndexMethod | undefined {
  if (!method) return undefined;
  const lower = method.toLowerCase();
  return (INDEX_METHODS as readonly string[]).includes(lower) ? (lower as IndexMethod) : undefined;
}

export interface PolicyDefinition extends FunctionDefinition {
  table: string;
  roles?: string[];
  cmd?: string;
}

/**
 * Parse PostgreSQL DDL file and extract tables, indexes, constraints, and RLS policies.
 * Returns BackendAST structure compatible with existing chunking pipeline.
 *
 * @param content - SQL file content
 * @param filePath - Optional file path for error reporting
 * @returns BackendAST with extracted SQL structures
 */
export async function parseSQLFile(content: string, filePath?: string): Promise<BackendAST> {
  const ast: BackendAST = {
    tables: [],
    indexes: [],
    functions: [],
    constraints: [],
  };

  try {
    // Remove comments before processing
    const cleanedContent = removeComments(content);

    // Extract CREATE TABLE statements
    ast.tables = extractTables(content, cleanedContent);

    // Extract CREATE INDEX statements
    ast.indexes = extractIndexes(content, cleanedContent);

    // Extract CREATE FUNCTION/PROCEDURE statements
    ast.functions = extractFunctions(content, cleanedContent);

    // Extract CREATE POLICY statements (treated as functions for chunking purposes)
    const policies = extractPolicies(content, cleanedContent);
    ast.functions.push(...policies);

    // Process ALTER TABLE statements and attach to existing tables
    processAlterStatements(content, cleanedContent, ast.tables);

    ast.constraints = ast.tables.flatMap((table) => table.constraints ?? []);

    return ast;
  } catch (error) {
    // Graceful degradation: return partial AST on error
    console.warn(`Failed to parse SQL file${filePath ? ` ${filePath}` : ''}: ${error}`);
    return ast;
  }
}

/**
 * Extract CREATE POLICY statements (RLS)
 *
 * @param originalContent - Original content (for line ranges)
 * @param cleanedContent - Cleaned content (for parsing)
 * @returns Array of policy definitions (mapped to FunctionDefinition structure)
 */
function extractPolicies(originalContent: string, cleanedContent: string): FunctionDefinition[] {
  const policies: FunctionDefinition[] = [];
  const createPolicyRegex =
    /CREATE\s+POLICY\s+"?([^"\s]+)"?\s+ON\s+([^\s]+)\s+(?:AS\s+(\w+)\s+)?(?:FOR\s+(\w+)\s+)?(?:TO\s+([^\s]+)\s+)?(?:USING\s*\(([^)]+)\))?(?:\s+WITH\s+CHECK\s*\(([^)]+)\))?/gi;

  let match: RegExpExecArray | null;
  while ((match = createPolicyRegex.exec(cleanedContent)) !== null) {
    const startIndex = match.index;
    const name = match[1];
    const tableRef = parseTableReference(match[2]);
    const type = match[3] || 'PERMISSIVE'; // PERMISSIVE | RESTRICTIVE
    const cmd = match[4] || 'ALL'; // SELECT | INSERT | UPDATE | DELETE | ALL
    // TODO: Add roles, using, and withCheck to PolicyDefinition metadata when needed
    // const roles = match[5] ? match[5].split(',').map((r) => r.trim()) : ['PUBLIC'];
    // const using = match[6];
    // const withCheck = match[7];

    const statementEnd = findStatementEnd(cleanedContent, startIndex);
    const endIndex = statementEnd !== -1 ? statementEnd + 1 : startIndex + match[0].length;

    const code = originalContent.substring(startIndex, endIndex).trim();
    const lineRange = getLineRange(originalContent, startIndex, endIndex);

    policies.push({
      name: `POLICY: ${name}`,
      schema: tableRef.schema,
      // Store policy specifics in available fields or extend AST later
      // For now, we map to FunctionDefinition to reuse the chunker
      return_type: `RLS ${type} FOR ${cmd}`,
      language: 'sql',
      code,
      lineRange,
      startOffset: startIndex,
      endOffset: endIndex,
    });
  }

  return policies;
}

/**
 * Remove SQL comments from content while preserving structure.
 * Handles both single-line (--) and multi-line (slash-star) comments.
 * Used for easier parsing, but line numbers are calculated from original content.
 *
 * @param content - Original SQL content
 * @returns Content with comments replaced by spaces to preserve offsets
 */
function removeComments(content: string): string {
  let result = '';
  let i = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let dollarTag = '';

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1] || '';

    // Handle dollar-quoted strings ($$text$$ or $tag$text$tag$)
    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '$') {
        // Extract dollar quote tag
        const tagMatch = content.substring(i).match(/^(\$\w*\$)/);
        if (tagMatch) {
          const tag = tagMatch[1];
          if (!inDollarQuote) {
            // Start of dollar quote
            inDollarQuote = true;
            dollarTag = tag;
            result += tag;
            i += tag.length;
            continue;
          }

          if (tag === dollarTag) {
            // End of dollar quote
            inDollarQuote = false;
            dollarTag = '';
            result += tag;
            i += tag.length;
            continue;
          }
        }
      }
    }

    // Handle single and double quotes
    if (!inDollarQuote) {
      if (char === "'" && !isEscaped(content, i)) {
        inSingleQuote = !inSingleQuote;
        result += char;
        i++;
        continue;
      }

      if (char === '"' && !isEscaped(content, i)) {
        inDoubleQuote = !inDoubleQuote;
        result += char;
        i++;
        continue;
      }
    }

    // Handle comments only if not in strings
    if (!inSingleQuote && !inDoubleQuote && !inDollarQuote) {
      // Multi-line comment /* */
      if (char === '/' && nextChar === '*') {
        result += '  '; // Replace with spaces to preserve offsets
        i += 2;
        while (i < content.length) {
          if (content[i] === '*' && content[i + 1] === '/') {
            result += '  ';
            i += 2;
            break;
          }
          // Preserve newlines for line counting
          result += content[i] === '\n' ? '\n' : ' ';
          i++;
        }
        continue;
      }

      // Single-line comment --
      if (char === '-' && nextChar === '-') {
        result += '  ';
        i += 2;
        while (i < content.length && content[i] !== '\n') {
          result += ' ';
          i++;
        }
        if (i < content.length) {
          result += '\n';
          i++;
        }
        continue;
      }
    }

    result += char;
    i++;
  }

  return result;
}

/**
 * Check if character at index is escaped by backslash
 */
function isEscaped(content: string, index: number): boolean {
  let backslashCount = 0;
  for (let i = index - 1; i >= 0 && content[i] === '\\'; i--) {
    backslashCount++;
  }
  return backslashCount % 2 === 1;
}

/**
 * Find the end of a SQL statement (semicolon outside strings and comments)
 *
 * @param content - SQL content
 * @param startIndex - Starting position
 * @returns Index of semicolon, or -1 if not found
 */
function findStatementEnd(content: string, startIndex: number): number {
  let i = startIndex;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let dollarTag = '';

  while (i < content.length) {
    const char = content[i];

    // Handle dollar-quoted strings
    if (!inSingleQuote && !inDoubleQuote) {
      const tagMatch = content.substring(i).match(/^(\$\w*\$)/);
      if (tagMatch) {
        const tag = tagMatch[1];
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
          i += tag.length;
          continue;
        }

        if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
          i += tag.length;
          continue;
        }
      }
    }

    // Handle quotes
    if (!inDollarQuote) {
      if (char === "'" && !isEscaped(content, i)) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !isEscaped(content, i)) {
        inDoubleQuote = !inDoubleQuote;
      }
    }

    // Check for semicolon outside strings
    if (!inSingleQuote && !inDoubleQuote && !inDollarQuote && char === ';') {
      return i;
    }

    i++;
  }

  return -1;
}

/**
 * Calculate line range from character offsets
 *
 * @param content - Full content
 * @param start - Start offset
 * @param end - End offset
 * @returns Tuple of [startLine, endLine] (1-indexed)
 */
function getLineRange(content: string, start: number, end: number): [number, number] {
  const beforeStart = content.substring(0, start);
  const beforeEnd = content.substring(0, end);
  const startLine = beforeStart.split('\n').length;
  const endLine = beforeEnd.split('\n').length;
  return [startLine, endLine];
}

/**
 * Extract table name with optional schema qualifier
 *
 * @param tableRef - Table reference (e.g., "users", "public.users", "\"my table\"")
 * @returns Object with schema and table name
 */
function parseTableReference(tableRef: string): { schema?: string; table: string } {
  const trimmed = tableRef.trim();

  // Handle schema.table
  const parts = trimmed.split('.');
  if (parts.length === 2) {
    return {
      schema: unquoteIdentifier(parts[0]),
      table: unquoteIdentifier(parts[1]),
    };
  }

  return {
    table: unquoteIdentifier(trimmed),
  };
}

/**
 * Remove quotes from SQL identifiers
 *
 * @param identifier - Quoted or unquoted identifier
 * @returns Unquoted identifier
 */
function unquoteIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.substring(1, trimmed.length - 1);
  }
  return trimmed;
}

/**
 * Extract CREATE TABLE statements and parse table definitions
 *
 * @param originalContent - Original content with comments (for line ranges)
 * @param cleanedContent - Content with comments removed (for parsing)
 * @returns Array of table definitions
 */
function extractTables(originalContent: string, cleanedContent: string): TableDefinition[] {
  const tables: TableDefinition[] = [];
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s(]+)\s*\(/gi;

  let match: RegExpExecArray | null;
  while ((match = createTableRegex.exec(cleanedContent)) !== null) {
    const startIndex = match.index;
    const tableRef = match[1];
    const { schema, table } = parseTableReference(tableRef);

    // Find the matching closing parenthesis
    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = findMatchingParenthesis(cleanedContent, openParenIndex);

    if (closeParenIndex === -1) {
      continue; // Malformed table definition
    }

    // Find statement end (semicolon)
    const semicolonIndex = findStatementEnd(cleanedContent, closeParenIndex);
    const endIndex = semicolonIndex !== -1 ? semicolonIndex + 1 : closeParenIndex + 1;

    // Extract table body (between parentheses)
    const tableBody = cleanedContent.substring(openParenIndex + 1, closeParenIndex);

    // Parse columns and constraints
    const { columns, constraints } = parseTableDefinition(tableBody);

    // Extract code from original content
    const code = originalContent.substring(startIndex, endIndex).trim();
    const lineRange = getLineRange(originalContent, startIndex, endIndex);

    tables.push({
      name: table,
      schema,
      columns,
      constraints,
      code,
      lineRange,
      startOffset: startIndex,
      endOffset: endIndex,
    });
  }

  return tables;
}

/**
 * Find matching closing parenthesis, accounting for nested parentheses and strings
 *
 * @param content - Content to search
 * @param startIndex - Index of opening parenthesis
 * @returns Index of matching closing parenthesis, or -1 if not found
 */
function findMatchingParenthesis(content: string, startIndex: number): number {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let dollarTag = '';
  let i = startIndex;

  while (i < content.length) {
    const char = content[i];

    // Handle dollar quotes
    if (!inSingleQuote && !inDoubleQuote) {
      const tagMatch = content.substring(i).match(/^(\$\w*\$)/);
      if (tagMatch) {
        const tag = tagMatch[1];
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
          i += tag.length;
          continue;
        }

        if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
          i += tag.length;
          continue;
        }
      }
    }

    // Handle quotes
    if (!inDollarQuote) {
      if (char === "'" && !isEscaped(content, i)) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !isEscaped(content, i)) {
        inDoubleQuote = !inDoubleQuote;
      }
    }

    // Count parentheses only if not in strings
    if (!inSingleQuote && !inDoubleQuote && !inDollarQuote) {
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }

    i++;
  }

  return -1;
}

/**
 * Parse table definition body (columns and constraints)
 *
 * @param tableBody - Content between CREATE TABLE parentheses
 * @returns Object with columns and constraints arrays
 */
function parseTableDefinition(tableBody: string): {
  columns: Column[];
  constraints: TableConstraint[];
} {
  const columns: Column[] = [];
  const constraints: TableConstraint[] = [];

  // Split by commas at the top level (not inside parentheses or strings)
  const items = splitByTopLevelComma(tableBody);

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    // Check if it's a constraint
    const constraintMatch = trimmed.match(
      /^(?:CONSTRAINT\s+([^\s]+)\s+)?(PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)\s*\((.+)\)/i
    );

    if (constraintMatch) {
      const constraintName = constraintMatch[1];
      const constraintType = constraintMatch[2]
        .toUpperCase()
        .replace(/\s+/g, ' ') as TableConstraint['type'];
      const constraintDef = constraintMatch[3];

      const constraint: TableConstraint = {
        type: constraintType,
        name: constraintName ? unquoteIdentifier(constraintName) : undefined,
        definition: trimmed,
      };

      // Extract columns for PRIMARY KEY and UNIQUE
      if (constraintType === 'PRIMARY KEY' || constraintType === 'UNIQUE') {
        constraint.columns = constraintDef.split(',').map((c) => unquoteIdentifier(c.trim()));
      }

      // Parse FOREIGN KEY
      if (constraintType === 'FOREIGN KEY') {
        const fkMatch = trimmed.match(
          /FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(\w+(?:\s+\w+)?))?(?:\s+ON\s+UPDATE\s+(\w+(?:\s+\w+)?))?/i
        );

        if (fkMatch) {
          constraint.columns = fkMatch[1].split(',').map((c) => unquoteIdentifier(c.trim()));
          const refTable = parseTableReference(fkMatch[2]);
          constraint.referencedTable = refTable.table;
          constraint.referencedColumns = fkMatch[3]
            .split(',')
            .map((c) => unquoteIdentifier(c.trim()));
          constraint.onDelete = fkMatch[4];
          constraint.onUpdate = fkMatch[5];
        }
      }

      constraints.push(constraint);
    } else {
      // It's a column definition
      const column = parseColumnDefinition(trimmed);
      if (column) {
        columns.push(column);
      }
    }
  }

  return { columns, constraints };
}

/**
 * Split string by top-level commas (not inside parentheses or strings)
 *
 * @param content - Content to split
 * @returns Array of items
 */
function splitByTopLevelComma(content: string): string[] {
  const items: string[] = [];
  let current = '';
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let dollarTag = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (!inSingleQuote && !inDoubleQuote) {
      const tagMatch = content.substring(i).match(/^(\$\w*\$)/);
      if (tagMatch) {
        const tag = tagMatch[1];
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
          current += tag;
          i += tag.length - 1;
          continue;
        }
        if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
          current += tag;
          i += tag.length - 1;
          continue;
        }
      }
    }

    if (!inDollarQuote) {
      if (char === "'" && !isEscaped(content, i)) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !isEscaped(content, i)) {
        inDoubleQuote = !inDoubleQuote;
      }
    }

    if (!inSingleQuote && !inDoubleQuote && !inDollarQuote) {
      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
      }
    }

    if (char === ',' && depth === 0 && !inSingleQuote && !inDoubleQuote && !inDollarQuote) {
      items.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    items.push(current);
  }

  return items;
}

/**
 * Parse a column definition line
 *
 * @param columnDef - Column definition string
 * @returns Column object or null if invalid
 */
function parseColumnDefinition(columnDef: string): Column | null {
  const match = columnDef.match(/^(\S+)\s+(.+)$/i);
  if (!match) return null;

  const name = unquoteIdentifier(match[1]);
  const remainder = match[2].trim();
  const constraintStart = findConstraintStart(remainder);
  const type = (constraintStart === -1 ? remainder : remainder.slice(0, constraintStart)).trim();
  const constraintsStr = constraintStart === -1 ? '' : remainder.slice(constraintStart).trim();

  if (!type) {
    return null;
  }

  const constraints: string[] = [];

  // Extract inline constraints
  if (/\bPRIMARY\s+KEY\b/i.test(constraintsStr)) {
    constraints.push('PRIMARY KEY');
  }
  if (/\bUNIQUE\b/i.test(constraintsStr)) {
    constraints.push('UNIQUE');
  }
  if (/\bNOT\s+NULL\b/i.test(constraintsStr)) {
    constraints.push('NOT NULL');
  }
  if (/\bNULL\b/i.test(constraintsStr) && !/NOT\s+NULL/i.test(constraintsStr)) {
    constraints.push('NULL');
  }

  // Extract DEFAULT
  const defaultMatch = constraintsStr.match(
    /DEFAULT\s+(.+?)(?:,|\s+(?:NOT\s+NULL|UNIQUE|CHECK|REFERENCES|PRIMARY\s+KEY)|$)/i
  );
  if (defaultMatch) {
    constraints.push(`DEFAULT ${defaultMatch[1].trim()}`);
  }

  // Extract CHECK
  const checkMatch = constraintsStr.match(/CHECK\s*\(([^)]+)\)/i);
  if (checkMatch) {
    constraints.push(`CHECK (${checkMatch[1]})`);
  }

  // Extract REFERENCES (inline foreign key)
  const refMatch = constraintsStr.match(
    /REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(\w+(?:\s+\w+)?))?(?:\s+ON\s+UPDATE\s+(\w+(?:\s+\w+)?))?/i
  );
  if (refMatch) {
    let refConstraint = `REFERENCES ${refMatch[1]}(${refMatch[2]})`;
    if (refMatch[3]) refConstraint += ` ON DELETE ${refMatch[3]}`;
    if (refMatch[4]) refConstraint += ` ON UPDATE ${refMatch[4]}`;
    constraints.push(refConstraint);
  }

  return { name, type, constraints };
}

const CONSTRAINT_KEYWORDS = [
  'primary key',
  'not null',
  'unique',
  'default',
  'check',
  'references',
  'constraint',
  'collate',
  'generated',
  'comment',
] as const;

function findConstraintStart(definition: string): number {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let dollarTag = '';
  let depth = 0;

  for (let i = 0; i < definition.length; i++) {
    const char = definition[i];

    if (!inSingleQuote && !inDoubleQuote) {
      const tagMatch = definition.substring(i).match(/^(\$\w*\$)/);
      if (tagMatch) {
        const tag = tagMatch[1];
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = tag;
          i += tag.length - 1;
          continue;
        }

        if (tag === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
          i += tag.length - 1;
          continue;
        }
      }
    }

    if (!inDollarQuote) {
      if (char === "'" && !isEscaped(definition, i)) {
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (char === '"' && !isEscaped(definition, i)) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
    }

    if (inSingleQuote || inDoubleQuote || inDollarQuote) {
      continue;
    }

    if (char === '(') {
      depth++;
      continue;
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0) {
      const keywordIndex = matchConstraintKeyword(definition, i);
      if (keywordIndex !== undefined) {
        return keywordIndex;
      }
    }
  }

  return -1;
}

function matchConstraintKeyword(source: string, index: number): number | undefined {
  let i = index;
  while (i < source.length && /\s/.test(source[i])) {
    i++;
  }

  for (const keyword of CONSTRAINT_KEYWORDS) {
    if (source.slice(i, i + keyword.length).toLowerCase() === keyword) {
      const beforeIdx = i - 1;
      if (beforeIdx >= 0 && /[a-z0-9_$]/i.test(source[beforeIdx])) {
        continue;
      }
      const afterIdx = i + keyword.length;
      if (afterIdx < source.length && /[a-z0-9_$]/i.test(source[afterIdx])) {
        continue;
      }
      return i;
    }
  }

  return undefined;
}

/**
 * Extract CREATE INDEX statements
 *
 * @param originalContent - Original content (for line ranges)
 * @param cleanedContent - Cleaned content (for parsing)
 * @returns Array of index definitions
 */
function extractIndexes(originalContent: string, cleanedContent: string): IndexDefinition[] {
  const indexes: IndexDefinition[] = [];
  const createIndexRegex =
    /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s]+)\s+ON\s+([^\s(]+)\s*(?:USING\s+(\w+)\s*)?\(([^)]+)\)(?:\s+WHERE\s+(.+?))?(?=;|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = createIndexRegex.exec(cleanedContent)) !== null) {
    const unique = !!match[1];
    const name = unquoteIdentifier(match[2]);
    const tableRef = parseTableReference(match[3]);
    const method = normalizeIndexMethod(match[4]);
    const columnsStr = match[5];
    const whereClause = match[6];

    const startIndex = match.index;
    const semicolonIndex = findStatementEnd(cleanedContent, startIndex);
    const endIndex = semicolonIndex !== -1 ? semicolonIndex + 1 : match.index + match[0].length;

    const code = originalContent.substring(startIndex, endIndex).trim();
    const lineRange = getLineRange(originalContent, startIndex, endIndex);

    // Parse columns (can be expressions, not just column names)
    const columns = columnsStr.split(',').map((c) => c.trim());

    indexes.push({
      name,
      table: tableRef.table,
      columns,
      unique,
      index_type: method,
      where_clause: whereClause?.trim(),
      lineRange,
      code,
      startOffset: startIndex,
      endOffset: endIndex,
    });
  }

  return indexes;
}

/**
 * Extract CREATE FUNCTION/PROCEDURE statements
 *
 * @param originalContent - Original content (for line ranges)
 * @param cleanedContent - Cleaned content (for parsing)
 * @returns Array of function definitions
 */
function extractFunctions(originalContent: string, cleanedContent: string): FunctionDefinition[] {
  const functions: FunctionDefinition[] = [];
  const createFunctionRegex =
    /CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\s+([^\s(]+)\s*\(/gi;

  let match: RegExpExecArray | null;
  while ((match = createFunctionRegex.exec(cleanedContent)) !== null) {
    const startIndex = match.index;
    const funcRef = match[1];
    const { schema, table: name } = parseTableReference(funcRef);

    const statementEnd = findStatementEnd(cleanedContent, startIndex);
    const endIndex = statementEnd !== -1 ? statementEnd + 1 : startIndex + match[0].length;
    const functionBody = cleanedContent.substring(startIndex, endIndex);

    // Extract return type
    const returnTypeMatch = functionBody.match(/RETURNS\s+([^\s]+)/i);
    const returnType = returnTypeMatch ? returnTypeMatch[1] : undefined;

    // Extract language
    const languageMatch = functionBody.match(/LANGUAGE\s+(\w+)/i);
    const language = languageMatch ? languageMatch[1] : undefined;

    const code = originalContent.substring(startIndex, endIndex).trim();
    const lineRange = getLineRange(originalContent, startIndex, endIndex);

    functions.push({
      name,
      schema,
      return_type: returnType,
      language,
      code,
      lineRange,
      startOffset: startIndex,
      endOffset: endIndex,
    });
  }

  return functions;
}

/**
 * Process ALTER TABLE statements and attach constraints/modifications to existing tables
 *
 * @param _originalContent - Original content (reserved for future line range tracking)
 * @param cleanedContent - Cleaned content
 * @param tables - Existing tables array to modify
 */
function processAlterStatements(
  _originalContent: string,
  cleanedContent: string,
  tables: TableDefinition[]
): void {
  const alterTableRegex =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([^\s]+)\s+(ADD|DROP|ALTER)\s+(.+?)(?=;|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = alterTableRegex.exec(cleanedContent)) !== null) {
    const tableRef = parseTableReference(match[1]);
    const action = match[2].toUpperCase();
    const definition = match[3].trim();

    // Find the table in our extracted tables
    const table = tables.find(
      (t) => t.name === tableRef.table && (!tableRef.schema || t.schema === tableRef.schema)
    );

    if (!table) continue; // Table not found, skip
    if (!table.constraints) {
      table.constraints = [];
    }

    if (action === 'ADD') {
      // ADD CONSTRAINT
      const constraintMatch = definition.match(
        /^(?:CONSTRAINT\s+([^\s]+)\s+)?(PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)\s*\((.+)\)/i
      );

      if (constraintMatch) {
        const constraintName = constraintMatch[1];
        const constraintType = constraintMatch[2]
          .toUpperCase()
          .replace(/\s+/g, ' ') as TableConstraint['type'];
        const constraintDef = constraintMatch[3];

        const constraint: TableConstraint = {
          type: constraintType,
          name: constraintName ? unquoteIdentifier(constraintName) : undefined,
          definition: definition,
        };

        if (constraintType === 'PRIMARY KEY' || constraintType === 'UNIQUE') {
          constraint.columns = constraintDef.split(',').map((c) => unquoteIdentifier(c.trim()));
        }

        if (constraintType === 'FOREIGN KEY') {
          const fkMatch = definition.match(
            /FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(\w+(?:\s+\w+)?))?(?:\s+ON\s+UPDATE\s+(\w+(?:\s+\w+)?))?/i
          );

          if (fkMatch) {
            constraint.columns = fkMatch[1].split(',').map((c) => unquoteIdentifier(c.trim()));
            const refTable = parseTableReference(fkMatch[2]);
            constraint.referencedTable = refTable.table;
            constraint.referencedColumns = fkMatch[3]
              .split(',')
              .map((c) => unquoteIdentifier(c.trim()));
            constraint.onDelete = fkMatch[4];
            constraint.onUpdate = fkMatch[5];
          }
        }

        table.constraints.push(constraint);
      }

      // ADD COLUMN
      const columnMatch = definition.match(/^COLUMN\s+(.+)/i);
      if (columnMatch) {
        const column = parseColumnDefinition(columnMatch[1]);
        if (column) {
          table.columns.push(column);
        }
      }
    }
  }
}
