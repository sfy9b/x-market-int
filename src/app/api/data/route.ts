import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const [companies, catalysts, digests, tweetCount] = await Promise.all([
    db.company.findMany({ orderBy: { lastUpdated: 'desc' } }),
    db.catalyst.findMany({
      orderBy: { detectedAt: 'desc' },
      take:    50,
      include: { company: { select: { name: true, ticker: true } } },
    }),
    db.digest.findMany({ orderBy: { generatedAt: 'desc' }, take: 5 }),
    db.tweet.count(),
  ]);
  return NextResponse.json({ companies, catalysts, digests, tweetCount });
}
