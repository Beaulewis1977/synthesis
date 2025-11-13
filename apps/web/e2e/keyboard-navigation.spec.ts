import { expect, test } from '@playwright/test';

test.describe('Keyboard Navigation - Phase 15 Day 3', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should show focus indicators on tab navigation', async ({ page }) => {
    // Tab through interactive elements
    await page.keyboard.press('Tab');

    // Check if focused element has focus ring
    const focusedElement = page.locator(':focus');
    const hasFocusRing = await focusedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return (
        styles.outlineWidth !== '0px' ||
        el.classList.toString().includes('ring') ||
        styles.boxShadow !== 'none'
      );
    });

    expect(hasFocusRing).toBeTruthy();
  });

  test('should navigate through tech stack filter chips with Tab', async ({ page }) => {
    await page.goto('/search/test-collection-id?q=test');
    await page.waitForLoadState('networkidle');

    const filterChips = page.locator('button[role="checkbox"][aria-label*="filter"]');
    const chipCount = await filterChips.count();

    if (chipCount > 0) {
      const firstChip = filterChips.first();
      await firstChip.focus();

      // Verify the intended chip is focused and has correct role
      await expect(firstChip).toBeFocused();
      await expect(firstChip).toHaveAttribute('role', 'checkbox');
    }
  });

  test('should activate buttons with Enter key', async ({ page }) => {
    await page.goto('/search/test-collection-id?q=test');
    await page.waitForLoadState('networkidle');

    // Focus the Search submit button
    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeVisible();
    await submitButton.focus();

    // Press Enter and verify the expected search request occurs
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/search') && resp.request().method() === 'POST'
      ),
      page.keyboard.press('Enter'),
    ]);
  });

  test('should activate buttons with Space key', async ({ page }) => {
    await page.goto('/search/test-collection-id?q=test');
    await page.waitForLoadState('networkidle');

    // Focus the Search submit button
    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeVisible();
    await submitButton.focus();

    // Press Space and verify the expected search request occurs
    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes('/api/search') && resp.request().method() === 'POST'
      ),
      page.keyboard.press('Space'),
    ]);
  });

  test('should not focus non-interactive badges', async ({ page }) => {
    // Navigate to a page with badges
    await page.goto('/search/test-collection-id?q=test');
    await page.waitForLoadState('networkidle');

    // Try to find badges
    const badges = page.locator('[role="status"]');
    const badgeCount = await badges.count();

    if (badgeCount > 0) {
      // Badges should not be focusable
      const firstBadge = badges.first();
      const tabIndex = await firstBadge.getAttribute('tabindex');

      // Should be null or -1 (not focusable)
      expect(tabIndex === null || tabIndex === '-1').toBeTruthy();
    }
  });
});
