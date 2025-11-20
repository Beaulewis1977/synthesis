import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CostBreakdown } from './CostBreakdown';

describe('CostBreakdown', () => {
  const mockBreakdown = [
    { provider: 'cohere', operation: 'rerank', total_cost: 2.5, request_count: 250 },
    { provider: 'openai', operation: 'embed', total_cost: 1.5, request_count: 500 },
    { provider: 'voyage', operation: 'embed', total_cost: 1.0, request_count: 300 },
  ];

  it('renders breakdown items correctly', () => {
    render(<CostBreakdown breakdown={mockBreakdown} />);

    expect(screen.getByText('cohere - rerank')).toBeInTheDocument();
    expect(screen.getByText('openai - embed')).toBeInTheDocument();
    expect(screen.getByText('voyage - embed')).toBeInTheDocument();
  });

  it('calculates and displays percentages correctly', () => {
    render(<CostBreakdown breakdown={mockBreakdown} />);

    // Total = 5.0, so cohere (2.5) = 50%, openai (1.5) = 30%, voyage (1.0) = 20%
    expect(screen.getByText(/\$2\.50 \(50%\)/)).toBeInTheDocument();
    expect(screen.getByText(/\$1\.50 \(30%\)/)).toBeInTheDocument();
    expect(screen.getByText(/\$1\.00 \(20%\)/)).toBeInTheDocument();
  });

  it('displays request counts correctly', () => {
    render(<CostBreakdown breakdown={mockBreakdown} />);

    expect(screen.getByText('250 requests')).toBeInTheDocument();
    expect(screen.getByText('500 requests')).toBeInTheDocument();
    expect(screen.getByText('300 requests')).toBeInTheDocument();
  });

  it('formats large request counts with commas', () => {
    const largeBreakdown = [
      { provider: 'openai', operation: 'embed', total_cost: 10, request_count: 25000 },
    ];

    render(<CostBreakdown breakdown={largeBreakdown} />);

    expect(screen.getByText('25,000 requests')).toBeInTheDocument();
  });

  it('renders empty state when no breakdown provided', () => {
    render(<CostBreakdown breakdown={[]} />);

    expect(screen.getByText('No API usage recorded yet this month')).toBeInTheDocument();
  });

  it('renders progress bars with correct aria attributes', () => {
    render(<CostBreakdown breakdown={mockBreakdown} />);

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(3);

    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '50');
    expect(progressBars[1]).toHaveAttribute('aria-valuenow', '30');
    expect(progressBars[2]).toHaveAttribute('aria-valuenow', '20');
  });

  it('handles single item breakdown', () => {
    const singleItem = [
      { provider: 'anthropic', operation: 'chat', total_cost: 5.0, request_count: 100 },
    ];

    render(<CostBreakdown breakdown={singleItem} />);

    expect(screen.getByText('anthropic - chat')).toBeInTheDocument();
    expect(screen.getByText(/\$5\.00 \(100%\)/)).toBeInTheDocument();
  });

  it('rounds percentages to whole numbers', () => {
    const breakdown = [
      { provider: 'a', operation: 'op1', total_cost: 1.234, request_count: 100 },
      { provider: 'b', operation: 'op2', total_cost: 2.345, request_count: 200 },
    ];

    render(<CostBreakdown breakdown={breakdown} />);

    // 1.234/3.579 = 34.48%, should round to 34%
    // 2.345/3.579 = 65.52%, should round to 66%
    expect(screen.getByText(/\(34%\)/)).toBeInTheDocument();
    expect(screen.getByText(/\(66%\)/)).toBeInTheDocument();
  });
});
