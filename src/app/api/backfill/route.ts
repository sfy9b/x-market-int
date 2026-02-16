import { NextResponse } from 'next/server';
import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const client   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const AUTH_PATH = path.join(process.cwd(), '.twitter-auth.json');

async function scrapeSearchPage(handle: string, since: string, until: string): Promise<{ id: string; text: string; timestamp: string; url: string }[]> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = fs.existsSync(AUTH_PATH)
    ? await browser.newContext({ storageState: AUTH_PATH })
    : await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

  const page = await context.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2}', r => r.abort());

  const query = `from:${handle} since:${since} until:${until}`;
  const url   = `https://twitter.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for tweets or no-results message
    await Promise.race([
      page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 }),
      page.waitForSelector('[data-testid="empty_state_header_text"]', { timeout: 10000 }),
    ]).catch(() => {});

    // Scroll to load more
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(1000 + Math.random() * 500);
    }

    const tweets = await page.$$eval(
      'article[data-testid="tweet"]',
      articles => articles.map(article => {
        const textEl = article.querySelector('[data-testid="tweetText"]');
        const timeEl = article.querySelector('time');
        const linkEl = article.querySelector('a[href*="/status/"]');
        if (!textEl || !linkEl) return null;
        return {
          id:        linkEl.getAttribute('href')?.split('/').pop() ?? '',
          text:      textEl.textContent ?? '',
          timestamp: timeEl?.getAttribute('datetime') ?? new Date().toISOString(),
          url:       `https://twitter.com${linkEl.getAttribute('href')}`,
        };
      }).filter((t): t is NonNullable<typeof t> => Boolean(t?.id && t?.text))
    );

    return tweets;
  } finally {
    await browser.close();
  }
}

async function extractTickers(tweets: { id: string; text: string; timestamp: string }[]): Promise<{ ticker: string; name: string; tweetId: string; context: string }[]> {
  if (tweets.length === 0) return [];

  const msg = await client.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages:   [{
      role:    'user',
      content: `Extract all publicly traded company mentions from these tweets.

${tweets.map((t, i) => `Tweet ${i + 1} [id:${t.id}]: "${t.text}"`).join('\n\n')}

Return ONLY a JSON array (no markdown):
[
  {
    "ticker": "SYMBOL",
    "name": "Full Company Name",
    "tweetId": "the tweet id it came from",
    "context": "exact phrase mentioning the company"
  }
]

Only include companies with confirmed US ticker symbols. Include duplicates if mentioned in different tweets.`,
    }],
  });

  const text  = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// Generate monthly date ranges going back N months
function getMonthRanges(monthsBack: number): { since: string; until: string }[] {
  const ranges = [];
  const now    = new Date();

  for (let i = 0; i < monthsBack; i++) {
    const until = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const since = new Date(now.getFullYear(), now.getMonth() - i, 1);
    ranges.push({
      since: since.toISOString().split('T')[0],
      until: until.toISOString().split('T')[0],
    });
  }

  return ranges;
}

export async function POST(req: Request) {
  try {
    const body       = await req.json().catch(() => ({}));
    const monthsBack = body.monthsBack ?? 3;
    const handle     = process.env.MONITOR_HANDLE ?? 'elonmusk';
    const ranges     = getMonthRanges(monthsBack);

    const allTickers: { ticker: string; name: string; tweetId: string; context: string; timestamp: string }[] = [];
    let   totalTweets = 0;

    for (const range of ranges) {
      // Scrape tweets for this month
      const tweets = await scrapeSearchPage(handle, range.since, range.until);
      totalTweets += tweets.length;

      if (tweets.length === 0) continue;

      // Extract tickers from this batch
      const tickers = await extractTickers(tweets);

      // Save tweets to DB (skip duplicates)
      for (const tweet of tweets) {
        const exists = await db.tweet.findUnique({ where: { id: tweet.id } });
        if (!exists) {
          await db.tweet.create({
            data: {
              id:       tweet.id,
              text:     tweet.text,
              author:   `@${handle}`,
              tweetUrl: tweet.url,
              postedAt: new Date(tweet.timestamp),
            },
          });
        }
      }

      // Save companies to DB (upsert)
      for (const ticker of tickers) {
        const tweet = tweets.find(t => t.id === ticker.tweetId);
        await db.company.upsert({
          where:  { ticker: ticker.ticker },
          create: {
            ticker:        ticker.ticker,
            name:          ticker.name,
            researchBrief: '',
            sentiment:     'neutral',
            recentMention: ticker.context,
          },
          update: {
            recentMention: ticker.context,
          },
        });

        allTickers.push({
          ...ticker,
          timestamp: tweet?.timestamp ?? range.since,
        });
      }

      // Polite delay between months to avoid rate limiting
      await new Promise(r => setTimeout(r, 3000));
    }

    // Deduplicate for the response
    const unique = Object.values(
      allTickers.reduce((acc, t) => {
        if (!acc[t.ticker]) acc[t.ticker] = { ...t, mentionCount: 1 };
        else acc[t.ticker].mentionCount++;
        return acc;
      }, {} as Record<string, typeof allTickers[0] & { mentionCount: number }>)
    ).sort((a, b) => b.mentionCount - a.mentionCount);

    return NextResponse.json({
      success:      true,
      monthsBack,
      totalTweets,
      uniqueTickers: unique.length,
      tickers:      unique,
    });

  } catch (err) {
    console.error('Backfill error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
