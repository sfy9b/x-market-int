import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scrapeTweets } from '@/lib/twitter';
import { extractCompanies, buildCompanyProfile, analyzeCatalyst } from '@/lib/claude';
import { getQuote } from '@/lib/market-data';

export async function POST() {
  try {
    const handle  = process.env.MONITOR_HANDLE ?? 'elonmusk';
    const scraped = await scrapeTweets(handle, 10);

    const existingIds = await db.tweet.findMany({
      where: { id: { in: scraped.map(t => t.id) } }, select: { id: true },
    });
    const seenIds   = new Set(existingIds.map(t => t.id));
    const newTweets = scraped.filter(t => !seenIds.has(t.id));

    if (newTweets.length === 0) return NextResponse.json({ message: 'No new tweets', processed: 0 });

    const companies = await extractCompanies(newTweets);
    const results   = [];

    for (const tweet of newTweets) {
      await db.tweet.create({
        data: { id: tweet.id, text: tweet.text, author: tweet.author, tweetUrl: tweet.url, postedAt: new Date(tweet.timestamp) },
      });

      const tweetCompanies = companies.filter(c =>
        tweet.text.toLowerCase().includes(c.ticker.toLowerCase()) ||
        tweet.text.toLowerCase().includes(c.name.toLowerCase())
      );

      for (const company of tweetCompanies) {
        const existing  = await db.company.findUnique({ where: { ticker: company.ticker } });
        const isStale   = !existing || (Date.now() - existing.lastUpdated.getTime()) > 24 * 60 * 60 * 1000;
        let researchBrief = existing?.researchBrief ?? '';
        let priceData     = null;

        if (isStale) {
          researchBrief = await buildCompanyProfile(company);
          priceData     = await getQuote(company.ticker);
        }

        const savedCompany = await db.company.upsert({
          where:  { ticker: company.ticker },
          create: {
            ticker: company.ticker, name: company.name, researchBrief,
            sentiment: company.sentiment, recentMention: company.mentionContext,
            price: priceData?.price, priceChange: priceData?.change, priceChangePct: priceData?.changePercent,
            tweets: { connect: { id: tweet.id } },
          },
          update: {
            sentiment: company.sentiment, recentMention: company.mentionContext,
            ...(isStale && { researchBrief, price: priceData?.price, priceChange: priceData?.change, priceChangePct: priceData?.changePercent }),
            tweets: { connect: { id: tweet.id } },
          },
        });

        if (company.isCatalyst) {
          const analysis = await analyzeCatalyst(company, tweet.text);
          await db.catalyst.create({
            data: { type: company.catalystType ?? 'other', description: company.mentionContext, analysis, sentiment: company.sentiment, companyId: savedCompany.id, tweetId: tweet.id },
          });
        }
      }
      results.push({ tweetId: tweet.id, companiesFound: tweetCompanies.length });
    }
    return NextResponse.json({ message: 'Scrape complete', processed: newTweets.length, results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
