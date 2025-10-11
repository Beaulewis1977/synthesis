/**
 * API client for communicating with the Synthesis backend server.
 * This module provides a simple interface for making HTTP requests to the backend API.
 */

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3333';

/**
 * Makes an HTTP request to the backend API.
 * @param endpoint The API endpoint (e.g., '/api/collections')
 * @param options Fetch options including method, headers, and body
 * @returns The parsed JSON response
 * @throws Error if the request fails
 */
async function request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BACKEND_API_URL}${endpoint}`;
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const rawBody = await response.text();

    if (!response.ok) {
      let parsedBody: unknown;
      let message = `Request failed with status ${response.status}`;

      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody;
        }

        if (
          parsedBody &&
          typeof parsedBody === 'object' &&
          'error' in parsedBody &&
          typeof (parsedBody as { error?: unknown }).error === 'string'
        ) {
          message = (parsedBody as { error: string }).error;
        } else if (typeof parsedBody === 'string') {
          message = parsedBody;
        }
      }

      const error = new Error(message) as Error & { status?: number; body?: unknown };
      error.status = response.status;
      error.body = parsedBody ?? rawBody;
      throw error;
    }

    if (!rawBody) {
      return undefined as T;
    }

    return JSON.parse(rawBody) as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unknown error during API request to ${endpoint}`);
  }
}

/**
 * API client object with methods for common HTTP verbs.
 */
export const apiClient = {
  /**
   * Makes a GET request to the backend API.
   * @param endpoint The API endpoint
   * @returns The parsed JSON response
   */
  get: <T = unknown>(endpoint: string): Promise<T> => {
    return request<T>(endpoint, { method: 'GET' });
  },

  /**
   * Makes a POST request to the backend API.
   * @param endpoint The API endpoint
   * @param body The request body (will be JSON stringified)
   * @returns The parsed JSON response
   */
  post: <T = unknown>(endpoint: string, body: unknown): Promise<T> => {
    return request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /**
   * Makes a DELETE request to the backend API.
   * @param endpoint The API endpoint
   * @returns The parsed JSON response
   */
  delete: <T = unknown>(endpoint: string): Promise<T> => {
    return request<T>(endpoint, { method: 'DELETE' });
  },
};
