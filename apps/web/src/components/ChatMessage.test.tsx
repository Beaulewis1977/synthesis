import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChatMessage as ChatMessageType } from '../types';
import { ChatMessage } from './ChatMessage';

describe('ChatMessage', () => {
  it('renders user message with correct styling', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'user',
      content: 'Hello, agent!',
    };

    render(<ChatMessage message={message} />);

    const element = screen.getByText('Hello, agent!');
    expect(element).toBeInTheDocument();

    // User messages should be right-aligned
    const container = element.closest('[data-role="user"]');
    expect(container).toHaveClass('justify-end');
  });

  it('renders assistant message with correct styling', () => {
    const message: ChatMessageType = {
      id: '2',
      role: 'assistant',
      content: 'Hello, user!',
    };

    render(<ChatMessage message={message} />);

    const element = screen.getByText('Hello, user!');
    expect(element).toBeInTheDocument();

    // Assistant messages should be left-aligned
    const container = element.closest('[data-role="assistant"]');
    expect(container).toHaveClass('justify-start');
  });

  it('renders tool calls when present', () => {
    const message: ChatMessageType = {
      id: '3',
      role: 'assistant',
      content: 'I searched the documents for you.',
      tool_calls: [
        {
          id: 'tool-1',
          tool: 'search_rag',
          status: 'completed',
        },
        {
          id: 'tool-2',
          tool: 'list_documents',
          status: 'completed',
        },
      ],
    };

    render(<ChatMessage message={message} />);

    expect(screen.getByText('Tools Used:')).toBeInTheDocument();
    expect(screen.getByText('search_rag')).toBeInTheDocument();
    expect(screen.getByText('list_documents')).toBeInTheDocument();
  });

  it('does not render tool calls section when no tools used', () => {
    const message: ChatMessageType = {
      id: '4',
      role: 'assistant',
      content: 'Simple message',
    };

    render(<ChatMessage message={message} />);

    expect(screen.queryByText('Tools Used:')).not.toBeInTheDocument();
  });

  it('renders citations when present', () => {
    const message: ChatMessageType = {
      id: '5',
      role: 'assistant',
      content: 'According to the documentation...',
      citations: [
        {
          title: 'Getting Started Guide',
          page: 12,
          section: 'Installation',
        },
        {
          title: 'API Reference',
          page: 45,
        },
      ],
    };

    render(<ChatMessage message={message} />);

    expect(screen.getByText('📚 Sources:')).toBeInTheDocument();
    expect(screen.getByText(/Getting Started Guide.*p. 12.*Installation/i)).toBeInTheDocument();
    expect(screen.getByText(/API Reference.*p. 45/i)).toBeInTheDocument();
  });

  it('does not render citations section when no citations', () => {
    const message: ChatMessageType = {
      id: '6',
      role: 'assistant',
      content: 'No citations here',
    };

    render(<ChatMessage message={message} />);

    expect(screen.queryByText('📚 Sources:')).not.toBeInTheDocument();
  });

  it('handles multi-line content correctly', () => {
    const message: ChatMessageType = {
      id: '7',
      role: 'assistant',
      content: 'Line 1\nLine 2\nLine 3',
    };

    render(<ChatMessage message={message} />);

    const element = screen.getByText(/Line 1\s*Line 2\s*Line 3/i);
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass('whitespace-pre-wrap');
  });
});
