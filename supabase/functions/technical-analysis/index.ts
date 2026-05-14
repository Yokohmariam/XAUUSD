const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OHLCV {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// EMA calculation
function ema(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  let prev = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    if (i === period - 1) { result.push(prev); continue; }
    prev = (data[i] - prev) * multiplier + prev;
    result.push(prev);
  }
  return result;
}

// RSI calculation
function rsi(closes: number[], period = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < closes.length; i++) {
    if (i < period) { result.push(NaN); continue; }
    if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
      continue;
    }
    avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

// ATR calculation
function atr(candles: OHLCV[], period = 14): number[] {
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { trs.push(candles[i].high - candles[i].low); continue; }
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ));
  }
  const result: number[] = [];
  let prev = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < trs.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    if (i === period - 1) { result.push(prev); continue; }
    prev = (prev * (period - 1) + trs[i]) / period;
    result.push(prev);
  }
  return result;
}

// ADX calculation
function adx(candles: OHLCV[], period = 14): { adx: number; pdi: number; mdi: number } {
  if (candles.length < period * 2) return { adx: 0, pdi: 50, mdi: 50 };
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    ));
  }
  let smoothTR = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
  const dxValues: number[] = [];
  for (let i = period; i < trs.length; i++) {
    smoothTR = smoothTR - smoothTR / period + trs[i];
    smoothPDM = smoothPDM - smoothPDM / period + plusDM[i];
    smoothMDM = smoothMDM - smoothMDM / period + minusDM[i];
    const pdi = smoothTR === 0 ? 0 : (smoothPDM / smoothTR) * 100;
    const mdi = smoothTR === 0 ? 0 : (smoothMDM / smoothTR) * 100;
    const dx = (pdi + mdi) === 0 ? 0 : Math.abs(pdi - mdi) / (pdi + mdi) * 100;
    dxValues.push(dx);
  }
  let adxVal = dxValues.length >= period ? dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period : 0;
  for (let i = period; i < dxValues.length; i++) {
    adxVal = (adxVal * (period - 1) + dxValues[i]) / period;
  }
  const lastPDI = smoothTR === 0 ? 50 : (smoothPDM / smoothTR) * 100;
  const lastMDI = smoothTR === 0 ? 50 : (smoothMDM / smoothTR) * 100;
  return { adx: adxVal, pdi: lastPDI, mdi: lastMDI };
}

// MACD
function macd(closes: number[], fast = 12, slow = 26, signal = 9): { macd: number; signal: number; histogram: number } {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(emaFast[i]) || isNaN(emaSlow[i])) { macdLine.push(NaN); continue; }
    macdLine.push(emaFast[i] - emaSlow[i]);
  }
  const validMacd = macdLine.filter(v => !isNaN(v));
  const signalLine = ema(validMacd, signal);
  const lastMacd = validMacd[validMacd.length - 1] || 0;
  const lastSignal = signalLine[signalLine.length - 1] || 0;
  return { macd: lastMacd, signal: lastSignal, histogram: lastMacd - lastSignal };
}

// Bollinger Bands
function bollingerBands(closes: number[], period = 20, mult = 2): { upper: number; middle: number; lower: number; bandwidth: number; percentB: number } {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0, bandwidth: 0, percentB: 0.5 };
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  const upper = mean + mult * std;
  const lower = mean - mult * std;
  const lastClose = closes[closes.length - 1];
  return {
    upper, middle: mean, lower,
    bandwidth: mean === 0 ? 0 : (upper - lower) / mean * 100,
    percentB: (upper - lower) === 0 ? 0.5 : (lastClose - lower) / (upper - lower)
  };
}

// Swing detection
function findSwings(candles: OHLCV[], lookback = 5): { swingHighs: number[]; swingLows: number[] } {
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true, isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high < candles[i - j].high || candles[i].high < candles[i + j].high) isHigh = false;
      if (candles[i].low > candles[i - j].low || candles[i].low > candles[i + j].low) isLow = false;
    }
    if (isHigh) swingHighs.push(candles[i].high);
    if (isLow) swingLows.push(candles[i].low);
  }
  return { swingHighs, swingLows };
}

// Detect BOS and CHOCH
function detectStructure(swingHighs: number[], swingLows: number[]): { structure: string; bos: boolean; choch: boolean } {
  if (swingHighs.length < 2 || swingLows.length < 2) return { structure: "undefined", bos: false, choch: false };
  const lastHighs = swingHighs.slice(-3);
  const lastLows = swingLows.slice(-3);
  const higherHighs = lastHighs.length >= 2 && lastHighs[lastHighs.length - 1] > lastHighs[lastHighs.length - 2];
  const higherLows = lastLows.length >= 2 && lastLows[lastLows.length - 1] > lastLows[lastLows.length - 2];
  const lowerHighs = lastHighs.length >= 2 && lastHighs[lastHighs.length - 1] < lastHighs[lastHighs.length - 2];
  const lowerLows = lastLows.length >= 2 && lastLows[lastLows.length - 1] < lastLows[lastLows.length - 2];

  if (higherHighs && higherLows) return { structure: "bullish", bos: true, choch: false };
  if (lowerHighs && lowerLows) return { structure: "bearish", bos: true, choch: false };
  if (higherHighs && lowerLows) return { structure: "consolidation", bos: false, choch: false };
  if (lowerHighs && higherLows) return { structure: "consolidation", bos: false, choch: true };
  return { structure: "consolidation", bos: false, choch: false };
}

// Fair Value Gap detection
function findFVG(candles: OHLCV[]): { type: string; high: number; low: number; mid: number }[] {
  const fvgs: { type: string; high: number; low: number; mid: number }[] = [];
  for (let i = 2; i < candles.length; i++) {
    const bullishGap = candles[i].low > candles[i - 2].high;
    const bearishGap = candles[i].high < candles[i - 2].low;
    if (bullishGap) fvgs.push({ type: "bullish", high: candles[i].low, low: candles[i - 2].high, mid: (candles[i].low + candles[i - 2].high) / 2 });
    if (bearishGap) fvgs.push({ type: "bearish", high: candles[i - 2].low, low: candles[i].high, mid: (candles[i - 2].low + candles[i].high) / 2 });
  }
  return fvgs.slice(-5);
}

// RSI Divergence detection
function detectRSIDivergence(closes: number[], rsiValues: number[]): { type: string; confidence: number } | null {
  const len = Math.min(closes.length, rsiValues.length);
  if (len < 20) return null;
  const recentCloses = closes.slice(-20);
  const recentRSI = rsiValues.slice(-20);
  const priceMakingHigherHighs = recentCloses[recentCloses.length - 1] > recentCloses[recentCloses.length - 10];
  const rsiMakingLowerHighs = recentRSI[recentRSI.length - 1] < recentRSI[recentRSI.length - 10];
  const priceMakingLowerLows = recentCloses[recentCloses.length - 1] < recentCloses[recentCloses.length - 10];
  const rsiMakingHigherLows = recentRSI[recentRSI.length - 1] > recentRSI[recentRSI.length - 10];

  if (priceMakingHigherHighs && rsiMakingLowerHighs) return { type: "bearish_divergence", confidence: 0.7 };
  if (priceMakingLowerLows && rsiMakingHigherLows) return { type: "bullish_divergence", confidence: 0.7 };
  return null;
}

// Stochastic
function stochastic(candles: OHLCV[], kPeriod = 14, dPeriod = 3): { k: number; d: number } {
  if (candles.length < kPeriod) return { k: 50, d: 50 };
  const slice = candles.slice(-kPeriod);
  const highest = Math.max(...slice.map(c => c.high));
  const lowest = Math.min(...slice.map(c => c.low));
  const lastClose = candles[candles.length - 1].close;
  const k = highest === lowest ? 50 : ((lastClose - lowest) / (highest - lowest)) * 100;
  return { k, d: k }; // simplified
}

function analyzeTimeframe(candles: OHLCV[], tf: string) {
  const closes = candles.map(c => c.close);
  const lastClose = closes[closes.length - 1] || 0;

  // EMAs
  const ema9 = ema(closes, 9);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);

  // Trend from EMAs
  const lastEma9 = ema9[ema9.length - 1] || lastClose;
  const lastEma20 = ema20[ema20.length - 1] || lastClose;
  const lastEma50 = ema50[ema50.length - 1] || lastClose;
  const lastEma200 = ema200[ema200.length - 1] || lastClose;

  let trend = "neutral";
  if (lastClose > lastEma9 && lastEma9 > lastEma20 && lastEma20 > lastEma50) trend = "bullish";
  else if (lastClose < lastEma9 && lastEma9 < lastEma20 && lastEma20 < lastEma50) trend = "bearish";

  // ADX
  const adxResult = adx(candles);
  let trendStrength = "weak";
  if (adxResult.adx > 40) trendStrength = "extreme";
  else if (adxResult.adx > 20) trendStrength = "strong";

  // RSI
  const rsiValues = rsi(closes);
  const lastRSI = rsiValues[rsiValues.length - 1] || 50;
  const rsiDivergence = detectRSIDivergence(closes, rsiValues);

  // MACD
  const macdResult = macd(closes);

  // ATR
  const atrValues = atr(candles);
  const lastATR = atrValues[atrValues.length - 1] || 0;
  const atrPercent = lastClose > 0 ? (lastATR / lastClose) * 100 : 0;

  // Bollinger Bands
  const bb = bollingerBands(closes);

  // Swings
  const swings = findSwings(candles);
  const structure = detectStructure(swings.swingHighs, swings.swingLows);

  // FVGs
  const fvgs = findFVG(candles);

  // Stochastic
  const stoch = stochastic(candles);

  // Support/Resistance from swing levels
  const supportLevels = swings.swingLows.slice(-3);
  const resistanceLevels = swings.swingHighs.slice(-3);

  // Linear regression slope
  const x = closes.slice(-50).map((_, i) => i);
  const y = closes.slice(-50);
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const slope = n > 0 && (n * sumX2 - sumX * sumX) !== 0 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;

  return {
    timeframe: tf,
    price: lastClose,
    trend: {
      direction: trend,
      strength: trendStrength,
      adx: Math.round(adxResult.adx * 10) / 10,
      pdi: Math.round(adxResult.pdi * 10) / 10,
      mdi: Math.round(adxResult.mdi * 10) / 10,
      regression_slope: Math.round(slope * 10000) / 10000,
    },
    ema: {
      ema9: Math.round(lastEma9 * 100) / 100,
      ema20: Math.round(lastEma20 * 100) / 100,
      ema50: Math.round(lastEma50 * 100) / 100,
      ema200: Math.round(lastEma200 * 100) / 100,
    },
    structure: {
      current: structure.structure,
      bos: structure.bos,
      choch: structure.choch,
      swing_highs: resistanceLevels.map(v => Math.round(v * 100) / 100),
      swing_lows: supportLevels.map(v => Math.round(v * 100) / 100),
    },
    support_resistance: {
      support: supportLevels.map(v => Math.round(v * 100) / 100),
      resistance: resistanceLevels.map(v => Math.round(v * 100) / 100),
      fair_value_gaps: fvgs,
    },
    momentum: {
      rsi: Math.round(lastRSI * 10) / 10,
      rsi_zone: lastRSI > 70 ? "overbought" : lastRSI < 30 ? "oversold" : "neutral",
      rsi_divergence: rsiDivergence,
      macd: {
        line: Math.round(macdResult.macd * 100) / 100,
        signal: Math.round(macdResult.signal * 100) / 100,
        histogram: Math.round(macdResult.histogram * 100) / 100,
        crossover: macdResult.histogram > 0 ? "bullish" : "bearish",
      },
      stochastic: { k: Math.round(stoch.k * 10) / 10, d: Math.round(stoch.d * 10) / 10 },
    },
    volatility: {
      atr: Math.round(lastATR * 100) / 100,
      atr_percent: Math.round(atrPercent * 100) / 100,
      bollinger: bb,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get("symbol") || "XAUUSD";

    // Fetch historical data from Yahoo Finance for multiple timeframes
    const timeframes = [
      { tf: "1M", range: "1mo", interval: "1d" },
      { tf: "1W", range: "6mo", interval: "1wk" },
      { tf: "1D", range: "1y", interval: "1d" },
      { tf: "H4", range: "6mo", interval: "1h" },
      { tf: "H1", range: "1mo", interval: "1h" },
      { tf: "M15", range: "5d", interval: "15m" },
      { tf: "M5", range: "5d", interval: "5m" },
      { tf: "M1", range: "1d", interval: "1m" },
    ];

    const YAHOO_MAP: Record<string, string> = {
      XAUUSD: "GC=F", XAGUSD: "SI=F", DXY: "DX-Y.NYB",
      EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "USDJPY=X",
      WTI: "CL=F", SPX: "^GSPC", NDX: "^IXIC", VIX: "^VIX", BTCUSD: "BTC-USD"
    };
    const yahooSym = YAHOO_MAP[symbol] || symbol;

    const results: Record<string, any> = {};
    const errors: string[] = [];

    for (const { tf, range, interval } of timeframes) {
      try {
        const fetchUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=${range}&interval=${interval}`;
        const response = await fetch(fetchUrl, {
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        if (!response.ok) { errors.push(`${tf}: fetch failed`); continue; }

        const data = await response.json();
        const result = data?.chart?.result?.[0];
        if (!result) { errors.push(`${tf}: no data`); continue; }

        const timestamps = result.timestamp || [];
        const quotes = result.indicators?.quote?.[0];
        const candles: OHLCV[] = timestamps.map((t: number, i: number) => ({
          timestamp: new Date(t * 1000).toISOString(),
          open: quotes?.open?.[i] ?? 0,
          high: quotes?.high?.[i] ?? 0,
          low: quotes?.low?.[i] ?? 0,
          close: quotes?.close?.[i] ?? 0,
          volume: quotes?.volume?.[i] ?? 0,
        })).filter((c: OHLCV) => c.close > 0);

        if (candles.length > 30) {
          results[tf] = analyzeTimeframe(candles, tf);
        } else {
          errors.push(`${tf}: insufficient data (${candles.length} candles)`);
        }
      } catch (e) {
        errors.push(`${tf}: ${e.message}`);
      }
    }

    // Multi-timeframe consensus
    const trends = Object.values(results).map((r: any) => r.trend.direction);
    const bullishCount = trends.filter(t => t === "bullish").length;
    const bearishCount = trends.filter(t => t === "bearish").length;
    const consensus = bullishCount > bearishCount ? "bullish" : bearishCount > bullishCount ? "bearish" : "mixed";

    return new Response(JSON.stringify({
      success: true,
      symbol,
      timeframes: results,
      multi_tf_consensus: {
        direction: consensus,
        bullish_timeframes: bullishCount,
        bearish_timeframes: bearishCount,
        total_analyzed: Object.keys(results).length,
      },
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
