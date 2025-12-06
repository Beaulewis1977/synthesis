/**
 * Streaming Chat Hook
 *
 * Phase 16C: React hook for SSE-based chat streaming.
 * Handles real-time token streaming, tool execution progress, and error handling.
 */

import { useCallback, useRef, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface StreamingToolCall {
  id?: string;
  tool: string;
  status: 'started' | 'completed';
  input?: unknown;
}

export interface StreamingUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface StreamingState {
  /** Whether streaming is in progress */
  isStreaming: boolean;
  /** Accumulated text content */
  content: string;
  /** Tool calls in progress or completed */
  toolCalls: StreamingToolCall[];
  /** Error message if any */
  error: string | null;
  /** Token usage after completion */
  usage: StreamingUsage | null;
}

export interface UseStreamingChatOptions {
  /** Called for each text token received */
  onToken?: (token: string) => void;
  /** Called when a tool starts execution */
  onToolStart?: (tool: string, input?: unknown) => void;
  /** Called when a tool completes */
  onToolEnd?: (tool: string) => void;
  /** Called when streaming completes successfully */
  onComplete?: (content: string, usage: StreamingUsage | null) => void;
  /** Called on error */
  onError?: (error: string) => void;
}

export interface StreamChatParams {
  message: string;
  collection_id: string;
  session_id?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    content: '',
    toolCalls: [],
    error: null,
    usage: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Start streaming a chat message
   */
  const streamChat = useCallback(
    async (params: StreamChatParams) => {
      // Abort any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // Reset state
      setState({
        isStreaming: true,
        content: '',
        toolCalls: [],
        error: null,
        usage: null,
      });

      let fullContent = '';
      const toolCalls: StreamingToolCall[] = [];

      try {
        const response = await fetch('/api/agent/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process SSE lines
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);
                processEvent(
                  currentEvent,
                  data,
                  fullContent,
                  toolCalls,
                  setState,
                  options,
                  (content) => {
                    fullContent = content;
                  }
                );
              } catch {
                // Ignore parse errors for malformed data
              }
            }
          }
        }

        // Note: onComplete is called in processEvent 'done' handler with up-to-date usage
        // Only set isStreaming false if 'done' event wasn't received (edge case)
        setState((s) => (s.isStreaming ? { ...s, isStreaming: false } : s));
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          setState((s) => ({ ...s, isStreaming: false }));
          return;
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        setState((s) => ({ ...s, isStreaming: false, error: message }));
        options.onError?.(message);
      }
    },
    [options]
  );

  /**
   * Cancel the current stream
   */
  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setState((s) => ({ ...s, isStreaming: false }));
  }, []);

  /**
   * Reset state for a new conversation
   */
  const reset = useCallback(() => {
    cancelStream();
    setState({
      isStreaming: false,
      content: '',
      toolCalls: [],
      error: null,
      usage: null,
    });
  }, [cancelStream]);

  return {
    ...state,
    streamChat,
    cancelStream,
    reset,
  };
}

// =============================================================================
// Event Processing
// =============================================================================

function processEvent(
  event: string,
  data: Record<string, unknown>,
  fullContent: string,
  toolCalls: StreamingToolCall[],
  setState: React.Dispatch<React.SetStateAction<StreamingState>>,
  options: UseStreamingChatOptions,
  setFullContent: (content: string) => void
): void {
  switch (event) {
    case 'token':
      if (data.content && typeof data.content === 'string') {
        const newContent = fullContent + data.content;
        setFullContent(newContent);
        setState((s) => ({ ...s, content: newContent }));
        options.onToken?.(data.content);
      }
      break;

    case 'tool_start':
      if (data.tool && typeof data.tool === 'string') {
        const id = typeof data.id === 'string' ? data.id : undefined;
        const newToolCall: StreamingToolCall = {
          id,
          tool: data.tool,
          status: 'started',
          input: data.input,
        };
        toolCalls.push(newToolCall);
        setState((s) => ({ ...s, toolCalls: [...toolCalls] }));
        options.onToolStart?.(data.tool, data.input);
      }
      break;

    case 'tool_end':
      if (data.tool && typeof data.tool === 'string') {
        const id = typeof data.id === 'string' ? data.id : undefined;
        const tc = id
          ? toolCalls.find((t) => t.id === id)
          : toolCalls.find((t) => t.tool === data.tool && t.status === 'started');
        if (tc) {
          tc.status = 'completed';
          setState((s) => ({ ...s, toolCalls: [...toolCalls] }));
        }
        options.onToolEnd?.(data.tool);
      }
      break;

    case 'usage':
      if (data.usage) {
        const usage = data.usage as StreamingUsage;
        setState((s) => ({ ...s, usage }));
      }
      break;

    case 'done':
      if (data.usage) {
        const usage = data.usage as StreamingUsage;
        setState((s) => ({ ...s, usage, isStreaming: false }));
        options.onComplete?.(fullContent, usage);
      } else {
        setState((s) => ({ ...s, isStreaming: false }));
        options.onComplete?.(fullContent, null);
      }
      break;

    case 'error':
      if (data.message && typeof data.message === 'string') {
        setState((s) => ({ ...s, error: data.message as string, isStreaming: false }));
        options.onError?.(data.message);
      }
      break;
  }
}
