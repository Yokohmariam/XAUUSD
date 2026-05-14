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

const ROUND_NUMBERS = [
  1800, 1850, 1900, 1950, 2000, 2050, 2100, 2150, 2200,
  2250, 2300, 2350, 2400, 2450, 2500, 2600, 2700, 2800,
  2900, 3000, 3100, 3200, 3300, 3400, 3500,
];

function findEqualHighsLows(candles: OHLCV[], lookback = 30, tolerance = 0.001): {
  equalHighs: number[];
  equalLows: number[];
} {
  const recent = candles.slice(-lookback);
  const highs = recent.map(c => c.high);
  const lows = recent.map(c => c.low);

  const equalHighs: number[] = [];
  const equalLows: number[] = [];

  for (let i = 0; i < highs.length; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      if (Math.abs(highs[i] - highs[j]) / highs[i] < tolerance) {
        const level = (highs[i] + highs[j]) / 2;
        if (!equalHighs.some(h => Math.abs(h - level) / level < tolerance)) {
          equalHighs.push(Math.round(level * 100) / 100);
        }
      }
    }
  }

  for (let i = 0; i < lows.length; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      if (Math.abs(lows[i] - lows[j]) / lows[i] < tolerance) {
        const level = (lows[i] + lows[j]) / 2;
        if (!equalLows.some(l => Math.abs(l - level) / level < tolerance)) {
          equalLows.push(Math.round(level * 100) / 100);
        }
      }
    }
  }

  return { equalHighs, equalLows };
}

function findLiquidityZones(candles: OHLCV[]): {
  level: number;
  type: string;
  magnitude: string;
  source: string;
}[] {
  const zones: { level: number; type: string; magnitude: string; source: string }[] = [];

  // Previous day high/low
  if (candles.length >= 24) {
    const yesterday = candles.slice(-48, -24);
    if (yesterday.length > 0) {
      zones.push({
        level: Math.max(...yesterday.map(c => c.high)),
        type: "resistance",
        magnitude: "high",
        source: "previous_day_high",
      });
      zones.push({
        level: Math.min(...yesterday.map(c => c.low)),
        type: "support",
        magnitude: "high",
        source: "previous_day_low",
      });
    }
  }

  // Previous week high/low
  if (candles.length >= 120) {
    const lastWeek = candles.slice(-168, -120);
    if (lastWeek.length > 0) {
      zones.push({
        level: Math.max(...lastWeek.map(c => c.high)),
        type: "resistance",
        magnitude: "high",
        source: "previous_week_high",
      });
      zones.push({
        level: Math.min(...lastWeek.map(c => c.low)),
        type: "support",
        magnitude: "high",
        source: "previous_week_low",
      });
    }
  }

  // Equal highs/lows
  const { equalHighs, equalLows } = findEqualHighsLows(candles);
  for (const h of equalHighs) {
    zones.push({ level: h, type: "resistance", magnitude: "medium", source: "equal_highs" });
  }
  for (const l of equalLows) {
    zones.push({ level: l, type: "support", magnitude: "medium", source: "equal_lows" });
  }

  // Round numbers near current price
  const currentPrice = candles[candles.length - 1]?.close || 0;
  for (const rn of ROUND_NUMBERS) {
    if (Math.abs(rn - currentPrice) / currentPrice < 0.03) {
      zones.push({ level: rn, type: rn > currentPrice ? "resistance" : "support", magnitude: "medium", source: "round_number" });
    }
  }

  return zones;
}

function detectVolumeSpikes(candles: OHLCV[], threshold = 2.5): {
  index: number;
  volume: number;
  avgVolume: number;
  priceChange: number;
  type: string;
}[] {
  const volumes = candles.map(c => c.volume);
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const spikes: { index: number; volume: number; avgVolume: number; priceChange: number; type: string }[] = [];

  for (let i = 1; i < candles.length; i++) {
    if (candles[i].volume > avgVol * threshold) {
      const priceChange = ((candles[i].close - candles[i].open) / candles[i].open) * 100;
      let type = "neutral_spike";
      if (Math.abs(priceChange) < 0.05) type = "absorption";
      else if (priceChange > 0.1) type = "impulse_buy";
      else if (priceChange < -0.1) type = "impulse_sell";
      spikes.push({
        index: i,
        volume: candles[i].volume,
        avgVolume: Math.round(avgVol),
        priceChange: Math.round(priceChange * 100) / 100,
        type,
      });
    }
  }
  return spikes.slice(-5);
}

function detectWickRejections(candles: OHLCV[]): {
  level: number;
  type: string;
  wickRatio: number;
}[] {
  const rejections: { level: number; type: string; wickRatio: number }[] = [];
  for (const c of candles.slice(-20)) {
    const range = c.high - c.low;
    if (range === 0) continue;
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;
    if (upperWick / range > 0.6) {
      rejections.push({ level: Math.round(c.high * 100) / 100, type: "bearish_rejection", wickRatio: Math.round(upperWick / range * 100) / 100 });
    }
    if (lowerWick / range > 0.6) {
      rejections.push({ level: Math.round(c.low * 100) / 100, type: "bullish_rejection", wickRatio: Math.round(lowerWick / range * 100) / 100 });
    }
  }
  return rejections;
}

function detectStopHunt(candles: OHLCV[], zones: { level: number; type: string }[]): {
  level: number;
  direction: string;
  reversal: boolean;
  confidence: number;
}[] {
  const hunts: { level: number; direction: string; reversal: boolean; confidence: number }[] = [];
  const recent = candles.slice(-10);
  if (recent.length < 3) return hunts;

  for (const zone of zones) {
    for (let i = 1; i < recent.length - 1; i++) {
      const prev = recent[i - 1];
      const curr = recent[i];
      const next = recent[i + 1];

      // Check if price swept above resistance then reversed
      if (zone.type === "resistance" && prev.high < zone.level && curr.high > zone.level) {
        const sweptAndReversed = curr.close < zone.level && next.close < curr.close;
        if (sweptAndReversed) {
          hunts.push({
            level: zone.level,
            direction: "bearish_stop_hunt",
            reversal: true,
            confidence: 0.7,
          });
        }
      }

      // Check if price swept below support then reversed
      if (zone.type === "support" && prev.low > zone.level && curr.low < zone.level) {
        const sweptAndReversed = curr.close > zone.level && next.close > curr.close;
        if (sweptAndReversed) {
          hunts.push({
            level: zone.level,
            direction: "bullish_stop_hunt",
            reversal: true,
            confidence: 0.7,
          });
        }
      }
    }
  }
  return hunts;
}

function detectSmartMoneyPhase(candles: OHLCV[]): {
  phase: string;
  confidence: number;
  description: string;
} {
  const recent = candles.slice(-50);
  if (recent.length < 20) return { phase: "unknown", confidence: 0, description: "Insufficient data" };

  const closes = recent.map(c => c.close);
  const volumes = recent.map(c => c.volume);
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recentVol = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const priceChange = (closes[closes.length - 1] - closes[0]) / closes[0] * 100;

  // Accumulation: price flat/slightly down, volume decreasing
  if (Math.abs(priceChange) < 1 && recentVol < avgVol * 0.8) {
    return { phase: "accumulation", confidence: 0.6, description: "Price consolidating with declining volume" };
  }

  // Markup: price rising with increasing volume
  if (priceChange > 1.5 && recentVol > avgVol * 1.2) {
    return { phase: "markup", confidence: 0.7, description: "Price advancing with strong volume" };
  }

  // Distribution: price at highs, volume increasing but price stalling
  if (priceChange > 0 && priceChange < 1 && recentVol > avgVol * 1.3) {
    return { phase: "distribution", confidence: 0.6, description: "High volume but price stalling at highs" };
  }

  // Markdown: price falling with increasing volume
  if (priceChange < -1.5 && recentVol > avgVol * 1.2) {
    return { phase: "markdown", confidence: 0.7, description: "Price declining with strong volume" };
  }

  return { phase: "consolidation", confidence: 0.4, description: "No clear smart money phase detected" };
}

function calculateEngineeredLiquidityScore(zones: { level: number; type: string; magnitude: string }[], stopHunts: { level: number; direction: string }[], currentPrice: number): number {
  let score = 0;
  // More liquidity zones near price = higher score
  const nearbyZones = zones.filter(z => Math.abs(z.level - currentPrice) / currentPrice < 0.02);
  score += nearbyZones.length * 15;
  // Stop hunts detected = higher score
  score += stopHunts.length * 20;
  // Round numbers near price
  const nearRound = ROUND_NUMBERS.filter(rn => Math.abs(rn - currentPrice) / currentPrice < 0.01);
  score += nearRound.length * 10;
  return Math.min(100, score);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Fetch XAUUSD hourly data
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=1mo&interval=1h";
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch market data" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const quotes = result?.indicators?.quote?.[0];
    const candles: OHLCV[] = timestamps.map((t: number, i: number) => ({
      timestamp: new Date(t * 1000).toISOString(),
      open: quotes?.open?.[i] ?? 0,
      high: quotes?.high?.[i] ?? 0,
      low: quotes?.low?.[i] ?? 0,
      close: quotes?.close?.[i] ?? 0,
      volume: quotes?.volume?.[i] ?? 0,
    })).filter((c: OHLCV) => c.close > 0);

    if (candles.length < 50) {
      return new Response(JSON.stringify({ error: "Insufficient data" }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const currentPrice = candles[candles.length - 1].close;

    // Run all analyses
    const liquidityZones = findLiquidityZones(candles);
    const volumeSpikes = detectVolumeSpikes(candles);
    const wickRejections = detectWickRejections(candles);
    const stopHunts = detectStopHunt(candles, liquidityZones);
    const smartMoneyPhase = detectSmartMoneyPhase(candles);
    const engineeredScore = calculateEngineeredLiquidityScore(liquidityZones, stopHunts, currentPrice);

    // Trap warnings
    const trapWarnings: { level: number; type: string; description: string }[] = [];
    for (const hunt of stopHunts) {
      trapWarnings.push({
        level: hunt.level,
        type: hunt.direction,
        description: `Stop hunt detected at ${hunt.level} - retail stops likely swept`,
      });
    }
    for (const zone of liquidityZones.filter(z => z.magnitude === "high")) {
      if (Math.abs(zone.level - currentPrice) / currentPrice < 0.015) {
        trapWarnings.push({
          level: zone.level,
          type: zone.type === "resistance" ? "sell_trap" : "buy_trap",
          description: `High-magnitude ${zone.source} at ${zone.level} - potential trap zone`,
        });
      }
    }

    const output = {
      liquidity_zones: liquidityZones.map(z => ({
        level: z.level,
        type: z.type,
        magnitude: z.magnitude,
        source: z.source,
        distance_from_current: Math.round(Math.abs(z.level - currentPrice) * 100) / 100,
      })),
      institutional_footprints: {
        volume_spikes: volumeSpikes,
        wick_rejections: wickRejections,
        stop_hunts: stopHunts,
      },
      smart_money_phase: smartMoneyPhase,
      trap_warnings: trapWarnings,
      engineered_liquidity_score: engineeredScore,
      current_price: currentPrice,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ success: true, data: output }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
