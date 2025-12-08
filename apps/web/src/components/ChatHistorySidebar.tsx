import { format } from 'date-fns';
import { MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChatSession } from '../types';

interface ChatHistorySidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newTitle: string) => void;
  onBatchDeleteSessions?: (sessionIds: string[]) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function ChatHistorySidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onBatchDeleteSessions,
  className = '',
  style,
}: ChatHistorySidebarProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

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

  const handleEditClick = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleEditSave = (sessionId: string) => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== sessions.find((s) => s.id === sessionId)?.title) {
      onRenameSession?.(sessionId, trimmed);
    }
    setEditingId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      handleEditSave(sessionId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const handleCheckboxChange = (sessionId: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(sessionId);
    } else {
      newSet.delete(sessionId);
    }
    setSelectedIds(newSet);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size > 0) {
      onBatchDeleteSessions?.(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  return (
    <div
      className={`flex flex-col h-full bg-bg-secondary border-r border-border ${className}`}
      style={style}
    >
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

      {/* Selection mode toggle */}
      {sessions.length > 0 && onBatchDeleteSessions && (
        <div className="px-md py-sm border-b border-border flex items-center justify-between">
          <span className="text-xs text-text-secondary">
            {isSelectionMode ? `${selectedIds.size} selected` : `${sessions.length} chats`}
          </span>
          <button
            type="button"
            onClick={toggleSelectionMode}
            className="text-xs text-accent hover:underline"
          >
            {isSelectionMode ? 'Cancel' : 'Manage'}
          </button>
        </div>
      )}

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
                  onClick={() => !isSelectionMode && onSelectSession(session.id)}
                  className={`w-full text-left p-sm rounded-md transition-colors flex items-start gap-sm cursor-pointer ${
                    currentSessionId === session.id
                      ? 'bg-accent/10 text-accent'
                      : 'hover:bg-bg-hover text-text-primary'
                  }`}
                >
                  {/* Selection checkbox */}
                  {isSelectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(session.id)}
                      onChange={(e) => handleCheckboxChange(session.id, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 flex-shrink-0"
                    />
                  )}

                  {!isSelectionMode && (
                    <MessageSquare
                      size={16}
                      className={`mt-1 flex-shrink-0 ${
                        currentSessionId === session.id ? 'text-accent' : 'text-text-secondary'
                      }`}
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    {editingId === session.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleEditSave(session.id)}
                        onKeyDown={(e) => handleEditKeyDown(e, session.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-xs py-0.5 text-sm rounded border border-accent bg-white focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    ) : (
                      <p className="font-medium text-sm truncate">{session.title}</p>
                    )}
                    <div className="flex items-center gap-xs text-xs text-text-secondary">
                      <span className="truncate">
                        {session.updated_at
                          ? (() => {
                              try {
                                return format(new Date(session.updated_at), 'MMM d, h:mm a');
                              } catch {
                                return 'Unknown date';
                              }
                            })()
                          : 'Unknown date'}
                      </span>
                      {session.model && (
                        <>
                          <span>•</span>
                          <span
                            className="truncate max-w-[80px]"
                            title={`${session.provider || ''}/${session.model}`}
                          >
                            {session.model.split('/').pop() || session.model}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action buttons (only show when not in selection mode) */}
                  {!isSelectionMode && (
                    <div className="flex gap-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      {onRenameSession && (
                        <button
                          type="button"
                          onClick={(e) => handleEditClick(e, session)}
                          className="p-xs rounded hover:bg-bg-hover text-text-secondary hover:text-accent"
                          title="Rename"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {onDeleteSession && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(e, session.id)}
                          className="p-xs rounded hover:bg-red-100 text-text-secondary hover:text-red-600"
                          title="Delete session"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Batch delete button */}
      {isSelectionMode && selectedIds.size > 0 && (
        <div className="p-sm border-t border-border">
          <button
            type="button"
            onClick={handleBatchDelete}
            className="w-full py-sm text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Delete Selected ({selectedIds.size})
          </button>
        </div>
      )}
    </div>
  );
}
