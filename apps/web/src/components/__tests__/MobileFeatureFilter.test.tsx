import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MobileFeatureFilter from '../MobileFeatureFilter';

describe('MobileFeatureFilter', () => {
  const defaultProps = {
    platform: null,
    usageTier: null,
    featureTags: [] as string[],
    onPlatformChange: vi.fn(),
    onUsageTierChange: vi.fn(),
    onFeatureTagsChange: vi.fn(),
  };

  const renderFilter = (props = {}) => {
    const mergedProps = { ...defaultProps, ...props };
    return render(<MobileFeatureFilter {...mergedProps} />);
  };

  describe('Platform Dropdown', () => {
    it('renders platform dropdown with all options', () => {
      renderFilter();

      const platformSelect = screen.getByLabelText('Platform');
      expect(platformSelect).toBeInTheDocument();

      expect(screen.getByRole('option', { name: 'All Platforms' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Mobile' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Web' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Backend' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Shared' })).toBeInTheDocument();
    });

    it('calls onPlatformChange when selection changes', () => {
      const onPlatformChange = vi.fn();
      renderFilter({ onPlatformChange });

      const platformSelect = screen.getByLabelText('Platform');
      fireEvent.change(platformSelect, { target: { value: 'mobile' } });

      expect(onPlatformChange).toHaveBeenCalledWith('mobile');
    });

    it('calls onPlatformChange with null when All Platforms is selected', () => {
      const onPlatformChange = vi.fn();
      renderFilter({ platform: 'mobile', onPlatformChange });

      const platformSelect = screen.getByLabelText('Platform');
      fireEvent.change(platformSelect, { target: { value: '' } });

      expect(onPlatformChange).toHaveBeenCalledWith(null);
    });

    it('displays selected platform value', () => {
      renderFilter({ platform: 'web' });

      const platformSelect = screen.getByLabelText('Platform') as HTMLSelectElement;
      expect(platformSelect.value).toBe('web');
    });
  });

  describe('Usage Tier Dropdown', () => {
    it('renders usage tier dropdown with all options', () => {
      renderFilter();

      const usageTierSelect = screen.getByLabelText('Content Type');
      expect(usageTierSelect).toBeInTheDocument();

      expect(screen.getByRole('option', { name: 'All Content Types' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Official' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Reference' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Example' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Recipe' })).toBeInTheDocument();
    });

    it('calls onUsageTierChange when selection changes', () => {
      const onUsageTierChange = vi.fn();
      renderFilter({ onUsageTierChange });

      const usageTierSelect = screen.getByLabelText('Content Type');
      fireEvent.change(usageTierSelect, { target: { value: 'recipe' } });

      expect(onUsageTierChange).toHaveBeenCalledWith('recipe');
    });

    it('calls onUsageTierChange with null when All Content Types is selected', () => {
      const onUsageTierChange = vi.fn();
      renderFilter({ usageTier: 'official', onUsageTierChange });

      const usageTierSelect = screen.getByLabelText('Content Type');
      fireEvent.change(usageTierSelect, { target: { value: '' } });

      expect(onUsageTierChange).toHaveBeenCalledWith(null);
    });

    it('displays selected usage tier value', () => {
      renderFilter({ usageTier: 'example' });

      const usageTierSelect = screen.getByLabelText('Content Type') as HTMLSelectElement;
      expect(usageTierSelect.value).toBe('example');
    });
  });

  describe('Feature Tag Categories', () => {
    it('renders all 7 feature tag categories', () => {
      renderFilter();

      expect(screen.getByText('Auth & Identity')).toBeInTheDocument();
      expect(screen.getByText('Payments')).toBeInTheDocument();
      expect(screen.getByText('Communication')).toBeInTheDocument();
      expect(screen.getByText('Data & Storage')).toBeInTheDocument();
      expect(screen.getByText('Navigation & UI')).toBeInTheDocument();
      expect(screen.getByText('Device Features')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });

    it('categories start collapsed by default', () => {
      renderFilter();

      // Auth tags should not be visible initially
      expect(screen.queryByText('Auth')).not.toBeInTheDocument();
      expect(screen.queryByText('Onboarding')).not.toBeInTheDocument();
    });

    it('category expands when header clicked', () => {
      renderFilter();

      const authCategoryButton = screen.getByRole('button', { name: /Auth & Identity/i });
      fireEvent.click(authCategoryButton);

      // Now auth tags should be visible
      expect(screen.getByText('Auth')).toBeInTheDocument();
      expect(screen.getByText('Onboarding')).toBeInTheDocument();
      expect(screen.getByText('Social Auth')).toBeInTheDocument();
    });

    it('category collapses when header clicked again', () => {
      renderFilter();

      const authCategoryButton = screen.getByRole('button', { name: /Auth & Identity/i });

      // Expand
      fireEvent.click(authCategoryButton);
      expect(screen.getByText('Auth')).toBeInTheDocument();

      // Collapse
      fireEvent.click(authCategoryButton);
      expect(screen.queryByText('Auth')).not.toBeInTheDocument();
    });

    it('displays aria-expanded correctly', () => {
      renderFilter();

      const authCategoryButton = screen.getByRole('button', { name: /Auth & Identity/i });
      expect(authCategoryButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(authCategoryButton);
      expect(authCategoryButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Feature Tag Toggle', () => {
    it('calls onFeatureTagsChange when tag is clicked', () => {
      const onFeatureTagsChange = vi.fn();
      renderFilter({ onFeatureTagsChange });

      // Expand category first
      const authCategoryButton = screen.getByRole('button', { name: /Auth & Identity/i });
      fireEvent.click(authCategoryButton);

      // Click on auth tag
      const authLabel = screen.getByText('Auth');
      fireEvent.click(authLabel);

      expect(onFeatureTagsChange).toHaveBeenCalledWith(['auth']);
    });

    it('removes tag when already selected tag is clicked', () => {
      const onFeatureTagsChange = vi.fn();
      renderFilter({ featureTags: ['auth'], onFeatureTagsChange });

      // Expand category first
      const authCategoryButton = screen.getByRole('button', { name: /Auth & Identity/i });
      fireEvent.click(authCategoryButton);

      // Click on auth tag (already selected)
      const authLabel = screen.getByText('Auth');
      fireEvent.click(authLabel);

      expect(onFeatureTagsChange).toHaveBeenCalledWith([]);
    });

    it('appends to existing tags when new tag is selected', () => {
      const onFeatureTagsChange = vi.fn();
      renderFilter({ featureTags: ['payments'], onFeatureTagsChange });

      // Expand Auth & Identity category
      const authCategoryButton = screen.getByRole('button', { name: /Auth & Identity/i });
      fireEvent.click(authCategoryButton);

      // Click on auth tag
      const authLabel = screen.getByText('Auth');
      fireEvent.click(authLabel);

      expect(onFeatureTagsChange).toHaveBeenCalledWith(['payments', 'auth']);
    });
  });

  describe('Active Count Badge', () => {
    it('shows active count badge per category', () => {
      renderFilter({ featureTags: ['auth', 'onboarding'] });

      // Auth & Identity should show badge with count 2
      const authCategoryButton = screen.getByRole('button', { name: /Auth & Identity/i });
      expect(authCategoryButton).toHaveTextContent('2');
    });

    it('does not show active count badge when no tags active in category', () => {
      renderFilter({ featureTags: ['payments'] });

      // The badge with bg-accent class should not exist for Auth & Identity
      // (it always shows "3 tags" for the category total, but no active count badge)
      const authCategoryButton = screen.getByRole('button', { name: /Auth & Identity/i });

      // The active count badge has bg-accent class - it should not be present in this button
      const activeBadge = authCategoryButton.querySelector('.bg-accent');
      expect(activeBadge).not.toBeInTheDocument();
    });

    it('shows total active count in Feature Tags header', () => {
      renderFilter({ featureTags: ['auth', 'payments', 'offline'] });

      expect(screen.getByText('(3 active)')).toBeInTheDocument();
    });
  });

  describe('Clear Button', () => {
    it('does not appear when no filters are active', () => {
      renderFilter();

      expect(screen.queryByText('Clear Mobile Filters')).not.toBeInTheDocument();
    });

    it('appears when platform filter is active', () => {
      renderFilter({ platform: 'mobile' });

      expect(screen.getByText('Clear Mobile Filters')).toBeInTheDocument();
    });

    it('appears when usage tier filter is active', () => {
      renderFilter({ usageTier: 'official' });

      expect(screen.getByText('Clear Mobile Filters')).toBeInTheDocument();
    });

    it('appears when feature tags are active', () => {
      renderFilter({ featureTags: ['auth'] });

      expect(screen.getByText('Clear Mobile Filters')).toBeInTheDocument();
    });

    it('clears all filters when clicked', () => {
      const onPlatformChange = vi.fn();
      const onUsageTierChange = vi.fn();
      const onFeatureTagsChange = vi.fn();

      renderFilter({
        platform: 'mobile',
        usageTier: 'official',
        featureTags: ['auth', 'payments'],
        onPlatformChange,
        onUsageTierChange,
        onFeatureTagsChange,
      });

      const clearButton = screen.getByText('Clear Mobile Filters');
      fireEvent.click(clearButton);

      expect(onPlatformChange).toHaveBeenCalledWith(null);
      expect(onUsageTierChange).toHaveBeenCalledWith(null);
      expect(onFeatureTagsChange).toHaveBeenCalledWith([]);
    });

    it('has correct aria-label for accessibility', () => {
      renderFilter({ platform: 'mobile' });

      const clearButton = screen.getByLabelText('Clear all mobile filters');
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper labels for dropdowns', () => {
      renderFilter();

      expect(screen.getByLabelText('Platform')).toBeInTheDocument();
      expect(screen.getByLabelText('Content Type')).toBeInTheDocument();
    });

    it('uses fieldset and legend for category grouping', () => {
      const { container } = renderFilter();

      const fieldsets = container.querySelectorAll('fieldset');
      expect(fieldsets.length).toBe(7);

      // Check legends exist (though sr-only)
      const legends = container.querySelectorAll('legend');
      expect(legends.length).toBe(7);
    });

    it('has proper aria-controls on category buttons', () => {
      renderFilter();

      const authCategoryButton = screen.getByRole('button', { name: /Auth & Identity/i });
      expect(authCategoryButton).toHaveAttribute('aria-controls', 'category-auth-&-identity');
    });
  });
});
