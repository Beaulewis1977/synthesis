import { type KeyboardEvent, useState } from 'react';
import type { SearchResult } from '../types';
import { FeedbackButtons } from './FeedbackButtons';
import { RecencyBadge } from './RecencyBadge';
import { RelatedFilesPanel } from './RelatedFilesPanel';
import { TrustBadge } from './TrustBadge';

interface ResultCardProps {
  result: SearchResult;
  collectionId?: string;
  query?: string;
  resultPosition?: number;
  onClick?: () => void;
}

export function ResultCard({ result, collectionId, query, resultPosition, onClick }: ResultCardProps) {
  const [showRelated, setShowRelated] = useState(false);
  const hasSimilarity = typeof result.similarity === 'number' && result.similarity > 0;
  const similarityPercent = hasSimilarity ? Math.round(result.similarity * 100) : null;
  const isCodeFile = Boolean(
    result.metadata?.file_path && typeof result.metadata.file_path === 'string'
  );

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
        {result.snippet}
      </p>

      {/* Feedback and Source */}
      <div className="pt-sm border-t border-border flex items-center justify-between">
        {query && collectionId && (
          <FeedbackButtons
            query={query}
            collectionId={collectionId}
            docId={result.doc_id}
            chunkId={result.id}
            resultPosition={resultPosition}
            similarityScore={result.similarity}
          />
        )}
        {result.source_url && (
          <a
            href={result.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline ml-auto"
            onClick={(event) => event.stopPropagation()}
          >
            View source →
          </a>
        )}
      </div>

      {isCodeFile && collectionId && typeof result.metadata?.file_path === 'string' && (
        <div className="pt-sm border-t border-border">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowRelated(!showRelated);
            }}
            className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-accent rounded px-1 -mx-1"
            aria-expanded={showRelated}
            aria-controls={`related-files-${result.doc_id}`}
          >
            <span className="inline-block transition-transform" aria-hidden="true">
              {showRelated ? '▼' : '▶'}
            </span>{' '}
            Related Files
          </button>
          {showRelated && (
            <div id={`related-files-${result.doc_id}`}>
              <RelatedFilesPanel collectionId={collectionId} docId={result.doc_id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
