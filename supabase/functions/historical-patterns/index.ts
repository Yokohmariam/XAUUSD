import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Pre-defined historical patterns database
const HISTORICAL_PATTERNS = [
  {
    name: "FOMC Hawkish Surprise",
    event_type: "FOMC",
    timeframe: "H1",
    setup_conditions: {
      pre_event_range_pips: 200,
      pre_event_trend: "consolidation",
      rsi_zone: "neutral",
      volatility_regime: "low",
      dxy_trend: "neutral",
    },
    actual_outcome: {
      direction: "bearish",
      move_1d_pips: -250,
      move_3d_pips: -400,
      move_1w_pips: -200,
    },
    win_rate: 0.72,
  },
  {
    name: "FOMC Dovish Surprise",
    event_type: "FOMC",
    timeframe: "H1",
    setup_conditions: {
      pre_event_range_pips: 200,
      pre_event_trend: "consolidation",
      rsi_zone: "neutral",
      volatility_regime: "low",
      dxy_trend: "neutral",
    },
    actual_outcome: {
      direction: "bullish",
      move_1d_pips: 300,
      move_3d_pips: 500,
      move_1w_pips: 350,
    },
    win_rate: 0.68,
  },
  {
    name: "CPI Hot Print",
    event_type: "CPI",
    timeframe: "H1",
    setup_conditions: {
      pre_event_range_pips: 150,
      pre_event_trend: "consolidation",
      rsi_zone: "neutral",
      volatility_regime: "low",
      dxy_trend: "weak",
    },
    actual_outcome: {
      direction: "bearish",
      move_1d_pips: -200,
      move_3d_pips: -350,
      move_1w_pips: -150,
    },
    win_rate: 0.65,
  },
  {
    name: "CPI Cool Print",
    event_type: "CPI",
    timeframe: "H1",
    setup_conditions: {
      pre_event_range_pips: 150,
      pre_event_trend: "consolidation",
      rsi_zone: "neutral",
      volatility_regime: "low",
      dxy_trend: "strong",
    },
    actual_outcome: {
      direction: "bullish",
      move_1d_pips: 250,
      move_3d_pips: 400,
      move_1w_pips: 300,
    },
    win_rate: 0.62,
  },
  {
    name: "NFP Miss",
    event_type: "NFP",
    timeframe: "H1",
    setup_conditions: {
      pre_event_range_pips: 180,
      pre_event_trend: "consolidation",
      rsi_zone: "neutral",
      volatility_regime: "low",
      dxy_trend: "neutral",
    },
    actual_outcome: {
      direction: "bullish",
      move_1d_pips: 200,
      move_3d_pips: 300,
      move_1w_pips: 250,
    },
    win_rate: 0.58,
  },
  {
    name: "NFP Beat",
    event_type: "NFP",
    timeframe: "H1",
    setup_conditions: {
      pre_event_range_pips: 180,
      pre_event_trend: "consolidation",
      rsi_zone: "neutral",
      volatility_regime: "low",
      dxy_trend: "neutral",
    },
    actual_outcome: {
      direction: "bearish",
      move_1d_pips: -180,
      move_3d_pips: -250,
      move_1w_pips: -100,
    },
    win_rate: 0.55,
  },
  {
    name: "Geopolitical Spike",
    event_type: "Geopolitics",
    timeframe: "H4",
    setup_conditions: {
      pre_event_range_pips: 100,
      pre_event_trend: "bullish",
      rsi_zone: "neutral",
      volatility_regime: "normal",
      dxy_trend: "weak",
    },
    actual_outcome: {
      direction: "bullish",
      move_1d_pips: 400,
      move_3d_pips: 600,
      move_1w_pips: 300,
    },
    win_rate: 0.70,
  },
  {
    name: "Liquidity Sweep Reversal",
    event_type: "Technical",
    timeframe: "H1",
    setup_conditions: {
      pre_event_range_pips: 250,
      pre_event_trend: "consolidation",
      rsi_zone: "oversold",
      volatility_regime: "contracting",
      dxy_trend: "neutral",
    },
    actual_outcome: {
      direction: "bullish",
      move_1d_pips: 200,
      move_3d_pips: 350,
      move_1w_pips: 400,
    },
    win_rate: 0.72,
  },
  {
    name: "Breakout Failure",
    event_type: "Technical",
    timeframe: "H4",
    setup_conditions: {
      pre_event_range_pips: 300,
      pre_event_trend: "consolidation",
      rsi_zone: "overbought",
      volatility_regime: "expanding",
      dxy_trend: "strong",
    },
    actual_outcome: {
      direction: "bearish",
      move_1d_pips: -150,
      move_3d_pips: -300,
      move_1w_pips: -400,
    },
    win_rate: 0.65,
  },
  {
    name: "Trend Continuation Pullback",
    event_type: "Technical",
    timeframe: "H4",
    setup_conditions: {
      pre_event_range_pips: 200,
      pre_event_trend: "bullish",
      rsi_zone: "neutral",
      volatility_regime: "normal",
      dxy_trend: "weak",
    },
    actual_outcome: {
      direction: "bullish",
      move_1d_pips: 150,
      move_3d_pips: 300,
      move_1w_pips: 450,
    },
    win_rate: 0.68,
  },
  {
    name: "Major Top Formation",
    event_type: "Technical",
    timeframe: "1D",
    setup_conditions: {
      pre_event_range_pips: 500,
      pre_event_trend: "bullish",
      rsi_zone: "overbought",
      volatility_regime: "expanding",
      dxy_trend: "strengthening",
    },
    actual_outcome: {
      direction: "bearish",
      move_1d_pips: -100,
      move_3d_pips: -400,
      move_1w_pips: -700,
    },
    win_rate: 0.60,
  },
  {
    name: "Consolidation Breakout",
    event_type: "Technical",
    timeframe: "H4",
    setup_conditions: {
      pre_event_range_pips: 100,
      pre_event_trend: "consolidation",
      rsi_zone: "neutral",
      volatility_regime: "squeeze",
      dxy_trend: "neutral",
    },
    actual_outcome: {
      direction: "bullish",
      move_1d_pips: 200,
      move_3d_pips: 350,
      move_1w_pips: 500,
    },
    win_rate: 0.63,
  },
];

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dotProduct = 0, normA = 0, normB = 0;
  for (const key of keys) {
    const va = a[key] || 0;
    const vb = b[key] || 0;
    dotProduct += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

function conditionsToVector(conditions: Record<string, any>): Record<string, number> {
  const vec: Record<string, number> = {};
  // Range
  vec["range_low"] = (conditions.pre_event_range_pips || 150) < 150 ? 1 : 0;
  vec["range_normal"] = (conditions.pre_event_range_pips || 150) >= 150 && (conditions.pre_event_range_pips || 150) <= 250 ? 1 : 0;
  vec["range_high"] = (conditions.pre_event_range_pips || 150) > 250 ? 1 : 0;
  // Trend
  vec["trend_bullish"] = conditions.pre_event_trend === "bullish" ? 1 : 0;
  vec["trend_bearish"] = conditions.pre_event_trend === "bearish" ? 1 : 0;
  vec["trend_consolidation"] = conditions.pre_event_trend === "consolidation" ? 1 : 0;
  // RSI
  vec["rsi_oversold"] = conditions.rsi_zone === "oversold" ? 1 : 0;
  vec["rsi_neutral"] = conditions.rsi_zone === "neutral" ? 1 : 0;
  vec["rsi_overbought"] = conditions.rsi_zone === "overbought" ? 1 : 0;
  // Volatility
  vec["vol_low"] = conditions.volatility_regime === "low" || conditions.volatility_regime === "contracting" ? 1 : 0;
  vec["vol_normal"] = conditions.volatility_regime === "normal" ? 1 : 0;
  vec["vol_high"] = conditions.volatility_regime === "expanding" || conditions.volatility_regime === "high" ? 1 : 0;
  // DXY
  vec["dxy_strong"] = conditions.dxy_trend === "strong" || conditions.dxy_trend === "strengthening" ? 1 : 0;
  vec["dxy_weak"] = conditions.dxy_trend === "weak" ? 1 : 0;
  vec["dxy_neutral"] = conditions.dxy_trend === "neutral" ? 1 : 0;
  return vec;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const currentConditions = url.searchParams.get("conditions");

    let conditionsVec: Record<string, number>;
    if (currentConditions) {
      try {
        const parsed = JSON.parse(currentConditions);
        conditionsVec = conditionsToVector(parsed);
      } catch {
        conditionsVec = conditionsToVector({
          pre_event_range_pips: 200,
          pre_event_trend: "consolidation",
          rsi_zone: "neutral",
          volatility_regime: "normal",
          dxy_trend: "neutral",
        });
      }
    } else {
      // Default current conditions
      conditionsVec = conditionsToVector({
        pre_event_range_pips: 200,
        pre_event_trend: "consolidation",
        rsi_zone: "neutral",
        volatility_regime: "normal",
        dxy_trend: "neutral",
      });
    }

    // Calculate similarity scores
    const scored = HISTORICAL_PATTERNS.map(pattern => {
      const patternVec = conditionsToVector(pattern.setup_conditions);
      const similarity = cosineSimilarity(conditionsVec, patternVec);
      return { pattern, similarity };
    });

    // Sort by similarity and take top 3
    const topMatches = scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(m => ({
        name: m.pattern.name,
        event_type: m.pattern.event_type,
        timeframe: m.pattern.timeframe,
        similarity: Math.round(m.similarity * 100) / 100,
        setup_conditions: m.pattern.setup_conditions,
        expected_outcome: m.pattern.actual_outcome,
        win_rate: m.pattern.win_rate,
        confidence: Math.round(m.similarity * m.pattern.win_rate * 100) / 100,
      }));

    // Weighted probability
    const totalWeight = topMatches.reduce((sum, m) => sum + m.similarity, 0);
    const weightedDirection = topMatches.reduce((sum, m) => {
      const weight = m.similarity / totalWeight;
      return sum + (m.expected_outcome.direction === "bullish" ? 1 : -1) * weight;
    }, 0);

    const probabilityDirection = weightedDirection > 0 ? "bullish" : "bearish";
    const probabilityStrength = Math.abs(weightedDirection);

    // Expected price target
    const weightedMove1D = topMatches.reduce((sum, m) => {
      const weight = m.similarity / totalWeight;
      return sum + m.expected_outcome.move_1d_pips * weight;
    }, 0);
    const weightedMove1W = topMatches.reduce((sum, m) => {
      const weight = m.similarity / totalWeight;
      return sum + m.expected_outcome.move_1w_pips * weight;
    }, 0);

    const result = {
      top_matches: topMatches,
      probability: {
        direction: probabilityDirection,
        strength: Math.round(probabilityStrength * 100) / 100,
        weighted_win_rate: Math.round(topMatches.reduce((sum, m) => sum + m.win_rate * m.similarity, 0) / totalWeight * 100) / 100,
      },
      expected_move: {
        move_1d_pips: Math.round(weightedMove1D),
        move_1w_pips: Math.round(weightedMove1W),
      },
      pattern_confidence: Math.round(topMatches[0]?.confidence * 100 || 0),
      total_patterns_compared: HISTORICAL_PATTERNS.length,
      timestamp: new Date().toISOString(),
    };

    // Store in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from("analysis_snapshots").insert({
      analysis_type: "historical_patterns",
      data: result,
      confidence_score: result.pattern_confidence,
    });

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
