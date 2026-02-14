import Anthropic from '@anthropic-ai/sdk';
import { ScrapedTweet } from './twitter';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = 'claude-sonnet-4-20250514';

export interface ExtractedCompany {
  ticker:         string;
  name:           string;
  mentionContext: string;
  sentiment:      'bullish' | 'bearish' | 'neutral';
  isCatalyst:     boolean;
  catalystType?:  'earnings' | 'product' | 'partnership' | 'regulatory' | 'other';
}

export async function extractCompanies(tweets: ScrapedTweet[]): Promise<ExtractedCompany[]> {
  const msg = await client.messages.create({
    model:      MODEL,
    max_tokens: 2000,
    messages:   [{
      role:    'user',
      content: `Analyze these tweets and extract all mentioned publicly traded companies:

${tweets.map((t, i) => `Tweet ${i + 1}: "${t.text}"`).join('\n\n')}

Return ONLY a JSON object (no markdown) structured as:
{
  "companies": [
    {
      "ticker": "SYMBOL",
      "name": "Full Company Name",
      "mentionContext": "Brief context from tweet",
      "sentiment": "bullish|bearish|neutral",
      "isCatalyst": true|false,
      "catalystType": "earnings|product|partnership|regulatory|other"
    }
  ]
}

Only include companies with valid US ticker symbols. Set isCatalyst true only for significant news.`,
    }],
  });
  const text  = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const clean = text.replace(/```json|```/g, '').trim();
  const { companies } = JSON.parse(clean);
  return companies as ExtractedCompany[];
}

export async function buildCompanyProfile(company: ExtractedCompany): Promise<string> {
  const msg = await client.messages.create({
    model:      MODEL,
    max_tokens: 1500,
    tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
    messages:   [{
      role:    'user',
      content: `Research ${company.name} (${company.ticker}) and write a concise investor research brief.

Cover:
1. Business model and main revenue streams
2. Recent financial performance (revenue growth, margins, key metrics)
3. Competitive position and moat
4. Recent developments in the last 30 days
5. Bull case and bear case (2-3 points each)

Write in the style of a sell-side equity research note. Be specific with numbers and dates. 3-4 paragraphs max.`,
    }],
  });
  return msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('\n');
}

export async function analyzeCatalyst(company: ExtractedCompany, tweetText: string): Promise<string> {
  const msg = await client.messages.create({
    model:      MODEL,
    max_tokens: 2000,
    tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
    messages:   [{
      role:    'user',
      content: `Deep dive analysis on this market catalyst:

Company: ${company.name} (${company.ticker})
Catalyst Type: ${company.catalystType}
Context: "${tweetText}"

Provide a structured analysis:
1. Verify and expand on the news with current data
2. Quantify the potential market impact (revenue, margins, TAM)
3. Comparable historical catalysts and their outcomes
4. Timeline and probability of full impact materializing
5. Key risks and counterpoints
6. Net assessment: significance level (high/medium/low) and why`,
    }],
  });
  return msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('\n');
}

export async function generateDigest(params: {
  handle:    string;
  companies: { ticker: string; name: string; recentMention: string }[];
  catalysts: { name: string; ticker: string; type: string; description: string }[];
}): Promise<string> {
  const msg = await client.messages.create({
    model:      MODEL,
    max_tokens: 4000,
    tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
    messages:   [{
      role:    'user',
      content: `Generate a comprehensive market intelligence digest from monitoring ${params.handle}.

TRACKED COMPANIES (${params.companies.length}):
${params.companies.map(c => `${c.name} (${c.ticker}): ${c.recentMention}`).join('\n')}

DETECTED CATALYSTS (${params.catalysts.length}):
${params.catalysts.map(c => `${c.name} (${c.ticker}) — ${c.type}: ${c.description}`).join('\n')}

Write a structured digest with these sections:

## Executive Summary
## Top Opportunities
## Catalyst Deep Dives
## Sector Themes
## Risk Radar
## Actionable Summary

Write like a professional research report. Use data, be specific, avoid filler.`,
    }],
  });
  return msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('\n');
}
