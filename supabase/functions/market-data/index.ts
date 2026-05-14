import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYMBOLS = [
  "XAUUSD", "DXY", "US10Y", "EURUSD", "GBPUSD", "USDJPY",
  "XAGUSD", "WTI", "SPX", "NDX", "VIX", "BTCUSD"
];

const YAHOO_SYMBOLS: Record<string, string> = {
  XAUUSD: "GC=F",
  DXY: "DX-Y.NYB",
  US10Y: "^TNX",
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "USDJPY=X",
  XAGUSD: "SI=F",
  WTI: "CL=F",
  SPX: "^GSPC",
  NDX: "^IXIC",
  VIX: "^VIX",
  BTCUSD: "BTC-USD"
};

function getSessionLabel(utcHour: number): string {
  if (utcHour >= 0 && utcHour < 8) return "Asia";
  if (utcHour >= 8 && utcHour < 13) return "London";
  if (utcHour >= 13 && utcHour < 17) return "Overlap";
  if (utcHour >= 17 && utcHour < 22) return "NY";
  return "Asia";
}

async function fetchYahooData(symbol: string, yahooSymbol: string): Promise<{
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  session: string;
  timestamp: string;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1m`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const quotes = result.indicators?.quote?.[0];
    const closes = quotes?.close || [];
    const volumes = quotes?.volume || [];
    const opens = quotes?.open || [];
    const highs = quotes?.high || [];
    const lows = quotes?.low || [];

    const lastClose = closes[closes.length - 1] ?? meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || closes[closes.length - 2] || lastClose;
    const change = lastClose - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    const utcNow = new Date();
    const session = getSessionLabel(utcNow.getUTCHours());

    return {
      symbol,
      price: lastClose,
      change,
      changePercent,
      high: Math.max(...highs.filter((h: number) => h != null)) || lastClose,
      low: Math.min(...lows.filter((l: number) => l != null)) || lastClose,
      open: opens[0] ?? meta.regularMarketPrice,
      volume: volumes.reduce((a: number, b: number) => a + (b || 0), 0),
      session,
      timestamp: utcNow.toISOString()
    };
  } catch {
    return null;
  }
}

async function fetchWithRetry(symbol: string, yahooSymbol: string, retries = 3): Promise<ReturnType<typeof fetchYahooData>> {
  for (let i = 0; i < retries; i++) {
    const result = await fetchYahooData(symbol, yahooSymbol);
    if (result) return result;
    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "snapshot";

    if (action === "snapshot") {
      const results: Record<string, any> = {};
      const fetchPromises = SYMBOLS.map(async (sym) => {
        const yahooSym = YAHOO_SYMBOLS[sym];
        const data = await fetchWithRetry(sym, yahooSym);
        if (data) results[sym] = data;
      });

      await Promise.all(fetchPromises);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Store snapshot in analysis_snapshots
      await supabase.from("analysis_snapshots").insert({
        analysis_type: "market_snapshot",
        data: results,
        confidence_score: Object.keys(results).length / SYMBOLS.length * 100
      });

      return new Response(JSON.stringify({
        success: true,
        data: results,
        symbols_fetched: Object.keys(results).length,
        total_symbols: SYMBOLS.length,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "history") {
      const symbol = url.searchParams.get("symbol") || "XAUUSD";
      const range = url.searchParams.get("range") || "5d";
      const interval = url.searchParams.get("interval") || "1h";
      const yahooSym = YAHOO_SYMBOLS[symbol] || symbol;

      const fetchUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=${range}&interval=${interval}`;
      const response = await fetch(fetchUrl, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch history" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const data = await response.json();
      const result = data?.chart?.result?.[0];
      if (!result) {
        return new Response(JSON.stringify({ error: "No data returned" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const timestamps = result.timestamp || [];
      const quotes = result.indicators?.quote?.[0];
      const ohlcv = timestamps.map((t: number, i: number) => ({
        timestamp: new Date(t * 1000).toISOString(),
        open: quotes?.open?.[i],
        high: quotes?.high?.[i],
        low: quotes?.low?.[i],
        close: quotes?.close?.[i],
        volume: quotes?.volume?.[i],
        session: getSessionLabel(new Date(t * 1000).getUTCHours())
      })).filter((c: any) => c.close != null);

      return new Response(JSON.stringify({
        success: true,
        symbol,
        range,
        interval,
        data: ohlcv,
        count: ohlcv.length
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
