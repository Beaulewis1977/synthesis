/**
 * Streaming Message Component
 *
 * Phase 16C: Displays a streaming assistant message with:
 * - Token-by-token text rendering
 * - Cursor animation while streaming
 * - Tool execution progress indicators
 */

import { useEffect, useRef } from 'react';
import type { StreamingToolCall } from '../hooks/useStreamingChat';

interface StreamingMessageProps {
  /** Accumulated content so far */
  content: string;
  /** Whether streaming is in progress */
  isStreaming: boolean;
  /** Tool calls in progress or completed */
  toolCalls: StreamingToolCall[];
}

export function StreamingMessage({ content, isStreaming, toolCalls }: StreamingMessageProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll as content streams
  // biome-ignore lint/correctness/useExhaustiveDependencies: content is intentionally included to trigger scroll on each token
  useEffect(() => {
    if (contentRef.current && isStreaming) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [content, isStreaming]);

  return (
    <div className="mb-md flex justify-start" data-role="assistant" data-streaming={isStreaming}>
      <div className="max-w-[80%] rounded-lg px-4 py-3 bg-bg-secondary text-text-primary border border-border">
        {/* Streaming content with cursor */}
        <div ref={contentRef} className="whitespace-pre-wrap break-words" aria-live="polite">
          {content || (isStreaming ? '' : 'Thinking...')}
          {isStreaming && (
            <span
              className="inline-block w-2 h-4 ml-0.5 bg-accent animate-pulse"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Tool calls in progress */}
        {toolCalls.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs font-semibold mb-2 text-text-secondary">
              {isStreaming ? 'Using Tools...' : 'Tools Used:'}
            </p>
            <div className="flex flex-wrap gap-2">
              {toolCalls.map((call, idx) => (
                <span
                  key={call.id ?? `${call.tool}-${idx}`}
                  className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${
                    call.status === 'started'
                      ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                      : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {call.status === 'started' ? (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse"
                      aria-label="In progress"
                    />
                  ) : (
                    <span aria-label="Completed">&#10003;</span>
                  )}
                  <span>{call.tool}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
