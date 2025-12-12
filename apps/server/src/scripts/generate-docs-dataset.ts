#!/usr/bin/env tsx
/**
 * Generate Lifer Docs Evaluation Dataset
 *
 * Extracts queries from the lifer repository's README.md and code comments
 * to create a documentation-focused evaluation dataset.
 *
 * Usage:
 *   pnpm generate:lifer-docs                           # Clone and generate
 *   pnpm generate:lifer-docs --repo-path /path/to/lifer # Use existing clone
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { simpleGit } from 'simple-git';
import type { EvalDataset, EvalQuery } from '../evaluation/types.js';

// =============================================================================
// Constants
// =============================================================================

const LIFER_REPO_URL = 'https://github.com/ahmedtohamy1/lifer';
const TEMP_CLONE_DIR = '/tmp/lifer-docs-gen';
const OUTPUT_FILE = 'perf/eval_datasets/lifer-docs.json';

const TARGET_QUERY_COUNT = 30;

// =============================================================================
// CLI
// =============================================================================

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      'repo-path': {
        type: 'string',
        description: 'Path to existing lifer clone',
      },
      'collection-id': {
        type: 'string',
        description: 'Collection ID to use in queries',
      },
      output: {
        type: 'string',
        short: 'o',
        default: OUTPUT_FILE,
      },
      verbose: {
        type: 'boolean',
        short: 'v',
        default: false,
      },
      help: {
        type: 'boolean',
        short: 'h',
        default: false,
      },
    },
  });

  return {
    repoPath: values['repo-path'] as string | undefined,
    collectionId: values['collection-id'] as string | undefined,
    output: values.output as string,
    verbose: values.verbose as boolean,
    help: values.help as boolean,
  };
}

function showHelp(): void {
  console.info(`
Generate Lifer Docs Evaluation Dataset

Usage: pnpm generate:lifer-docs [options]

Options:
  --repo-path <path>      Path to existing lifer clone (will clone if not provided)
  --collection-id <uuid>  Collection ID to use in queries
  -o, --output <path>     Output file path (default: ${OUTPUT_FILE})
  -v, --verbose           Show detailed progress
  -h, --help              Show this help

Examples:
  pnpm generate:lifer-docs
  pnpm generate:lifer-docs --repo-path ~/repos/lifer
  pnpm generate:lifer-docs --collection-id 05cab0fa-6c92-4ad3-9bf7-b0e4144081e2
`);
}

// =============================================================================
// Repository Handling
// =============================================================================

async function ensureRepoClone(repoPath?: string): Promise<string> {
  if (repoPath) {
    // Verify path exists
    await fs.access(repoPath);
    console.info(`Using existing clone: ${repoPath}`);
    return repoPath;
  }

  // Clone to temp directory
  console.info(`Cloning ${LIFER_REPO_URL} to ${TEMP_CLONE_DIR}...`);

  try {
    await fs.rm(TEMP_CLONE_DIR, { recursive: true, force: true });
  } catch {
    // Directory might not exist
  }

  await fs.mkdir(TEMP_CLONE_DIR, { recursive: true });
  const git = simpleGit();
  await git.clone(LIFER_REPO_URL, TEMP_CLONE_DIR, ['--depth', '1']);

  console.info('Clone complete');
  return TEMP_CLONE_DIR;
}

// =============================================================================
// README.md Parsing
// =============================================================================

interface MarkdownSection {
  title: string;
  level: number;
  content: string;
}

function parseMarkdownSections(content: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const lines = content.split('\n');

  let currentSection: MarkdownSection | null = null;
  let contentLines: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentLines.join('\n').trim();
        if (currentSection.content) {
          sections.push(currentSection);
        }
      }

      // Start new section
      currentSection = {
        title: headerMatch[2].trim(),
        level: headerMatch[1].length,
        content: '',
      };
      contentLines = [];
    } else if (currentSection) {
      contentLines.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentLines.join('\n').trim();
    if (currentSection.content) {
      sections.push(currentSection);
    }
  }

  return sections;
}

function generateReadmeQueries(sections: MarkdownSection[]): EvalQuery[] {
  const queries: EvalQuery[] = [];
  let queryIndex = 1;

  for (const section of sections) {
    if (!section.content || section.content.length < 50) continue;

    // Generate "What is X?" query for major sections
    if (section.level <= 2) {
      queries.push({
        id: `docs-readme-${queryIndex++}`,
        query: `What is ${section.title} in the lifer app?`,
        category: 'docs',
        difficulty: 'easy',
        queryType: 'conceptual',
        relevantDocIds: [], // Will be populated via GT expansion
        collectionId: '', // Will be set later
        requiredKeywords: extractKeywords(section.title),
        metadata: {
          source: 'synthetic',
          notes: `Generated from README section: ${section.title}`,
        },
      });
    }

    // Generate "How does X work?" for sections with code or steps
    if (
      section.content.includes('```') ||
      section.content.includes('1.') ||
      section.content.includes('-')
    ) {
      queries.push({
        id: `docs-readme-${queryIndex++}`,
        query: `How does ${section.title.toLowerCase()} work in lifer?`,
        category: 'docs',
        difficulty: 'medium',
        queryType: 'how-to',
        relevantDocIds: [],
        collectionId: '',
        requiredKeywords: extractKeywords(section.title),
        metadata: {
          source: 'synthetic',
          notes: `Generated from README section: ${section.title}`,
        },
      });
    }
  }

  return queries;
}

// =============================================================================
// pubspec.yaml Parsing
// =============================================================================

interface Dependency {
  name: string;
  version?: string;
  isDevDependency: boolean;
}

function parsePubspec(content: string): Dependency[] {
  const deps: Dependency[] = [];
  const lines = content.split('\n');

  let inDependencies = false;
  let inDevDependencies = false;

  for (const line of lines) {
    if (line.startsWith('dependencies:')) {
      inDependencies = true;
      inDevDependencies = false;
      continue;
    }
    if (line.startsWith('dev_dependencies:')) {
      inDependencies = false;
      inDevDependencies = true;
      continue;
    }
    if (line.match(/^[a-z_]+:/) && !line.startsWith(' ')) {
      inDependencies = false;
      inDevDependencies = false;
      continue;
    }

    if (inDependencies || inDevDependencies) {
      const match = line.match(/^\s+([a-z_]+):\s*(.*)$/);
      if (match) {
        deps.push({
          name: match[1],
          version: match[2] || undefined,
          isDevDependency: inDevDependencies,
        });
      }
    }
  }

  return deps;
}

function generatePubspecQueries(deps: Dependency[]): EvalQuery[] {
  const queries: EvalQuery[] = [];
  let queryIndex = 1;

  // Filter to interesting dependencies
  const interestingDeps = deps.filter((d) => {
    const skipList = ['flutter', 'cupertino_icons', 'flutter_test', 'flutter_lints'];
    return !skipList.includes(d.name) && !d.isDevDependency;
  });

  for (const dep of interestingDeps.slice(0, 10)) {
    queries.push({
      id: `docs-dep-${queryIndex++}`,
      query: `How does lifer use ${dep.name}?`,
      category: 'docs',
      difficulty: 'medium',
      queryType: 'how-to',
      relevantDocIds: [],
      collectionId: '',
      requiredKeywords: [dep.name],
      metadata: {
        source: 'synthetic',
        notes: `Generated from pubspec.yaml dependency: ${dep.name}`,
      },
    });
  }

  return queries;
}

// =============================================================================
// Dart Doc Comments Extraction
// =============================================================================

interface DocComment {
  className?: string;
  methodName?: string;
  comment: string;
  filePath: string;
}

function extractDartDocComments(content: string, filePath: string): DocComment[] {
  const comments: DocComment[] = [];
  const lines = content.split('\n');

  let currentComment: string[] = [];
  let inComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('///')) {
      inComment = true;
      currentComment.push(trimmed.slice(3).trim());
    } else if (inComment && currentComment.length > 0) {
      // Check what follows the comment
      const nextNonEmpty = findNextNonEmptyLine(lines, i);

      if (nextNonEmpty) {
        const classMatch = nextNonEmpty.match(/^class\s+(\w+)/);
        const methodMatch = nextNonEmpty.match(/^(?:void|Future|Stream|Widget|\w+)\s+(\w+)\s*\(/);

        if (classMatch || methodMatch) {
          comments.push({
            className: classMatch?.[1],
            methodName: methodMatch?.[1],
            comment: currentComment.join(' '),
            filePath,
          });
        }
      }

      currentComment = [];
      inComment = false;
    }
  }

  return comments;
}

function findNextNonEmptyLine(lines: string[], startIndex: number): string | null {
  for (let i = startIndex; i < Math.min(startIndex + 5, lines.length); i++) {
    const trimmed = lines[i].trim();
    if (trimmed && !trimmed.startsWith('///') && !trimmed.startsWith('//')) {
      return trimmed;
    }
  }
  return null;
}

function generateDocCommentQueries(comments: DocComment[]): EvalQuery[] {
  const queries: EvalQuery[] = [];
  let queryIndex = 1;

  // Filter to significant comments
  const significantComments = comments.filter(
    (c) => c.comment.length > 30 && (c.className || c.methodName)
  );

  for (const comment of significantComments.slice(0, 15)) {
    const subject = comment.className ?? comment.methodName ?? null;
    if (!subject) {
      continue;
    }

    queries.push({
      id: `docs-comment-${queryIndex++}`,
      query: `What does ${subject} do in lifer?`,
      category: 'docs',
      difficulty: 'medium',
      queryType: 'conceptual',
      relevantDocIds: [],
      collectionId: '',
      requiredKeywords: [subject.toLowerCase()],
      metadata: {
        source: 'synthetic',
        notes: `Generated from doc comment in ${comment.filePath}`,
        sourceDocTitle: path.basename(comment.filePath),
      },
    });
  }

  return queries;
}

// =============================================================================
// Feature-Based Queries
// =============================================================================

function generateFeatureQueries(): EvalQuery[] {
  // Manually crafted queries based on typical Flutter/Supabase app features
  return [
    {
      id: 'docs-feature-1',
      query: 'How is authentication implemented in lifer?',
      category: 'docs',
      difficulty: 'medium',
      queryType: 'how-to',
      relevantDocIds: [],
      collectionId: '',
      requiredKeywords: ['auth', 'login'],
    },
    {
      id: 'docs-feature-2',
      query: 'What state management does lifer use?',
      category: 'docs',
      difficulty: 'easy',
      queryType: 'factual',
      relevantDocIds: [],
      collectionId: '',
      requiredKeywords: ['state', 'riverpod', 'provider'],
    },
    {
      id: 'docs-feature-3',
      query: 'How does lifer handle navigation?',
      category: 'docs',
      difficulty: 'medium',
      queryType: 'how-to',
      relevantDocIds: [],
      collectionId: '',
      requiredKeywords: ['navigate', 'route'],
    },
    {
      id: 'docs-feature-4',
      query: 'What database does lifer use?',
      category: 'docs',
      difficulty: 'easy',
      queryType: 'factual',
      relevantDocIds: [],
      collectionId: '',
      requiredKeywords: ['supabase', 'database'],
    },
    {
      id: 'docs-feature-5',
      query: 'How are notifications handled in lifer?',
      category: 'docs',
      difficulty: 'medium',
      queryType: 'how-to',
      relevantDocIds: [],
      collectionId: '',
      requiredKeywords: ['notification'],
    },
    {
      id: 'docs-feature-6',
      query: 'What is the app architecture of lifer?',
      category: 'docs',
      difficulty: 'hard',
      queryType: 'conceptual',
      relevantDocIds: [],
      collectionId: '',
      requiredKeywords: ['architecture', 'structure'],
    },
    {
      id: 'docs-feature-7',
      query: 'How does lifer store user preferences?',
      category: 'docs',
      difficulty: 'medium',
      queryType: 'how-to',
      relevantDocIds: [],
      collectionId: '',
      requiredKeywords: ['shared', 'preferences', 'store'],
    },
    {
      id: 'docs-feature-8',
      query: 'What themes and styling does lifer support?',
      category: 'docs',
      difficulty: 'easy',
      queryType: 'conceptual',
      relevantDocIds: [],
      collectionId: '',
      requiredKeywords: ['theme', 'style', 'color'],
    },
  ];
}

// =============================================================================
// Utilities
// =============================================================================

function extractKeywords(text: string): string[] {
  // Extract meaningful words from text
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .filter((word) => !['with', 'from', 'this', 'that', 'what', 'does'].includes(word))
    .slice(0, 3);
}

function deduplicateQueries(queries: EvalQuery[]): EvalQuery[] {
  const seen = new Set<string>();
  return queries.filter((q) => {
    const key = q.query.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = parseCliArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.info('='.repeat(60));
  console.info('LIFER DOCS DATASET GENERATOR');
  console.info('='.repeat(60));

  // Get repo
  const repoPath = await ensureRepoClone(args.repoPath);

  const allQueries: EvalQuery[] = [];

  // 1. Parse README.md
  console.info('\n1. Parsing README.md...');
  try {
    const readmePath = path.join(repoPath, 'README.md');
    const readmeContent = await fs.readFile(readmePath, 'utf-8');
    const sections = parseMarkdownSections(readmeContent);
    const readmeQueries = generateReadmeQueries(sections);
    allQueries.push(...readmeQueries);
    console.info(`   Found ${readmeQueries.length} queries from README`);
  } catch (error) {
    console.info('   README.md not found or empty');
  }

  // 2. Parse pubspec.yaml
  console.info('\n2. Parsing pubspec.yaml...');
  try {
    const pubspecPath = path.join(repoPath, 'pubspec.yaml');
    const pubspecContent = await fs.readFile(pubspecPath, 'utf-8');
    const deps = parsePubspec(pubspecContent);
    const pubspecQueries = generatePubspecQueries(deps);
    allQueries.push(...pubspecQueries);
    console.info(`   Found ${pubspecQueries.length} queries from dependencies`);
  } catch (error) {
    console.info('   pubspec.yaml not found');
  }

  // 3. Extract doc comments
  console.info('\n3. Extracting doc comments from Dart files...');
  const dartFiles = await findDartFiles(repoPath);
  const allComments: DocComment[] = [];

  for (const dartFile of dartFiles.slice(0, 50)) {
    try {
      const content = await fs.readFile(dartFile, 'utf-8');
      const relativePath = path.relative(repoPath, dartFile);
      const comments = extractDartDocComments(content, relativePath);
      allComments.push(...comments);
    } catch {
      // Skip files that can't be read
    }
  }

  const commentQueries = generateDocCommentQueries(allComments);
  allQueries.push(...commentQueries);
  console.info(`   Found ${commentQueries.length} queries from doc comments`);

  // 4. Add feature-based queries
  console.info('\n4. Adding feature-based queries...');
  const featureQueries = generateFeatureQueries();
  allQueries.push(...featureQueries);
  console.info(`   Added ${featureQueries.length} feature queries`);

  // 5. Deduplicate and limit
  console.info('\n5. Deduplicating and finalizing...');
  let finalQueries = deduplicateQueries(allQueries);

  // Set collection ID if provided
  if (args.collectionId) {
    const cid = args.collectionId;
    finalQueries = finalQueries.map((q) => ({
      ...q,
      collectionId: cid,
    }));
  }

  // Limit to target count
  if (finalQueries.length > TARGET_QUERY_COUNT) {
    finalQueries = finalQueries.slice(0, TARGET_QUERY_COUNT);
  }

  console.info(`   Final query count: ${finalQueries.length}`);

  // 6. Create dataset
  const dataset: EvalDataset = {
    metadata: {
      name: 'lifer-docs-eval',
      description: 'Documentation queries extracted from lifer README, pubspec, and code comments',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      source: 'synthetic',
    },
    queries: finalQueries,
  };

  // 7. Save dataset
  const outputPath = path.join(process.cwd(), args.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(dataset, null, 2));

  console.info(`\nDataset saved to: ${outputPath}`);
  console.info(`Total queries: ${finalQueries.length}`);

  // Summary by type
  const byType: Record<string, number> = {};
  for (const q of finalQueries) {
    byType[q.queryType] = (byType[q.queryType] || 0) + 1;
  }
  console.info('\nBy query type:');
  for (const [type, count] of Object.entries(byType)) {
    console.info(`  ${type}: ${count}`);
  }

  // Cleanup temp clone
  if (!args.repoPath && repoPath === TEMP_CLONE_DIR) {
    console.info('\nCleaning up temp clone...');
    await fs.rm(TEMP_CLONE_DIR, { recursive: true, force: true });
  }

  console.info('\nDone!');
  console.info('\nNext steps:');
  console.info('  1. Review and edit the generated queries');
  console.info('  2. Run ground truth expansion:');
  console.info('     pnpm eval:expand-gt --dataset perf/eval_datasets/lifer-docs.json');
}

async function findDartFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Skip common non-source directories
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'build', '.dart_tool', '.idea'].includes(entry.name)) {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.dart')) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
