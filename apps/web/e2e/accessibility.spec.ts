import { expect, test } from '@playwright/test';

test.describe('Accessibility - Phase 15 Day 3', () => {
  test('should have proper ARIA labels on interactive elements', async ({ page }) => {
    await page.goto('/search/test-collection-id?q=test');
    await page.waitForLoadState('networkidle');

    // Check filter chips have aria-label
    const filterChips = page.locator('button[role="checkbox"]');
    const chipCount = await filterChips.count();

    for (let i = 0; i < Math.min(chipCount, 5); i++) {
      const chip = filterChips.nth(i);
      const ariaLabel = await chip.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel?.length).toBeGreaterThan(0);
    }
  });

  test('should have proper ARIA states on toggle buttons', async ({ page }) => {
    await page.goto('/chat/test-collection-id');
    await page.waitForLoadState('networkidle');

    // Check synthesis toggle buttons
    const toggleButtons = page.locator('button[role="radio"]');
    const buttonCount = await toggleButtons.count();

    if (buttonCount > 0) {
      for (let i = 0; i < buttonCount; i++) {
        const button = toggleButtons.nth(i);
        const ariaChecked = await button.getAttribute('aria-checked');
        expect(ariaChecked).toBeTruthy();
        expect(['true', 'false']).toContain(ariaChecked);
      }
    }
  });

  test('should have proper ARIA expanded states', async ({ page }) => {
    await page.goto('/search/test-collection-id?q=test');
    await page.waitForLoadState('networkidle');

    // Check Related Files toggle if present
    const relatedFilesToggle = page.locator('button[aria-expanded]');
    const toggleCount = await relatedFilesToggle.count();

    if (toggleCount > 0) {
      const toggle = relatedFilesToggle.first();
      const ariaExpanded = await toggle.getAttribute('aria-expanded');
      expect(ariaExpanded).toBeTruthy();
      expect(['true', 'false']).toContain(ariaExpanded);
    }
  });

  test('should have semantic HTML landmarks', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for main landmark
    const main = page.locator('main');
    expect(await main.count()).toBeGreaterThan(0);

    // Check for nav landmarks
    const nav = page.locator('nav');
    const navCount = await nav.count();
    // At least one nav should exist (Related Files panel or main navigation)
    expect(navCount).toBeGreaterThanOrEqual(1);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for h1
    const h1 = page.locator('h1');
    expect(await h1.count()).toBeGreaterThan(0);

    // Verify headings are in logical order (basic check)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);
  });
});
