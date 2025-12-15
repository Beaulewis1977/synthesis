/**
 * Content Analyzer Service
 * Phase: Auto-Optimal RAG Settings
 *
 * Analyzes collection content to determine optimal RAG settings
 * based on file type distribution (code vs documentation).
 */

import { type ContentProfile, type OptimalSettings, query } from '@synthesis/db';

/**
 * File extensions categorized as code (programming languages only).
 * Config/data formats (json, yaml, xml) are excluded as they don't have
 * code semantics and would skew the analysis.
 */
const CODE_EXTENSIONS = new Set([
  // Programming languages
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'java',
  'c',
  'cpp',
  'cs',
  'go',
  'rs',
  'rb',
  'php',
  'swift',
  'kt',
  'scala',
  'sh',
  'bash',
  'zsh',
  'dart',
  'vue',
  'svelte',
]);

/**
 * File extensions categorized as documentation.
 * HTML is excluded as it's ambiguous (could be templates, components,
 * or documentation depending on context).
 */
const DOC_EXTENSIONS = new Set([
  'md',
  'mdx',
  'txt',
  'pdf',
  'docx',
  'doc',
  'rst',
  'adoc',
  'asciidoc',
]);

/**
 * Extract file extension from a file path.
 * @param filePath The full file path
 * @returns The lowercase extension without the dot
 */
function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Determine confidence level based on sample size.
 * @param fileCount Number of files analyzed
 * @returns Confidence level
 */
function getConfidenceLevel(fileCount: number): 'low' | 'medium' | 'high' {
  if (fileCount < 5) return 'low';
  if (fileCount < 20) return 'medium';
  return 'high';
}

/**
 * Analyze collection content to build a content profile.
 * Queries completed documents and categorizes them by file type.
 *
 * @param collectionId The UUID of the collection to analyze
 * @returns ContentProfile with file type ratios and counts
 */
export async function analyzeCollectionContent(collectionId: string): Promise<ContentProfile> {
  // Get all completed documents in collection with their file paths
  const result = await query<{ file_path: string | null }>(
    `SELECT file_path FROM documents
     WHERE collection_id = $1 AND status = 'complete'`,
    [collectionId]
  );

  let codeFiles = 0;
  let docFiles = 0;
  const totalFiles = result.rows.length;

  for (const row of result.rows) {
    const filePath = row.file_path;
    if (!filePath) continue;

    const ext = getFileExtension(filePath);

    if (CODE_EXTENSIONS.has(ext)) {
      codeFiles++;
    } else if (DOC_EXTENSIONS.has(ext)) {
      docFiles++;
    }
    // Files with unknown extensions don't count toward either category
  }

  const codeFileRatio = totalFiles > 0 ? codeFiles / totalFiles : 0;
  const docFileRatio = totalFiles > 0 ? docFiles / totalFiles : 0;

  return {
    codeFileRatio,
    docFileRatio,
    totalFiles,
    codeFiles,
    docFiles,
    confidence: getConfidenceLevel(totalFiles),
  };
}

/**
 * Determine optimal RAG settings based on content profile.
 * Uses detection rules to select the best embedding provider and search mode.
 *
 * Detection Rules:
 * - ≥60% code files → voyage-code-3, vector mode (best for code, 2x better MRR)
 * - ≥60% doc files → nomic-embed-text, vector mode (optimized for natural language)
 * - Mixed content (40-60%) → voyage-code-3, hybrid mode (best coverage)
 *
 * @param profile The content profile from analyzeCollectionContent
 * @returns OptimalSettings with provider, model, mode, and reasoning
 */
export function determineOptimalSettings(profile: ContentProfile): OptimalSettings {
  let embeddingProvider: 'voyage' | 'ollama' | 'openai';
  let embeddingModel: string;
  let searchMode: 'vector' | 'hybrid';
  let reasoning: string;

  // Rule 1: Code-heavy (≥60% code files)
  if (profile.codeFileRatio >= 0.6) {
    embeddingProvider = 'voyage';
    embeddingModel = 'voyage-code-3';
    searchMode = 'vector';
    reasoning =
      `Code-heavy collection (${Math.round(profile.codeFileRatio * 100)}% code files). ` +
      'voyage-code-3 provides 2x better MRR for code retrieval.';
  }
  // Rule 2: Documentation-heavy (≥60% doc files)
  else if (profile.docFileRatio >= 0.6) {
    embeddingProvider = 'ollama';
    embeddingModel = 'nomic-embed-text';
    searchMode = 'vector';
    reasoning =
      `Documentation-heavy collection (${Math.round(profile.docFileRatio * 100)}% docs). ` +
      'nomic-embed-text optimized for natural language retrieval.';
  }
  // Rule 3: Mixed content (neither code nor doc heavy)
  else {
    embeddingProvider = 'voyage';
    embeddingModel = 'voyage-code-3';
    searchMode = 'hybrid';
    reasoning =
      `Mixed content collection (${Math.round(profile.codeFileRatio * 100)}% code, ` +
      `${Math.round(profile.docFileRatio * 100)}% docs). ` +
      'voyage-code-3 with hybrid search for best coverage.';
  }

  return {
    embeddingProvider,
    embeddingModel,
    searchMode,
    reasoning,
    confidence: profile.confidence,
    analyzedAt: new Date(),
    fileCount: profile.totalFiles,
  };
}

/**
 * Full analysis pipeline: analyze content + determine optimal settings.
 * Convenience function that combines analyzeCollectionContent and determineOptimalSettings.
 *
 * @param collectionId The UUID of the collection to analyze
 * @returns OptimalSettings ready to be stored in the database
 */
export async function generateOptimalSettings(collectionId: string): Promise<OptimalSettings> {
  const profile = await analyzeCollectionContent(collectionId);
  return determineOptimalSettings(profile);
}

/**
 * Check if analysis should be triggered based on file count.
 * Triggers at specific milestones to avoid unnecessary analysis.
 *
 * Milestones: 1, 5, 20, 50, then every 50 files thereafter
 *
 * @param fileCount Current number of completed files
 * @returns true if analysis should be triggered
 */
export function shouldTriggerAnalysis(fileCount: number): boolean {
  // Trigger at: 1, 5, 20, 50, 100, 150, etc.
  if (fileCount === 1 || fileCount === 5 || fileCount === 20 || fileCount === 50) {
    return true;
  }
  // After 50, trigger every 50 files
  return fileCount > 50 && fileCount % 50 === 0;
}
