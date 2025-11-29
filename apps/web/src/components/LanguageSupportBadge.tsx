/**
 * Language Support Badge Component (Phase 14)
 *
 * Displays language support status with visual indicators for:
 * - Parser type (AST, regex, line-based)
 * - Support level (full, partial, basic)
 * - Detected frameworks
 * - Chunking quality score
 */

import type { LanguageSupportLevel, LanguageSupportStatus, ParserType } from '@synthesis/shared';
import { AlertCircle, CheckCircle2, Code2, Cpu, FileCode, Sparkles } from 'lucide-react';

interface LanguageSupportBadgeProps {
  status: LanguageSupportStatus;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Get color classes based on support level
 */
function getSupportLevelColors(level: LanguageSupportLevel): string {
  switch (level) {
    case 'full':
      return 'bg-success/10 text-success border-success/20';
    case 'partial':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'basic':
      return 'bg-text-secondary/10 text-text-secondary border-text-secondary/20';
    case 'none':
      return 'bg-error/10 text-error border-error/20';
    default:
      return 'bg-bg-tertiary text-text-secondary border-border';
  }
}

/**
 * Get icon based on parser type
 */
function getParserIcon(parserType: ParserType) {
  switch (parserType) {
    case 'ast':
      return <Cpu size={14} className="text-success" />;
    case 'regex':
      return <Code2 size={14} className="text-warning" />;
    case 'line-based':
      return <FileCode size={14} className="text-text-secondary" />;
    default:
      return <FileCode size={14} />;
  }
}

/**
 * Get human-readable parser type label
 */
function getParserLabel(parserType: ParserType): string {
  switch (parserType) {
    case 'ast':
      return 'AST';
    case 'regex':
      return 'Regex';
    case 'line-based':
      return 'Basic';
    default:
      return 'Unknown';
  }
}

/**
 * Get human-readable support level label
 */
function getSupportLabel(level: LanguageSupportLevel): string {
  switch (level) {
    case 'full':
      return 'Full Support';
    case 'partial':
      return 'Partial Support';
    case 'basic':
      return 'Basic Support';
    case 'none':
      return 'No Support';
    default:
      return 'Unknown';
  }
}

/**
 * Language icon mapping
 */
const LANGUAGE_ICONS: Record<string, string> = {
  typescript: '🔷',
  tsx: '⚛️',
  javascript: '🟨',
  jsx: '⚛️',
  python: '🐍',
  java: '☕',
  kotlin: '🟣',
  swift: '🍎',
  dart: '🎯',
  go: '🐹',
  rust: '🦀',
  c: '🔧',
  cpp: '⚙️',
  csharp: '💜',
  ruby: '💎',
  php: '🐘',
  sql: '🗃️',
};

export function LanguageSupportBadge({
  status,
  showDetails = false,
  size = 'md',
}: LanguageSupportBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const languageIcon = LANGUAGE_ICONS[status.language] || '📄';

  if (!showDetails) {
    // Compact badge view
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border ${getSupportLevelColors(status.supportLevel)} ${sizeClasses[size]}`}
        title={`${status.language}: ${getSupportLabel(status.supportLevel)} (${getParserLabel(status.parserType)})`}
      >
        <span>{languageIcon}</span>
        <span className="font-medium capitalize">{status.language}</span>
        {getParserIcon(status.parserType)}
      </span>
    );
  }

  // Detailed view
  return (
    <div className={`rounded-lg border ${getSupportLevelColors(status.supportLevel)} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{languageIcon}</span>
          <span className="font-semibold capitalize">{status.language}</span>
        </div>
        <div className="flex items-center gap-1">
          {getParserIcon(status.parserType)}
          <span className="text-xs">{getParserLabel(status.parserType)}</span>
        </div>
      </div>

      {/* Support level indicator */}
      <div className="flex items-center gap-2 mb-2">
        {status.supportLevel === 'full' && <CheckCircle2 size={14} className="text-success" />}
        {status.supportLevel === 'partial' && <AlertCircle size={14} className="text-warning" />}
        {status.supportLevel === 'basic' && (
          <AlertCircle size={14} className="text-text-secondary" />
        )}
        <span className="text-sm">{getSupportLabel(status.supportLevel)}</span>
      </div>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1 mb-2">
        {status.capabilities.hierarchicalChunking && (
          <span className="text-xs px-1.5 py-0.5 bg-bg-tertiary rounded">Hierarchical</span>
        )}
        {status.capabilities.frameworkDetection && (
          <span className="text-xs px-1.5 py-0.5 bg-bg-tertiary rounded">Framework Detection</span>
        )}
        {status.capabilities.importExtraction && (
          <span className="text-xs px-1.5 py-0.5 bg-bg-tertiary rounded">Imports</span>
        )}
        {status.capabilities.symbolExtraction && (
          <span className="text-xs px-1.5 py-0.5 bg-bg-tertiary rounded">Symbols</span>
        )}
      </div>

      {/* Detected frameworks */}
      {status.frameworks.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Sparkles size={12} className="text-accent" />
          {status.frameworks.map((fw) => (
            <span
              key={fw.name}
              className="text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded"
              title={`Confidence: ${Math.round(fw.confidence * 100)}%`}
            >
              {fw.name}
            </span>
          ))}
        </div>
      )}

      {/* Chunking quality */}
      {status.chunkingQuality !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-text-secondary">Quality:</span>
          <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                status.chunkingQuality >= 80
                  ? 'bg-success'
                  : status.chunkingQuality >= 50
                    ? 'bg-warning'
                    : 'bg-error'
              }`}
              style={{ width: `${status.chunkingQuality}%` }}
            />
          </div>
          <span className="text-xs font-medium">{status.chunkingQuality}%</span>
        </div>
      )}

      {/* File count */}
      {status.fileCount !== undefined && (
        <div className="mt-1 text-xs text-text-secondary">
          {status.fileCount} file{status.fileCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

/**
 * Collection Language Summary Component
 */
interface CollectionLanguageSummaryProps {
  languages: LanguageSupportStatus[];
  maxDisplay?: number;
}

export function CollectionLanguageSummary({
  languages,
  maxDisplay = 5,
}: CollectionLanguageSummaryProps) {
  if (languages.length === 0) {
    return <span className="text-xs text-text-secondary italic">No languages detected</span>;
  }

  const displayLanguages = languages.slice(0, maxDisplay);
  const remaining = languages.length - maxDisplay;

  return (
    <div className="flex flex-wrap gap-1">
      {displayLanguages.map((lang) => (
        <LanguageSupportBadge key={lang.language} status={lang} size="sm" />
      ))}
      {remaining > 0 && (
        <span className="text-xs px-1.5 py-0.5 bg-bg-tertiary text-text-secondary rounded-full">
          +{remaining} more
        </span>
      )}
    </div>
  );
}

export default LanguageSupportBadge;
