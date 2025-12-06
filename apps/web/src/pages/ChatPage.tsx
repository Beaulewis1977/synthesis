import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Menu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChatHistorySidebar } from '../components/ChatHistorySidebar';
import { ChatMessage } from '../components/ChatMessage';
import { StreamingMessage } from '../components/StreamingMessage';
import { SynthesisView } from '../components/SynthesisView';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { apiClient } from '../lib/api';
import type { ChatMessage as ChatMessageType } from '../types';

type ViewMode = 'chat' | 'synthesis';

export function ChatPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [lastUserQuery, setLastUserQuery] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Streaming chat hook
  const {
    isStreaming,
    content: streamingContent,
    toolCalls: streamingToolCalls,
    streamChat,
  } = useStreamingChat({
    onComplete: (content) => {
      // Add completed streaming message to messages array
      const assistantMessage: ChatMessageType = {
        id: createMessageId(),
        role: 'assistant',
        content,
        tool_calls: streamingToolCalls.map((tc, idx) => ({
          id: tc.id ?? `tool-${idx}`,
          tool: tc.tool,
          status: tc.status,
        })),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error) => {
      // Add error message to chat
      const errorMessage: ChatMessageType = {
        id: `error-${createMessageId()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    },
  });

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

  // Fetch chat sessions
  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ['chat-sessions', collectionId],
    queryFn: async () => {
      if (!collectionId) return { sessions: [] };
      return apiClient.listChatSessions(collectionId);
    },
    enabled: !!collectionId,
  });

  // Load specific session if present in URL or state
  useEffect(() => {
    const sid = searchParams.get('session');
    if (sid && sid !== sessionId) {
      setSessionId(sid);
    }
  }, [searchParams, sessionId]);

  // Fetch session messages when sessionId changes
  const { data: sessionData } = useQuery({
    queryKey: ['chat-session', sessionId],
    queryFn: () => (sessionId ? apiClient.getChatSession(sessionId) : null),
    enabled: !!sessionId,
  });

  // Sync messages when session data is loaded
  useEffect(() => {
    if (sessionData?.messages) {
      setMessages(sessionData.messages);
      // If it's an existing session, set the last user query for synthesis view context
      const lastUserMsg = [...sessionData.messages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        setLastUserQuery(lastUserMsg.content);
      }
    }
  }, [sessionData]);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!collectionId) throw new Error('Collection ID is required');

      let currentSessionId = sessionId;

      // Create session if it doesn't exist
      if (!currentSessionId) {
        // Use first 30 chars of message as title
        const title = message.slice(0, 30) + (message.length > 30 ? '...' : '');
        const { session } = await apiClient.createChatSession(collectionId, title);
        currentSessionId = session.id;
        setSessionId(currentSessionId);
        setSearchParams({ session: currentSessionId });
        // Refresh sessions list
        refetchSessions();
      }

      // Convert messages to history format for API (excluding the one we just added optimistically)
      // We only send the last few messages for context if needed, but the agent handles history mostly via DB now
      // if we pass session_id. However, for immediate context before DB persist, we pass recent history.
      const history = messages.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      return apiClient.sendChatMessage({
        message,
        collection_id: collectionId,
        history,
        session_id: currentSessionId,
      });
    },
    onSuccess: (data) => {
      // Add assistant's response to messages
      const assistantMessage: ChatMessageType = {
        id: createMessageId(),
        role: 'assistant',
        content: data.message,
        tool_calls: data.tool_calls,
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
    if (!sessionId) {
      setMessages([]);
      setInputValue('');
      chatMutation.reset();
    }
  }, [collectionId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || !collectionId) return;

    // Store last user query for synthesis view
    setLastUserQuery(trimmedMessage);

    // Add user message to chat immediately (optimistic UI)
    const userMessage: ChatMessageType = {
      id: createMessageId(),
      role: 'user',
      content: trimmedMessage,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    // Re-focus input
    setTimeout(() => inputRef.current?.focus(), 0);

    // Create session if needed
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const title = trimmedMessage.slice(0, 30) + (trimmedMessage.length > 30 ? '...' : '');
        const { session } = await apiClient.createChatSession(collectionId, title);
        currentSessionId = session.id;
        setSessionId(currentSessionId);
        setSearchParams({ session: currentSessionId });
        refetchSessions();
      } catch (error) {
        console.error('Failed to create session:', error);
      }
    }

    // Use streaming chat - include current user message in history
    const history = [...messages.slice(-9), userMessage].map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    streamChat({
      message: trimmedMessage,
      collection_id: collectionId,
      session_id: currentSessionId ?? undefined,
      history,
    });
  };

  const handleNewChat = () => {
    setSessionId(null);
    setSearchParams({});
    setMessages([]);
    setInputValue('');
    setLastUserQuery(''); // Reset synthesis context
    chatMutation.reset();
    inputRef.current?.focus();
  };

  const handleSelectSession = (id: string) => {
    setSessionId(id);
    setSearchParams({ session: id });
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await apiClient.deleteChatSession(id);
      // If we deleted the current session, clear it
      if (sessionId === id) {
        handleNewChat();
      }
      // Refresh sessions list
      refetchSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const isLoading = chatMutation.isPending || isStreaming;

  return (
    <div className="h-[calc(100vh-120px)] flex">
      {/* Sidebar */}
      <div
        className={`
          ${isSidebarOpen ? 'w-64' : 'w-0'} 
          transition-all duration-300 ease-in-out overflow-hidden border-r border-border bg-bg-secondary flex-shrink-0
        `}
      >
        <ChatHistorySidebar
          sessions={sessionsData?.sessions || []}
          currentSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          className="h-full w-64"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-lg p-md pb-0">
          <div className="flex items-center gap-sm mb-sm">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-xs rounded hover:bg-bg-hover text-text-secondary"
              title="Toggle Sidebar"
            >
              <Menu size={20} />
            </button>
            <Link to="/" className="text-accent hover:underline">
              ← Back to Collections
            </Link>
          </div>
          <div className="flex items-start justify-between gap-md">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-text-primary truncate">
                {isCollectionLoading ? '...' : (collection?.name ?? 'Unknown Collection')}
              </h1>
              <p className="text-text-secondary mt-sm text-sm">
                Ask questions about your documents
              </p>
            </div>
            {/* View mode toggle */}
            <fieldset className="flex flex-wrap gap-sm" aria-label="View mode">
              <label
                className={`px-md py-sm min-h-[44px] rounded text-sm font-medium transition-all duration-200 cursor-pointer ${
                  viewMode === 'chat'
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
                }`}
              >
                <input
                  type="radio"
                  name="viewMode"
                  value="chat"
                  checked={viewMode === 'chat'}
                  onChange={() => setViewMode('chat')}
                  className="sr-only"
                />
                Chat View
              </label>
              <label
                className={`px-md py-sm min-h-[44px] rounded text-sm font-medium transition-all duration-200 cursor-pointer ${
                  viewMode === 'synthesis'
                    ? 'bg-accent text-white shadow-sm'
                    : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
                } ${!lastUserQuery ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="viewMode"
                  value="synthesis"
                  checked={viewMode === 'synthesis'}
                  onChange={() => setViewMode('synthesis')}
                  className="sr-only"
                  disabled={!lastUserQuery}
                  aria-disabled={!lastUserQuery}
                  title={
                    !lastUserQuery ? 'Send a message first to enable synthesis' : 'View synthesis'
                  }
                />
                Synthesis View
              </label>
            </fieldset>
          </div>
        </div>

        {isCollectionError && (
          <div className="px-md">
            <div className="card bg-red-50 border-error mb-lg">
              <div className="flex items-start gap-md">
                <AlertCircle className="text-error flex-shrink-0" size={24} />
                <div>
                  <h3 className="font-semibold text-error mb-sm">
                    Failed to load collection details
                  </h3>
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
          </div>
        )}

        {/* Conditional view rendering */}
        {viewMode === 'chat' ? (
          /* Chat interface */
          <div className="flex-1 card flex flex-col overflow-hidden mx-md mb-md">
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
                  {/* Streaming message indicator */}
                  {isStreaming && (
                    <StreamingMessage
                      content={streamingContent}
                      isStreaming={true}
                      toolCalls={streamingToolCalls}
                    />
                  )}
                  {/* Legacy loading indicator (for non-streaming fallback) */}
                  {chatMutation.isPending && !isStreaming && (
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
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message..."
                  className="input flex-1"
                  // Don't disable input while loading to allow queueing/optimistic updates
                  // disabled={isLoading}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!inputValue.trim()} // Allow sending even if loading (queueing handled by mutation chain ideally or just optimistic)
                >
                  {isLoading ? 'Sending...' : 'Send →'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Synthesis view */
          <div className="flex-1 overflow-y-auto px-md pb-md">
            {lastUserQuery && collectionId ? (
              <SynthesisView query={lastUserQuery} collectionId={collectionId} />
            ) : (
              <div className="card bg-bg-secondary text-center py-xl">
                <p className="text-text-secondary">
                  Send a message first to view synthesis results
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
