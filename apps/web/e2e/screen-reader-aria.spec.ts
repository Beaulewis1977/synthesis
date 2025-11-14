import { expect, test } from '@playwright/test';

test.describe('Screen Reader - ARIA Validation', () => {
  test.use({ viewport: { width: 1280, height: 720 } }); // Desktop only

  test('should have ARIA labels on all interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get all interactive elements
    const buttons = page.locator('button:not([aria-hidden="true"])');
    const links = page.locator('a:not([aria-hidden="true"])');
    const inputs = page.locator('input:not([aria-hidden="true"])');

    // Check buttons have aria-label or accessible text
    const buttonCount = await buttons.count();
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const textContent = await button.textContent();
      const hasLabel = ariaLabel || (textContent && textContent.trim().length > 0);
      expect(hasLabel).toBeTruthy();
    }

    // Check links have accessible text
    const linkCount = await links.count();
    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const ariaLabel = await link.getAttribute('aria-label');
      const textContent = await link.textContent();
      const hasLabel = ariaLabel || (textContent && textContent.trim().length > 0);
      expect(hasLabel).toBeTruthy();
    }

    // Check inputs have aria-label, aria-labelledby, or associated <label>
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');

      let isLabeled =
        Boolean(ariaLabel && ariaLabel.trim().length > 0) ||
        Boolean(ariaLabelledBy && ariaLabelledBy.trim().length > 0);

      if (!isLabeled) {
        // If no aria-* labeling, ensure there is a proper <label>
        const id = await input.getAttribute('id');
        if (id) {
          const hasForLabel = await page.locator(`label[for="${id}"]`).count();
          if (hasForLabel > 0) {
            isLabeled = true;
          }
        }
        if (!isLabeled) {
          // Or input is wrapped by a <label>
          const wrappedByLabel = await input.evaluate((el) => !!el.closest('label'));
          if (wrappedByLabel) {
            isLabeled = true;
          }
        }
      }

      // Do NOT treat placeholder as an accessible name.
      expect(isLabeled).toBeTruthy();
    }
  });
});
