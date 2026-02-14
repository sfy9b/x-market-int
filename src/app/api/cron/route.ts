import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const base       = req.nextUrl.origin;
    const scrapeRes  = await fetch(`${base}/api/scrape`, { method: 'POST' });
    const scrapeData = await scrapeRes.json();

    const latestDigest        = await db.digest.findFirst({ orderBy: { generatedAt: 'desc' } });
    const sinceLastDigest     = latestDigest ? Date.now() - latestDigest.generatedAt.getTime() : Infinity;
    const recentCatalystCount = await db.catalyst.count({
      where: { detectedAt: latestDigest ? { gt: latestDigest.generatedAt } : undefined },
    });
    const shouldDigest = sinceLastDigest > 7 * 24 * 60 * 60 * 1000 || recentCatalystCount >= 5;

    let digestData = null;
    if (shouldDigest) {
      const digestRes = await fetch(`${base}/api/digest`, { method: 'POST' });
      digestData = await digestRes.json();
    }
    return NextResponse.json({ ok: true, scrape: scrapeData, digest: digestData });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
