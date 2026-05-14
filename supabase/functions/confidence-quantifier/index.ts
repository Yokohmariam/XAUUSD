const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LayerOutput {
  direction?: string;
  confidence?: number;
  bullish_score?: number;
  bearish_score?: number;
  sentiment_score?: number;
  gold_macro_bias?: number;
  probability?: number;
  strength?: number;
}

function calculateEntropy(probabilities: number[]): number {
  let entropy = 0;
  for (const p of probabilities) {
    if (p > 0 && p < 1) {
      entropy -= p * Math.log2(p) + (1 - p) * Math.log2(1 - p);
    }
  }
  return entropy / probabilities.length;
}

function monteCarloSimulation(
  currentPrice: number,
  dailyDrift: number,
  dailyVol: number,
  days: number,
  simulations: number,
  targetPrice: number | null,
  stopPrice: number | null
): {
  probHitTarget: number;
  probHitStop: number;
  maxAdverseExcursion: number;
  pricePaths: number[][];
  distribution: { p5: number; p25: number; p50: number; p75: number; p95: number };
} {
  const finalPrices: number[] = [];
  let hitTarget = 0;
  let hitStop = 0;
  let totalAdverse = 0;
  const samplePaths: number[][] = [];

  for (let s = 0; s < simulations; s++) {
    let price = currentPrice;
    let maxAdverse = 0;
    const path = [price];

    for (let d = 0; d < days; d++) {
      const shock = dailyVol * gaussianRandom();
      price = price * Math.exp(dailyDrift + shock);
      const adverse = (currentPrice - price) / currentPrice;
      if (adverse > maxAdverse) maxAdverse = adverse;
      path.push(price);

      if (targetPrice && price >= targetPrice) { hitTarget++; break; }
      if (stopPrice && price <= stopPrice) { hitStop++; break; }
    }

    finalPrices.push(price);
    totalAdverse += maxAdverse;
    if (s < 20) samplePaths.push(path);
  }

  finalPrices.sort((a, b) => a - b);
  const n = finalPrices.length;

  return {
    probHitTarget: targetPrice ? hitTarget / simulations : 0,
    probHitStop: stopPrice ? hitStop / simulations : 0,
    maxAdverseExcursion: Math.round((totalAdverse / simulations) * 10000) / 100,
    pricePaths: samplePaths,
    distribution: {
      p5: finalPrices[Math.floor(n * 0.05)] || 0,
      p25: finalPrices[Math.floor(n * 0.25)] || 0,
      p50: finalPrices[Math.floor(n * 0.50)] || 0,
      p75: finalPrices[Math.floor(n * 0.75)] || 0,
      p95: finalPrices[Math.floor(n * 0.95)] || 0,
    },
  };
}

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function assessEnsembleDisagreement(layers: LayerOutput[]): {
  disagreementScore: number;
  dominantView: string;
  confidencePenalty: number;
} {
  const directions = layers.map(l => {
    if (l.direction === "bullish" || (l.bullish_score && l.bullish_score > l.bearish_score)) return 1;
    if (l.direction === "bearish" || (l.bearish_score && l.bearish_score > l.bullish_score)) return -1;
    return 0;
  });

  const avg = directions.reduce((a, b) => a + b, 0) / directions.length;
  const variance = directions.reduce((s, d) => s + (d - avg) ** 2, 0) / directions.length;
  const disagreementScore = Math.min(1, Math.sqrt(variance));

  return {
    disagreementScore: Math.round(disagreementScore * 100) / 100,
    dominantView: avg > 0.2 ? "bullish" : avg < -0.2 ? "bearish" : "neutral",
    confidencePenalty: Math.round(disagreementScore * 30), // up to 30% penalty
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let body: any = {};
    if (req.method === "POST") {
      body = await req.json();
    }

    const currentPrice = body.current_price || 2350;
    const forecastDirection = body.forecast_direction || "bullish";
    const forecastConfidence = body.forecast_confidence || 60;
    const dailyVol = body.daily_volatility || 0.008;
    const dailyDrift = body.daily_drift || (forecastDirection === "bullish" ? 0.0005 : -0.0005);
    const targetPrice = body.target_price || (forecastDirection === "bullish" ? currentPrice * 1.02 : null);
    const stopPrice = body.stop_price || (forecastDirection === "bullish" ? currentPrice * 0.985 : null);
    const layers = body.layers || [];

    // Monte Carlo simulation
    const mc5d = monteCarloSimulation(currentPrice, dailyDrift, dailyVol, 5, 5000, targetPrice, stopPrice);
    const mc10d = monteCarloSimulation(currentPrice, dailyDrift, dailyVol, 10, 5000, targetPrice, stopPrice);

    // Entropy calculation
    const layerProbs = layers.map((l: any) => (l.confidence || 50) / 100);
    if (layerProbs.length === 0) layerProbs.push(forecastConfidence / 100);
    const entropy = calculateEntropy(layerProbs);

    // Ensemble disagreement
    const disagreement = assessEnsembleDisagreement(layers);

    // Adjusted confidence
    const adjustedConfidence = Math.max(10, Math.min(95,
      forecastConfidence - disagreement.confidencePenalty - entropy * 20
    ));

    // Confidence intervals
    const priceTarget = forecastDirection === "bullish" ? targetPrice : stopPrice;
    const confidence80 = {
      lower: mc5d.distribution.p10 || mc5d.distribution.p25,
      upper: mc5d.distribution.p90 || mc5d.distribution.p75,
    };
    const confidence95 = {
      lower: mc5d.distribution.p5,
      upper: mc5d.distribution.p95,
    };

    // Uncertainty statement
    let uncertaintyStatement = "";
    if (adjustedConfidence >= 80) {
      uncertaintyStatement = `High confidence (${Math.round(adjustedConfidence)}%): ${forecastDirection} continuation expected`;
    } else if (adjustedConfidence >= 60) {
      uncertaintyStatement = `Moderate confidence (${Math.round(adjustedConfidence)}%): ${forecastDirection} bias but watch for reversals`;
    } else if (adjustedConfidence >= 45) {
      uncertaintyStatement = `Low confidence (${Math.round(adjustedConfidence)}%): Macro data conflicting with technicals`;
    } else {
      uncertaintyStatement = `Avoid trading: Uncertainty exceeds acceptable threshold (${Math.round(adjustedConfidence)}%)`;
    }

    // Calibration warning
    const overconfidenceWarning = forecastConfidence > 85 && disagreement.disagreementScore > 0.3;

    const result = {
      point_estimate: {
        direction: forecastDirection,
        confidence: Math.round(adjustedConfidence),
      },
      confidence_intervals: {
        "80%": confidence80,
        "95%": confidence95,
      },
      monte_carlo: {
        "5_day": {
          prob_hit_target: Math.round(mc5d.probHitTarget * 100),
          prob_hit_stop: Math.round(mc5d.probHitStop * 100),
          max_adverse_excursion_pct: mc5d.maxAdverseExcursion,
          distribution: mc5d.distribution,
        },
        "10_day": {
          prob_hit_target: Math.round(mc10d.probHitTarget * 100),
          prob_hit_stop: Math.round(mc10d.probHitStop * 100),
          distribution: mc10d.distribution,
        },
      },
      uncertainty: {
        entropy: Math.round(entropy * 100) / 100,
        ensemble_disagreement: disagreement.disagreementScore,
        confidence_penalty: disagreement.confidencePenalty,
        statement: uncertaintyStatement,
        overconfidence_warning: overconfidenceWarning,
      },
      recommendation: adjustedConfidence >= 65
        ? "Tradeable with position sizing adjustment"
        : adjustedConfidence >= 45
        ? "Wait for confirmation before entering"
        : "Avoid trading - insufficient edge",
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
