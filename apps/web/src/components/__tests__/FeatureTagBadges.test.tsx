import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FeatureTagBadges from '../FeatureTagBadges';

describe('FeatureTagBadges', () => {
  it('renders single feature tag correctly', () => {
    render(<FeatureTagBadges featureTags={['auth']} />);

    expect(screen.getByText('Auth')).toBeInTheDocument();
  });

  it('renders multiple feature tags', () => {
    render(<FeatureTagBadges featureTags={['auth', 'payments', 'offline']} />);

    expect(screen.getByText('Auth')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('converts snake_case to Title Case', () => {
    render(<FeatureTagBadges featureTags={['push_notifications']} />);

    expect(screen.getByText('Push Notifications')).toBeInTheDocument();
  });

  it('handles multiple snake_case tags', () => {
    render(
      <FeatureTagBadges featureTags={['push_notifications', 'local_storage', 'deep_linking']} />
    );

    expect(screen.getByText('Push Notifications')).toBeInTheDocument();
    expect(screen.getByText('Local Storage')).toBeInTheDocument();
    expect(screen.getByText('Deep Linking')).toBeInTheDocument();
  });

  it('returns null for undefined featureTags', () => {
    const { container } = render(<FeatureTagBadges featureTags={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null for null featureTags', () => {
    const { container } = render(<FeatureTagBadges featureTags={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null for empty array', () => {
    const { container } = render(<FeatureTagBadges featureTags={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('deduplicates tags', () => {
    render(<FeatureTagBadges featureTags={['auth', 'auth', 'payments', 'auth']} />);

    const authBadges = screen.getAllByText('Auth');
    expect(authBadges).toHaveLength(1);
    expect(screen.getByText('Payments')).toBeInTheDocument();
  });

  it('preserves order while deduplicating', () => {
    const { container } = render(
      <FeatureTagBadges featureTags={['payments', 'auth', 'payments', 'offline']} />
    );

    const badges = container.querySelectorAll('span.inline-flex');
    expect(badges[0]).toHaveTextContent('Payments');
    expect(badges[1]).toHaveTextContent('Auth');
    expect(badges[2]).toHaveTextContent('Offline');
  });

  it('converts snake_case with underscores to Title Case', () => {
    render(<FeatureTagBadges featureTags={['state_management', 'deep_linking']} />);

    expect(screen.getByText('State Management')).toBeInTheDocument();
    expect(screen.getByText('Deep Linking')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <FeatureTagBadges featureTags={['auth']} className="custom-class" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('renders with flex-wrap layout', () => {
    const { container } = render(
      <FeatureTagBadges featureTags={['auth', 'payments', 'offline']} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('flex', 'flex-wrap');
  });

  it('applies correct styling to each tag', () => {
    render(<FeatureTagBadges featureTags={['auth']} />);

    const badge = screen.getByText('Auth');
    expect(badge).toHaveClass('bg-slate-100', 'text-slate-700', 'border-slate-200');
  });

  it('sets title attribute for each tag', () => {
    render(<FeatureTagBadges featureTags={['push_notifications']} />);

    const badge = screen.getByText('Push Notifications');
    expect(badge).toHaveAttribute('title', 'Push Notifications');
  });

  it('handles single-word tags correctly', () => {
    render(<FeatureTagBadges featureTags={['auth', 'chat', 'sync']} />);

    expect(screen.getByText('Auth')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Sync')).toBeInTheDocument();
  });

  it('renders all provided valid tags', () => {
    const tags = ['auth', 'payments', 'push_notifications', 'offline', 'analytics'];
    render(<FeatureTagBadges featureTags={tags} />);

    expect(screen.getByText('Auth')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Push Notifications')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });
});
