import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Code2,
  FileText,
  GitCompare,
  Lightbulb,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ResultCard } from '../components/ResultCard';
import { apiClient } from '../lib/api';
import type { QueryIntent } from '../types';

// Phase 14: Static tech stack list for filtering
const TECH_STACKS = ['postgres', 'supabase', 'redis', 'flutter', 'typescript'];

// Phase 13: Default MMR lambda value
const DEFAULT_MMR_LAMBDA = 0.7;

// Phase 12: Intent icon and label configuration
const INTENT_CONFIG: Record<QueryIntent, { icon: LucideIcon; label: string; color: string }> = {
  code_symbol: { icon: Code2, label: 'Code Symbol', color: 'text-blue-500' },
  natural_language: { icon: Search, label: 'Natural Language', color: 'text-green-500' },
  error_message: { icon: AlertCircle, label: 'Error Message', color: 'text-red-500' },
  api_lookup: { icon: FileText, label: 'API Lookup', color: 'text-purple-500' },
  conceptual: { icon: Lightbulb, label: 'Conceptual', color: 'text-yellow-500' },
  comparison: { icon: GitCompare, label: 'Comparison', color: 'text-orange-500' },
};

const INTENT_TYPES = Object.keys(INTENT_CONFIG) as QueryIntent[];

// Phase 12: Intent icon component
function IntentIcon({ intent }: { intent: QueryIntent }) {
  const config = INTENT_CONFIG[intent];
  if (!config) return null;
  const Icon = config.icon;
  return <Icon size={14} className={config.color} />;
}

export function SearchPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive state directly from URL search params, making it the single source of truth.
  const currentQuery = searchParams.get('q') || '';
  const selectedTags = searchParams.getAll('tech_stack');

  // Phase 13: MMR diversification settings from URL params
  const mmrEnabledParam = searchParams.get('mmr');
  const mmrLambdaParam = searchParams.get('mmr_lambda');
  const mmrEnabled = mmrEnabledParam === 'true';
  const mmrLambda = mmrLambdaParam ? Number.parseFloat(mmrLambdaParam) : DEFAULT_MMR_LAMBDA;

  // Phase 12: Intent override from URL params (null = auto-detect)
  const rawIntentParam = searchParams.get('intent');
  const intentOverride: QueryIntent | null =
    rawIntentParam && INTENT_TYPES.includes(rawIntentParam as QueryIntent)
      ? (rawIntentParam as QueryIntent)
      : null;

  // Local state for the controlled search input field.
  const [inputQuery, setInputQuery] = useState(currentQuery);

  // Phase 13: Advanced settings panel visibility
  const [showAdvanced, setShowAdvanced] = useState(mmrEnabled);

  // Sync input field with URL on navigation (browser back/forward).
  useEffect(() => {
    setInputQuery(currentQuery);
  }, [currentQuery]);

  const { data, isLoading, isError, error } = useQuery({
    // The queryKey now directly depends on the URL params, ensuring React Query
    // refetches whenever the URL changes (e.g., on back/forward navigation).
    // Phase 13: Added MMR params to query key
    // Phase 12: Added intent override to query key
    queryKey: [
      'search',
      collectionId,
      currentQuery,
      selectedTags.join(','),
      mmrEnabled,
      mmrLambda,
      intentOverride,
    ],
    queryFn: () => {
      if (!collectionId || !currentQuery) {
        throw new Error('Collection ID and query are required');
      }
      return apiClient.performSearch(
        currentQuery,
        collectionId,
        10,
        selectedTags.length > 0 ? selectedTags : undefined,
        mmrEnabled ? { enabled: true, lambda: mmrLambda } : undefined,
        intentOverride
      );
    },
    // The query is enabled only when there's a query in the URL.
    enabled: !!collectionId && !!currentQuery,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputQuery.trim()) {
      const params = new URLSearchParams(searchParams);
      params.set('q', inputQuery.trim());
      setSearchParams(params);
      // No manual refetch() needed; the change in queryKey triggers it.
    }
  };

  const toggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];

    // Update URL with new tags, which will trigger a re-render and refetch.
    const params = new URLSearchParams(searchParams);
    params.delete('tech_stack');
    for (const t of newTags) {
      params.append('tech_stack', t);
    }
    setSearchParams(params, { replace: true });
  };

  // Phase 13: MMR toggle handler
  const toggleMMR = () => {
    const params = new URLSearchParams(searchParams);
    if (mmrEnabled) {
      params.delete('mmr');
      params.delete('mmr_lambda');
    } else {
      params.set('mmr', 'true');
      params.set('mmr_lambda', DEFAULT_MMR_LAMBDA.toString());
    }
    setSearchParams(params, { replace: true });
  };

  // Phase 13: MMR lambda slider handler
  const handleLambdaChange = (value: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('mmr_lambda', value.toFixed(2));
    setSearchParams(params, { replace: true });
  };

  // Phase 12: Intent override handler
  const handleIntentChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'auto') {
      params.delete('intent');
    } else {
      params.set('intent', value);
    }
    setSearchParams(params, { replace: true });
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
            <label htmlFor="search-input" className="sr-only">
              Search query
            </label>
            <input
              type="text"
              id="search-input"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Search for code, functions, or documentation..."
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary flex items-center gap-xs"
            disabled={!inputQuery.trim()}
          >
            <Search size={18} />
            Search
          </button>
        </form>

        {/* Phase 14: Tech Stack Filter Chips */}
        <fieldset className="flex gap-2 mb-md items-center flex-wrap">
          <legend className="text-sm text-text-secondary">
            Filter by tech stack
            {selectedTags.length > 0 && (
              <span className="ml-1 font-medium text-accent">({selectedTags.length} active)</span>
            )}
          </legend>
          {TECH_STACKS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <label
                key={tag}
                className={`px-4 py-2 min-h-[44px] rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-accent text-white shadow-sm scale-100 hover:scale-105'
                    : 'bg-bg-secondary text-text-primary hover:bg-bg-hover active:scale-95'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleTag(tag)}
                  className="sr-only"
                  aria-label={`${isSelected ? 'Remove' : 'Add'} ${tag} filter`}
                />
                {tag}
                {isSelected && (
                  <span className="ml-1" aria-hidden="true">
                    ✓
                  </span>
                )}
              </label>
            );
          })}
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.delete('tech_stack');
                setSearchParams(params, { replace: true });
              }}
              className="px-3 py-2 min-h-[44px] text-sm text-error hover:underline focus:outline-none focus:ring-2 focus:ring-error rounded"
              aria-label="Clear all tech stack filters"
            >
              Clear all
            </button>
          )}
        </fieldset>

        {/* Phase 13: Advanced Search Settings (MMR Diversification) */}
        <div className="mb-md">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
            aria-controls="advanced-settings"
            className="flex items-center gap-xs text-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded"
          >
            {showAdvanced ? (
              <ChevronUp size={16} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} aria-hidden="true" />
            )}
            Advanced Settings
            {mmrEnabled && (
              <span className="ml-1 px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs font-medium">
                <Sparkles size={12} className="inline mr-1" />
                Diversity On
              </span>
            )}
          </button>

          {showAdvanced && (
            <div
              id="advanced-settings"
              className="mt-sm p-4 bg-bg-secondary rounded-lg border border-border"
            >
              <div className="flex flex-col gap-md">
                {/* Phase 12: Intent Override Dropdown */}
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="intent-override" className="font-medium text-text-primary">
                      Query Intent
                    </label>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Override automatic intent detection
                    </p>
                  </div>
                  <select
                    id="intent-override"
                    value={intentOverride || 'auto'}
                    onChange={(e) => handleIntentChange(e.target.value)}
                    className="px-3 py-1.5 border border-border rounded-lg text-sm bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="code_symbol">Code Symbol</option>
                    <option value="natural_language">Natural Language</option>
                    <option value="error_message">Error Message</option>
                    <option value="api_lookup">API Lookup</option>
                    <option value="conceptual">Conceptual</option>
                    <option value="comparison">Comparison</option>
                  </select>
                </div>

                {/* MMR Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="mmr-toggle" className="font-medium text-text-primary">
                      Result Diversification
                    </label>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Reduce near-duplicate results for broader coverage
                    </p>
                  </div>
                  <button
                    id="mmr-toggle"
                    type="button"
                    role="switch"
                    aria-checked={mmrEnabled}
                    onClick={toggleMMR}
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
                </div>

                {/* Lambda Slider (only shown when MMR is enabled) */}
                {mmrEnabled && (
                  <div>
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
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    />
                    <div className="flex justify-between text-xs text-text-secondary mt-1">
                      <span>← More Diverse</span>
                      <span>More Relevant →</span>
                    </div>
                  </div>
                )}

                {/* Phase 12: Search Configuration Details */}
                {data?.metadata?.diagnostics && (
                  <div className="mt-3 p-3 bg-bg-tertiary rounded-lg text-xs">
                    <h4 className="font-medium text-text-primary mb-2">Search Configuration</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-text-secondary">Mode:</span>
                        <span className="ml-1 font-medium">{data.metadata.search_mode}</span>
                      </div>
                      <div>
                        <span className="text-text-secondary">Intent:</span>
                        <span className="ml-1 font-medium">
                          {data.metadata.intent?.type || 'auto'}
                        </span>
                      </div>
                      {data.metadata.diagnostics.weights && (
                        <>
                          <div>
                            <span className="text-text-secondary">Vector Weight:</span>
                            <span className="ml-1 font-medium">
                              {data.metadata.diagnostics.weights.vector}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-secondary">BM25 Weight:</span>
                            <span className="ml-1 font-medium">
                              {data.metadata.diagnostics.weights.bm25}
                            </span>
                          </div>
                        </>
                      )}
                      {data.metadata.intent?.confidence !== undefined && (
                        <div>
                          <span className="text-text-secondary">Confidence:</span>
                          <span className="ml-1 font-medium">
                            {(data.metadata.intent.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                      {data.metadata.diagnostics.timing && (
                        <div>
                          <span className="text-text-secondary">Search Time:</span>
                          <span className="ml-1 font-medium">
                            {data.metadata.diagnostics.timing.total_ms}ms
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {data && (
          <div className="space-y-1">
            <p className="text-text-secondary text-sm">
              Found {data.total_results} result{data.total_results !== 1 ? 's' : ''} in{' '}
              {data.search_time_ms}ms
              {selectedTags.length > 0 && (
                <span className="ml-xs">(filtered by: {selectedTags.join(', ')})</span>
              )}
              {data.metadata?.mmr?.enabled && (
                <span className="ml-xs text-accent">
                  (diversified: {data.metadata.mmr.duplicates_removed} duplicates removed)
                </span>
              )}
            </p>
            {/* Phase 12: Intent Badge */}
            {data.metadata?.intent && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <IntentIcon intent={data.metadata.intent.type} />
                <span className={INTENT_CONFIG[data.metadata.intent.type]?.color}>
                  {INTENT_CONFIG[data.metadata.intent.type]?.label}
                </span>
                <span className="text-text-tertiary">|</span>
                <span>Mode: {data.metadata.search_mode}</span>
                {data.metadata.diagnostics?.weights && (
                  <span className="text-text-tertiary">
                    ({(data.metadata.diagnostics.weights.vector * 100).toFixed(0)}% vector)
                  </span>
                )}
              </div>
            )}
          </div>
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
          {data.results.map((result, index) => (
            <ResultCard
              key={result.id}
              result={result}
              collectionId={collectionId}
              query={currentQuery}
              resultPosition={index + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
