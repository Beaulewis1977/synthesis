import type {
  CreateCustomProviderInput,
  CustomProvider,
  TestConnectionResult,
} from '@synthesis/shared';
import type {
  AgentChatRequest,
  AgentChatResponse,
  ApiError,
  ApiKeysResponse,
  ArchiveResult,
  BatchArchiveResult,
  BatchRestoreResult,
  ChatMessage,
  ChatSession,
  Collection,
  CollectionVersionStats,
  CollectionsResponse,
  CostAlertsResponse,
  CostHistoryResponse,
  CostSummaryResponse,
  Document,
  DocumentChunksResponse,
  DocumentQualityScore,
  DocumentsResponse,
  EmbeddingProfile,
  EmbeddingProfilesResponse,
  FrameworkVersionInfo,
  GraphBuildResponse,
  GraphContextRequest,
  GraphContextResponse,
  GraphStatsResponse,
  IngestionJob,
  IngestionJobStatusResponse,
  LanguageSupportStatus,
  LifecycleStatus,
  ModelConfig,
  ModelConfigResponse,
  ModelConfigUpdate,
  ModelFeature,
  OllamaModelsResponse,
  RelatedFilesResponse,
  RepositorySource,
  RepositorySourcesResponse,
  RestoreResult,
  SearchFeedbackRequest,
  SearchResponse,
  SupersedeResult,
  SynthesisResponse,
  TechStackProfile,
  TechStackTemplate,
  UpdateChunkResponse,
  VersionHistoryResponse,
  VersionedDocument,
  WorkflowInstance,
  WorkflowTemplate,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options?.headers ?? undefined);

    if (options?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    try {
      const response = await fetch(url, {
        ...(options ?? {}),
        headers,
      });

      if (!response.ok) {
        let parsedBody: unknown;
        let message = `Request failed with status ${response.status}`;

        try {
          const rawBody = await response.text();
          if (rawBody) {
            try {
              parsedBody = JSON.parse(rawBody);
            } catch {
              parsedBody = rawBody;
            }
          }
        } catch {
          parsedBody = undefined;
        }

        if (
          parsedBody &&
          typeof parsedBody === 'object' &&
          'error' in parsedBody &&
          typeof (parsedBody as ApiError).error === 'string'
        ) {
          message = (parsedBody as ApiError).error;
        } else if (typeof parsedBody === 'string' && parsedBody.trim().length > 0) {
          message = parsedBody;
        }

        const error = new Error(message) as Error & {
          status?: number;
          body?: unknown;
        };
        error.status = response.status;
        error.body = parsedBody;
        throw error;
      }

      // Handle 204 No Content (e.g., DELETE operations)
      if (response.status === 204) {
        return undefined as T;
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unknown error occurred');
    }
  }

  /**
   * Fetch all available collections.
   */
  async fetchCollections(): Promise<CollectionsResponse> {
    return this.request<CollectionsResponse>('/api/collections');
  }

  /**
   * Fetch a single collection by its identifier.
   */
  async fetchCollection(collectionId: string): Promise<Collection> {
    return this.request<Collection>(`/api/collections/${encodeURIComponent(collectionId)}`);
  }

  /**
   * Create a new collection.
   */
  async createCollection(name: string, description?: string): Promise<Collection> {
    return this.request<Collection>('/api/collections', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  /**
   * Update MMR (Maximal Marginal Relevance) default settings for a collection.
   */
  async updateCollectionMMRDefaults(
    collectionId: string,
    settings: { mmr_enabled?: boolean; mmr_lambda?: number }
  ): Promise<Collection> {
    return this.request<Collection>(
      `/api/collections/${encodeURIComponent(collectionId)}/mmr-defaults`,
      {
        method: 'PATCH',
        body: JSON.stringify(settings),
      }
    );
  }

  /**
   * Fetch documents that belong to the provided collection.
   */
  async fetchDocuments(collectionId: string): Promise<DocumentsResponse> {
    return this.request<DocumentsResponse>(
      `/api/collections/${encodeURIComponent(collectionId)}/documents`
    );
  }

  /**
   * Delete a document from a collection.
   */
  async deleteDocument(documentId: string): Promise<void> {
    await this.request<void>(`/api/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Delete a collection and all its documents.
   * Uses cascade delete - all documents and chunks are automatically removed.
   */
  async deleteCollection(
    collectionId: string
  ): Promise<{ message: string; collection_id: string; collection_name: string }> {
    return this.request<{ message: string; collection_id: string; collection_name: string }>(
      `/api/collections/${encodeURIComponent(collectionId)}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Delete multiple collections.
   */
  async batchDeleteCollections(
    collectionIds: string[]
  ): Promise<{ deleted_count: number; deleted_ids: string[]; failed_ids: string[] }> {
    return this.request<{ deleted_count: number; deleted_ids: string[]; failed_ids: string[] }>(
      '/api/collections/batch/delete',
      {
        method: 'POST',
        body: JSON.stringify({ collection_ids: collectionIds }),
      }
    );
  }

  /**
   * Batch delete multiple documents
   */
  async batchDeleteDocuments(documentIds: string[]): Promise<{
    deleted: string[];
    failed: Array<{ id: string; error: string }>;
    summary: { total: number; deleted: number; failed: number };
  }> {
    return this.request('/api/documents/batch', {
      method: 'DELETE',
      body: JSON.stringify({ documentIds }),
    });
  }

  /**
   * Refresh a document from its source URL
   */
  async refreshDocument(documentId: string): Promise<{
    documentId: string;
    version: number;
    hasChanges: boolean;
    message: string;
  }> {
    return this.request(`/api/documents/${encodeURIComponent(documentId)}/refresh`, {
      method: 'POST',
    });
  }

  /**
   * Send a chat message to the agent API.
   */
  async sendChatMessage(request: AgentChatRequest): Promise<AgentChatResponse> {
    return this.request<AgentChatResponse>('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Create a new chat session.
   * Phase 16G: Added provider/model parameters for per-chat model persistence.
   */
  async createChatSession(
    collectionId: string,
    title: string,
    provider?: string,
    model?: string
  ): Promise<{ session: ChatSession }> {
    return this.request<{ session: ChatSession }>('/api/chats', {
      method: 'POST',
      body: JSON.stringify({ collectionId, title, provider, model }),
    });
  }

  /**
   * List chat sessions for a collection.
   */
  async listChatSessions(collectionId: string): Promise<{ sessions: ChatSession[] }> {
    return this.request<{ sessions: ChatSession[] }>(
      `/api/chats/collection/${encodeURIComponent(collectionId)}`
    );
  }

  /**
   * Get a single chat session with messages.
   */
  async getChatSession(
    sessionId: string
  ): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
    return this.request<{ session: ChatSession; messages: ChatMessage[] }>(
      `/api/chats/${encodeURIComponent(sessionId)}`
    );
  }

  /**
   * Delete a chat session.
   * Phase 16 feature - persistent chat history.
   */
  async deleteChatSession(sessionId: string): Promise<void> {
    await this.request(`/api/chats/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Batch delete multiple chat sessions.
   * Uses CASCADE - all messages are automatically deleted.
   */
  async batchDeleteChatSessions(sessionIds: string[]): Promise<{ deleted: number }> {
    return this.request<{ deleted: number }>('/api/chats/batch/delete', {
      method: 'POST',
      body: JSON.stringify({ session_ids: sessionIds }),
    });
  }

  /**
   * Update a chat session title.
   * Phase 16 feature - persistent chat history.
   */
  async updateChatSessionTitle(
    sessionId: string,
    title: string
  ): Promise<{ session: ChatSession }> {
    return this.request<{ session: ChatSession }>(`/api/chats/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  }

  /**
   * Update chat session model configuration.
   * Phase 16G: Per-chat model persistence.
   */
  async updateChatSessionModel(
    sessionId: string,
    provider: string,
    model: string
  ): Promise<{ session: ChatSession }> {
    return this.request<{ session: ChatSession }>(
      `/api/chats/${encodeURIComponent(sessionId)}/model`,
      {
        method: 'PATCH',
        body: JSON.stringify({ provider, model }),
      }
    );
  }

  /**
   * Add a message to a chat session.
   * Phase 16 feature - persistent chat history.
   */
  async addChatMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<{ message: ChatMessage }> {
    return this.request<{ message: ChatMessage }>(
      `/api/chats/${encodeURIComponent(sessionId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ role, content, metadata }),
      }
    );
  }

  /**
   * Synthesize search results with multi-source comparison.
   * Phase 12 feature - requires ENABLE_SYNTHESIS=true on backend.
   */
  async synthesizeResults(
    query: string,
    collectionId: string,
    topK = 15
  ): Promise<SynthesisResponse> {
    return this.request<SynthesisResponse>('/api/synthesis/compare', {
      method: 'POST',
      body: JSON.stringify({
        query,
        collection_id: collectionId,
        top_k: topK,
      }),
    });
  }

  /**
   * Get current month cost summary with budget information.
   * Phase 12 feature - cost tracking dashboard.
   */
  async getCostSummary(): Promise<CostSummaryResponse> {
    return this.request<CostSummaryResponse>('/api/costs/summary');
  }

  /**
   * Get detailed cost history with optional date range filtering.
   * Phase 12 feature - cost tracking dashboard.
   */
  async getCostHistory(startDate?: string, endDate?: string): Promise<CostHistoryResponse> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString();
    const endpoint = query ? `/api/costs/history?${query}` : '/api/costs/history';
    return this.request<CostHistoryResponse>(endpoint);
  }

  /**
   * Get recent budget alerts.
   * Phase 12 feature - cost tracking dashboard.
   */
  async getCostAlerts(): Promise<CostAlertsResponse> {
    return this.request<CostAlertsResponse>('/api/costs/alerts');
  }

  /**
   * Perform a search query on a collection.
   * Phase 13 feature - search page functionality.
   * Phase 14 update - added tech_stack filtering support.
   * Phase 13 update - added MMR diversification support.
   * GPT Phase 1 update - added mobile feature filtering support.
   */
  async performSearch(
    query: string,
    collectionId: string,
    topK = 10,
    techStack?: string[],
    mmrOptions?: { enabled?: boolean; lambda?: number },
    intentOverride?: string | null,
    mobileFilters?: {
      featureTags?: string[];
      platform?: string;
      usageTier?: string;
    }
  ): Promise<SearchResponse> {
    const body: Record<string, unknown> = {
      query,
      collection_id: collectionId,
      top_k: topK,
    };

    // Only include tech_stack if provided and non-empty
    if (techStack && techStack.length > 0) {
      body.tech_stack = techStack;
    }

    // Include MMR options if provided
    if (mmrOptions?.enabled !== undefined) {
      body.mmr_enabled = mmrOptions.enabled;
    }
    if (mmrOptions?.lambda !== undefined) {
      body.mmr_lambda = mmrOptions.lambda;
    }

    // Phase 12: Include intent override if provided
    if (intentOverride) {
      body.intent = intentOverride;
    }

    // GPT Phase 1: Include mobile feature filters if provided
    if (mobileFilters?.featureTags && mobileFilters.featureTags.length > 0) {
      body.feature_tags = mobileFilters.featureTags;
    }
    if (mobileFilters?.platform) {
      body.platform = mobileFilters.platform;
    }
    if (mobileFilters?.usageTier) {
      body.usage_tier = mobileFilters.usageTier;
    }

    return this.request<SearchResponse>('/api/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get related files for a document (imports, tests, siblings, etc.).
   * Phase 13 feature - code intelligence.
   */
  async getRelatedFiles(documentId: string): Promise<RelatedFilesResponse> {
    return this.request<RelatedFilesResponse>(
      `/api/documents/${encodeURIComponent(documentId)}/related-files`
    );
  }

  /**
   * Start a new autonomous ingestion job.
   * Phase 17 feature.
   */
  async startIngestionJob(collectionId: string, topic: string): Promise<IngestionJob> {
    return this.request<IngestionJob>('/api/ingestion-agent/start', {
      method: 'POST',
      body: JSON.stringify({ collection_id: collectionId, topic }),
    });
  }

  /**
   * Get status of an ingestion job.
   * Phase 17 feature.
   */
  async getIngestionJobStatus(jobId: string): Promise<IngestionJobStatusResponse> {
    return this.request<IngestionJobStatusResponse>(
      `/api/ingestion-agent/status/${encodeURIComponent(jobId)}`
    );
  }

  /**
   * Get document details.
   * Phase 16 feature.
   */
  async getDocument(documentId: string): Promise<{ document: Document }> {
    return this.request<{ document: Document }>(`/api/documents/${encodeURIComponent(documentId)}`);
  }

  /**
   * Get chunks for a document.
   * Phase 16 feature.
   */
  async getDocumentChunks(documentId: string): Promise<DocumentChunksResponse> {
    return this.request<DocumentChunksResponse>(
      `/api/documents/${encodeURIComponent(documentId)}/chunks`
    );
  }

  /**
   * Update a chunk's text and metadata.
   * Phase 16 feature.
   */
  async updateChunk(
    documentId: string,
    chunkIndex: number,
    data: { text: string; metadata?: Record<string, unknown> }
  ): Promise<UpdateChunkResponse> {
    return this.request<UpdateChunkResponse>(
      `/api/documents/${encodeURIComponent(documentId)}/chunks/${chunkIndex}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Update document metadata.
   * Phase 16 feature.
   */
  async updateDocumentMetadata(
    documentId: string,
    data: { title?: string; metadata?: Record<string, unknown> }
  ): Promise<{ message: string; document: Document }> {
    return this.request<{ message: string; document: Document }>(
      `/api/documents/${encodeURIComponent(documentId)}/metadata`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Get repository sources for a collection.
   * Phase 16 feature.
   */
  async getRepositorySources(collectionId: string): Promise<RepositorySourcesResponse> {
    return this.request<RepositorySourcesResponse>(
      `/api/repos?collection_id=${encodeURIComponent(collectionId)}`
    );
  }

  /**
   * Add a repository source to a collection.
   * Phase 16 feature.
   */
  async addRepositorySource(data: {
    collection_id: string;
    repo_url: string;
    default_branch?: string;
    ignored_paths?: string[];
  }): Promise<{ repo: RepositorySource }> {
    return this.request<{ repo: RepositorySource }>('/api/repos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Trigger repository sync.
   * Phase 16 feature.
   */
  async syncRepository(repoSourceId: string): Promise<{ message: string; status: string }> {
    return this.request<{ message: string; status: string }>(
      `/api/repos/${encodeURIComponent(repoSourceId)}/sync`,
      {
        method: 'POST',
      }
    );
  }

  // ============================================
  // Tech Stack Profiles (Phase C)
  // ============================================

  async getTechStackTemplates(category?: string): Promise<{ templates: TechStackTemplate[] }> {
    const url = category
      ? `/api/tech-profiles/templates?category=${encodeURIComponent(category)}`
      : '/api/tech-profiles/templates';
    return this.request<{ templates: TechStackTemplate[] }>(url);
  }

  async getTechStackProfile(collectionId: string): Promise<{ profile: TechStackProfile }> {
    return this.request<{ profile: TechStackProfile }>(
      `/api/tech-profiles/${encodeURIComponent(collectionId)}`
    );
  }

  async applyTechStackTemplate(
    collectionId: string,
    templateName: string
  ): Promise<{ message: string; profile: TechStackProfile }> {
    return this.request<{ message: string; profile: TechStackProfile }>(
      `/api/tech-profiles/${encodeURIComponent(collectionId)}/apply-template`,
      {
        method: 'POST',
        body: JSON.stringify({ template_name: templateName }),
      }
    );
  }

  async updateTechStackProfile(
    collectionId: string,
    data: Partial<TechStackProfile>
  ): Promise<{ profile: TechStackProfile }> {
    return this.request<{ profile: TechStackProfile }>(
      `/api/tech-profiles/${encodeURIComponent(collectionId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  // ============================================
  // Feedback (Phase D)
  // ============================================

  async submitSearchFeedback(
    data: SearchFeedbackRequest
  ): Promise<{ message: string; feedback_id: string }> {
    return this.request<{ message: string; feedback_id: string }>('/api/feedback/search', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDocumentQuality(docId: string): Promise<{ quality: DocumentQualityScore }> {
    return this.request<{ quality: DocumentQualityScore }>(
      `/api/feedback/quality/${encodeURIComponent(docId)}`
    );
  }

  // ============================================
  // Workflows (Phase F)
  // ============================================

  async getWorkflowTemplates(
    category?: string,
    techStack?: string
  ): Promise<{ templates: WorkflowTemplate[] }> {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (techStack) params.set('tech_stack', techStack);
    const query = params.toString();
    return this.request<{ templates: WorkflowTemplate[] }>(
      `/api/workflows/templates${query ? `?${query}` : ''}`
    );
  }

  async getWorkflows(
    collectionId: string,
    status?: string
  ): Promise<{ workflows: WorkflowInstance[] }> {
    const params = new URLSearchParams({ collection_id: collectionId });
    if (status) params.set('status', status);
    return this.request<{ workflows: WorkflowInstance[] }>(`/api/workflows?${params.toString()}`);
  }

  async createWorkflow(data: {
    collection_id: string;
    template_id?: string;
    task_description: string;
    task_context?: Record<string, unknown>;
  }): Promise<{ message: string; workflow: WorkflowInstance }> {
    return this.request<{ message: string; workflow: WorkflowInstance }>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async executeWorkflowStep(workflowId: string): Promise<{
    message: string;
    workflow_id: string;
    current_step?: { id: string; name: string };
    status?: string;
  }> {
    return this.request(`/api/workflows/${encodeURIComponent(workflowId)}/step`, {
      method: 'POST',
    });
  }

  // ============================================
  // Model Configuration (Phase 6)
  // ============================================

  /**
   * Get all model configurations with provider metadata.
   */
  async getModelConfigs(): Promise<ModelConfigResponse> {
    return this.request<ModelConfigResponse>('/api/admin/models');
  }

  /**
   * Get configuration for a specific feature.
   */
  async getModelConfig(
    feature: ModelFeature
  ): Promise<{ config: ModelConfig; apiKeyConfigured: boolean }> {
    return this.request<{ config: ModelConfig; apiKeyConfigured: boolean }>(
      `/api/admin/models/${encodeURIComponent(feature)}`
    );
  }

  /**
   * Update configuration for a specific feature.
   */
  async updateModelConfig(
    feature: ModelFeature,
    update: ModelConfigUpdate
  ): Promise<{ config: ModelConfig; apiKeyConfigured: boolean; message: string }> {
    return this.request<{ config: ModelConfig; apiKeyConfigured: boolean; message: string }>(
      `/api/admin/models/${encodeURIComponent(feature)}`,
      {
        method: 'PUT',
        body: JSON.stringify(update),
      }
    );
  }

  /**
   * Reset a specific feature to default configuration.
   */
  async resetModelConfig(feature: ModelFeature): Promise<{ config: ModelConfig; message: string }> {
    return this.request<{ config: ModelConfig; message: string }>(
      `/api/admin/models/${encodeURIComponent(feature)}`,
      {
        method: 'DELETE',
      }
    );
  }

  /**
   * Reset all model configurations to defaults.
   */
  async resetAllModelConfigs(): Promise<ModelConfigResponse & { message: string }> {
    return this.request<ModelConfigResponse & { message: string }>('/api/admin/models/reset', {
      method: 'POST',
    });
  }

  /**
   * Validate a configuration without saving it.
   */
  async validateModelConfig(
    feature: ModelFeature,
    update: ModelConfigUpdate
  ): Promise<{ valid: boolean; errors?: string[]; message?: string }> {
    return this.request<{ valid: boolean; errors?: string[]; message?: string }>(
      '/api/admin/models/validate',
      {
        method: 'POST',
        body: JSON.stringify({ feature, ...update }),
      }
    );
  }

  /**
   * Get available Ollama models.
   * Phase 16G: Dynamic model discovery.
   */
  async getOllamaModels(): Promise<OllamaModelsResponse> {
    return this.request<OllamaModelsResponse>('/api/admin/models/ollama');
  }

  // ============================================
  // Embedding Profiles (Phase 6)
  // ============================================

  /**
   * Get all embedding profiles.
   */
  async getEmbeddingProfiles(): Promise<EmbeddingProfilesResponse> {
    return this.request<EmbeddingProfilesResponse>('/api/admin/profiles');
  }

  /**
   * Get a specific embedding profile.
   */
  async getEmbeddingProfile(id: string): Promise<EmbeddingProfile> {
    return this.request<EmbeddingProfile>(`/api/admin/profiles/${encodeURIComponent(id)}`);
  }

  /**
   * Get the embedding profile for a collection.
   */
  async getCollectionProfile(
    collectionId: string
  ): Promise<{ collectionId: string; profile: EmbeddingProfile; isDefault: boolean }> {
    return this.request<{ collectionId: string; profile: EmbeddingProfile; isDefault: boolean }>(
      `/api/admin/collections/${encodeURIComponent(collectionId)}/profile`
    );
  }

  /**
   * Set the embedding profile for a collection.
   */
  async setCollectionProfile(
    collectionId: string,
    profileId: string | null
  ): Promise<{ collectionId: string; profile: EmbeddingProfile; message: string }> {
    return this.request<{ collectionId: string; profile: EmbeddingProfile; message: string }>(
      `/api/admin/collections/${encodeURIComponent(collectionId)}/profile`,
      {
        method: 'PUT',
        body: JSON.stringify({ profileId }),
      }
    );
  }

  /**
   * Get the current default embedding profile.
   */
  async getDefaultEmbeddingProfile(): Promise<{
    profile: EmbeddingProfile;
    isConfigured: boolean;
  }> {
    return this.request<{ profile: EmbeddingProfile; isConfigured: boolean }>(
      '/api/admin/profiles/default'
    );
  }

  /**
   * Set the default embedding profile.
   * Pass null to reset to the 'balanced' profile.
   */
  async setDefaultEmbeddingProfile(profileId: string | null): Promise<{
    profile: EmbeddingProfile;
    message: string;
  }> {
    return this.request<{ profile: EmbeddingProfile; message: string }>(
      '/api/admin/profiles/default',
      {
        method: 'PUT',
        body: JSON.stringify({ profileId }),
      }
    );
  }

  // ============================================
  // API Key Management (Phase 6)
  // ============================================

  /**
   * Get status of all API keys (configured or not).
   */
  async getApiKeyStatus(): Promise<ApiKeysResponse> {
    return this.request<ApiKeysResponse>('/api/admin/api-keys');
  }

  /**
   * Set or update an API key for a provider.
   */
  async setApiKey(
    provider: string,
    apiKey: string
  ): Promise<{ message: string; provider: string; configured: boolean }> {
    return this.request<{ message: string; provider: string; configured: boolean }>(
      '/api/admin/api-keys',
      {
        method: 'POST',
        body: JSON.stringify({ provider, apiKey }),
      }
    );
  }

  /**
   * Delete an API key for a provider.
   */
  async deleteApiKey(provider: string): Promise<{ message: string; provider: string }> {
    return this.request<{ message: string; provider: string }>(
      `/api/admin/api-keys/${encodeURIComponent(provider)}`,
      {
        method: 'DELETE',
      }
    );
  }

  /**
   * Test an API key by making a simple request to the provider.
   */
  async testApiKey(provider: string): Promise<{ valid: boolean; message: string }> {
    return this.request<{ valid: boolean; message: string }>(
      `/api/admin/api-keys/${encodeURIComponent(provider)}/test`,
      {
        method: 'POST',
      }
    );
  }

  // ============================================
  // OAuth Token Management (Phase 17A - Anthropic)
  // ============================================

  /**
   * Get OAuth token status for Anthropic.
   */
  async getOAuthTokenStatus(): Promise<{
    configured: boolean;
    source: 'env' | 'db' | 'none';
    maskedValue?: string;
  }> {
    return this.request<{
      configured: boolean;
      source: 'env' | 'db' | 'none';
      maskedValue?: string;
    }>('/api/admin/api-keys/oauth/status');
  }

  /**
   * Set OAuth token for Anthropic (Claude subscription).
   */
  async setOAuthToken(token: string): Promise<{
    message: string;
    provider: string;
    configured: boolean;
  }> {
    return this.request<{
      message: string;
      provider: string;
      configured: boolean;
    }>('/api/admin/api-keys/oauth', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  /**
   * Delete OAuth token for Anthropic.
   */
  async deleteOAuthToken(): Promise<{ message: string; provider: string }> {
    return this.request<{ message: string; provider: string }>('/api/admin/api-keys/oauth', {
      method: 'DELETE',
    });
  }

  /**
   * Test OAuth token for Anthropic.
   */
  async testOAuthToken(): Promise<{ valid: boolean; message: string }> {
    return this.request<{ valid: boolean; message: string }>('/api/admin/api-keys/oauth/test', {
      method: 'POST',
    });
  }

  // ============================================
  // Provider Settings (Phase 16G)
  // ============================================

  /**
   * Get all provider settings.
   */
  async getProviderSettings(): Promise<{
    settings: Array<{ provider: string; settingKey: string; settingValue: string }>;
  }> {
    return this.request<{
      settings: Array<{ provider: string; settingKey: string; settingValue: string }>;
    }>('/api/admin/provider-settings');
  }

  /**
   * Get settings for a specific provider.
   */
  async getProviderSettingsFor(
    provider: string
  ): Promise<{ provider: string; settings: Record<string, string> }> {
    return this.request<{ provider: string; settings: Record<string, string> }>(
      `/api/admin/provider-settings/${encodeURIComponent(provider)}`
    );
  }

  /**
   * Set a provider setting.
   */
  async setProviderSetting(
    provider: string,
    key: string,
    value: string
  ): Promise<{ message: string; provider: string; key: string; value: string }> {
    return this.request<{ message: string; provider: string; key: string; value: string }>(
      `/api/admin/provider-settings/${encodeURIComponent(provider)}/${encodeURIComponent(key)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }
    );
  }

  /**
   * Delete a provider setting.
   */
  async deleteProviderSetting(provider: string, key: string): Promise<void> {
    return this.request<void>(
      `/api/admin/provider-settings/${encodeURIComponent(provider)}/${encodeURIComponent(key)}`,
      {
        method: 'DELETE',
      }
    );
  }

  // ============================================
  // Collection Versioning (Phase 7)
  // ============================================

  /**
   * Get documents with lifecycle status filtering.
   */
  async getVersionedDocuments(
    collectionId: string,
    status?: LifecycleStatus | 'all',
    frameworkVersion?: string
  ): Promise<{ documents: VersionedDocument[] }> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (frameworkVersion) params.set('framework_version', frameworkVersion);
    const query = params.toString();
    return this.request<{ documents: VersionedDocument[] }>(
      `/api/collections/${encodeURIComponent(collectionId)}/documents/versioned${query ? `?${query}` : ''}`
    );
  }

  /**
   * Get version statistics for a collection.
   */
  async getCollectionVersionStats(collectionId: string): Promise<CollectionVersionStats> {
    return this.request<CollectionVersionStats>(
      `/api/collections/${encodeURIComponent(collectionId)}/versions`
    );
  }

  /**
   * Get unique framework versions in a collection.
   */
  async getFrameworkVersions(
    collectionId: string
  ): Promise<{ framework_versions: FrameworkVersionInfo[] }> {
    return this.request<{ framework_versions: FrameworkVersionInfo[] }>(
      `/api/collections/${encodeURIComponent(collectionId)}/framework-versions`
    );
  }

  /**
   * Get version history for a document.
   */
  async getDocumentVersionHistory(documentId: string): Promise<VersionHistoryResponse> {
    return this.request<VersionHistoryResponse>(
      `/api/documents/${encodeURIComponent(documentId)}/version-history`
    );
  }

  /**
   * Archive a document.
   */
  async archiveDocument(documentId: string): Promise<ArchiveResult> {
    return this.request<ArchiveResult>(`/api/documents/${encodeURIComponent(documentId)}/archive`, {
      method: 'POST',
    });
  }

  /**
   * Restore an archived or superseded document.
   */
  async restoreDocument(documentId: string): Promise<RestoreResult> {
    return this.request<RestoreResult>(`/api/documents/${encodeURIComponent(documentId)}/restore`, {
      method: 'POST',
    });
  }

  /**
   * Supersede a document with a new one.
   */
  async supersedeDocument(oldDocumentId: string, newDocumentId: string): Promise<SupersedeResult> {
    return this.request<SupersedeResult>(
      `/api/documents/${encodeURIComponent(oldDocumentId)}/supersede`,
      {
        method: 'POST',
        body: JSON.stringify({ new_document_id: newDocumentId }),
      }
    );
  }

  /**
   * Archive multiple documents.
   */
  async batchArchiveDocuments(documentIds: string[]): Promise<BatchArchiveResult> {
    return this.request<BatchArchiveResult>('/api/documents/batch/archive', {
      method: 'POST',
      body: JSON.stringify({ document_ids: documentIds }),
    });
  }

  /**
   * Restore multiple documents.
   */
  async batchRestoreDocuments(documentIds: string[]): Promise<BatchRestoreResult> {
    return this.request<BatchRestoreResult>('/api/documents/batch/restore', {
      method: 'POST',
      body: JSON.stringify({ document_ids: documentIds }),
    });
  }

  /**
   * Archive all documents with a specific framework version.
   */
  async archiveByFrameworkVersion(
    collectionId: string,
    frameworkVersion: string
  ): Promise<BatchArchiveResult> {
    return this.request<BatchArchiveResult>(
      `/api/collections/${encodeURIComponent(collectionId)}/archive-by-version`,
      {
        method: 'POST',
        body: JSON.stringify({ framework_version: frameworkVersion }),
      }
    );
  }

  // ============================================
  // Language Stats (Phase 14)
  // ============================================

  /**
   * Get language statistics for a collection.
   * Returns detected languages with their analyzer support level.
   */
  async getCollectionLanguageStats(
    collectionId: string
  ): Promise<{ languages: LanguageSupportStatus[] }> {
    return this.request<{ languages: LanguageSupportStatus[] }>(
      `/api/collections/${encodeURIComponent(collectionId)}/language-stats`
    );
  }

  // ============================================
  // GPT Phase 2: Knowledge Graph APIs
  // ============================================

  /**
   * Get graph statistics for a collection.
   * Returns node/edge counts by type.
   */
  async getGraphStats(collectionId: string): Promise<GraphStatsResponse> {
    return this.request<GraphStatsResponse>(`/api/graph/stats/${encodeURIComponent(collectionId)}`);
  }

  /**
   * Get graph context from seed nodes via BFS traversal.
   * Returns nodes, edges, and associated chunks.
   */
  async getGraphContext(params: GraphContextRequest): Promise<GraphContextResponse> {
    return this.request<GraphContextResponse>('/api/graph/context', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Build/rebuild the knowledge graph for a collection.
   * This backfills graph data for existing documents.
   */
  async buildGraph(collectionId: string): Promise<GraphBuildResponse> {
    return this.request<GraphBuildResponse>(
      `/api/graph/build/${encodeURIComponent(collectionId)}`,
      { method: 'POST' }
    );
  }

  // ============================================
  // Custom Providers (Phase 17G)
  // ============================================

  /**
   * List all custom providers.
   */
  async listCustomProviders(): Promise<CustomProvider[]> {
    const response = await this.request<{ providers: CustomProvider[] }>(
      '/api/admin/custom-providers'
    );
    return response.providers;
  }

  /**
   * Get a single custom provider by ID.
   */
  async getCustomProvider(id: string): Promise<CustomProvider> {
    return this.request<CustomProvider>(`/api/admin/custom-providers/${encodeURIComponent(id)}`);
  }

  /**
   * Create a new custom provider.
   */
  async createCustomProvider(data: CreateCustomProviderInput): Promise<CustomProvider> {
    return this.request<CustomProvider>('/api/admin/custom-providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing custom provider.
   */
  async updateCustomProvider(
    id: string,
    data: Partial<CreateCustomProviderInput>
  ): Promise<CustomProvider> {
    return this.request<CustomProvider>(`/api/admin/custom-providers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a custom provider.
   */
  async deleteCustomProvider(id: string): Promise<void> {
    return this.request<void>(`/api/admin/custom-providers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Test connection to a custom provider before saving.
   */
  async testCustomProviderConnection(
    baseUrl: string,
    apiKey?: string
  ): Promise<TestConnectionResult> {
    return this.request<TestConnectionResult>('/api/admin/custom-providers/test-connection', {
      method: 'POST',
      body: JSON.stringify({ baseUrl, apiKey }),
    });
  }

  /**
   * Test an existing saved custom provider's connection.
   */
  async testExistingCustomProvider(id: string): Promise<TestConnectionResult> {
    return this.request<TestConnectionResult>(
      `/api/admin/custom-providers/${encodeURIComponent(id)}/test`,
      {
        method: 'POST',
      }
    );
  }

  /**
   * Discover/refresh models for an existing custom provider.
   */
  async discoverCustomProviderModels(id: string): Promise<string[]> {
    const response = await this.request<{ models: string[] }>(
      `/api/admin/custom-providers/${encodeURIComponent(id)}/models`
    );
    return response.models;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
