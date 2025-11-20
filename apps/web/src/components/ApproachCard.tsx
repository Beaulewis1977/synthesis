import type { Approach } from '../types';

interface ApproachCardProps {
  approach: Approach;
  isRecommended: boolean;
}

export function ApproachCard({ approach, isRecommended }: ApproachCardProps) {
  // Convert consensus score (0-1) to star rating (0-5)
  const stars = Math.round(approach.consensusScore * 5);
  const fullStars = '⭐'.repeat(stars);
  const emptyStars = '☆'.repeat(5 - stars);

  return (
    <article
      className={`card border-2 animate-fade-in ${isRecommended ? 'border-success bg-green-50' : 'border-border'}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-md">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-text-primary mb-xs break-words">
            {approach.method}
          </h3>
          {approach.topic !== approach.method && (
            <p className="text-sm text-text-secondary break-words">{approach.topic}</p>
          )}
        </div>
        {isRecommended && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-success text-white px-2 py-1 rounded flex-shrink-0 self-start">
            <span role="img" aria-label="Check mark">
              ✓
            </span>{' '}
            Recommended
          </span>
        )}
      </div>

      {/* Consensus score and source count */}
      <div className="flex flex-wrap items-center gap-x-md gap-y-2 mb-md">
        <div className="flex items-center gap-xs">
          <span
            className="text-lg whitespace-nowrap"
            role="img"
            aria-label={`${stars} out of 5 stars, ${(approach.consensusScore * 100).toFixed(0)}% consensus`}
            title={`Consensus: ${(approach.consensusScore * 100).toFixed(0)}%`}
          >
            {fullStars}
            {emptyStars}
          </span>
          <span className="text-xs text-text-secondary whitespace-nowrap">
            ({(approach.consensusScore * 100).toFixed(0)}% consensus)
          </span>
        </div>
        <span className="text-sm text-text-secondary">
          {approach.sources.length} {approach.sources.length === 1 ? 'source' : 'sources'}
        </span>
      </div>

      {/* Summary */}
      <p className="text-text-primary mb-md leading-relaxed">{approach.summary}</p>

      {/* Expandable sources list */}
      <details className="text-sm group">
        <summary className="cursor-pointer text-accent hover:underline font-medium list-none focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 -mx-2 py-1 min-h-[44px] flex items-center">
          <span
            className="inline-block transition-transform group-open:rotate-90"
            aria-hidden="true"
          >
            ▶
          </span>{' '}
          View {approach.sources.length} {approach.sources.length === 1 ? 'source' : 'sources'}
        </summary>
        <ul className="mt-md space-y-sm ml-md animate-slide-down">
          {approach.sources.map((source, index) => (
            <li key={`${source.docId}-${index}`} className="border-l-2 border-border pl-md">
              <div className="font-medium text-text-primary break-words">
                {source.docTitle || 'Untitled Document'}
              </div>
              {source.sourceUrl && (
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline break-all block mt-1"
                >
                  {source.sourceUrl}
                </a>
              )}
              <p className="text-text-secondary text-xs mt-xs line-clamp-3">{source.snippet}</p>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}
