import type {
  AgentChatRequest,
  AgentChatResponse,
  ApiError,
  ChatMessage,
  ChatSession,
  Collection,
  CollectionsResponse,
  CostAlertsResponse,
  CostHistoryResponse,
  CostSummaryResponse,
  Document,
  DocumentChunksResponse,
  DocumentQualityScore,
  DocumentsResponse,
  IngestionJob,
  IngestionJobStatusResponse,
  RelatedFilesResponse,
  RepositorySource,
  RepositorySourcesResponse,
  SearchFeedbackRequest,
  SearchResponse,
  SynthesisResponse,
  TechStackProfile,
  TechStackTemplate,
  UpdateChunkResponse,
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
   * Fetch documents that belong to the provided collection.
   */
  async fetchDocuments(collectionId: string): Promise<DocumentsResponse> {
    return this.request<DocumentsResponse>(
      `/api/collections/${encodeURIComponent(collectionId)}/documents`
    );
  }

  /**
   * Delete a document by its identifier.
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE',
    });
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
   */
  async createChatSession(collectionId: string, title: string): Promise<{ session: ChatSession }> {
    return this.request<{ session: ChatSession }>('/api/chats', {
      method: 'POST',
      body: JSON.stringify({ collectionId, title }),
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
   */
  async performSearch(
    query: string,
    collectionId: string,
    topK = 10,
    techStack?: string[]
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
}

export const apiClient = new ApiClient(API_BASE_URL);
