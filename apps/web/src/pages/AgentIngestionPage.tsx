import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Bot, CheckCircle, Loader2, Play, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api';
import type { IngestionJobStatusResponse } from '../types';

export function AgentIngestionPage() {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [topic, setTopic] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Fetch collections for the dropdown
  const { data: collectionsData, isLoading: isLoadingCollections } = useQuery({
    queryKey: ['collections'],
    queryFn: () => apiClient.fetchCollections(),
  });

  // Mutation to start job
  const startJobMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCollectionId || !topic) throw new Error('Missing fields');
      return apiClient.startIngestionJob(selectedCollectionId, topic);
    },
    onSuccess: (job) => {
      setActiveJobId(job.id);
    },
  });

  // Poll for job status
  const {
    data: jobStatus,
    error: jobError,
    isLoading: isJobStatusLoading,
    refetch: refetchJobStatus,
  } = useQuery({
    queryKey: ['ingestion-job', activeJobId],
    queryFn: () => {
      if (!activeJobId) throw new Error('No active job');
      return apiClient.getIngestionJobStatus(activeJobId);
    },
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const data = query.state.data as IngestionJobStatusResponse | undefined;
      if (data?.job.status === 'completed' || data?.job.status === 'failed') {
        return false; // Stop polling
      }
      return 2000; // Poll every 2s
    },
  });

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    startJobMutation.mutate();
  };

  const resetForm = () => {
    setActiveJobId(null);
    setTopic('');
    startJobMutation.reset();
  };

  if (activeJobId && isJobStatusLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-lg">
          <Link to="/" className="text-accent hover:underline mb-md inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-sm">
            <Bot className="text-accent" />
            Autonomous Ingestion Agent
          </h1>
        </div>

        <div className="card p-xl flex items-center gap-sm text-text-secondary">
          <Loader2 className="animate-spin text-accent" size={20} />
          <span>Loading job status...</span>
        </div>
      </div>
    );
  }

  if (activeJobId && jobError) {
    const errorMessage = jobError instanceof Error ? jobError.message : String(jobError);

    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-lg">
          <Link to="/" className="text-accent hover:underline mb-md inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-sm">
            <Bot className="text-accent" />
            Autonomous Ingestion Agent
          </h1>
        </div>

        <div className="card p-xl space-y-md">
          <div className="flex items-center gap-sm text-error">
            <AlertCircle size={18} />
            <span>Failed to load job status.</span>
          </div>
          <p className="text-sm text-text-secondary break-words">{errorMessage}</p>
          <div className="flex justify-end gap-sm">
            <button
              type="button"
              className="btn btn-secondary flex items-center gap-sm"
              onClick={() => refetchJobStatus()}
            >
              <RefreshCw size={16} /> Retry
            </button>
            <button
              type="button"
              className="btn btn-ghost flex items-center gap-sm"
              onClick={resetForm}
            >
              Back to form
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Active Job View
  if (activeJobId && jobStatus) {
    const { job, stats } = jobStatus;
    const progressPercent =
      stats.total > 0
        ? Math.round(((stats.ingested + stats.failed + stats.skipped) / stats.total) * 100)
        : 0;

    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-lg">
          <Link to="/" className="text-accent hover:underline mb-md inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-sm">
            <Bot className="text-accent" />
            Autonomous Ingestion Agent
          </h1>
        </div>

        <div className="card p-xl space-y-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-xs">Ingesting: "{job.topic}"</h2>
              <p className="text-text-secondary text-sm">
                Status: <span className="font-medium uppercase">{job.status}</span>
              </p>
            </div>
            {job.status === 'processing' && (
              <Loader2 className="animate-spin text-accent" size={24} />
            )}
            {job.status === 'completed' && <CheckCircle className="text-success" size={24} />}
            {job.status === 'failed' && <AlertCircle className="text-error" size={24} />}
          </div>

          {/* Progress Bar */}
          <div className="space-y-xs">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  job.status === 'failed' ? 'bg-error' : 'bg-accent'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
            <div className="bg-gray-50 p-md rounded-lg text-center">
              <div className="text-2xl font-bold text-text-primary">{stats.total}</div>
              <div className="text-xs text-text-secondary uppercase tracking-wider">URLs Found</div>
            </div>
            <div className="bg-gray-50 p-md rounded-lg text-center">
              <div className="text-2xl font-bold text-accent">{stats.scraped}</div>
              <div className="text-xs text-text-secondary uppercase tracking-wider">Scraped</div>
            </div>
            <div className="bg-gray-50 p-md rounded-lg text-center">
              <div className="text-2xl font-bold text-success">{stats.ingested}</div>
              <div className="text-xs text-text-secondary uppercase tracking-wider">Ingested</div>
            </div>
            <div className="bg-gray-50 p-md rounded-lg text-center">
              <div className="text-2xl font-bold text-error">{stats.failed}</div>
              <div className="text-xs text-text-secondary uppercase tracking-wider">Failed</div>
            </div>
          </div>

          {job.error_summary && (
            <div className="bg-red-50 border border-error p-md rounded-lg text-error text-sm">
              <strong>Error:</strong> {job.error_summary}
            </div>
          )}

          {job.status === 'completed' && (
            <div className="flex justify-end pt-md">
              <Link
                to={`/collections/${job.collection_id}`}
                className="btn btn-primary flex items-center gap-sm"
              >
                View Collection <ArrowRight size={16} />
              </Link>
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-ghost ml-sm flex items-center gap-sm"
              >
                Start New Job <RefreshCw size={16} />
              </button>
            </div>
          )}

          {job.status === 'failed' && (
            <div className="flex justify-end pt-md">
              <button
                type="button"
                onClick={resetForm}
                className="btn btn-secondary flex items-center gap-sm"
              >
                Try Again <RefreshCw size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Form View
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-lg">
        <Link to="/" className="text-accent hover:underline mb-md inline-block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-sm">
          <Bot className="text-accent" />
          Autonomous Ingestion Agent
        </h1>
        <p className="text-text-secondary mt-sm">
          Give the agent a topic, and it will search the web, scrape relevant pages, and build a
          knowledge base for you automatically.
        </p>
      </div>

      <div className="card p-xl">
        <form onSubmit={handleStart} className="space-y-lg">
          {/* Collection Select */}
          <div>
            <label
              htmlFor="collection-select"
              className="block text-sm font-medium text-text-primary mb-xs"
            >
              Target Collection
            </label>
            {isLoadingCollections ? (
              <div className="h-10 bg-gray-100 animate-pulse rounded" />
            ) : (
              <select
                id="collection-select"
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                className="w-full border border-border rounded-md px-md py-sm focus:ring-2 focus:ring-accent focus:border-transparent"
                required
              >
                <option value="">Select a collection...</option>
                {collectionsData?.collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-text-secondary mt-xs">
              Documents will be added to this collection.
            </p>
          </div>

          {/* Topic Input */}
          <div>
            <label
              htmlFor="topic-input"
              className="block text-sm font-medium text-text-primary mb-xs"
            >
              Topic / Query
            </label>
            <input
              id="topic-input"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Flutter State Management, Rust Async Programming"
              className="w-full border border-border rounded-md px-md py-sm focus:ring-2 focus:ring-accent focus:border-transparent"
              required
              minLength={3}
            />
            <p className="text-xs text-text-secondary mt-xs">
              Be specific. The agent will search for this exact topic.
            </p>
          </div>

          {startJobMutation.isError && (
            <div className="bg-red-50 text-error p-sm rounded text-sm flex items-center gap-sm">
              <AlertCircle size={16} />
              Failed to start job. Please try again.
            </div>
          )}

          <div className="pt-md flex justify-end">
            <button
              type="submit"
              disabled={startJobMutation.isPending || !selectedCollectionId || !topic}
              className="btn btn-primary flex items-center gap-sm"
            >
              {startJobMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Starting...
                </>
              ) : (
                <>
                  <Play size={16} /> Start Ingestion
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
