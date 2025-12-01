/**
 * GraphDebugPage - Knowledge Graph Debug UI
 * GPT Phase 2: Graph Retrieval & Context Expansion
 *
 * Provides a comprehensive debug interface for inspecting knowledge graph data:
 * - Stats tab: Node/edge counts by type
 * - Visualization tab: Interactive force-directed graph
 * - Nodes tab: Searchable/filterable node list
 * - Edges tab: Filterable edge list with relationship details
 */

import type { KnowledgeEdge, KnowledgeNode } from '@synthesis/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  GitBranch,
  Hammer,
  ListTree,
  Loader2,
  Network,
  RefreshCw,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EdgeList, GraphVisualization, NodeList } from '../components/graph';
import { apiClient } from '../lib/api';

/**
 * Tab configuration for the debug interface
 */
type TabId = 'stats' | 'visualization' | 'nodes' | 'edges';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'stats', label: 'Stats', icon: <BarChart3 size={16} aria-hidden="true" /> },
  { id: 'visualization', label: 'Visualization', icon: <Network size={16} aria-hidden="true" /> },
  { id: 'nodes', label: 'Nodes', icon: <ListTree size={16} aria-hidden="true" /> },
  { id: 'edges', label: 'Edges', icon: <GitBranch size={16} aria-hidden="true" /> },
];

/**
 * Node type color mapping for stat badges
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
 * Edge type color mapping for stat badges
 */
const EDGE_TYPE_COLORS: Record<string, string> = {
  calls: 'bg-blue-100 text-blue-800',
  defines: 'bg-purple-100 text-purple-800',
  belongs_to: 'bg-gray-100 text-gray-800',
  persists_to: 'bg-green-100 text-green-800',
  configured_by: 'bg-pink-100 text-pink-800',
  documents: 'bg-yellow-100 text-yellow-800',
  imports: 'bg-orange-100 text-orange-800',
  depends_on: 'bg-red-100 text-red-800',
};

/**
 * Details panel component for displaying selected node/edge metadata
 */
function DetailsPanel({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-md sticky top-md">
      <h3 className="font-semibold text-text-primary mb-sm">{title}</h3>
      {data ? (
        <pre className="text-sm text-text-secondary whitespace-pre-wrap overflow-auto max-h-96 font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <p className="text-text-secondary text-sm">Select an item to view details</p>
      )}
    </div>
  );
}

/**
 * Loading skeleton for stat cards
 */
function StatCardSkeleton() {
  return (
    <div className="bg-bg-secondary rounded-lg p-md animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-sm" />
      <div className="h-8 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

/**
 * Stat card component for displaying graph statistics
 */
function StatCard({
  label,
  value,
  className = '',
}: {
  label: string;
  value: number | string;
  className?: string;
}) {
  return (
    <div className={`bg-bg-secondary rounded-lg p-md ${className}`}>
      <p className="text-sm text-text-secondary mb-xs">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value.toLocaleString()}</p>
    </div>
  );
}

/**
 * Type breakdown list component for nodes/edges by type
 */
function TypeBreakdown({
  title,
  data,
  colorMap,
}: {
  title: string;
  data: Record<string, number>;
  colorMap: Record<string, string>;
}) {
  const sortedEntries = useMemo(() => Object.entries(data).sort((a, b) => b[1] - a[1]), [data]);

  if (sortedEntries.length === 0) {
    return (
      <div className="bg-bg-secondary rounded-lg p-md">
        <h4 className="text-sm font-medium text-text-primary mb-sm">{title}</h4>
        <p className="text-sm text-text-secondary">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-lg p-md">
      <h4 className="text-sm font-medium text-text-primary mb-sm">{title}</h4>
      <ul className="space-y-sm">
        {sortedEntries.map(([type, count]) => (
          <li key={type} className="flex items-center justify-between">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${colorMap[type] || 'bg-gray-100 text-gray-800'}`}
            >
              {type.replace(/_/g, ' ')}
            </span>
            <span className="text-sm font-medium text-text-primary">{count.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * GraphDebugPage component - main debug interface for knowledge graph inspection
 */
export function GraphDebugPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // URL-driven state
  const collectionId = searchParams.get('collection') || undefined;
  const activeTab = (searchParams.get('tab') as TabId) || 'stats';

  // Local state for selected items
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<KnowledgeEdge | null>(null);
  const [buildResult, setBuildResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Fetch collections for selector
  const { data: collectionsData, isLoading: collectionsLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => apiClient.fetchCollections(),
  });

  // Build graph mutation
  const buildGraphMutation = useMutation({
    mutationFn: (collId: string) => apiClient.buildGraph(collId),
    onSuccess: (data) => {
      setBuildResult({
        success: true,
        message: `Built graph: ${data.total_nodes_created} nodes, ${data.total_edges_created} edges from ${data.documents_processed} documents (${data.duration_ms}ms)`,
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['graph-stats', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['graph-context', collectionId] });
    },
    onError: (error) => {
      setBuildResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to build graph',
      });
    },
  });

  // Fetch graph stats
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErrorDetails,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['graph-stats', collectionId],
    queryFn: () =>
      collectionId ? apiClient.getGraphStats(collectionId) : Promise.reject('No collection'),
    enabled: !!collectionId,
  });

  // Fetch graph data for browsing (nodes and edges) - only when there's graph data
  const hasGraphData = (stats?.total_nodes ?? 0) > 0;
  const {
    data: graphData,
    isLoading: graphLoading,
    isError: graphError,
    error: graphErrorDetails,
    refetch: refetchGraph,
  } = useQuery({
    queryKey: ['graph-context', collectionId],
    queryFn: () =>
      collectionId
        ? apiClient.getGraphContext({
            collection_id: collectionId,
            query: '*', // Browse mode - get all nodes up to max_nodes limit
            max_nodes: 200,
          })
        : Promise.reject('No collection'),
    enabled: !!collectionId && hasGraphData,
  });

  // Transform graph data to component-compatible types
  // API returns dates as strings (JSON serialization), so we convert them to Date objects
  const nodes: KnowledgeNode[] = useMemo(
    () =>
      graphData?.nodes?.map((n) => ({
        id: n.id,
        collection_id: n.collection_id,
        node_type: n.node_type as KnowledgeNode['node_type'],
        name: n.name,
        document_id: n.document_id ?? undefined,
        chunk_id: n.chunk_id ?? undefined,
        metadata: n.metadata ?? {},
        created_at: new Date(n.created_at),
      })) || [],
    [graphData]
  );

  const edges: KnowledgeEdge[] = useMemo(
    () =>
      graphData?.edges?.map((e) => ({
        id: e.id,
        collection_id: e.collection_id,
        source_node_id: e.source_node_id,
        target_node_id: e.target_node_id,
        edge_type: e.edge_type as KnowledgeEdge['edge_type'],
        metadata: e.metadata,
        created_at: new Date(e.created_at),
      })) || [],
    [graphData]
  );

  // Event handlers
  const handleCollectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCollectionId = e.target.value;
    const params = new URLSearchParams(searchParams);
    if (newCollectionId) {
      params.set('collection', newCollectionId);
    } else {
      params.delete('collection');
    }
    setSearchParams(params, { replace: true });
    // Reset selections when collection changes
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const handleTabChange = (tabId: TabId) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tabId);
    setSearchParams(params, { replace: true });
  };

  const handleNodeSelect = (node: KnowledgeNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const handleEdgeSelect = (edge: KnowledgeEdge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  };

  const handleVisualizationNodeClick = (node: KnowledgeNode | null) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  const handleRefresh = () => {
    refetchStats();
    refetchGraph();
  };

  // Determine if there's an error state
  const hasError = statsError || graphError;
  const errorMessage =
    statsErrorDetails instanceof Error
      ? statsErrorDetails.message
      : graphErrorDetails instanceof Error
        ? graphErrorDetails.message
        : 'An unexpected error occurred';

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary">
        <div className="max-w-7xl mx-auto px-md py-lg">
          <div className="flex items-center gap-md mb-md">
            <Network size={28} className="text-accent" aria-hidden="true" />
            <h1 className="text-2xl font-bold text-text-primary">Knowledge Graph Debug</h1>
          </div>

          {/* Collection Selector */}
          <div className="flex items-center gap-md">
            <label htmlFor="collection-select" className="text-sm font-medium text-text-secondary">
              Collection:
            </label>
            <select
              id="collection-select"
              value={collectionId || ''}
              onChange={handleCollectionChange}
              disabled={collectionsLoading}
              className="px-3 py-2 border border-border rounded-lg text-sm bg-bg-primary text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent min-w-[200px]"
            >
              <option value="">Select a collection...</option>
              {collectionsData?.collections?.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>

            {collectionId && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={statsLoading || graphLoading}
                className="inline-flex items-center gap-xs px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-primary border border-border rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                aria-label="Refresh graph data"
              >
                <RefreshCw
                  size={16}
                  className={statsLoading || graphLoading ? 'animate-spin' : ''}
                  aria-hidden="true"
                />
                Refresh
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-md py-lg">
        {/* No Collection Selected State */}
        {!collectionId && (
          <div className="flex flex-col items-center justify-center py-xl text-center">
            <Network size={64} className="text-text-secondary mb-md" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-text-primary mb-sm">Select a Collection</h2>
            <p className="text-text-secondary max-w-md">
              Choose a collection from the dropdown above to inspect its knowledge graph data.
            </p>
          </div>
        )}

        {/* Error State */}
        {collectionId && hasError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-md">
            <div className="flex items-start gap-md">
              <AlertCircle className="text-error flex-shrink-0" size={24} aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-error mb-sm">Failed to load graph data</h3>
                <p className="text-sm text-text-secondary mb-md">{errorMessage}</p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-xs px-3 py-2 text-sm font-medium text-white bg-error hover:bg-red-600 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2"
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Collection Selected - Tab Interface */}
        {collectionId && !hasError && (
          <>
            {/* Tab Bar */}
            <div
              className="border-b border-border mb-lg"
              role="tablist"
              aria-label="Graph debug tabs"
            >
              <nav className="-mb-px flex gap-md">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`tabpanel-${tab.id}`}
                    id={`tab-${tab.id}`}
                    onClick={() => handleTabChange(tab.id)}
                    className={`inline-flex items-center gap-xs px-md py-sm text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                      activeTab === tab.id
                        ? 'border-accent text-accent'
                        : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
              {/* Stats Tab */}
              {activeTab === 'stats' && (
                <div className="space-y-lg">
                  {/* Loading State */}
                  {statsLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                      <StatCardSkeleton />
                      <StatCardSkeleton />
                      <StatCardSkeleton />
                    </div>
                  )}

                  {/* Stats Content */}
                  {stats && !statsLoading && (
                    <>
                      {/* Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                        <StatCard label="Total Nodes" value={stats.total_nodes} />
                        <StatCard label="Total Edges" value={stats.total_edges} />
                        <StatCard
                          label="Graph Coverage"
                          value={
                            stats.total_nodes > 0
                              ? `${Object.keys(stats.nodes_by_type || {}).length} node types`
                              : 'No data'
                          }
                        />
                      </div>

                      {/* Type Breakdowns */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                        <TypeBreakdown
                          title="Nodes by Type"
                          data={stats.nodes_by_type || {}}
                          colorMap={NODE_TYPE_COLORS}
                        />
                        <TypeBreakdown
                          title="Edges by Type"
                          data={stats.edges_by_type || {}}
                          colorMap={EDGE_TYPE_COLORS}
                        />
                      </div>
                    </>
                  )}

                  {/* Empty State */}
                  {stats && stats.total_nodes === 0 && (
                    <div className="text-center py-xl max-w-md mx-auto">
                      <Network
                        size={48}
                        className="mx-auto text-text-secondary mb-md"
                        aria-hidden="true"
                      />
                      <h3 className="text-lg font-semibold text-text-primary mb-sm">
                        No Graph Data
                      </h3>
                      <p className="text-text-secondary mb-md">
                        This collection does not have any knowledge graph nodes yet.
                      </p>

                      {/* Build Result Message */}
                      {buildResult && (
                        <div
                          className={`mb-md p-md rounded-lg text-sm ${
                            buildResult.success
                              ? 'bg-green-50 text-green-800 border border-green-200'
                              : 'bg-red-50 text-red-800 border border-red-200'
                          }`}
                        >
                          {buildResult.message}
                        </div>
                      )}

                      {/* Build Graph Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (collectionId) {
                            setBuildResult(null);
                            buildGraphMutation.mutate(collectionId);
                          }
                        }}
                        disabled={buildGraphMutation.isPending}
                        className="inline-flex items-center gap-sm px-lg py-md bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-lg"
                      >
                        {buildGraphMutation.isPending ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Building Graph...
                          </>
                        ) : (
                          <>
                            <Hammer size={18} />
                            Build Graph from Existing Documents
                          </>
                        )}
                      </button>

                      <div className="text-left bg-bg-secondary rounded-lg p-md text-sm">
                        <p className="font-medium text-text-primary mb-xs">
                          Or enable automatic graph building:
                        </p>
                        <ol className="list-decimal list-inside text-text-secondary space-y-xs">
                          <li>
                            Set env var:{' '}
                            <code className="bg-gray-200 px-1 rounded">
                              ENABLE_GRAPH_BUILDER=true
                            </code>
                          </li>
                          <li>Restart the server</li>
                          <li>New documents will automatically build graph nodes</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Visualization Tab */}
              {activeTab === 'visualization' && (
                <div className="space-y-lg">
                  {graphLoading && (
                    <div className="flex items-center justify-center h-[500px] bg-bg-secondary rounded-lg">
                      <Loader2 size={32} className="animate-spin text-accent" aria-hidden="true" />
                      <span className="ml-md text-text-secondary">Loading graph...</span>
                    </div>
                  )}

                  {!graphLoading && (
                    <>
                      <GraphVisualization
                        nodes={nodes}
                        edges={edges}
                        selectedNodeId={selectedNode?.id}
                        onNodeClick={handleVisualizationNodeClick}
                        height={500}
                      />

                      {/* Selected Node Details */}
                      <DetailsPanel title="Selected Node Details" data={selectedNode} />
                    </>
                  )}
                </div>
              )}

              {/* Nodes Tab */}
              {activeTab === 'nodes' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
                  {/* Node List - 2/3 width */}
                  <div className="lg:col-span-2 bg-bg-secondary rounded-lg border border-border overflow-hidden min-h-[500px]">
                    {graphLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2
                          size={32}
                          className="animate-spin text-accent"
                          aria-hidden="true"
                        />
                        <span className="ml-md text-text-secondary">Loading nodes...</span>
                      </div>
                    ) : (
                      <NodeList
                        nodes={nodes}
                        selectedNodeId={selectedNode?.id}
                        onSelectNode={handleNodeSelect}
                      />
                    )}
                  </div>

                  {/* Node Details - 1/3 width */}
                  <div className="lg:col-span-1">
                    <DetailsPanel title="Node Details" data={selectedNode} />
                  </div>
                </div>
              )}

              {/* Edges Tab */}
              {activeTab === 'edges' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
                  {/* Edge List - 2/3 width */}
                  <div className="lg:col-span-2 bg-bg-secondary rounded-lg border border-border overflow-hidden min-h-[500px]">
                    {graphLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2
                          size={32}
                          className="animate-spin text-accent"
                          aria-hidden="true"
                        />
                        <span className="ml-md text-text-secondary">Loading edges...</span>
                      </div>
                    ) : (
                      <EdgeList
                        edges={edges}
                        nodes={nodes}
                        selectedEdgeId={selectedEdge?.id}
                        onSelectEdge={handleEdgeSelect}
                      />
                    )}
                  </div>

                  {/* Edge Details - 1/3 width */}
                  <div className="lg:col-span-1">
                    <DetailsPanel title="Edge Details" data={selectedEdge} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default GraphDebugPage;
