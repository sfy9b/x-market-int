import { chromium, Browser, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';

export interface ScrapedTweet {
  id: string;
  text: string;
  timestamp: string;
  url: string;
  author: string;
}

const AUTH_PATH = path.join(process.cwd(), '.twitter-auth.json');

async function getContext(browser: Browser): Promise<BrowserContext> {
  if (fs.existsSync(AUTH_PATH)) {
    return browser.newContext({ storageState: AUTH_PATH });
  }
  return browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/120.0.0.0 Safari/537.36',
  });
}

export async function scrapeTweets(handle: string, maxTweets = 50): Promise<ScrapedTweet[]> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await getContext(browser);
  const page = await context.newPage();

  await page.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2}', r => r.abort());

  try {
    await page.goto(`https://twitter.com/${handle}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });

    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(1200 + Math.random() * 800);
    }

    const tweets = await page.$$eval(
      'article[data-testid="tweet"]',
      (articles, max) =>
        articles.slice(0, max).map(article => {
          const textEl   = article.querySelector('[data-testid="tweetText"]');
          const timeEl   = article.querySelector('time');
          const linkEl   = article.querySelector('a[href*="/status/"]');
          const handleEl = article.querySelector('[data-testid="User-Name"] a');
          if (!textEl || !linkEl) return null;
          return {
            id:        linkEl.getAttribute('href')?.split('/').pop() ?? '',
            text:      textEl.textContent ?? '',
            timestamp: timeEl?.getAttribute('datetime') ?? new Date().toISOString(),
            url:       `https://twitter.com${linkEl.getAttribute('href')}`,
            author:    handleEl?.textContent ?? '',
          };
        }).filter((t): t is NonNullable<typeof t> => Boolean(t?.id && t?.text)),
      maxTweets
    );

    return tweets;
  } finally {
    await browser.close();
  }
}

export async function saveAuthSession() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page    = await context.newPage();
  await page.goto('https://twitter.com/login');
  console.log('Log in manually, then press Enter...');
  await new Promise(resolve => process.stdin.once('data', resolve));
  await context.storageState({ path: AUTH_PATH });
  console.log(`Auth saved to ${AUTH_PATH}`);
  await browser.close();
}
