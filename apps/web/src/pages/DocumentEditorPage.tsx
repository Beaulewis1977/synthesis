import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Edit2,
  FileText,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import type { Chunk } from '../types';

export function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [editingChunk, setEditingChunk] = useState<number | null>(null);
  const [editedText, setEditedText] = useState('');
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());

  // Fetch document chunks
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['document-chunks', id],
    queryFn: () => {
      if (!id) throw new Error('Document ID is required');
      return apiClient.getDocumentChunks(id);
    },
    enabled: !!id,
  });

  // Update chunk mutation
  const updateChunkMutation = useMutation({
    mutationFn: ({ chunkIndex, text }: { chunkIndex: number; text: string }) => {
      if (!id) throw new Error('Document ID is required');
      return apiClient.updateChunk(id, chunkIndex, { text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-chunks', id] });
      setEditingChunk(null);
      setEditedText('');
    },
  });

  const toggleChunkExpanded = (chunkIndex: number) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(chunkIndex)) {
        next.delete(chunkIndex);
      } else {
        next.add(chunkIndex);
      }
      return next;
    });
  };

  const startEditing = (chunk: Chunk) => {
    setEditingChunk(chunk.chunk_index);
    setEditedText(chunk.text);
    setExpandedChunks((prev) => new Set(prev).add(chunk.chunk_index));
  };

  const cancelEditing = () => {
    setEditingChunk(null);
    setEditedText('');
  };

  const saveChunk = (chunkIndex: number) => {
    updateChunkMutation.mutate({ chunkIndex, text: editedText });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-xl">
        <Loader2 className="animate-spin text-accent" size={32} />
        <span className="ml-md text-text-secondary">Loading document chunks...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div>
        <Link to="/" className="text-accent hover:underline mb-md inline-block">
          ← Back to Collections
        </Link>
        <div className="card bg-red-50 border-error">
          <div className="flex items-start gap-md">
            <AlertCircle className="text-error flex-shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-error mb-sm">Failed to load document</h3>
              <p className="text-sm text-text-secondary">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-lg">
        <Link to="/" className="text-accent hover:underline mb-md inline-block">
          ← Back to Collections
        </Link>
        <div className="flex items-center gap-md mb-sm">
          <FileText className="text-accent" size={28} />
          <h1 className="text-2xl font-bold text-text-primary">{data.document.title}</h1>
        </div>
        <p className="text-text-secondary">
          {data.total} chunk{data.total !== 1 ? 's' : ''} • Status: {data.document.status}
        </p>
      </div>

      {/* Chunks List */}
      <div className="space-y-md">
        {data.chunks.map((chunk) => {
          const isExpanded = expandedChunks.has(chunk.chunk_index);
          const isEditing = editingChunk === chunk.chunk_index;

          return (
            <div key={chunk.id} className="card">
              {/* Chunk Header */}
              <div
                className="flex items-center justify-between cursor-pointer w-full text-left"
                onClick={() => !isEditing && toggleChunkExpanded(chunk.chunk_index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isEditing) {
                    toggleChunkExpanded(chunk.chunk_index);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-sm">
                  {isExpanded ? (
                    <ChevronDown className="text-text-secondary" size={20} />
                  ) : (
                    <ChevronRight className="text-text-secondary" size={20} />
                  )}
                  <span className="font-medium">Chunk {chunk.chunk_index + 1}</span>
                  <span className="text-sm text-text-secondary">
                    ({chunk.token_count || '?'} tokens)
                  </span>
                  {chunk.has_embedding && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      Embedded
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-sm">
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(chunk);
                      }}
                      className="btn btn-sm flex items-center gap-xs"
                      title="Edit chunk"
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Chunk Content */}
              {isExpanded && (
                <div className="mt-md pt-md border-t border-border">
                  {isEditing ? (
                    <div className="space-y-md">
                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className="input w-full min-h-[200px] font-mono text-sm"
                        placeholder="Chunk text..."
                      />
                      <div className="flex justify-end gap-sm">
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="btn btn-secondary flex items-center gap-xs"
                          disabled={updateChunkMutation.isPending}
                        >
                          <X size={14} />
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveChunk(chunk.chunk_index)}
                          className="btn btn-primary flex items-center gap-xs"
                          disabled={updateChunkMutation.isPending || editedText === chunk.text}
                        >
                          {updateChunkMutation.isPending ? (
                            <Loader2 className="animate-spin" size={14} />
                          ) : (
                            <Save size={14} />
                          )}
                          Save Changes
                        </button>
                      </div>
                      {updateChunkMutation.isError && (
                        <div className="text-sm text-error bg-red-50 p-3 rounded-md">
                          {updateChunkMutation.error instanceof Error
                            ? updateChunkMutation.error.message
                            : 'Failed to save changes'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <pre className="whitespace-pre-wrap text-sm bg-bg-secondary p-md rounded-md overflow-x-auto">
                        {chunk.text}
                      </pre>

                      {/* Metadata */}
                      {Object.keys(chunk.metadata).length > 0 && (
                        <div className="mt-md">
                          <h4 className="text-sm font-medium text-text-secondary mb-sm">
                            Metadata
                          </h4>
                          <div className="bg-bg-secondary p-md rounded-md">
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(chunk.metadata, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.chunks.length === 0 && (
        <div className="card text-center py-xl">
          <FileText className="mx-auto text-text-secondary mb-md" size={48} />
          <h3 className="text-lg font-semibold text-text-primary mb-sm">No chunks yet</h3>
          <p className="text-text-secondary">
            This document hasn't been processed yet or has no content.
          </p>
        </div>
      )}
    </div>
  );
}
