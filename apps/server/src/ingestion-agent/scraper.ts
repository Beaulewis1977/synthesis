import { chromium } from 'playwright';
import TurndownService from 'turndown';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Configure Turndown to drop certain elements
turndownService.remove(['script', 'style', 'nav', 'footer', 'iframe', 'noscript']);

export interface ScrapedPage {
  title: string;
  content: string; // Markdown
  description?: string;
  url: string;
}

export async function scrapeUrl(url: string): Promise<ScrapedPage> {
  const disableSandboxEnv = (process.env.DISABLE_BROWSER_SANDBOX || '').toLowerCase();
  const disableSandbox =
    disableSandboxEnv === '1' || disableSandboxEnv === 'true' || disableSandboxEnv === 'yes';

  const chromiumArgs = disableSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];

  if (disableSandbox) {
    console.warn('[Scraper] Launching browser with sandbox disabled');
  }

  const browser = await chromium.launch({
    headless: true,
    args: chromiumArgs, // Required for some container environments
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

    // Timeout after 30s
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Basic cleanup in the browser context
    await page.evaluate(() => {
      // Remove obvious non-content elements
      const selectors = [
        'nav',
        'footer',
        'header',
        'aside',
        '.nav',
        '.footer',
        '.header',
        '.sidebar',
        '#nav',
        '#footer',
        '#header',
        '#sidebar',
        '[role="navigation"]',
        '[role="banner"]',
        '[role="contentinfo"]',
        '.cookie-banner',
        '.ad-container',
        '.advertisement',
      ];

      for (const selector of selectors) {
        // @ts-ignore
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          el.remove();
        }
      }
    });

    const title = await page.title();

    // Get meta description
    const description =
      (await page.getAttribute('meta[name="description"]', 'content').catch(() => undefined)) ||
      undefined;

    // Get main content HTML
    // Prefer 'main' tag, or 'article', or fallback to body
    const contentHtml = await page.evaluate(() => {
      // @ts-ignore
      const main =
        // @ts-ignore
        document.querySelector('main') || document.querySelector('article') || document.body;
      return main.innerHTML;
    });

    const markdown = turndownService.turndown(contentHtml);

    return {
      title: title.trim() || url,
      content: markdown,
      description,
      url,
    };
  } finally {
    await browser.close();
  }
}
