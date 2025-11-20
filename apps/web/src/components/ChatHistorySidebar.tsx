import { format } from 'date-fns';
import { MessageSquare, Plus } from 'lucide-react';
import type { ChatSession } from '../types';

interface ChatHistorySidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  className?: string;
}

export function ChatHistorySidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  className = '',
}: ChatHistorySidebarProps) {
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
            <button
              key={session.id}
              type="button"
              onClick={() => onSelectSession(session.id)}
              className={`w-full text-left p-sm rounded-md transition-colors flex items-start gap-sm group ${
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
                  {format(new Date(session.updated_at), 'MMM d, h:mm a')}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
