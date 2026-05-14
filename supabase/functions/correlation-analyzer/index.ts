const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const YAHOO_MAP: Record<string, string> = {
  XAUUSD: "GC=F",
  DXY: "DX-Y.NYB",
  US10Y: "^TNX",
  EURUSD: "EURUSD=X",
  XAGUSD: "SI=F",
  SPX: "^GSPC",
  VIX: "^VIX",
  BTCUSD: "BTC-USD",
  WTI: "CL=F",
};

const CORRELATED_ASSETS = ["DXY", "US10Y", "EURUSD", "XAGUSD", "SPX", "VIX", "BTCUSD", "WTI"];

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0;
  const xSlice = x.slice(-n);
  const ySlice = y.slice(-n);
  const meanX = xSlice.reduce((a, b) => a + b, 0) / n;
  const meanY = ySlice.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - meanX;
    const dy = ySlice[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

async function fetchReturns(symbol: string, range: string, interval: string): Promise<number[]> {
  try {
    const yahooSym = YAHOO_MAP[symbol];
    if (!yahooSym) return [];
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=${range}&interval=${interval}`;
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) return [];
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const validCloses = closes.filter((c: number) => c != null && !isNaN(c));
    const returns: number[] = [];
    for (let i = 1; i < validCloses.length; i++) {
      if (validCloses[i - 1] !== 0) {
        returns.push((validCloses[i] - validCloses[i - 1]) / validCloses[i - 1]);
      }
    }
    return returns;
  } catch {
    return [];
  }
}

function detectDivergence(
  goldReturns: number[],
  assetReturns: number[],
  assetName: string,
  typicalCorrelation: number
): { type: string; description: string; significance: string } | null {
  const n = Math.min(goldReturns.length, assetReturns.length);
  if (n < 10) return null;
  const recentGold = goldReturns.slice(-10);
  const recentAsset = assetReturns.slice(-10);
  const goldDirection = recentGold.reduce((a, b) => a + b, 0);
  const assetDirection = recentAsset.reduce((a, b) => a + b, 0);

  // Divergence: gold and asset moving in same direction when they should be inverse
  if (typicalCorrelation < 0 && goldDirection > 0 && assetDirection > 0) {
    return {
      type: "positive_divergence",
      description: `Gold up + ${assetName} up (typically inverse) - indicates safe haven bid`,
      significance: "high",
    };
  }
  if (typicalCorrelation < 0 && goldDirection < 0 && assetDirection < 0) {
    return {
      type: "negative_divergence",
      description: `Gold down + ${assetName} down (typically inverse) - bearish for gold`,
      significance: "medium",
    };
  }
  if (typicalCorrelation > 0 && goldDirection > 0 && assetDirection < 0) {
    return {
      type: "correlation_breakdown",
      description: `Gold up + ${assetName} down (typically correlated) - correlation breakdown`,
      significance: "high",
    };
  }
  return null;
}

const TYPICAL_CORRELATIONS: Record<string, number> = {
  DXY: -0.85,
  US10Y: -0.70,
  EURUSD: 0.75,
  XAGUSD: 0.90,
  SPX: 0.20,
  VIX: 0.30,
  BTCUSD: 0.25,
  WTI: 0.35,
};

const IMPACT_ESTIMATES: Record<string, number> = {
  DXY: 8,
  US10Y: 7,
  EURUSD: 6,
  XAGUSD: 5,
  SPX: 4,
  VIX: 5,
  BTCUSD: 3,
  WTI: 3,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const timeframes = [
      { label: "1H", range: "5d", interval: "1h" },
      { label: "4H", range: "1mo", interval: "1h" },
      { label: "1D", range: "6mo", interval: "1d" },
      { label: "1W", range: "1y", interval: "1wk" },
    ];

    const correlationMatrix: Record<string, Record<string, number>> = {};
    const divergences: { asset: string; type: string; description: string; significance: string }[] = {};

    // Fetch gold returns for all timeframes
    const goldReturnsByTF: Record<string, number[]> = {};
    for (const tf of timeframes) {
      goldReturnsByTF[tf.label] = await fetchReturns("XAUUSD", tf.range, tf.interval);
    }

    // Calculate correlations for each asset and timeframe
    for (const asset of CORRELATED_ASSETS) {
      correlationMatrix[asset] = {};
      const assetReturnsByTF: Record<string, number[]> = {};

      for (const tf of timeframes) {
        const assetReturns = await fetchReturns(asset, tf.range, tf.interval);
        assetReturnsByTF[tf.label] = assetReturns;
        const goldReturns = goldReturnsByTF[tf.label];
        const corr = pearsonCorrelation(goldReturns, assetReturns);
        correlationMatrix[asset][tf.label] = Math.round(corr * 100) / 100;
      }

      // Detect divergence using 1H timeframe
      const divergence = detectDivergence(
        goldReturnsByTF["1H"],
        assetReturnsByTF["1H"],
        asset,
        TYPICAL_CORRELATIONS[asset]
      );
      if (divergence) {
        divergences[asset] = divergence;
      }
    }

    // Find strongest influence
    let strongestInfluence = "DXY";
    let strongestAbsCorr = 0;
    for (const [asset, corrs] of Object.entries(correlationMatrix)) {
      const absCorr = Math.abs(corrs["1D"] || 0);
      if (absCorr > strongestAbsCorr) {
        strongestAbsCorr = absCorr;
        strongestInfluence = asset;
      }
    }

    // Predict gold move from DXY
    const dxyCorr = correlationMatrix["DXY"]?.["1D"] || -0.85;
    const dxyImpactPerPercent = Math.abs(dxyCorr) * 15; // rough: 0.85 * 15 = ~12.75 pips per 0.1% DXY move

    const result = {
      correlation_matrix: correlationMatrix,
      typical_correlations: TYPICAL_CORRELATIONS,
      strongest_influence: {
        asset: strongestInfluence,
        correlation_1d: correlationMatrix[strongestInfluence]?.["1D"] || 0,
        impact_score: IMPACT_ESTIMATES[strongestInfluence],
      },
      divergences: Object.entries(divergences).map(([asset, d]) => ({ asset, ...d })),
      impact_estimates: {
        dxy_move_0_5pct_gold_expected: `~${Math.round(dxyImpactPerPercent * 5)} pips (inverse)`,
        yields_up_10bp_gold_expected: `~${Math.round(Math.abs(correlationMatrix["US10Y"]?.["1D"] || -0.7) * 8)} pips (inverse)`,
      },
      hedge_ratio: {
        xagusd: Math.round(Math.abs(correlationMatrix["XAGUSD"]?.["1D"] || 0.9) * 100) / 100,
        eurusd: Math.round(Math.abs(correlationMatrix["EURUSD"]?.["1D"] || 0.75) * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
