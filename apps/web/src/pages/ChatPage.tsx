import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, GripVertical, Menu, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChatHistorySidebar } from '../components/ChatHistorySidebar';
import { ChatMessage } from '../components/ChatMessage';
import { ChatModelSelector } from '../components/ChatModelSelector';
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
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('chat-sidebar-width');
    return saved ? Number(saved) : 256; // Default 256px (w-64)
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Track freshly created sessions to prevent message sync overwriting optimistic updates
  const justCreatedSessionRef = useRef<string | null>(null);

  // Message queue for follow-up messages sent while streaming
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);

  // Sidebar resize handlers
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
        // Clamp between 200px and 500px
        const clampedWidth = Math.max(200, Math.min(500, newWidth));
        setSidebarWidth(clampedWidth);
        localStorage.setItem('chat-sidebar-width', String(clampedWidth));
      }
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      // Prevent text selection while dragging
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, resize, stopResizing]);

  // Streaming chat hook
  const {
    isStreaming,
    content: streamingContent,
    toolCalls: streamingToolCalls,
    streamChat,
    cancelStream,
  } = useStreamingChat({
    onComplete: (content, _usage, toolCalls) => {
      // Add completed streaming message to messages array
      // Note: toolCalls passed as parameter to avoid stale closure
      const assistantMessage: ChatMessageType = {
        id: createMessageId(),
        role: 'assistant',
        content,
        tool_calls: toolCalls.map((tc, idx) => ({
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

  // Sync messages and model selection when session data is loaded
  useEffect(() => {
    if (sessionData?.session) {
      // Only override provider/model if session has them set
      // This allows localStorage preference to persist when session doesn't specify
      if (sessionData.session.provider) {
        setSelectedProvider(sessionData.session.provider);
      }
      if (sessionData.session.model) {
        setSelectedModel(sessionData.session.model);
      }
    }
    // Only sync messages if this is an existing session being loaded, not freshly created
    // This prevents overwriting optimistically added user messages
    if (sessionData?.messages && sessionData.session?.id !== justCreatedSessionRef.current) {
      setMessages(sessionData.messages);
      // If it's an existing session, set the last user query for synthesis view context
      const lastUserMsg = [...sessionData.messages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg) {
        setLastUserQuery(lastUserMsg.content);
      }
    }
    // Clear the flag after first check so subsequent loads work normally
    if (justCreatedSessionRef.current === sessionData?.session?.id) {
      justCreatedSessionRef.current = null;
    }
  }, [sessionData]);

  // Load saved model preference for collection from localStorage
  useEffect(() => {
    if (!collectionId) return;

    const key = `chat-model-${collectionId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const { provider, model } = JSON.parse(saved);
        setSelectedProvider(provider);
        setSelectedModel(model);
      } catch {
        // Ignore parse errors
      }
    }
  }, [collectionId]);

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

  // Auto-resize textarea based on content
  // biome-ignore lint/correctness/useExhaustiveDependencies: inputValue triggers resize when content changes
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight, capped at max-height (200px = ~6 lines)
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  // Process pending messages after streaming completes using latest context values
  useEffect(() => {
    if (!isStreaming || pendingMessages.length === 0 || !collectionId || !sessionId) return;

    // Combine all pending messages into one request
    const combinedMessage = pendingMessages.join('\n\n---\n\n');
    setPendingMessages([]);

    // Build history from current messages (which includes all user messages already)
    const history = messages.slice(-10).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Send combined message
    streamChat({
      message: combinedMessage,
      collection_id: collectionId,
      session_id: sessionId,
      history,
      provider: selectedProvider ?? undefined,
      model: selectedModel ?? undefined,
    });
  }, [
    collectionId,
    isStreaming,
    messages,
    pendingMessages,
    selectedModel,
    selectedProvider,
    sessionId,
    streamChat,
  ]);

  const handleSubmit = async (e: React.FormEvent | React.KeyboardEvent) => {
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

    // If streaming, queue the message instead of sending immediately
    // The queued messages will be combined and sent after current stream completes
    if (isStreaming) {
      setPendingMessages((prev) => [...prev, trimmedMessage]);
      return;
    }

    // Create session if needed
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const title = trimmedMessage.slice(0, 30) + (trimmedMessage.length > 30 ? '...' : '');
        const { session } = await apiClient.createChatSession(collectionId, title);
        currentSessionId = session.id;
        // Mark as freshly created to prevent useEffect from overwriting optimistic messages
        justCreatedSessionRef.current = currentSessionId;
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
      provider: selectedProvider ?? undefined,
      model: selectedModel ?? undefined,
    });
  };

  const handleNewChat = () => {
    setSessionId(null);
    setSearchParams({});
    setMessages([]);
    setInputValue('');
    setLastUserQuery(''); // Reset synthesis context
    setSelectedProvider(null);
    setSelectedModel(null);
    setPendingMessages([]); // Clear any queued messages
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

  const handleModelChange = (provider: string, model: string) => {
    setSelectedProvider(provider || null);
    setSelectedModel(model || null);

    // Persist model selection per collection to localStorage
    if (collectionId) {
      const key = `chat-model-${collectionId}`;
      if (provider && model) {
        localStorage.setItem(key, JSON.stringify({ provider, model }));
      } else {
        localStorage.removeItem(key);
      }
    }
  };

  const handleRenameSession = async (id: string, newTitle: string) => {
    try {
      await apiClient.updateChatSessionTitle(id, newTitle);
      refetchSessions();
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  };

  const handleBatchDeleteSessions = async (sessionIds: string[]) => {
    try {
      await apiClient.batchDeleteChatSessions(sessionIds);
      // If we deleted the current session, clear it
      if (sessionId && sessionIds.includes(sessionId)) {
        handleNewChat();
      }
      refetchSessions();
    } catch (error) {
      console.error('Failed to batch delete sessions:', error);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex">
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
        className={`
          ${isResizing ? '' : 'transition-all duration-300 ease-in-out'}
          overflow-hidden border-r border-border bg-bg-secondary flex-shrink-0 relative
        `}
      >
        <ChatHistorySidebar
          sessions={sessionsData?.sessions || []}
          currentSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onBatchDeleteSessions={handleBatchDeleteSessions}
          className="h-full"
          style={{ width: sidebarWidth }}
        />

        {/* Resize handle */}
        {isSidebarOpen && (
          <div
            onMouseDown={startResizing}
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-accent/50 transition-colors group flex items-center justify-center ${
              isResizing ? 'bg-accent' : ''
            }`}
            title="Drag to resize"
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={12} className="text-text-secondary" />
            </div>
          </div>
        )}
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
            {/* Model selector and view mode toggle */}
            <div className="flex items-center gap-md">
              <ChatModelSelector
                sessionId={sessionId}
                currentProvider={selectedProvider}
                currentModel={selectedModel}
                disabled={isStreaming}
                onModelChange={handleModelChange}
              />
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
              <form onSubmit={handleSubmit} className="flex gap-sm items-end">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter to submit (without Shift), Shift+Enter for new line
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  className="input flex-1 resize-none overflow-hidden min-h-[44px] max-h-[200px] py-2"
                  rows={1}
                />
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={cancelStream}
                    className="btn bg-red-600 text-white hover:bg-red-700 flex items-center gap-xs"
                    title="Stop generation"
                  >
                    <Square size={16} />
                    Stop
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary" disabled={!inputValue.trim()}>
                    Send →
                  </button>
                )}
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
