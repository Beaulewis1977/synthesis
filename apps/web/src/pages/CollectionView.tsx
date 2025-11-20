import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, MessageSquare, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DocumentList } from '../components/DocumentList';
import { apiClient } from '../lib/api';

export function CollectionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [refreshingDocId, setRefreshingDocId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['documents', id],
    queryFn: () => {
      if (!id) throw new Error('Collection ID is required');
      return apiClient.fetchDocuments(id);
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => apiClient.deleteDocument(documentId),
    onSuccess: () => {
      // Refetch documents after successful deletion
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
      // Also invalidate collections to update doc count
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
    onError: (error) => {
      console.error('Failed to delete document:', error);
      // TODO: Show user-facing notification/toast with error message
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (documentIds: string[]) => apiClient.batchDeleteDocuments(documentIds),
    onSuccess: (result) => {
      console.info('Batch deletion result:', result.summary);
      // Refetch documents after successful deletion
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
      // Also invalidate collections to update doc count
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
    onError: (error) => {
      console.error('Failed to batch delete documents:', error);
      // TODO: Show user-facing notification/toast with error message
    },
  });

  const handleDelete = (documentId: string) => {
    deleteMutation.mutate(documentId);
  };

  const handleBatchDelete = (documentIds: string[]) => {
    batchDeleteMutation.mutate(documentIds);
  };

  const refreshMutation = useMutation({
    mutationFn: (documentId: string) => apiClient.refreshDocument(documentId),
    onMutate: (documentId) => {
      setRefreshingDocId(documentId);
    },
    onSuccess: (result) => {
      console.info('Document refresh result:', result);
      // Refetch documents after refresh
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
      setRefreshingDocId(null);
    },
    onError: (error) => {
      console.error('Failed to refresh document:', error);
      setRefreshingDocId(null);
      // TODO: Show user-facing notification/toast with error message
    },
  });

  const handleRefresh = (documentId: string) => {
    refreshMutation.mutate(documentId);
  };

  const handleChat = () => {
    navigate(`/chat/${id}`);
  };

  const handleSearch = () => {
    if (!id || id.trim().length === 0) {
      return;
    }
    navigate(`/search/${id}`);
  };

  return (
    <div>
      <div className="mb-lg">
        <Link to="/" className="text-accent hover:underline mb-md inline-block">
          ← Back to Collections
        </Link>
        <div className="flex items-center justify-between mb-sm">
          <h1 className="text-2xl font-bold text-text-primary">Collection Documents</h1>
          <div className="flex gap-sm">
            <button
              type="button"
              onClick={handleSearch}
              className="btn btn-primary flex items-center gap-xs"
            >
              <Search size={18} />
              Search
            </button>
            <button
              type="button"
              onClick={handleChat}
              className="btn btn-primary flex items-center gap-xs"
            >
              <MessageSquare size={18} />
              Chat
            </button>
            <button
              type="button"
              onClick={() => navigate(`/upload/${id}`)}
              className="btn btn-secondary"
            >
              Upload
            </button>
          </div>
        </div>
        {data && (
          <p className="text-text-secondary">
            {data.documents.length} document{data.documents.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-xl">
          <Loader2 className="animate-spin text-accent" size={32} />
          <span className="ml-md text-text-secondary">Loading documents...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card bg-red-50 border-error">
          <div className="flex items-start gap-md">
            <AlertCircle className="text-error flex-shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-error mb-sm">Failed to load documents</h3>
              <p className="text-sm text-text-secondary">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      {!isLoading && !isError && data && (
        <DocumentList
          documents={data.documents}
          onDelete={handleDelete}
          onBatchDelete={handleBatchDelete}
          onRefresh={handleRefresh}
          isDeleting={deleteMutation.isPending}
          isBatchDeleting={batchDeleteMutation.isPending}
          isRefreshing={refreshMutation.isPending}
          refreshingDocId={refreshingDocId ?? undefined}
        />
      )}
    </div>
  );
}
