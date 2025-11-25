import { format } from 'date-fns';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ChatSession } from '../types';

interface ChatHistorySidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession?: (sessionId: string) => void;
  className?: string;
}

export function ChatHistorySidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  className = '',
}: ChatHistorySidebarProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(sessionId);
  };

  const handleConfirmDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    onDeleteSession?.(sessionId);
    setDeleteConfirmId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  return (
    <div className={`flex flex-col h-full bg-bg-secondary border-r border-border ${className}`}>
      <div className="p-md border-b border-border">
        <button
          type="button"
          onClick={onNewChat}
          className="btn btn-primary w-full flex items-center justify-center gap-sm"
        >
          <Plus size={18} />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-sm space-y-xs">
        {sessions.length === 0 ? (
          <div className="text-center py-xl text-text-secondary">
            <p className="text-sm">No chat history yet.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="relative group">
              {deleteConfirmId === session.id ? (
                <div className="p-sm rounded-md bg-red-50 border border-red-200 flex items-center justify-between gap-sm">
                  <span className="text-xs text-red-700">Delete?</span>
                  <div className="flex gap-xs">
                    <button
                      type="button"
                      onClick={(e) => handleConfirmDelete(e, session.id)}
                      className="px-sm py-xs text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelDelete}
                      className="px-sm py-xs text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      No
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full text-left p-sm rounded-md transition-colors flex items-start gap-sm ${
                    currentSessionId === session.id
                      ? 'bg-accent/10 text-accent'
                      : 'hover:bg-bg-hover text-text-primary'
                  }`}
                >
                  <MessageSquare
                    size={16}
                    className={`mt-1 flex-shrink-0 ${
                      currentSessionId === session.id ? 'text-accent' : 'text-text-secondary'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{session.title}</p>
                    <p className="text-xs text-text-secondary truncate">
                      {session.updated_at
                        ? (() => {
                            try {
                              return format(new Date(session.updated_at), 'MMM d, h:mm a');
                            } catch {
                              return 'Unknown date';
                            }
                          })()
                        : 'Unknown date'}
                    </p>
                  </div>
                  {onDeleteSession && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, session.id)}
                      className="opacity-0 group-hover:opacity-100 p-xs rounded hover:bg-red-100 text-text-secondary hover:text-red-600 transition-all"
                      title="Delete session"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
