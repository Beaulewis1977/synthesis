import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsageTierBadge } from '../UsageTierBadge';

describe('UsageTierBadge', () => {
  it('renders official tier with green styling and book emoji', () => {
    render(<UsageTierBadge usageTier="official" />);

    const badge = screen.getByLabelText('Usage tier: official');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Official');
    expect(badge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-300');
  });

  it('renders reference tier with blue styling and books emoji', () => {
    render(<UsageTierBadge usageTier="reference" />);

    const badge = screen.getByLabelText('Usage tier: reference');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Reference');
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-300');
  });

  it('renders example tier with amber styling and lightbulb emoji', () => {
    render(<UsageTierBadge usageTier="example" />);

    const badge = screen.getByLabelText('Usage tier: example');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Example');
    expect(badge).toHaveClass('bg-amber-100', 'text-amber-800', 'border-amber-300');
  });

  it('renders recipe tier with purple styling and cooking emoji', () => {
    render(<UsageTierBadge usageTier="recipe" />);

    const badge = screen.getByLabelText('Usage tier: recipe');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Recipe');
    expect(badge).toHaveClass('bg-purple-100', 'text-purple-800', 'border-purple-300');
  });

  it('returns null for undefined usageTier', () => {
    const { container } = render(<UsageTierBadge usageTier={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null for null usageTier', () => {
    const { container } = render(<UsageTierBadge usageTier={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null for empty string usageTier', () => {
    const { container } = render(<UsageTierBadge usageTier="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null for whitespace-only usageTier', () => {
    const { container } = render(<UsageTierBadge usageTier="   " />);
    expect(container).toBeEmptyDOMElement();
  });

  it('handles unknown tier gracefully with gray styling', () => {
    render(<UsageTierBadge usageTier="custom-tier" />);

    const badge = screen.getByLabelText('Usage tier: custom-tier');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('custom-tier');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-300');
  });

  it('is case-insensitive and handles uppercase OFFICIAL', () => {
    render(<UsageTierBadge usageTier="OFFICIAL" />);

    const badge = screen.getByLabelText('Usage tier: official');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Official');
    expect(badge).toHaveClass('bg-green-100');
  });

  it('is case-insensitive and handles mixed case Reference', () => {
    render(<UsageTierBadge usageTier="Reference" />);

    const badge = screen.getByLabelText('Usage tier: reference');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Reference');
    expect(badge).toHaveClass('bg-blue-100');
  });

  it('applies custom className when provided', () => {
    render(<UsageTierBadge usageTier="official" className="custom-class" />);

    const badge = screen.getByLabelText('Usage tier: official');
    expect(badge).toHaveClass('custom-class');
  });

  it('displays correct tooltip for official tier', () => {
    render(<UsageTierBadge usageTier="official" />);

    const badge = screen.getByLabelText('Usage tier: official');
    expect(badge).toHaveAttribute('title', 'Authoritative documentation from official sources');
  });

  it('displays correct tooltip for recipe tier', () => {
    render(<UsageTierBadge usageTier="recipe" />);

    const badge = screen.getByLabelText('Usage tier: recipe');
    expect(badge).toHaveAttribute(
      'title',
      'Curated implementation guides with opinionated patterns'
    );
  });

  it('displays unknown tooltip for unknown tier', () => {
    render(<UsageTierBadge usageTier="mystery" />);

    const badge = screen.getByLabelText('Usage tier: mystery');
    expect(badge).toHaveAttribute('title', 'Unknown usage tier: mystery');
  });
});
