import axios from 'axios';

const BASE = 'https://www.alphavantage.co/query';
const KEY  = process.env.ALPHA_VANTAGE_API_KEY ?? 'demo';

export interface PriceData {
  price:         number;
  change:        number;
  changePercent: string;
  volume:        number;
  high:          number;
  low:           number;
  previousClose: number;
}

export async function getQuote(ticker: string): Promise<PriceData | null> {
  try {
    const { data } = await axios.get(BASE, {
      params:  { function: 'GLOBAL_QUOTE', symbol: ticker, apikey: KEY },
      timeout: 8000,
    });
    const q = data['Global Quote'];
    if (!q || !q['05. price']) return null;
    return {
      price:         parseFloat(q['05. price']),
      change:        parseFloat(q['09. change']),
      changePercent: q['10. change percent'],
      volume:        parseInt(q['06. volume']),
      high:          parseFloat(q['03. high']),
      low:           parseFloat(q['04. low']),
      previousClose: parseFloat(q['08. previous close']),
    };
  } catch (err) {
    console.error(`Quote fetch failed for ${ticker}:`, err);
    return null;
  }
}

export async function getQuotes(tickers: string[]): Promise<Record<string, PriceData | null>> {
  const results: Record<string, PriceData | null> = {};
  for (const ticker of tickers) {
    results[ticker] = await getQuote(ticker);
    if (tickers.indexOf(ticker) < tickers.length - 1) {
      await new Promise(r => setTimeout(r, 12500));
    }
  }
  return results;
}
