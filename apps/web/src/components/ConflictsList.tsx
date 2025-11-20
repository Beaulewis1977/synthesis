import type { Conflict } from '../types';

const SEVERITY_COLORS = {
  high: 'border-error bg-red-50',
  medium: 'border-warning bg-yellow-50',
  low: 'border-gray-400 bg-gray-50',
} as const;

const SEVERITY_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
} as const;

interface ConflictsListProps {
  conflicts: Conflict[];
}

export function ConflictsList({ conflicts }: ConflictsListProps) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <section
      className="card bg-yellow-50 border-2 border-warning animate-fade-in"
      aria-label="Contradictions"
    >
      <h3 className="text-lg font-semibold text-text-primary mb-md flex items-center gap-sm">
        <span className="text-xl" role="img" aria-label="Warning icon">
          ⚠️
        </span>
        Contradictions Found ({conflicts.length})
      </h3>

      <div className="space-y-md">
        {conflicts.map((conflict, index) => {
          return (
            <article
              key={
                conflict.id ??
                `${conflict.topic}-${conflict.source_a.title}-${conflict.source_b.title}-${index}`
              }
              className={`border-2 rounded-lg p-md ${SEVERITY_COLORS[conflict.severity]} animate-slide-down`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Topic and severity */}
              <div className="flex flex-wrap items-start justify-between gap-2 mb-md">
                <h4 className="font-semibold text-text-primary flex-1 min-w-0 break-words">
                  {conflict.topic}
                </h4>
                <span
                  className="text-xs font-medium px-2 py-1 bg-white rounded flex-shrink-0"
                  aria-label={`Severity: ${conflict.severity}`}
                >
                  {SEVERITY_LABELS[conflict.severity]}
                </span>
              </div>

              {/* Source A */}
              <div className="mb-md">
                <div className="text-sm font-medium text-text-primary mb-xs">
                  Source A: {conflict.source_a.title || 'Untitled'}
                </div>
                {conflict.source_a.url && (
                  <a
                    href={conflict.source_a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline block mb-xs break-all"
                  >
                    {conflict.source_a.url}
                  </a>
                )}
                <p className="text-sm text-text-secondary italic ml-0 sm:ml-md pl-md border-l-2 border-gray-300">
                  "{conflict.source_a.statement}"
                </p>
              </div>

              {/* Source B */}
              <div className="mb-md">
                <div className="text-sm font-medium text-text-primary mb-xs">
                  Source B: {conflict.source_b.title || 'Untitled'}
                </div>
                {conflict.source_b.url && (
                  <a
                    href={conflict.source_b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline block mb-xs break-all"
                  >
                    {conflict.source_b.url}
                  </a>
                )}
                <p className="text-sm text-text-secondary italic ml-0 sm:ml-md pl-md border-l-2 border-gray-300">
                  "{conflict.source_b.statement}"
                </p>
              </div>

              {/* Difference explanation */}
              <div className="bg-white rounded p-sm mb-sm">
                <div className="text-xs font-semibold text-text-primary mb-xs">Difference:</div>
                <p className="text-sm text-text-secondary">{conflict.difference}</p>
              </div>

              {/* Recommendation */}
              <div className="bg-success/10 border border-success rounded p-sm">
                <div className="text-xs font-semibold text-success mb-xs">
                  <span aria-hidden="true">→</span> Recommendation:
                </div>
                <p className="text-sm text-text-primary">{conflict.recommendation}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
