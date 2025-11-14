import { expect, test } from '@playwright/test';

test.describe('Disabled Button States', () => {
  test.use({ viewport: { width: 1280, height: 720 } }); // Desktop only

  test('search button should be disabled when input is empty', async ({ page }) => {
    await page.goto('/search/test-collection-id');
    await page.waitForLoadState('networkidle');

    // Verify the search input is empty
    const searchInput = page.getByPlaceholder('Search for code, functions, or documentation...');
    const inputValue = await searchInput.inputValue();
    expect(inputValue).toBe('');

    const searchButton = page.locator('button[type="submit"]').first();
    const isDisabled = await searchButton.isDisabled();
    expect(isDisabled).toBe(true); // Should be disabled initially
  });

  test('chat send button should be disabled when input is empty', async ({ page }) => {
    await page.goto('/chat/test-collection-id');
    await page.waitForLoadState('networkidle');

    const sendButton = page.locator('button[type="submit"]').first();
    const isDisabled = await sendButton.isDisabled();
    expect(isDisabled).toBe(true); // Should be disabled when input empty
  });

  test('synthesis toggle should be disabled when no messages sent', async ({ page }) => {
    await page.goto('/chat/test-collection-id');
    await page.waitForLoadState('networkidle');

    const synthesisButton = page.locator('button:has-text("Synthesis View")');
    const isDisabled = await synthesisButton.isDisabled();
    expect(isDisabled).toBe(true); // Should be disabled initially
  });

  test('disabled buttons should have proper attributes', async ({ page }) => {
    await page.goto('/search/test-collection-id');
    await page.waitForLoadState('networkidle');

    const disabledButton = page.locator('button[disabled]').first();

    // Check that button is actually disabled (more reliable than className)
    const isDisabled = await disabledButton.isDisabled();
    expect(isDisabled).toBe(true);

    // Optional: Check aria-disabled if present
    const ariaDisabled = await disabledButton.getAttribute('aria-disabled');
    if (ariaDisabled !== null) {
      expect(ariaDisabled).toBe('true');
    }
  });
});
