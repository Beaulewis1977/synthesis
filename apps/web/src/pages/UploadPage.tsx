import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { UploadZone } from '../components/UploadZone';
import { apiClient } from '../lib/api';

export function UploadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['collection', id],
    queryFn: () => apiClient.fetchCollection(id as string),
    enabled: !!id,
  });

  const handleUploadComplete = () => {
    // Invalidate queries to refresh document list
    queryClient.invalidateQueries({ queryKey: ['documents', id] });
    queryClient.invalidateQueries({ queryKey: ['collections'] });

    // Navigate back to collection view
    navigate(`/collections/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-xl">
        <Loader2 className="animate-spin text-accent" size={32} />
        <span className="ml-md text-text-secondary">Loading collection...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div>
        <Link to="/" className="text-accent hover:underline mb-md inline-block">
          ← Back to Collections
        </Link>
        <div className="card bg-red-50 border-error">
          <div className="flex items-start gap-md">
            <AlertCircle className="text-error flex-shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-error mb-sm">Collection not found</h3>
              <p className="text-sm text-text-secondary">
                The requested collection could not be loaded. Please check the URL and try again.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-lg">
        <Link to={`/collections/${id}`} className="text-accent hover:underline mb-md inline-block">
          ← Back to Collection
        </Link>
        <h1 className="text-2xl font-bold text-text-primary mb-sm">Upload Documents</h1>
        <p className="text-text-secondary">
          Upload documents to: <span className="font-semibold">{data.name}</span>
        </p>
      </div>

      <UploadZone collectionId={id as string} onUploadComplete={handleUploadComplete} />
    </div>
  );
}
