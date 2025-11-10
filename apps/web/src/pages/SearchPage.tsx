import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ResultCard } from '../components/ResultCard';
import { apiClient } from '../lib/api';

export function SearchPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['search', collectionId, initialQuery],
    queryFn: () => {
      if (!collectionId || !initialQuery) {
        throw new Error('Collection ID and query are required');
      }
      return apiClient.performSearch(initialQuery, collectionId);
    },
    enabled: !!collectionId && !!initialQuery,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
      refetch();
    }
  };

  if (!collectionId) {
    return (
      <div className="card bg-red-50 border-error">
        <div className="flex items-start gap-md">
          <AlertCircle className="text-error flex-shrink-0" size={24} />
          <div>
            <h3 className="font-semibold text-error mb-sm">Invalid collection</h3>
            <p className="text-sm text-text-secondary">No collection ID provided in the URL.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-lg">
        <Link
          to={`/collections/${collectionId}`}
          className="text-accent hover:underline mb-md inline-block"
        >
          ← Back to Collection
        </Link>
        <h1 className="text-2xl font-bold text-text-primary mb-md">Search Collection</h1>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="flex gap-sm mb-md">
          <div className="flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for code, functions, or documentation..."
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary flex items-center gap-xs"
            disabled={!query.trim()}
          >
            <Search size={18} />
            Search
          </button>
        </form>

        {data && (
          <p className="text-text-secondary text-sm">
            Found {data.total_results} result{data.total_results !== 1 ? 's' : ''} in{' '}
            {data.search_time_ms}ms
          </p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-xl">
          <Loader2 className="animate-spin text-accent" size={32} />
          <span className="ml-md text-text-secondary">Searching...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card bg-red-50 border-error">
          <div className="flex items-start gap-md">
            <AlertCircle className="text-error flex-shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-error mb-sm">Search failed</h3>
              <p className="text-sm text-text-secondary">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && data && data.results.length === 0 && (
        <div className="card bg-gray-50">
          <div className="text-center py-xl">
            <Search className="mx-auto text-gray-400 mb-md" size={48} />
            <h3 className="font-semibold text-gray-700 mb-sm">No results found</h3>
            <p className="text-sm text-gray-600">
              Try a different search query or check your spelling.
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {!isLoading && !isError && data && data.results.length > 0 && (
        <div className="space-y-md">
          {data.results.map((result) => (
            <ResultCard key={result.id} result={result} collectionId={collectionId} />
          ))}
        </div>
      )}
    </div>
  );
}
