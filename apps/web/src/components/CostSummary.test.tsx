import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CostSummary } from './CostSummary';

describe('CostSummary', () => {
  it('renders current spend and budget correctly', () => {
    render(<CostSummary current={5.25} budget={10} percentage={52.5} remaining={4.75} />);

    expect(screen.getByText('$5.25')).toBeInTheDocument();
    expect(screen.getByText('/ $10.00')).toBeInTheDocument();
    expect(screen.getByText(/52\.5% used/)).toBeInTheDocument();
    expect(screen.getByText(/\$4\.75 remaining/)).toBeInTheDocument();
  });

  it('displays green color when usage is below 80%', () => {
    render(<CostSummary current={5} budget={10} percentage={50} remaining={5} />);

    const currentSpend = screen.getByText('$5.00');
    expect(currentSpend).toHaveClass('text-green-600');
  });

  it('displays red color and warning when usage is above 80%', () => {
    render(<CostSummary current={9} budget={10} percentage={90} remaining={1} />);

    const currentSpend = screen.getByText('$9.00');
    expect(currentSpend).toHaveClass('text-red-600');

    // Warning message should appear
    expect(screen.getByText(/You've reached 90% of your monthly budget/)).toBeInTheDocument();
  });

  it('displays warning at exactly 80%', () => {
    render(<CostSummary current={8} budget={10} percentage={80} remaining={2} />);

    expect(screen.getByText(/You've reached 80% of your monthly budget/)).toBeInTheDocument();
  });

  it('does not show warning below 80%', () => {
    render(<CostSummary current={7.9} budget={10} percentage={79} remaining={2.1} />);

    expect(screen.queryByText(/You've reached/)).not.toBeInTheDocument();
  });

  it('renders progress bar with correct aria attributes', () => {
    render(<CostSummary current={5} budget={10} percentage={50} remaining={5} />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('caps progress bar at 100% even if over budget', () => {
    const { container } = render(
      <CostSummary current={15} budget={10} percentage={150} remaining={-5} />
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveStyle({ width: '100%' });
  });

  it('formats decimal values correctly', () => {
    render(<CostSummary current={5.678} budget={10.123} percentage={56.08} remaining={4.445} />);

    expect(screen.getByText('$5.68')).toBeInTheDocument();
    expect(screen.getByText('/ $10.12')).toBeInTheDocument();
    expect(screen.getByText(/56\.1% used/)).toBeInTheDocument();
    expect(screen.getByText(/\$4\.45 remaining/)).toBeInTheDocument();
  });
});
