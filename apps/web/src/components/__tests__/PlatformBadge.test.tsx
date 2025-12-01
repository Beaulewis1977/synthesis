import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlatformBadge } from '../PlatformBadge';

describe('PlatformBadge', () => {
  it('renders mobile platform with green styling and phone emoji', () => {
    render(<PlatformBadge platform="mobile" />);

    const badge = screen.getByLabelText('Platform: mobile');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Mobile');
    expect(badge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-300');
  });

  it('renders web platform with blue styling and globe emoji', () => {
    render(<PlatformBadge platform="web" />);

    const badge = screen.getByLabelText('Platform: web');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Web');
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-300');
  });

  it('renders backend platform with purple styling and gear emoji', () => {
    render(<PlatformBadge platform="backend" />);

    const badge = screen.getByLabelText('Platform: backend');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Backend');
    expect(badge).toHaveClass('bg-purple-100', 'text-purple-800', 'border-purple-300');
  });

  it('renders shared platform with gray styling and link emoji', () => {
    render(<PlatformBadge platform="shared" />);

    const badge = screen.getByLabelText('Platform: shared');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Shared');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-300');
  });

  it('returns null for undefined platform', () => {
    const { container } = render(<PlatformBadge platform={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null for null platform', () => {
    const { container } = render(<PlatformBadge platform={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null for empty string platform', () => {
    const { container } = render(<PlatformBadge platform="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null for whitespace-only platform', () => {
    const { container } = render(<PlatformBadge platform="   " />);
    expect(container).toBeEmptyDOMElement();
  });

  it('handles unknown platform gracefully with gray styling', () => {
    render(<PlatformBadge platform="unknown" />);

    const badge = screen.getByLabelText('Platform: unknown');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('unknown');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-300');
  });

  it('is case-insensitive and handles uppercase MOBILE', () => {
    render(<PlatformBadge platform="MOBILE" />);

    const badge = screen.getByLabelText('Platform: mobile');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Mobile');
    expect(badge).toHaveClass('bg-green-100');
  });

  it('is case-insensitive and handles mixed case Mobile', () => {
    render(<PlatformBadge platform="Mobile" />);

    const badge = screen.getByLabelText('Platform: mobile');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Mobile');
    expect(badge).toHaveClass('bg-green-100');
  });

  it('is case-insensitive and handles lowercase mobile', () => {
    render(<PlatformBadge platform="mobile" />);

    const badge = screen.getByLabelText('Platform: mobile');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-100');
  });

  it('applies custom className when provided', () => {
    render(<PlatformBadge platform="mobile" className="custom-class" />);

    const badge = screen.getByLabelText('Platform: mobile');
    expect(badge).toHaveClass('custom-class');
  });

  it('displays correct tooltip for mobile platform', () => {
    render(<PlatformBadge platform="mobile" />);

    const badge = screen.getByLabelText('Platform: mobile');
    expect(badge).toHaveAttribute(
      'title',
      'Mobile platform content (Flutter, React Native, native apps)'
    );
  });

  it('displays correct tooltip for web platform', () => {
    render(<PlatformBadge platform="web" />);

    const badge = screen.getByLabelText('Platform: web');
    expect(badge).toHaveAttribute('title', 'Web platform content (React, Vue, browser-based)');
  });
});
