import { expect, test } from '@playwright/test';

async function stabilizeForScreenshot(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content: `
      * { animation: none !important; transition: none !important; caret-color: transparent !important; }
      /* Avoid blinking cursors or selection changes affecting diffs */
      ::selection { background: transparent !important; }
    `,
  });
}

test.describe('Visual Regression - Key Views', () => {
  test('Dashboard baseline', async ({ page }) => {
    // Mock collections response
    await page.route('**/api/collections', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          collections: [
            {
              id: 'c1',
              name: 'Demo Collection',
              description: 'A stable demo collection for screenshots',
              created_at: '2024-01-01T00:00:00.000Z',
              updated_at: '2024-01-01T00:00:00.000Z',
            },
            {
              id: 'c2',
              name: 'API Docs',
              description: 'Reference materials',
              created_at: '2024-01-01T00:00:00.000Z',
              updated_at: '2024-01-01T00:00:00.000Z',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await stabilizeForScreenshot(page);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('Search page baseline (mocked)', async ({ page }) => {
    // Mock search results for deterministic UI
    await page.route('**/api/search', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'hello',
          total_results: 2,
          search_time_ms: 123,
          metadata: {
            search_mode: 'hybrid',
            reranked: true,
            rerank_provider: 'bge',
          },
          results: [
            {
              id: 1,
              snippet: 'Stable snippet content for the first result.',
              similarity: 0.89,
              source: 'both',
              doc_id: 'd1',
              doc_title: 'Getting Started',
              source_url: 'https://example.com/docs/start',
              metadata: {
                file_path: 'docs/start.md',
                source_quality: 'official',
                // Omit last_verified to avoid date-relative UI
              },
            },
            {
              id: 2,
              snippet: 'Second stable snippet for the result list.',
              similarity: 0.77,
              source: 'vector',
              doc_id: 'd2',
              doc_title: 'API Reference',
              source_url: 'https://example.com/api',
              metadata: {
                file_path: 'api/reference.ts',
                source_quality: 'verified',
              },
            },
          ],
        }),
      });
    });

    await page.goto('/search/demo-collection?q=hello');
    await stabilizeForScreenshot(page);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('search.png', {
      fullPage: true,
      maxDiffPixels: 120,
    });
  });

  test('Cost dashboard baseline (mocked)', async ({ page }) => {
    // Mock cost summary and alerts
    await page.route('**/api/costs/summary', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          current_spend: 123.45,
          budget: 500,
          percentage_used: 24.69,
          remaining: 376.55,
          breakdown: [
            {
              provider: 'openai',
              operation: 'chat.completions',
              total_cost: 75,
              request_count: 150,
            },
            { provider: 'anthropic', operation: 'messages', total_cost: 40, request_count: 80 },
            { provider: 'voyageai', operation: 'rerank', total_cost: 8.45, request_count: 200 },
          ],
        }),
      });
    });

    await page.route('**/api/costs/alerts', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          alerts: [
            {
              id: 101,
              alert_type: 'warning',
              threshold_usd: 400,
              current_spend_usd: 350,
              period: 'current_month',
              triggered_at: '2024-01-15T00:00:00.000Z',
              acknowledged: false,
            },
            {
              id: 102,
              alert_type: 'limit_reached',
              threshold_usd: 500,
              current_spend_usd: 505,
              period: 'current_month',
              triggered_at: '2024-01-20T00:00:00.000Z',
              acknowledged: false,
            },
          ],
        }),
      });
    });

    await page.goto('/costs');
    await stabilizeForScreenshot(page);
    await page.waitForLoadState('networkidle');

    // Mask potentially dynamic time-based elements to avoid churn
    const mask = [page.locator('time'), page.locator('p.text-xs.text-text-secondary.mt-xs')];

    await expect(page).toHaveScreenshot('costs.png', {
      fullPage: true,
      maxDiffPixels: 120,
      mask,
    });
  });
});
