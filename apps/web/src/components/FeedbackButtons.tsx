import { useMutation } from '@tanstack/react-query';
import { Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../lib/api';

interface FeedbackButtonsProps {
  query: string;
  collectionId: string;
  docId?: string;
  chunkId?: number;
  resultPosition?: number;
  similarityScore?: number;
  size?: 'sm' | 'md';
  onFeedbackSubmitted?: (rating: -1 | 1) => void;
}

export function FeedbackButtons({
  query,
  collectionId,
  docId,
  chunkId,
  resultPosition,
  similarityScore,
  size = 'sm',
  onFeedbackSubmitted,
}: FeedbackButtonsProps) {
  const [submitted, setSubmitted] = useState<-1 | 1 | null>(null);

  const feedbackMutation = useMutation({
    mutationFn: (rating: -1 | 1) =>
      apiClient.submitSearchFeedback({
        query,
        collection_id: collectionId,
        doc_id: docId,
        chunk_id: chunkId,
        rating,
        result_position: resultPosition,
        similarity_score: similarityScore,
      }),
    onSuccess: (_, rating) => {
      setSubmitted(rating);
      onFeedbackSubmitted?.(rating);
    },
  });

  const iconSize = size === 'sm' ? 14 : 18;
  const buttonClass = size === 'sm' ? 'p-1' : 'p-1.5';

  if (submitted !== null) {
    return (
      <div className="flex items-center gap-xs text-xs text-text-secondary">
        {submitted === 1 ? (
          <>
            <ThumbsUp size={iconSize} className="text-success" />
            <span>Thanks!</span>
          </>
        ) : (
          <>
            <ThumbsDown size={iconSize} className="text-warning" />
            <span>Noted</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-xs">
      <button
        type="button"
        onClick={() => feedbackMutation.mutate(1)}
        disabled={feedbackMutation.isPending}
        className={`${buttonClass} rounded hover:bg-success/10 text-text-secondary hover:text-success transition-colors`}
        title="Helpful result"
        aria-label="Mark as helpful"
      >
        {feedbackMutation.isPending ? (
          <Loader2 size={iconSize} className="animate-spin" />
        ) : (
          <ThumbsUp size={iconSize} />
        )}
      </button>
      <button
        type="button"
        onClick={() => feedbackMutation.mutate(-1)}
        disabled={feedbackMutation.isPending}
        className={`${buttonClass} rounded hover:bg-warning/10 text-text-secondary hover:text-warning transition-colors`}
        title="Not helpful"
        aria-label="Mark as not helpful"
      >
        <ThumbsDown size={iconSize} />
      </button>
    </div>
  );
}

// Chat-specific feedback component
interface ChatFeedbackProps {
  sessionId: string;
  messageId: string;
  onFeedbackSubmitted?: (rating: -1 | 1) => void;
}

export function ChatFeedback({ sessionId, messageId, onFeedbackSubmitted }: ChatFeedbackProps) {
  const [submitted, setSubmitted] = useState<-1 | 1 | null>(null);

  const feedbackMutation = useMutation({
    mutationFn: (rating: -1 | 1) =>
      apiClient.submitSearchFeedback({
        query: messageId, // Using messageId as reference
        collection_id: sessionId,
        rating,
      }),
    onSuccess: (_, rating) => {
      setSubmitted(rating);
      onFeedbackSubmitted?.(rating);
    },
  });

  if (submitted !== null) {
    return (
      <div className="flex items-center gap-sm text-xs text-text-secondary">
        {submitted === 1 ? (
          <span className="flex items-center gap-xs text-success">
            <ThumbsUp size={12} />
            Thanks for your feedback!
          </span>
        ) : (
          <span className="flex items-center gap-xs text-warning">
            <ThumbsDown size={12} />
            We'll work on improving this.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-sm">
      <span className="text-xs text-text-secondary">Was this helpful?</span>
      <div className="flex items-center gap-xs">
        <button
          type="button"
          onClick={() => feedbackMutation.mutate(1)}
          disabled={feedbackMutation.isPending}
          className="p-1 rounded hover:bg-success/10 text-text-secondary hover:text-success transition-colors"
          title="Yes, helpful"
        >
          {feedbackMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ThumbsUp size={14} />
          )}
        </button>
        <button
          type="button"
          onClick={() => feedbackMutation.mutate(-1)}
          disabled={feedbackMutation.isPending}
          className="p-1 rounded hover:bg-warning/10 text-text-secondary hover:text-warning transition-colors"
          title="No, not helpful"
        >
          <ThumbsDown size={14} />
        </button>
      </div>
    </div>
  );
}
