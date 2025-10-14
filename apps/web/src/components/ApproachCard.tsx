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
    <div
      className={`card border-2 ${isRecommended ? 'border-success bg-green-50' : 'border-border'}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-md">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-text-primary mb-xs">{approach.method}</h3>
          {approach.topic !== approach.method && (
            <p className="text-sm text-text-secondary">{approach.topic}</p>
          )}
        </div>
        {isRecommended && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-success text-white px-2 py-1 rounded">
            ✓ Recommended
          </span>
        )}
      </div>

      {/* Consensus score and source count */}
      <div className="flex items-center gap-md mb-md">
        <div className="flex items-center gap-xs">
          <span
            className="text-lg"
            role="img"
            aria-label={`${stars} out of 5 stars, ${(approach.consensusScore * 100).toFixed(0)}% consensus`}
            title={`Consensus: ${(approach.consensusScore * 100).toFixed(0)}%`}
          >
            {fullStars}
            {emptyStars}
          </span>
          <span className="text-xs text-text-secondary">
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
      <details className="text-sm">
        <summary className="cursor-pointer text-accent hover:underline font-medium">
          View {approach.sources.length} {approach.sources.length === 1 ? 'source' : 'sources'}
        </summary>
        <ul className="mt-md space-y-sm ml-md">
          {approach.sources.map((source, index) => (
            <li key={`${source.docId}-${index}`} className="border-l-2 border-border pl-md">
              <div className="font-medium text-text-primary">
                {source.docTitle || 'Untitled Document'}
              </div>
              {source.sourceUrl && (
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  {source.sourceUrl}
                </a>
              )}
              <p className="text-text-secondary text-xs mt-xs line-clamp-3">{source.snippet}</p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
