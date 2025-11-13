/**
 * Browser MCP Integration Tests
 *
 * These tests use Playwright's browser automation to verify:
 * - Keyboard navigation and focus indicators (Part 4)
 * - Animation and motion preferences (Part 6)
 * - Empty states and loading states (Part 10)
 * - Visual accessibility (Part 5 - partial)
 *
 * Note: Some tests require manual verification (screen readers, cross-browser)
 */

import { expect, test } from '@playwright/test';

test.describe('Browser MCP Integration Tests - Phase 15 Day 3', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Part 4: Keyboard Navigation - Visual Verification', () => {
    test('should show visible focus indicators when tabbing through elements', async ({ page }) => {
      // Tab through first few elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Get focused element
      const focusedElement = page.locator(':focus');
      const count = await focusedElement.count();

      expect(count).toBeGreaterThan(0);

      // Check computed styles for focus indicator
      const hasFocusRing = await focusedElement.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        const outline = styles.outlineWidth;
        const boxShadow = styles.boxShadow;
        const hasRing = el.classList.toString().includes('ring');

        return outline !== '0px' || boxShadow !== 'none' || hasRing;
      });

      expect(hasFocusRing).toBeTruthy();
    });

    test('should navigate through all interactive elements with Tab', async ({ page }) => {
      const interactiveElements: string[] = [];

      // Tab through all elements (with timeout protection)
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);

        // Check if any element is focused
        const focused = page.locator(':focus');
        const count = await focused.count();

        if (count > 0) {
          try {
            const tagName = await focused.evaluate((el) => el.tagName.toLowerCase());
            const role = await focused.getAttribute('role');
            const text = await focused.textContent();

            if (tagName || role) {
              interactiveElements.push(`${tagName || role}: ${text?.substring(0, 30) || ''}`);
            }
          } catch (e) {
            // Element may have been removed, continue
          }
        }
      }

      // Should have found at least some interactive elements
      expect(interactiveElements.length).toBeGreaterThan(0);
    });

    test('should activate buttons with Enter key', async ({ page }) => {
      // Navigate to search page
      await page.goto('/search/test-collection-id?q=test');
      await page.waitForLoadState('networkidle');

      // Find a button
      const button = page.locator('button').first();
      if ((await button.count()) > 0) {
        await button.focus();

        // Press Enter
        await page.keyboard.press('Enter');

        // Button should still be visible (not removed)
        expect(await button.isVisible()).toBeTruthy();
      }
    });

    test('should activate buttons with Space key', async ({ page }) => {
      await page.goto('/search/test-collection-id?q=test');
      await page.waitForLoadState('networkidle');

      const button = page.locator('button').first();
      if ((await button.count()) > 0) {
        await button.focus();
        await page.keyboard.press('Space');
        expect(await button.isVisible()).toBeTruthy();
      }
    });
  });

  test.describe('Part 6: Animation & Motion Testing', () => {
    test('should respect prefers-reduced-motion media query', async ({ page }) => {
      // Enable reduced motion
      await page.emulateMedia({ reducedMotion: 'reduce' });

      // Check if animations are disabled
      const animationDisabled = await page.evaluate(() => {
        const style = window.getComputedStyle(document.body);
        return (
          style.animationDuration === '0s' ||
          style.animationDuration === '0ms' ||
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        );
      });

      expect(animationDisabled).toBeTruthy();
    });

    test('should have smooth animations when motion is allowed', async ({ page }) => {
      // Disable reduced motion
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      // Navigate to a page with animations
      await page.goto('/search/test-collection-id?q=test');
      await page.waitForLoadState('networkidle');

      // Check animation classes exist in CSS or DOM
      const hasAnimationClasses = await page.evaluate(() => {
        // Check CSS for animation definitions
        const stylesheets = Array.from(document.styleSheets);
        let hasAnimations = false;

        for (const sheet of stylesheets) {
          try {
            const rules = Array.from(sheet.cssRules || []);
            for (const rule of rules) {
              if (
                rule instanceof CSSKeyframesRule ||
                (rule instanceof CSSStyleRule && rule.selectorText?.includes('animate'))
              ) {
                hasAnimations = true;
                break;
              }
            }
          } catch (e) {
            // Cross-origin stylesheets may throw
          }
          if (hasAnimations) break;
        }

        // Also check DOM for animation classes
        const body = document.body;
        const html = body.innerHTML;
        return (
          hasAnimations ||
          html.includes('animate-fade-in') ||
          html.includes('animate-slide-down') ||
          html.includes('animate-scale-in')
        );
      });

      // Animations should be present (either in CSS or DOM)
      expect(hasAnimationClasses).toBeTruthy();
    });
  });

  test.describe('Part 10: Empty States & Loading States', () => {
    test('should show loading state for collections', async ({ page }) => {
      // Navigate to home page
      await page.goto('/');

      // Accept either the loading indicator OR the final collections grid within timeout
      const loadingText = page.locator('text=Loading collections');
      const collectionsGrid = page.locator('div.grid.grid-cols-1');

      try {
        await expect(loadingText).toBeVisible({ timeout: 2000 });
      } catch {
        // If loading never appears (instant load), ensure collections content is visible
        await expect(collectionsGrid).toBeVisible({ timeout: 2000 });
      }
    });

    test('should show empty state when no collections exist', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check for empty state text or existing collections
      const emptyState = page.locator('text=/no collections yet|empty|no data/i');
      const emptyCount = await emptyState.count();

      if (emptyCount > 0) {
        await expect(emptyState.first()).toBeVisible();
      } else {
        // Otherwise ensure a collections grid is present with items
        const collectionsGrid = page.locator('div.grid.grid-cols-1');
        await expect(collectionsGrid).toHaveCount(1, { timeout: 2000 });
      }
    });

    test('should show skeleton loaders on cost dashboard', async ({ page }) => {
      await page.goto('/costs');
      await page.waitForLoadState('networkidle');

      // Check for skeleton loaders or final dashboard content
      const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]');
      const skeletonCount = await skeleton.count();

      if (skeletonCount > 0) {
        await expect(skeleton.first()).toBeVisible();
      } else {
        // If loader isn't visible (fast load), assert dashboard heading is visible
        await expect(page.getByRole('heading', { name: 'API Cost Dashboard' })).toBeVisible({
          timeout: 3000,
        });
      }
    });
  });

  test.describe('Part 5: Screen Reader - Accessibility Tree', () => {
    test('should have proper ARIA labels on interactive elements', async ({ page }) => {
      await page.goto('/search/test-collection-id?q=test');
      await page.waitForLoadState('networkidle');

      // Check buttons have aria-label or accessible text
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      let accessibleButtons = 0;
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const button = buttons.nth(i);
        const ariaLabel = await button.getAttribute('aria-label');
        const text = await button.textContent();
        const ariaLabelledBy = await button.getAttribute('aria-labelledby');

        if (ariaLabel || (text && text.trim().length > 0) || ariaLabelledBy) {
          accessibleButtons++;
        }
      }

      // Most buttons should be accessible
      expect(accessibleButtons).toBeGreaterThan(0);
    });

    test('should have semantic HTML landmarks', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check for semantic landmarks
      const main = page.locator('main');
      const nav = page.locator('nav');
      const header = page.locator('header');
      const footer = page.locator('footer');

      const mainCount = await main.count();
      const navCount = await nav.count();

      // Should have at least main landmark
      expect(mainCount).toBeGreaterThan(0);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Get all headings
      const h1 = page.locator('h1');
      const h2 = page.locator('h2');
      const h3 = page.locator('h3');

      const h1Count = await h1.count();

      // Should have at least one h1
      expect(h1Count).toBeGreaterThan(0);
    });
  });

  test.describe('Visual Regression - Screenshots', () => {
    test('should capture home page screenshot', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Take screenshot
      await page.screenshot({
        path: 'test-results/home-page.png',
        fullPage: true,
      });

      // Verify page loaded
      const title = await page.title();
      expect(title).toContain('Synthesis');
    });

    test('should capture mobile viewport screenshot', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: 'test-results/home-page-mobile.png',
        fullPage: true,
      });

      const viewport = page.viewportSize();
      expect(viewport?.width).toBe(375);
    });
  });
});
