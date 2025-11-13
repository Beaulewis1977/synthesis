import { expect, test } from '@playwright/test';

test.describe('Mobile Responsiveness - Phase 15 Day 3', () => {
  // Note: Ensure test data is seeded before running these tests
  // via a fixture/setup step so a collection with filters exists.
  // Example: seedTestData({ collections: 1, filters: ['tech stack'] })
  test.describe('320px width (iPhone SE)', () => {
    test.use({ viewport: { width: 320, height: 568 } });

    test('should not have horizontal scrolling on home page', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = page.viewportSize()?.width || 320;

      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1); // Allow 1px tolerance
    });

    test('should wrap tech stack filter chips', async ({ page }) => {
      // Navigate to a search page with filters
      await page.goto('/search/test-collection-id?q=test');
      await page.waitForLoadState('networkidle');

      const filterContainer = page.locator('[role="group"][aria-label="Tech stack filters"]');
      await expect(filterContainer).toHaveCount(1);

      const chips = filterContainer.locator('button[role="checkbox"]');
      const chipCount = await chips.count();
      expect(chipCount).toBeGreaterThan(0);

      // Check that chips are visible and don't overflow
      const containerBox = await filterContainer.boundingBox();
      const firstChipBox = await chips.first().boundingBox();
      const lastChipBox = await chips.last().boundingBox();

      expect(containerBox).toBeTruthy();
      expect(firstChipBox).toBeTruthy();
      expect(lastChipBox).toBeTruthy();

      if (containerBox && firstChipBox && lastChipBox) {
        // Chips should be within container bounds
        expect(firstChipBox.x).toBeGreaterThanOrEqual(containerBox.x - 5);
        expect(lastChipBox.x + lastChipBox.width).toBeLessThanOrEqual(
          containerBox.x + containerBox.width + 5
        );
      }
    });

    test('should have touch targets ≥44px', async ({ page }) => {
      await page.goto('/search/test-collection-id?q=test');
      await page.waitForLoadState('networkidle');

      // Check tech stack filter chips
      const filterChips = page.locator('button[role="checkbox"][aria-label*="filter"]');
      const chipCount = await filterChips.count();

      for (let i = 0; i < Math.min(chipCount, 5); i++) {
        const chip = filterChips.nth(i);
        const box = await chip.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });

  test.describe('375px width (iPhone 12)', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('should not have horizontal scrolling', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = page.viewportSize()?.width || 375;

      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
    });
  });

  test.describe('768px width (iPad)', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('should not have horizontal scrolling', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = page.viewportSize()?.width || 768;

      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1);
    });
  });
});
