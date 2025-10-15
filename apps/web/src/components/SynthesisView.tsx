import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { apiClient } from '../lib/api';
import { ApproachCard } from './ApproachCard';
import { ConflictsList } from './ConflictsList';

interface SynthesisViewProps {
  query: string;
  collectionId: string;
}

export function SynthesisView({ query, collectionId }: SynthesisViewProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['synthesis', query, collectionId],
    queryFn: () => apiClient.synthesizeResults(query, collectionId, 15),
    enabled: !!query && !!collectionId,
    retry: 1,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-xl">
        <div className="flex gap-sm mb-md">
          <div className="animate-bounce">.</div>
          <div className="animate-bounce [animation-delay:0.2s]">.</div>
          <div className="animate-bounce [animation-delay:0.4s]">.</div>
        </div>
        <p className="text-text-secondary">Analyzing sources and detecting contradictions...</p>
      </div>
    );
  }

  // Error state
  if (isError) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to synthesize results';
    const is404 = errorMessage.includes('404') || errorMessage.includes('disabled');

    return (
      <div className="card bg-red-50 border-error">
        <div className="flex items-start gap-md">
          <AlertCircle className="text-error flex-shrink-0" size={24} />
          <div className="flex-1">
            <h3 className="font-semibold text-error mb-sm">
              {is404 ? 'Synthesis Feature Disabled' : 'Synthesis Failed'}
            </h3>
            <p className="text-sm text-text-secondary mb-md">
              {is404
                ? 'The synthesis feature is not enabled on the backend. Set ENABLE_SYNTHESIS=true in your environment.'
                : errorMessage}
            </p>
            {!is404 && (
              <button type="button" onClick={() => refetch()} className="btn btn-secondary text-sm">
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || data.approaches.length === 0) {
    return (
      <div className="card bg-bg-secondary text-center py-xl">
        <p className="text-lg text-text-secondary mb-sm">No approaches found</p>
        <p className="text-sm text-text-secondary">
          Try refining your query or adding more documents to the collection.
        </p>
      </div>
    );
  }

  const recommendedApproach = data.recommended;

  return (
    <div className="space-y-lg">
      {/* Metadata summary */}
      <div className="card bg-bg-secondary">
        <div className="flex flex-wrap gap-md text-sm text-text-secondary">
          <span>
            <strong className="text-text-primary">{data.metadata.total_sources}</strong> sources
            analyzed
          </span>
          <span>•</span>
          <span>
            <strong className="text-text-primary">{data.metadata.approaches_found}</strong>{' '}
            {data.metadata.approaches_found === 1 ? 'approach' : 'approaches'} found
          </span>
          {data.metadata.conflicts_found > 0 && (
            <>
              <span>•</span>
              <span className="text-warning">
                <strong>{data.metadata.conflicts_found}</strong>{' '}
                {data.metadata.conflicts_found === 1 ? 'conflict' : 'conflicts'} detected
              </span>
            </>
          )}
          <span>•</span>
          <span>{data.metadata.synthesis_time_ms}ms</span>
        </div>
      </div>

      {/* Approaches */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-md">Approaches</h2>
        <div className="space-y-md">
          {data.approaches.map((approach, index) => (
            <ApproachCard
              key={`${approach.method}-${index}`}
              approach={approach}
              isRecommended={recommendedApproach?.method === approach.method}
            />
          ))}
        </div>
      </div>

      {/* Conflicts */}
      {data.conflicts.length > 0 && (
        <div>
          <ConflictsList conflicts={data.conflicts} />
        </div>
      )}
    </div>
  );
}
