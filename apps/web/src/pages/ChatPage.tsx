import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChatMessage } from '../components/ChatMessage';
import { SynthesisView } from '../components/SynthesisView';
import { apiClient } from '../lib/api';
import type { ChatMessage as ChatMessageType } from '../types';

type ViewMode = 'chat' | 'synthesis';

export function ChatPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [lastUserQuery, setLastUserQuery] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createMessageId = () => {
    const randomSource = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

    if (randomSource && 'randomUUID' in randomSource) {
      return randomSource.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  // Fetch collection name
  const {
    data: collection,
    isLoading: isCollectionLoading,
    isError: isCollectionError,
    error: collectionError,
    refetch: refetchCollection,
  } = useQuery({
    queryKey: ['collection', collectionId],
    queryFn: async () => {
      if (!collectionId) throw new Error('Collection ID is required');
      return apiClient.fetchCollection(collectionId);
    },
    enabled: !!collectionId,
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!collectionId) throw new Error('Collection ID is required');

      // Convert messages to history format for API
      const history = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      return apiClient.sendChatMessage({
        message,
        collection_id: collectionId,
        history,
      });
    },
    onSuccess: (data) => {
      // Add assistant's response to messages
      const assistantMessage: ChatMessageType = {
        id: createMessageId(),
        role: 'assistant',
        content: data.message,
        tool_calls: data.tool_calls,
        // Note: Citations would need to be parsed from the message or provided by the API
        // For now, we'll leave this empty as the API doesn't explicitly return citations
        citations: undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error) => {
      console.error('Chat error:', error);
      // Add error message to chat
      const errorMessage: ChatMessageType = {
        id: `error-${createMessageId()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

  // Reset messages when collectionId changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only run on collectionId change
  useEffect(() => {
    if (!collectionId) return;
    setMessages([]);
    setInputValue('');
    chatMutation.reset();
  }, [collectionId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || chatMutation.isPending) return;

    // Store last user query for synthesis view
    setLastUserQuery(trimmedMessage);

    // Add user message to chat immediately
    const userMessage: ChatMessageType = {
      id: createMessageId(),
      role: 'user',
      content: trimmedMessage,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    // Send to API
    chatMutation.mutate(trimmedMessage);
  };

  const isLoading = chatMutation.isPending;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="mb-lg">
        <Link to="/" className="text-accent hover:underline mb-md inline-block">
          ← Back to Collections
        </Link>
        <div className="flex items-start justify-between gap-md">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary">
              Chatting with:{' '}
              {isCollectionLoading ? '...' : (collection?.name ?? 'Unknown Collection')}
            </h1>
            <p className="text-text-secondary mt-sm text-sm">Ask questions about your documents</p>
          </div>
          {/* View mode toggle */}
          <div className="flex gap-sm">
            <button
              type="button"
              onClick={() => setViewMode('chat')}
              className={`px-md py-sm rounded text-sm font-medium transition-colors ${
                viewMode === 'chat'
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
              }`}
            >
              Chat View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('synthesis')}
              className={`px-md py-sm rounded text-sm font-medium transition-colors ${
                viewMode === 'synthesis'
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
              }`}
              disabled={!lastUserQuery}
              title={!lastUserQuery ? 'Send a message first to enable synthesis' : 'View synthesis'}
            >
              Synthesis View
            </button>
          </div>
        </div>
      </div>

      {isCollectionError && (
        <div className="card bg-red-50 border-error mb-lg">
          <div className="flex items-start gap-md">
            <AlertCircle className="text-error flex-shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-error mb-sm">Failed to load collection details</h3>
              <p className="text-sm text-text-secondary mb-md">
                {collectionError instanceof Error
                  ? collectionError.message
                  : 'An unexpected error occurred'}
              </p>
              <button
                type="button"
                onClick={() => refetchCollection()}
                className="btn btn-secondary text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conditional view rendering */}
      {viewMode === 'chat' ? (
        /* Chat interface */
        <div className="flex-1 card flex flex-col overflow-hidden">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto mb-md px-2">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-text-secondary text-center">
                  Start a conversation by typing a message below
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {/* Loading indicator */}
                {isLoading && (
                  <div className="mb-md flex justify-start">
                    <div className="max-w-[80%] rounded-lg px-4 py-3 bg-bg-secondary text-text-primary border border-border">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="animate-bounce">.</span>
                          <span className="animate-bounce [animation-delay:0.2s]">.</span>
                          <span className="animate-bounce [animation-delay:0.4s]">.</span>
                        </div>
                        <span className="text-sm text-text-secondary">Thinking</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input form */}
          <div className="border-t border-border pt-md">
            <form onSubmit={handleSubmit} className="flex gap-sm">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                className="input flex-1"
                disabled={isLoading}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || !inputValue.trim()}
              >
                {isLoading ? 'Sending...' : 'Send →'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Synthesis view */
        <div className="flex-1 overflow-y-auto">
          {lastUserQuery && collectionId ? (
            <SynthesisView query={lastUserQuery} collectionId={collectionId} />
          ) : (
            <div className="card bg-bg-secondary text-center py-xl">
              <p className="text-text-secondary">Send a message first to view synthesis results</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
