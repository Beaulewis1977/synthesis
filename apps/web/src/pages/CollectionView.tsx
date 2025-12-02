import { DEFAULT_MMR_LAMBDA } from '@synthesis/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, MessageSquare, Network, Search, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DocumentList } from '../components/DocumentList';
import { CollectionLanguageSummary } from '../components/LanguageSupportBadge';
import { VersionFilter, VersionStats } from '../components/collections';
import { apiClient } from '../lib/api';
import type { GraphStatsResponse, LifecycleStatus } from '../types';

/**
 * Node type color mapping for graph coverage badges
 * Matches the colors used in GraphDebugPage for visual consistency
 */
const NODE_TYPE_COLORS: Record<string, string> = {
  document: 'bg-blue-100 text-blue-800',
  chunk: 'bg-gray-100 text-gray-800',
  symbol: 'bg-purple-100 text-purple-800',
  endpoint: 'bg-green-100 text-green-800',
  table: 'bg-orange-100 text-orange-800',
  column: 'bg-yellow-100 text-yellow-800',
  config_section: 'bg-pink-100 text-pink-800',
};

/**
 * GraphCoverageCard - Displays knowledge graph coverage statistics
 * Shows node/edge counts and type breakdown for a collection
 */
function GraphCoverageCard({
  stats,
  isLoading,
  totalDocuments,
  collectionId,
}: {
  stats: GraphStatsResponse | undefined;
  isLoading: boolean;
  totalDocuments: number;
  collectionId?: string;
}) {
  // Build graph URL with collection context if available
  const graphUrl = collectionId ? `/graph?collection=${collectionId}` : '/graph';
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="mt-lg p-4 bg-bg-secondary rounded-lg border border-border animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-64 mb-4" />
        <div className="flex gap-6 mb-4">
          <div className="h-8 bg-gray-200 rounded w-20" />
          <div className="h-8 bg-gray-200 rounded w-20" />
        </div>
        <div className="h-2 bg-gray-200 rounded w-full" />
      </div>
    );
  }

  // Empty state - no graph data
  if (!stats || stats.total_nodes === 0) {
    return (
      <div className="mt-lg p-4 bg-bg-secondary rounded-lg border border-border">
        <div className="flex items-center gap-2 mb-1">
          <Network size={18} className="text-text-secondary" aria-hidden="true" />
          <h4 className="font-medium text-text-primary">Knowledge Graph Coverage</h4>
        </div>
        <p className="text-sm text-text-secondary">
          No graph data available. Visit the{' '}
          <Link to={graphUrl} className="text-accent hover:underline">
            Graph page
          </Link>{' '}
          to build the knowledge graph for this collection.
        </p>
      </div>
    );
  }

  // Calculate coverage percentage based on documents with nodes
  // The graph stores document nodes, so we can estimate coverage
  const documentNodes = stats.nodes_by_type?.document ?? 0;
  const coveragePercent =
    totalDocuments > 0 ? Math.min(100, Math.round((documentNodes / totalDocuments) * 100)) : 0;

  // Get sorted node types (excluding generic types like 'document' and 'chunk' for the breakdown)
  const semanticNodeTypes = Object.entries(stats.nodes_by_type || {})
    .filter(([type]) => !['document', 'chunk'].includes(type))
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="mt-lg p-4 bg-bg-secondary rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network size={18} className="text-accent" aria-hidden="true" />
          <h4 className="font-medium text-text-primary">Knowledge Graph Coverage</h4>
        </div>
        <Link to={graphUrl} className="text-sm text-accent hover:underline">
          View Graph
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="mt-3 flex flex-wrap gap-6">
        <div>
          <span className="text-2xl font-bold text-text-primary">
            {stats.total_nodes.toLocaleString()}
          </span>
          <span className="text-sm text-text-secondary ml-1">nodes</span>
        </div>
        <div>
          <span className="text-2xl font-bold text-text-primary">
            {stats.total_edges.toLocaleString()}
          </span>
          <span className="text-sm text-text-secondary ml-1">edges</span>
        </div>
      </div>

      {/* Node Type Breakdown */}
      {semanticNodeTypes.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-text-secondary mb-2">Node Types:</p>
          <div className="flex flex-wrap gap-2">
            {semanticNodeTypes.map(([type, count]) => (
              <span
                key={type}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                  NODE_TYPE_COLORS[type] || 'bg-gray-100 text-gray-800'
                }`}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-60"
                  aria-hidden="true"
                />
                {type.replace(/_/g, ' ')} ({count.toLocaleString()})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Coverage Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <span id="graph-coverage-label" className="text-sm text-text-secondary">
            Coverage: {documentNodes} of {totalDocuments} document{totalDocuments !== 1 ? 's' : ''}{' '}
            indexed
          </span>
          <span className="text-sm font-medium text-text-primary">{coveragePercent}%</span>
        </div>
        <div
          className="h-2 bg-bg-tertiary rounded-full overflow-hidden"
          role="progressbar"
          tabIndex={0}
          aria-valuenow={coveragePercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-labelledby="graph-coverage-label"
        >
          <div
            className={`h-full rounded-full transition-all ${
              coveragePercent >= 80
                ? 'bg-success'
                : coveragePercent >= 50
                  ? 'bg-warning'
                  : coveragePercent > 0
                    ? 'bg-accent'
                    : 'bg-gray-300'
            }`}
            style={{ width: `${coveragePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function CollectionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [refreshingDocId, setRefreshingDocId] = useState<string | null>(null);

  // Phase 7: Version filtering state
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleStatus | 'all'>('all');
  const [frameworkVersionFilter, setFrameworkVersionFilter] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['documents', id],
    queryFn: () => {
      if (!id) throw new Error('Collection ID is required');
      return apiClient.fetchDocuments(id);
    },
    enabled: !!id,
  });

  // Fetch language stats for this collection
  const { data: languageData } = useQuery({
    queryKey: ['language-stats', id],
    queryFn: () => {
      if (!id) throw new Error('Collection ID is required');
      return apiClient.getCollectionLanguageStats(id);
    },
    enabled: !!id,
  });

  // Fetch collection for MMR defaults
  const { data: collection } = useQuery({
    queryKey: ['collection', id],
    queryFn: () => {
      if (!id) throw new Error('Collection ID is required');
      return apiClient.fetchCollection(id);
    },
    enabled: !!id,
  });

  // GPT Phase 2: Fetch graph stats for knowledge graph coverage
  const { data: graphStats, isLoading: graphStatsLoading } = useQuery({
    queryKey: ['graph-stats', id],
    queryFn: () => {
      if (!id) throw new Error('Collection ID is required');
      return apiClient.getGraphStats(id);
    },
    enabled: !!id,
  });

  // MMR defaults state - initialized from collection data
  const [mmrEnabled, setMmrEnabled] = useState(false);
  const [mmrLambda, setMmrLambda] = useState(DEFAULT_MMR_LAMBDA);
  const [mmrSaving, setMmrSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state when collection data loads
  useEffect(() => {
    if (collection) {
      setMmrEnabled(collection.mmr_enabled ?? false);
      // mmr_lambda comes as string from DB (DECIMAL type), convert to number
      // Guard against NaN from invalid strings and undefined
      const lambda = collection.mmr_lambda;
      const parsed = typeof lambda === 'string' ? Number.parseFloat(lambda) : lambda;
      setMmrLambda(
        typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : DEFAULT_MMR_LAMBDA
      );
    }
  }, [collection]);

  // MMR mutation for saving
  const mmrMutation = useMutation({
    mutationFn: (settings: { mmr_enabled?: boolean; mmr_lambda?: number }) => {
      if (!id) throw new Error('Collection ID is required');
      return apiClient.updateCollectionMMRDefaults(id, settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
      setMmrSaving(false);
    },
    onError: (error) => {
      console.error('Failed to update MMR defaults:', error);
      setMmrSaving(false);
    },
  });

  // Extract stable mutate function to avoid recreating callback on each render
  const mmrMutate = mmrMutation.mutate;

  // Debounced save function
  const saveMMRDefaults = useCallback(
    (enabled: boolean, lambda: number) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      setMmrSaving(true);
      saveTimeoutRef.current = setTimeout(() => {
        mmrMutate({ mmr_enabled: enabled, mmr_lambda: lambda });
      }, 300);
    },
    [mmrMutate]
  );

  // Cleanup any pending debounced save when component unmounts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, []);

  const handleMMRToggle = () => {
    const newEnabled = !mmrEnabled;
    setMmrEnabled(newEnabled);
    saveMMRDefaults(newEnabled, mmrLambda);
  };

  const handleLambdaChange = (value: number) => {
    setMmrLambda(value);
    saveMMRDefaults(mmrEnabled, value);
  };

  // Calculate overall chunking quality from language stats (weighted by file count)
  const overallChunkingQuality =
    languageData?.languages && languageData.languages.length > 0
      ? Math.round(
          languageData.languages.reduce(
            (sum, lang) => sum + (lang.chunkingQuality ?? 0) * (lang.fileCount ?? 1),
            0
          ) / (languageData.languages.reduce((sum, lang) => sum + (lang.fileCount ?? 1), 0) || 1)
        )
      : undefined;

  // Filter documents based on lifecycle status and framework version
  const filteredDocuments = data?.documents.filter((doc) => {
    // Filter by lifecycle status
    if (lifecycleFilter !== 'all' && doc.lifecycle_status !== lifecycleFilter) {
      return false;
    }
    // Filter by framework version
    if (frameworkVersionFilter) {
      const docFrameworkVersion =
        doc.metadata && typeof doc.metadata === 'object' && 'framework_version' in doc.metadata
          ? String(doc.metadata.framework_version)
          : null;
      if (docFrameworkVersion !== frameworkVersionFilter) {
        return false;
      }
    }
    return true;
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
            <button
              type="button"
              onClick={() => navigate(`/workflows/${id}`)}
              className="btn btn-secondary flex items-center gap-xs"
              title="Manage workflows"
            >
              <Zap size={18} />
              Workflows
            </button>
          </div>
        </div>

        {/* Phase 7: Version stats and filter */}
        {id && (
          <div className="flex flex-col gap-sm mt-md">
            <div className="flex items-center justify-between">
              <VersionStats collectionId={id} />
              {data && (
                <p className="text-text-secondary text-sm">
                  {filteredDocuments?.length ?? 0} of {data.documents.length} document
                  {data.documents.length !== 1 ? 's' : ''}
                  {lifecycleFilter !== 'all' || frameworkVersionFilter ? ' (filtered)' : ''}
                </p>
              )}
            </div>
            <VersionFilter
              collectionId={id}
              selectedStatus={lifecycleFilter}
              selectedFrameworkVersion={frameworkVersionFilter}
              onStatusChange={setLifecycleFilter}
              onFrameworkVersionChange={setFrameworkVersionFilter}
            />
          </div>
        )}

        {/* Phase 14: Language Support Badges & Chunking Quality */}
        {languageData?.languages && languageData.languages.length > 0 && (
          <div className="mt-md p-4 bg-bg-secondary rounded-lg border border-border">
            <div className="flex items-center justify-between mb-sm">
              <h4 className="text-sm font-medium text-text-primary">Languages Detected</h4>
            </div>
            <CollectionLanguageSummary languages={languageData.languages} maxDisplay={5} />

            {/* Chunking Quality Indicator */}
            {overallChunkingQuality !== undefined && (
              <div className="mt-md flex items-center gap-sm">
                <span id="chunking-quality-label" className="text-sm text-text-secondary">
                  Chunking Quality:
                </span>
                <div
                  className="flex-1 max-w-xs h-2 bg-bg-tertiary rounded-full overflow-hidden"
                  role="progressbar"
                  tabIndex={0}
                  aria-valuenow={overallChunkingQuality}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-labelledby="chunking-quality-label"
                >
                  <div
                    className={`h-full rounded-full transition-all ${
                      overallChunkingQuality >= 80
                        ? 'bg-success'
                        : overallChunkingQuality >= 50
                          ? 'bg-warning'
                          : 'bg-error'
                    }`}
                    style={{ width: `${overallChunkingQuality}%` }}
                  />
                </div>
                <span className="text-sm font-medium" aria-hidden="true">
                  {overallChunkingQuality}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* MMR Collection Defaults */}
        <div className="mt-lg p-4 bg-bg-secondary rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-text-primary">MMR Defaults</h4>
              <p className="text-sm text-text-secondary mt-1">
                Configure default diversity settings for this collection
              </p>
            </div>
            {mmrSaving && (
              <span className="text-xs text-text-tertiary flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {/* MMR Toggle */}
            <div className="flex items-center gap-3">
              <button
                id="mmr-toggle"
                type="button"
                role="switch"
                aria-checked={mmrEnabled}
                onClick={handleMMRToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                  mmrEnabled ? 'bg-accent' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mmrEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <label htmlFor="mmr-toggle" className="text-sm text-text-primary cursor-pointer">
                Enable MMR (Maximal Marginal Relevance)
              </label>
            </div>

            {/* Lambda Slider - only shown when MMR enabled */}
            {mmrEnabled && (
              <div className="pl-14">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="mmr-lambda" className="text-sm text-text-secondary">
                    Diversity Level
                  </label>
                  <span className="text-sm font-mono text-text-primary">
                    {mmrLambda.toFixed(2)}
                  </span>
                </div>
                <input
                  id="mmr-lambda"
                  type="range"
                  min="0.3"
                  max="1.0"
                  step="0.05"
                  value={mmrLambda}
                  onChange={(e) => handleLambdaChange(Number.parseFloat(e.target.value))}
                  aria-valuemin={0.3}
                  aria-valuemax={1.0}
                  aria-valuenow={mmrLambda}
                  aria-valuetext={`Diversity level ${mmrLambda.toFixed(2)}: ${mmrLambda < 0.5 ? 'more diverse results' : mmrLambda > 0.8 ? 'more relevant results' : 'balanced'}`}
                  className="w-full max-w-xs h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                />
                <div className="flex justify-between text-xs text-text-secondary mt-1 max-w-xs">
                  <span>← More Diverse</span>
                  <span>More Relevant →</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GPT Phase 2: Knowledge Graph Coverage */}
        <GraphCoverageCard
          stats={graphStats}
          isLoading={graphStatsLoading}
          totalDocuments={data?.documents.length ?? 0}
          collectionId={id}
        />
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
      {!isLoading && !isError && data && filteredDocuments && (
        <DocumentList
          documents={filteredDocuments}
          collectionId={id ?? ''}
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
