// API client functions for interacting with the backend

import type { ApiError, CollectionsResponse, DocumentsResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
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

  async fetchCollections(): Promise<CollectionsResponse> {
    return this.request<CollectionsResponse>('/api/collections');
  }

  async fetchDocuments(collectionId: string): Promise<DocumentsResponse> {
    return this.request<DocumentsResponse>(
      `/api/collections/${encodeURIComponent(collectionId)}/documents`
    );
  }

  async deleteDocument(documentId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
