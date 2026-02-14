import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateDigest } from '@/lib/claude';

export async function POST() {
  try {
    const companies = await db.company.findMany({ orderBy: { lastUpdated: 'desc' }, take: 20 });
    const catalysts = await db.catalyst.findMany({
      orderBy: { detectedAt: 'desc' }, take: 20, include: { company: true },
    });
    if (companies.length < 3) {
      return NextResponse.json({ error: 'Not enough data yet.' }, { status: 400 });
    }
    const handle  = process.env.MONITOR_HANDLE ?? 'elonmusk';
    const content = await generateDigest({
      handle:    `@${handle}`,
      companies: companies.map(c => ({ ticker: c.ticker, name: c.name, recentMention: c.recentMention })),
      catalysts: catalysts.map(c => ({ name: c.company.name, ticker: c.company.ticker, type: c.type, description: c.description })),
    });
    const digest = await db.digest.create({
      data: { content, stockCount: companies.length, catalystCount: catalysts.length },
    });
    return NextResponse.json({ digest });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  const digests = await db.digest.findMany({ orderBy: { generatedAt: 'desc' }, take: 5 });
  return NextResponse.json({ digests });
}
