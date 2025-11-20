import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Folder, Loader2 } from 'lucide-react';
import { CollectionCard } from '../components/CollectionCard';
import { apiClient } from '../lib/api';

export function Dashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['collections'],
    queryFn: () => apiClient.fetchCollections(),
  });

  return (
    <div>
      <div className="mb-lg">
        <h1 className="text-2xl font-bold text-text-primary mb-md">Your Collections</h1>
        <p className="text-text-secondary">Manage and explore your document collections</p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-xl">
          <Loader2 className="animate-spin text-accent" size={32} />
          <span className="ml-md text-text-secondary">Loading collections...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card bg-red-50 border-error">
          <div className="flex items-start gap-md">
            <AlertCircle className="text-error flex-shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-error mb-sm">Failed to load collections</h3>
              <p className="text-sm text-text-secondary">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && data?.collections.length === 0 && (
        <div className="card text-center py-xl">
          <Folder className="mx-auto text-text-secondary mb-md" size={48} />
          <h3 className="text-lg font-semibold text-text-primary mb-sm">No collections yet</h3>
          <p className="text-text-secondary">Create your first collection to get started</p>
        </div>
      )}

      {/* Collections Grid */}
      {!isLoading && !isError && data && data.collections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {data.collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      )}
    </div>
  );
}
