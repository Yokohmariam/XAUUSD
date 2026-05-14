import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FRED_SERIES: Record<string, { id: string; name: string; impact: string }> = {
  fed_funds_rate: { id: "FEDFUNDS", name: "Fed Funds Rate", impact: "direct" },
  cpi_yoy: { id: "CPIAUCSL", name: "CPI YoY", impact: "direct" },
  core_cpi: { id: "CPILFESL", name: "Core CPI", impact: "direct" },
  ppi: { id: "PPIACO", name: "PPI", impact: "indirect" },
  unemployment: { id: "UNRATE", name: "Unemployment Rate", impact: "direct" },
  gdp: { id: "GDP", name: "GDP", impact: "indirect" },
  treasury_10y: { id: "DGS10", name: "10Y Treasury", impact: "direct" },
  treasury_2y: { id: "DGS2", name: "2Y Treasury", impact: "direct" },
  dxy: { id: "DTWEXBGS", name: "DXY", impact: "direct" },
  m2_money_supply: { id: "WM2NS", name: "M2 Money Supply", impact: "indirect" },
  fed_assets: { id: "WALCL", name: "Fed Balance Sheet", impact: "indirect" },
};

function interpretGoldImpact(seriesId: string, currentValue: number, previousValue: number): {
  deviation: string;
  goldImpact: string;
  confidence: number;
} {
  const diff = currentValue - previousValue;
  const pctChange = previousValue !== 0 ? (diff / Math.abs(previousValue)) * 100 : 0;

  switch (seriesId) {
    case "FEDFUNDS":
      if (diff > 0) return { deviation: "hawkish", goldImpact: "bearish", confidence: 8 };
      if (diff < 0) return { deviation: "dovish", goldImpact: "bullish", confidence: 8 };
      return { deviation: "neutral", goldImpact: "neutral", confidence: 5 };

    case "CPIAUCSL":
    case "CPILFESL":
      if (pctChange > 0.3) return { deviation: "inflation_rising", goldImpact: "bullish_short_bearish_long", confidence: 7 };
      if (pctChange < -0.3) return { deviation: "disinflation", goldImpact: "bearish_short_bullish_long", confidence: 7 };
      return { deviation: "stable", goldImpact: "neutral", confidence: 5 };

    case "UNRATE":
      if (diff > 0) return { deviation: "weakening_labor", goldImpact: "bullish", confidence: 6 };
      if (diff < 0) return { deviation: "strong_labor", goldImpact: "bearish", confidence: 6 };
      return { deviation: "stable", goldImpact: "neutral", confidence: 5 };

    case "DGS10":
      if (diff > 0.1) return { deviation: "yields_rising", goldImpact: "bearish", confidence: 8 };
      if (diff < -0.1) return { deviation: "yields_falling", goldImpact: "bullish", confidence: 8 };
      return { deviation: "stable", goldImpact: "neutral", confidence: 5 };

    case "DTWEXBGS":
      if (pctChange > 0.5) return { deviation: "dollar_strong", goldImpact: "bearish", confidence: 8 };
      if (pctChange < -0.5) return { deviation: "dollar_weak", goldImpact: "bullish", confidence: 8 };
      return { deviation: "stable", goldImpact: "neutral", confidence: 5 };

    case "GDP":
      if (pctChange > 0.5) return { deviation: "growth_strong", goldImpact: "bearish", confidence: 5 };
      if (pctChange < -0.5) return { deviation: "growth_weak", goldImpact: "bullish", confidence: 5 };
      return { deviation: "stable", goldImpact: "neutral", confidence: 4 };

    default:
      return { deviation: "neutral", goldImpact: "neutral", confidence: 3 };
  }
}

async function fetchFredData(seriesId: string, apiKey: string): Promise<{
  current: number;
  previous: number;
  date: string;
} | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const observations = data?.observations;
    if (!observations || observations.length < 2) return null;
    return {
      current: parseFloat(observations[0].value),
      previous: parseFloat(observations[1].value),
      date: observations[0].date,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const fredApiKey = Deno.env.get("FRED_API_KEY") || "";
    const indicators: Record<string, any> = {};
    const errors: string[] = [];

    if (fredApiKey) {
      for (const [key, series] of Object.entries(FRED_SERIES)) {
        const data = await fetchFredData(series.id, fredApiKey);
        if (data && !isNaN(data.current) && !isNaN(data.previous)) {
          const impact = interpretGoldImpact(series.id, data.current, data.previous);
          indicators[key] = {
            name: series.name,
            current_value: data.current,
            previous_value: data.previous,
            date: data.date,
            impact_type: series.impact,
            deviation: impact.deviation,
            gold_impact: impact.goldImpact,
            confidence: impact.confidence,
          };
        } else {
          errors.push(`${key}: no data`);
        }
      }
    }

    // Calculate composite scores even without FRED
    const yield10y = indicators.treasury_10y?.current_value || 4.3;
    const yield2y = indicators.treasury_2y?.current_value || 4.1;
    const cpi = indicators.cpi_yoy?.current_value || 3.2;
    const fedRate = indicators.fed_funds_rate?.current_value || 5.25;
    const unemployment = indicators.unemployment?.current_value || 3.8;

    const yieldSpread = yield10y - yield2y;
    const realYields = yield10y - cpi;

    // USD Strength Score (-10 to +10)
    const dxyChange = indicators.dxy ? (indicators.dxy.current_value - indicators.dxy.previous_value) / indicators.dxy.previous_value * 100 : 0;
    const usdStrength = Math.max(-10, Math.min(10, dxyChange * 5 + (fedRate > 5 ? 2 : fedRate > 4 ? 1 : -1)));

    // Inflation Regime
    let inflationRegime = "stable";
    if (cpi > 5) inflationRegime = "overheating";
    else if (cpi > 3) inflationRegime = "elevated";
    else if (cpi > 2) inflationRegime = "perfect";
    else if (cpi > 0) inflationRegime = "disinflation";
    else inflationRegime = "deflation";

    // Real Rate Regime
    let realRateRegime = "neutral";
    if (realYields > 1.5) realRateRegime = "positive";
    else if (realYields > 0) realRateRegime = "slightly_positive";
    else if (realYields > -1) realRateRegime = "slightly_negative";
    else realRateRegime = "negative";

    // Gold Macro Bias (1-10)
    let goldMacroBias = 5;
    if (realYields < 0) goldMacroBias += 2;
    if (yieldSpread < 0) goldMacroBias += 1; // inverted yield curve = recession risk
    if (inflationRegime === "overheating") goldMacroBias += 1;
    if (inflationRegime === "deflation") goldMacroBias -= 1;
    if (usdStrength > 3) goldMacroBias -= 2;
    if (usdStrength < -3) goldMacroBias += 2;
    goldMacroBias = Math.max(1, Math.min(10, goldMacroBias));

    const result = {
      indicators,
      composite: {
        usd_strength_score: Math.round(usdStrength * 10) / 10,
        inflation_regime: inflationRegime,
        real_rate_regime: realRateRegime,
        yield_curve_spread: Math.round(yieldSpread * 100) / 100,
        real_yields: Math.round(realYields * 100) / 100,
        gold_macro_bias: goldMacroBias,
        gold_macro_direction: goldMacroBias > 6 ? "bullish" : goldMacroBias < 4 ? "bearish" : "neutral",
      },
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    };

    // Store in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from("analysis_snapshots").insert({
      analysis_type: "macro_fundamentals",
      data: result,
      confidence_score: fredApiKey ? 80 : 40,
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
