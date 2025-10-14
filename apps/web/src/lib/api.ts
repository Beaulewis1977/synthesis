import type {
  AgentChatRequest,
  AgentChatResponse,
  ApiError,
  Collection,
  CollectionsResponse,
  DocumentsResponse,
  SynthesisResponse,
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
   * Send a chat message to the agent API.
   */
  async sendChatMessage(request: AgentChatRequest): Promise<AgentChatResponse> {
    return this.request<AgentChatResponse>('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
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
}

export const apiClient = new ApiClient(API_BASE_URL);
