import type { KeyboardEvent } from 'react';
import type { SearchResult } from '../types';
import { RecencyBadge } from './RecencyBadge';
import { TrustBadge } from './TrustBadge';

interface ResultCardProps {
  result: SearchResult;
  onClick?: () => void;
}

export function ResultCard({ result, onClick }: ResultCardProps) {
  const hasSimilarity = typeof result.similarity === 'number' && result.similarity > 0;
  const similarityPercent = hasSimilarity ? Math.round(result.similarity * 100) : null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className="card hover:shadow-md transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-accent"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-md mb-sm">
        <h3 className="text-lg font-semibold text-text-primary flex-1 break-words">
          {result.doc_title ?? 'Untitled document'}
        </h3>
        {similarityPercent !== null && (
          <span className="inline-flex items-center text-xs font-medium px-2 py-1 rounded border bg-indigo-50 text-indigo-700 border-indigo-200 shrink-0">
            {similarityPercent}% match
          </span>
        )}
      </div>

      {(result.metadata?.source_quality || result.metadata?.last_verified) && (
        <div className="flex items-center gap-2 mb-sm flex-wrap">
          <TrustBadge sourceQuality={result.metadata?.source_quality} />
          <RecencyBadge lastVerified={result.metadata?.last_verified} />
        </div>
      )}

      <p className="text-text-secondary text-sm mb-md line-clamp-3 whitespace-pre-wrap">
        {result.text}
      </p>

      {result.source_url && (
        <div className="pt-sm border-t border-border">
          <a
            href={result.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            View source →
          </a>
        </div>
      )}
    </div>
  );
}
