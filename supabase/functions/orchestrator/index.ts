import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callLayer(layer: string, params?: string): Promise<any> {
  try {
    const url = params ? `${SUPABASE_URL}/functions/v1/${layer}?${params}` : `${SUPABASE_URL}/functions/v1/${layer}`;
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      return { error: `Layer ${layer} returned ${response.status}`, success: false };
    }
    const data = await response.json();
    return data.success ? data.data : data;
  } catch (error) {
    return { error: `Layer ${layer} failed: ${error.message}`, success: false };
  }
}

function generateMarketSummary(market: any, technical: any, session: any): any {
  const goldData = market?.XAUUSD || {};
  const price = goldData.price || technical?.timeframes?.["1D"]?.price || 0;
  const change = goldData.changePercent || 0;
  const dailyTF = technical?.timeframes?.["1D"];
  const trend = dailyTF?.trend?.direction || "neutral";
  const currentSession = session?.current_session?.name || "Unknown";

  return {
    current_price: price,
    daily_change_percent: Math.round(change * 100) / 100,
    daily_high: goldData.high || dailyTF?.structure?.swing_highs?.[0] || 0,
    daily_low: goldData.low || dailyTF?.structure?.swing_lows?.[0] || 0,
    current_trend: trend,
    current_session: currentSession,
    market_status: change > 0.5 ? "strong_bullish" : change > 0 ? "mild_bullish" : change < -0.5 ? "strong_bearish" : "mild_bearish",
  };
}

function generateForecast(technical: any, macro: any, sentiment: any, correlation: any, patterns: any, smartMoney: any): any {
  let bullishScore = 0;
  let bearishScore = 0;
  let totalWeight = 0;

  // Technical (weight: 35%)
  const techConsensus = technical?.multi_tf_consensus;
  if (techConsensus) {
    const techWeight = 35;
    totalWeight += techWeight;
    if (techConsensus.direction === "bullish") bullishScore += techWeight * (techConsensus.bullish_timeframes / techConsensus.total_analyzed);
    if (techConsensus.direction === "bearish") bearishScore += techWeight * (techConsensus.bearish_timeframes / techConsensus.total_analyzed);
  }

  // Macro (weight: 25%)
  const macroBias = macro?.composite?.gold_macro_bias || 5;
  totalWeight += 25;
  if (macroBias > 5) bullishScore += 25 * ((macroBias - 5) / 5);
  if (macroBias < 5) bearishScore += 25 * ((5 - macroBias) / 5);

  // Sentiment (weight: 15%)
  const sentScore = sentiment?.aggregated?.sentiment_score || 0;
  totalWeight += 15;
  if (sentScore > 0) bullishScore += 15 * sentScore;
  if (sentScore < 0) bearishScore += 15 * Math.abs(sentScore);

  // Correlation (weight: 10%)
  const dxyCorr = correlation?.correlation_matrix?.DXY?.["1D"];
  totalWeight += 10;
  if (dxyCorr && dxyCorr < -0.5) bullishScore += 5;
  if (dxyCorr && dxyCorr > -0.3) bearishScore += 5;

  // Historical patterns (weight: 10%)
  const patternDir = patterns?.probability?.direction;
  const patternConf = patterns?.probability?.strength || 0;
  totalWeight += 10;
  if (patternDir === "bullish") bullishScore += 10 * patternConf;
  if (patternDir === "bearish") bearishScore += 10 * patternConf;

  // Smart money (weight: 5%)
  const smPhase = smartMoney?.smart_money_phase?.phase;
  totalWeight += 5;
  if (smPhase === "markup") bullishScore += 5;
  if (smPhase === "markdown") bearishScore += 5;

  const totalScore = bullishScore + bearishScore;
  const bullishPct = totalScore > 0 ? (bullishScore / totalScore) * 100 : 50;
  const bearishPct = 100 - bullishPct;

  let direction = "neutral";
  let confidence = 50;
  if (bullishPct > 60) { direction = "bullish"; confidence = Math.min(90, bullishPct); }
  else if (bearishPct > 60) { direction = "bearish"; confidence = Math.min(90, bearishPct); }
  else { confidence = 50 - Math.abs(bullishPct - 50); }

  return {
    direction,
    confidence: Math.round(confidence),
    bullish_score: Math.round(bullishPct),
    bearish_score: Math.round(bearishPct),
    key_driver: bullishPct > bearishPct ? "bullish_factors_dominant" : "bearish_factors_dominant",
    expected_move_1d_pips: patterns?.expected_move?.move_1d_pips || 0,
    expected_move_1w_pips: patterns?.expected_move?.move_1w_pips || 0,
  };
}

// ============================================================
// ENHANCED TRADE RECOMMENDATION ENGINE
// ============================================================

interface SignalFactor {
  name: string;
  direction: "bullish" | "bearish" | "neutral";
  weight: number;
  score: number; // -1 to +1
  detail: string;
}

function computeAllSignalFactors(
  technical: any,
  macro: any,
  sentiment: any,
  correlation: any,
  patterns: any,
  smartMoney: any,
  session: any,
  risk: any
): SignalFactor[] {
  const factors: SignalFactor[] = [];

  // --- TECHNICAL FACTORS ---
  const dailyTF = technical?.timeframes?.["1D"];
  const h4TF = technical?.timeframes?.["H4"];
  const h1TF = technical?.timeframes?.["H1"];
  const consensus = technical?.multi_tf_consensus;

  // 1. Multi-TF Trend Alignment
  if (consensus) {
    const bullRatio = consensus.bullish_timeframes / Math.max(1, consensus.total_analyzed);
    const bearRatio = consensus.bearish_timeframes / Math.max(1, consensus.total_analyzed);
    const score = bullRatio - bearRatio;
    factors.push({
      name: "Multi-TF Trend Alignment",
      direction: score > 0.2 ? "bullish" : score < -0.2 ? "bearish" : "neutral",
      weight: 20,
      score,
      detail: `${consensus.bullish_timeframes} bullish / ${consensus.bearish_timeframes} bearish of ${consensus.total_analyzed} timeframes`,
    });
  }

  // 2. Daily Market Structure
  if (dailyTF?.structure) {
    const s = dailyTF.structure;
    let score = 0;
    if (s.current === "bullish" && s.bos) score = 0.8;
    else if (s.current === "bearish" && s.bos) score = -0.8;
    else if (s.current === "bullish") score = 0.5;
    else if (s.current === "bearish") score = -0.5;
    else if (s.choch) score = 0.3; // CHOCH often signals reversal
    factors.push({
      name: "Daily Market Structure",
      direction: score > 0 ? "bullish" : score < 0 ? "bearish" : "neutral",
      weight: 15,
      score,
      detail: `Structure: ${s.current}${s.bos ? " + BOS" : ""}${s.choch ? " + CHOCH" : ""}`,
    });
  }

  // 3. RSI Momentum
  const rsi = dailyTF?.momentum?.rsi || h4TF?.momentum?.rsi || 50;
  let rsiScore = 0;
  if (rsi > 70) rsiScore = -0.4; // overbought = bearish signal
  else if (rsi < 30) rsiScore = 0.4; // oversold = bullish signal
  else if (rsi > 55) rsiScore = 0.2;
  else if (rsi < 45) rsiScore = -0.2;
  factors.push({
    name: "RSI Momentum",
    direction: rsiScore > 0 ? "bullish" : rsiScore < 0 ? "bearish" : "neutral",
    weight: 10,
    score: rsiScore,
    detail: `RSI: ${rsi} (${rsi > 70 ? "overbought" : rsi < 30 ? "oversold" : "neutral"})`,
  });

  // 4. RSI Divergence
  const rsiDiv = dailyTF?.momentum?.rsi_divergence || h4TF?.momentum?.rsi_divergence;
  if (rsiDiv) {
    const score = rsiDiv.type === "bullish_divergence" ? 0.6 : -0.6;
    factors.push({
      name: "RSI Divergence",
      direction: rsiDiv.type === "bullish_divergence" ? "bullish" : "bearish",
      weight: 12,
      score: score * rsiDiv.confidence,
      detail: `${rsiDiv.type.replace(/_/g, " ")} (confidence: ${rsiDiv.confidence})`,
    });
  }

  // 5. MACD Crossover
  const macdCross = dailyTF?.momentum?.macd?.crossover || h4TF?.momentum?.macd?.crossover;
  if (macdCross) {
    factors.push({
      name: "MACD Crossover",
      direction: macdCross === "bullish" ? "bullish" : "bearish",
      weight: 8,
      score: macdCross === "bullish" ? 0.5 : -0.5,
      detail: `MACD crossover: ${macdCross}`,
    });
  }

  // 6. ADX Trend Strength
  const adx = dailyTF?.trend?.adx || h4TF?.trend?.adx || 0;
  const trendDir = dailyTF?.trend?.direction || "neutral";
  if (adx > 20) {
    const score = trendDir === "bullish" ? 0.5 : trendDir === "bearish" ? -0.5 : 0;
    factors.push({
      name: "ADX Trend Strength",
      direction: trendDir,
      weight: 8,
      score: score * Math.min(1, adx / 40),
      detail: `ADX: ${adx} (${dailyTF?.trend?.strength || "weak"}), trend: ${trendDir}`,
    });
  }

  // --- MACRO FACTORS ---
  const macroBias = macro?.composite?.gold_macro_bias || 5;
  const macroScore = (macroBias - 5) / 5; // -1 to +1
  factors.push({
    name: "Macro Gold Bias",
    direction: macroBias > 6 ? "bullish" : macroBias < 4 ? "bearish" : "neutral",
    weight: 12,
    score: macroScore,
    detail: `Gold macro bias: ${macroBias}/10, regime: ${macro?.composite?.inflation_regime}, real rates: ${macro?.composite?.real_rate_regime}`,
  });

  // --- SENTIMENT FACTORS ---
  const sentScore = sentiment?.aggregated?.sentiment_score || 0;
  factors.push({
    name: "News Sentiment",
    direction: sentScore > 0.2 ? "bullish" : sentScore < -0.2 ? "bearish" : "neutral",
    weight: 8,
    score: Math.max(-1, Math.min(1, sentScore)),
    detail: `Sentiment: ${sentScore.toFixed(2)} (${sentiment?.aggregated?.sentiment_label}), ${sentiment?.aggregated?.news_volume || 0} articles`,
  });

  // Fear & Greed contrarian
  const fng = sentiment?.fear_greed_index;
  if (fng != null) {
    // Extreme fear = bullish contrarian, Extreme greed = bearish contrarian
    const contrarianScore = fng < 25 ? 0.4 : fng > 75 ? -0.4 : 0;
    factors.push({
      name: "Fear & Greed (Contrarian)",
      direction: contrarianScore > 0 ? "bullish" : contrarianScore < 0 ? "bearish" : "neutral",
      weight: 5,
      score: contrarianScore,
      detail: `FNG: ${fng} (${fng < 25 ? "Extreme Fear" : fng > 75 ? "Extreme Greed" : "Neutral"})`,
    });
  }

  // --- CORRELATION FACTORS ---
  const dxyCorr = correlation?.correlation_matrix?.DXY?.["1D"];
  const dxyImpact = correlation?.strongest_influence;
  if (dxyImpact) {
    factors.push({
      name: "DXY Correlation Influence",
      direction: dxyCorr != null && dxyCorr < -0.5 ? "bullish" : "neutral",
      weight: 6,
      score: dxyCorr != null ? (dxyCorr < -0.5 ? 0.3 : dxyCorr > -0.3 ? -0.2 : 0) : 0,
      detail: `DXY 1D correlation: ${dxyCorr?.toFixed(2) || "N/A"}, strongest influence: ${dxyImpact.asset}`,
    });
  }

  // Divergences from correlation
  const corrDivs = correlation?.divergences || [];
  for (const d of corrDivs.slice(0, 2)) {
    const score = d.type === "positive_divergence" ? 0.5 : d.type === "correlation_breakdown" ? -0.3 : -0.2;
    factors.push({
      name: `Correlation Divergence: ${d.asset}`,
      direction: score > 0 ? "bullish" : "bearish",
      weight: 5,
      score,
      detail: d.description,
    });
  }

  // --- SMART MONEY FACTORS ---
  const smPhase = smartMoney?.smart_money_phase?.phase;
  if (smPhase) {
    let smScore = 0;
    if (smPhase === "markup") smScore = 0.7;
    else if (smPhase === "accumulation") smScore = 0.3;
    else if (smPhase === "distribution") smScore = -0.3;
    else if (smPhase === "markdown") smScore = -0.7;
    factors.push({
      name: "Smart Money Phase",
      direction: smScore > 0 ? "bullish" : smScore < 0 ? "bearish" : "neutral",
      weight: 10,
      score: smScore,
      detail: `Phase: ${smPhase} - ${smartMoney?.smart_money_phase?.description || ""}`,
    });
  }

  // Stop hunts
  const stopHunts = smartMoney?.institutional_footprints?.stop_hunts || [];
  for (const hunt of stopHunts.slice(0, 2)) {
    const score = hunt.direction === "bullish_stop_hunt" ? 0.5 : -0.5;
    factors.push({
      name: `Stop Hunt at ${hunt.level}`,
      direction: hunt.direction === "bullish_stop_hunt" ? "bullish" : "bearish",
      weight: 7,
      score: score * (hunt.confidence || 0.5),
      detail: `${hunt.direction.replace(/_/g, " ")} - retail stops swept, reversal expected`,
    });
  }

  // Engineered liquidity
  const engLiq = smartMoney?.engineered_liquidity_score || 0;
  if (engLiq > 50) {
    factors.push({
      name: "Engineered Liquidity",
      direction: "neutral",
      weight: 4,
      score: 0,
      detail: `Score: ${engLiq}/100 - high liquidity engineering detected, expect stop hunts`,
    });
  }

  // --- SESSION FACTORS ---
  const sessionBias = session?.session_statistics?.direction_bias;
  if (sessionBias) {
    let sessScore = 0;
    if (sessionBias === "trend_setting" || sessionBias === "high_volatility_trend") sessScore = 0.3;
    else if (sessionBias === "consolidation") sessScore = 0;
    factors.push({
      name: "Session Bias",
      direction: sessScore > 0 ? "bullish" : "neutral",
      weight: 4,
      score: sessScore,
      detail: `Session: ${session?.current_session?.name}, bias: ${sessionBias}`,
    });
  }

  // --- HISTORICAL PATTERN FACTORS ---
  const patternDir2 = patterns?.probability?.direction;
  const patternStrength = patterns?.probability?.strength || 0;
  if (patternDir2 && patternStrength > 0.1) {
    const score = patternDir2 === "bullish" ? patternStrength : -patternStrength;
    factors.push({
      name: "Historical Pattern Match",
      direction: patternDir2,
      weight: 8,
      score,
      detail: `Direction: ${patternDir2}, strength: ${patternStrength.toFixed(2)}, win rate: ${((patterns?.probability?.weighted_win_rate || 0) * 100).toFixed(0)}%`,
    });
  }

  // --- RISK FACTORS ---
  const dangerLevel = risk?.danger_assessment?.danger_level || 1;
  if (dangerLevel > 5) {
    factors.push({
      name: "Risk Warning",
      direction: "neutral",
      weight: 6,
      score: 0,
      detail: `Danger level: ${dangerLevel}/10 - ${(risk?.danger_assessment?.warnings || []).join("; ")}`,
    });
  }

  return factors;
}

function generateTradeRecommendation(
  factors: SignalFactor[],
  technical: any,
  smartMoney: any,
  risk: any,
  forecast: any,
  session: any,
  patterns: any
): any {
  // Calculate weighted composite score
  let totalWeightedScore = 0;
  let totalWeight = 0;
  for (const f of factors) {
    totalWeightedScore += f.score * f.weight;
    totalWeight += f.weight;
  }

  const compositeScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  const direction = compositeScore > 0.1 ? "LONG" : compositeScore < -0.1 ? "SHORT" : "FLAT";

  // Count confluence factors
  const bullishFactors = factors.filter(f => f.direction === "bullish" && Math.abs(f.score) > 0.1);
  const bearishFactors = factors.filter(f => f.direction === "bearish" && Math.abs(f.score) > 0.1);
  const confluenceCount = direction === "LONG" ? bullishFactors.length : direction === "SHORT" ? bearishFactors.length : 0;

  // Calculate probability
  let baseProbability = 50;
  baseProbability += Math.abs(compositeScore) * 30; // up to 30% from composite
  baseProbability += Math.min(15, confluenceCount * 3); // up to 15% from confluence
  baseProbability = Math.min(90, Math.max(20, baseProbability));

  // Risk adjustments
  const dangerLevel = risk?.danger_assessment?.danger_level || 1;
  if (dangerLevel > 5) baseProbability -= 10;
  if (dangerLevel > 7) baseProbability -= 15;

  // Session quality
  const sessionName = session?.current_session?.name || "";
  if (sessionName === "London-NY Overlap") baseProbability += 3;
  if (sessionName === "Asia" && Math.abs(compositeScore) < 0.2) baseProbability -= 5;

  // Historical pattern boost
  const patternWinRate = patterns?.probability?.weighted_win_rate || 0.5;
  if (patternWinRate > 0.65) baseProbability += 5;

  baseProbability = Math.min(90, Math.max(20, Math.round(baseProbability)));

  // If probability too low or direction is FLAT, recommend no trade
  if (direction === "FLAT" || baseProbability < 60) {
    return {
      action: "NO_TRADE",
      direction: "FLAT",
      composite_score: Math.round(compositeScore * 1000) / 1000,
      probability: baseProbability,
      confidence: Math.round(Math.abs(compositeScore) * 100),
      reasoning: generateNoTradeReasoning(factors, compositeScore, direction),
      what_would_change: generateWhatWouldChange(factors, direction),
      factors_summary: summarizeFactors(factors),
      confluence: {
        bullish_count: bullishFactors.length,
        bearish_count: bearishFactors.length,
        total_factors: factors.length,
      },
    };
  }

  // Calculate specific trade levels
  const dailyTF = technical?.timeframes?.["1D"];
  const h4TF = technical?.timeframes?.["H4"];
  const h1TF = technical?.timeframes?.["H1"];
  const price = dailyTF?.price || h4TF?.price || 0;
  const atr = dailyTF?.volatility?.atr || h4TF?.volatility?.atr || 15;
  const atrPercent = dailyTF?.volatility?.atr_percent || 0.75;

  // Determine setup type
  let setupType = "continuation";
  let entry, stopLoss, tp1, tp2, tp3;

  const resistance = dailyTF?.structure?.swing_highs?.[0] || h4TF?.structure?.swing_highs?.[0];
  const support = dailyTF?.structure?.swing_lows?.[0] || h4TF?.structure?.swing_lows?.[0];
  const ema20 = h4TF?.ema?.ema20 || price;
  const ema50 = h4TF?.ema?.ema50 || price;

  // Check for liquidity sweep setup
  const stopHunts = smartMoney?.institutional_footprints?.stop_hunts || [];
  const relevantHunt = stopHunts.find((h: any) =>
    direction === "LONG" ? h.direction === "bullish_stop_hunt" : h.direction === "bearish_stop_hunt"
  );

  // Check for FVG
  const fvgs = dailyTF?.support_resistance?.fair_value_gaps || h4TF?.support_resistance?.fair_value_gaps || [];
  const relevantFVG = fvgs.find((f: any) =>
    direction === "LONG" ? f.type === "bullish" : f.type === "bearish"
  );

  if (relevantHunt) {
    // Liquidity sweep reversal setup
    setupType = "liquidity_sweep_reversal";
    if (direction === "LONG") {
      entry = relevantHunt.level + atr * 0.1;
      stopLoss = relevantHunt.level - atr * 1.5;
    } else {
      entry = relevantHunt.level - atr * 0.1;
      stopLoss = relevantHunt.level + atr * 1.5;
    }
  } else if (relevantFVG) {
    // FVG retracement setup
    setupType = "fvg_retracement";
    if (direction === "LONG") {
      entry = relevantFVG.mid;
      stopLoss = relevantFVG.low - atr * 0.5;
    } else {
      entry = relevantFVG.mid;
      stopLoss = relevantFVG.high + atr * 0.5;
    }
  } else if (direction === "LONG" && price > (resistance || 0) && h4TF?.trend?.direction === "bullish") {
    // Breakout setup
    setupType = "breakout";
    entry = price + atr * 0.1;
    stopLoss = (support || price - atr * 2);
  } else if (direction === "SHORT" && price < (support || Infinity) && h4TF?.trend?.direction === "bearish") {
    setupType = "breakdown";
    entry = price - atr * 0.1;
    stopLoss = (resistance || price + atr * 2);
  } else {
    // Continuation / pullback setup
    setupType = "continuation_pullback";
    if (direction === "LONG") {
      entry = Math.min(ema20, ema50);
      stopLoss = entry - atr * 1.5;
    } else {
      entry = Math.max(ema20, ema50);
      stopLoss = entry + atr * 1.5;
    }
  }

  // Ensure stop loss is valid
  if (!stopLoss || isNaN(stopLoss)) {
    stopLoss = direction === "LONG" ? price - atr * 2 : price + atr * 2;
  }
  if (!entry || isNaN(entry)) {
    entry = price;
  }

  const riskDistance = Math.abs(entry - stopLoss);
  tp1 = direction === "LONG" ? entry + riskDistance * 1.5 : entry - riskDistance * 1.5;
  tp2 = direction === "LONG" ? entry + riskDistance * 2.5 : entry - riskDistance * 2.5;
  tp3 = direction === "LONG" ? entry + riskDistance * 4 : entry - riskDistance * 4;

  const rr1 = riskDistance > 0 ? 1.5 : 0;
  const rr2 = 2.5;
  const rr3 = 4.0;

  // Position sizing
  const riskPct = baseProbability > 75 ? 1.5 : baseProbability > 65 ? 1.0 : 0.5;
  const accountBalance = 10000; // default
  const dollarRisk = accountBalance * (riskPct / 100);
  const pipValue = 1;
  const positionSizeOz = riskDistance > 0 ? dollarRisk / (riskDistance * pipValue) : 0;

  // Invalidation conditions
  const invalidation = direction === "LONG"
    ? `Price closes below $${stopLoss.toFixed(2)} (structural support break)`
    : `Price closes above $${stopLoss.toFixed(2)} (structural resistance break)`;

  // Detailed reasoning
  const topBullish = bullishFactors.sort((a, b) => Math.abs(b.score) * b.weight - Math.abs(a.score) * a.weight).slice(0, 3);
  const topBearish = bearishFactors.sort((a, b) => Math.abs(b.score) * b.weight - Math.abs(a.score) * a.weight).slice(0, 3);
  const relevantFactors = direction === "LONG" ? topBullish : topBearish;

  const reasoning = [
    `Composite score: ${compositeScore.toFixed(3)} (${direction === "LONG" ? "bullish" : "bearish"} bias)`,
    `Confluence: ${confluenceCount} aligned factors out of ${factors.length} total`,
    ...relevantFactors.map(f => `${f.name}: ${f.detail}`),
    `Setup type: ${setupType.replace(/_/g, " ")}`,
    `Risk: ${riskPct}% of account ($${dollarRisk.toFixed(0)})`,
  ].join(". ");

  return {
    action: "TRADE",
    direction,
    setup_type: setupType,
    composite_score: Math.round(compositeScore * 1000) / 1000,
    probability: baseProbability,
    confidence: Math.round(Math.abs(compositeScore) * 100),
    entry: Math.round(entry * 100) / 100,
    entry_zone: [Math.round((entry - atr * 0.2) * 100) / 100, Math.round((entry + atr * 0.2) * 100) / 100],
    stop_loss: Math.round(stopLoss * 100) / 100,
    tp1: Math.round(tp1 * 100) / 100,
    tp2: Math.round(tp2 * 100) / 100,
    tp3: Math.round(tp3 * 100) / 100,
    rr_ratio_tp1: rr1,
    rr_ratio_tp2: rr2,
    rr_ratio_tp3: rr3,
    risk_percent: riskPct,
    position_size_oz: Math.round(positionSizeOz * 100) / 100,
    dollar_risk: Math.round(dollarRisk * 100) / 100,
    reasoning,
    invalidation,
    invalidation_conditions: [
      invalidation,
      `High-impact news event within 2 hours`,
      `Spread widens beyond 2x normal`,
    ],
    factors_summary: summarizeFactors(factors),
    confluence: {
      bullish_count: bullishFactors.length,
      bearish_count: bearishFactors.length,
      total_factors: factors.length,
      aligned_count: confluenceCount,
    },
    top_bullish_factors: topBullish.map(f => ({ name: f.name, detail: f.detail, score: Math.round(f.score * 100) / 100, weight: f.weight })),
    top_bearish_factors: topBearish.map(f => ({ name: f.name, detail: f.detail, score: Math.round(f.score * 100) / 100, weight: f.weight })),
  };
}

function summarizeFactors(factors: SignalFactor[]): any {
  return factors.map(f => ({
    name: f.name,
    direction: f.direction,
    score: Math.round(f.score * 100) / 100,
    weight: f.weight,
    weighted_impact: Math.round(f.score * f.weight * 100) / 100,
    detail: f.detail,
  }));
}

function generateNoTradeReasoning(factors: SignalFactor[], compositeScore: number, direction: string): string {
  const bullish = factors.filter(f => f.direction === "bullish" && Math.abs(f.score) > 0.1);
  const bearish = factors.filter(f => f.direction === "bearish" && Math.abs(f.score) > 0.1);

  if (direction === "FLAT") {
    return `Signals are conflicting: ${bullish.length} bullish vs ${bearish.length} bearish factors. Composite score ${compositeScore.toFixed(3)} is too close to neutral. No clear edge detected - staying flat is the safest position.`;
  }

  return `Insufficient confidence for ${direction === "LONG" ? "bullish" : "bearish"} trade. Composite score ${compositeScore.toFixed(3)} does not meet minimum threshold. Wait for stronger alignment.`;
}

function generateWhatWouldChange(factors: SignalFactor[], currentDirection: string): string[] {
  const changes: string[] = [];

  if (currentDirection === "FLAT" || currentDirection === "LONG") {
    changes.push("Bullish breakout above nearest resistance with volume confirmation");
    changes.push("DXY weakening below key support level");
    changes.push("Smart money entering accumulation/markup phase");
    changes.push("Bullish RSI divergence forming on H4 or Daily");
    changes.push("Positive CPI/Fed surprise (dovish data)");
  }

  if (currentDirection === "FLAT" || currentDirection === "SHORT") {
    changes.push("Bearish breakdown below nearest support with volume");
    changes.push("DXY strengthening above resistance");
    changes.push("Smart money distribution/markdown phase");
    changes.push("Bearish RSI divergence on H4 or Daily");
    changes.push("Hawkish Fed surprise or hot inflation data");
  }

  return changes;
}

// ============================================================
// END ENHANCED TRADE RECOMMENDATION ENGINE
// ============================================================

function generateTradeOpportunities(technical: any, smartMoney: any, patterns: any, risk: any, forecast: any): any[] {
  const opportunities: any[] = [];
  const dailyTF = technical?.timeframes?.["1D"];
  const h4TF = technical?.timeframes?.["H4"];
  const price = dailyTF?.price || h4TF?.price || 0;

  if (price === 0) return opportunities;

  const direction = forecast.direction;
  if (direction === "neutral" || forecast.confidence < 60) return opportunities;

  const resistance = dailyTF?.structure?.swing_highs?.[0] || h4TF?.structure?.swing_highs?.[0];
  const support = dailyTF?.structure?.swing_lows?.[0] || h4TF?.structure?.swing_lows?.[0];

  if (direction === "bullish" && resistance) {
    const entry = resistance;
    const sl = support || entry - (dailyTF?.volatility?.atr || 15) * 2;
    const riskPips = Math.abs(entry - sl);
    const tp1 = entry + riskPips * 1.5;
    const tp2 = entry + riskPips * 2.5;
    const tp3 = entry + riskPips * 4;
    const rr = riskPips > 0 ? (tp1 - entry) / riskPips : 0;

    if (rr >= 1.5) {
      opportunities.push({
        direction: "LONG",
        setup_type: "breakout",
        entry_zone: [Math.round((entry - 1) * 100) / 100, Math.round((entry + 1) * 100) / 100],
        stop_loss: Math.round(sl * 100) / 100,
        tp1: Math.round(tp1 * 100) / 100,
        tp2: Math.round(tp2 * 100) / 100,
        tp3: Math.round(tp3 * 100) / 100,
        rr_ratio: Math.round(rr * 100) / 100,
        probability: Math.min(85, forecast.confidence + 5),
        confidence: Math.round(forecast.confidence * 0.8),
        reasoning: `Bullish breakout above resistance ${resistance}. Multi-TF alignment: ${forecast.bullish_score}% bullish.`,
        invalidation: `Close below ${Math.round(sl * 100) / 100} invalidates setup`,
      });
    }
  }

  const stopHunts = smartMoney?.institutional_footprints?.stop_hunts || [];
  const bullishHunt = stopHunts.find((h: any) => h.direction === "bullish_stop_hunt");
  if (direction === "bullish" && bullishHunt && support) {
    const entry = support;
    const sl = entry - (dailyTF?.volatility?.atr || 15) * 1.5;
    const riskPips = Math.abs(entry - sl);
    const tp1 = entry + riskPips * 2;
    const tp2 = entry + riskPips * 3;

    opportunities.push({
      direction: "LONG",
      setup_type: "liquidity_sweep_reversal",
      entry_zone: [Math.round((entry - 2) * 100) / 100, Math.round((entry + 2) * 100) / 100],
      stop_loss: Math.round(sl * 100) / 100,
      tp1: Math.round(tp1 * 100) / 100,
      tp2: Math.round(tp2 * 100) / 100,
      tp3: null,
      rr_ratio: 2.0,
      probability: Math.min(80, forecast.confidence),
      confidence: Math.round(forecast.confidence * 0.75),
      reasoning: `Bullish stop hunt at ${bullishHunt.level} + support at ${support}. Smart money accumulation detected.`,
      invalidation: `Close below ${Math.round(sl * 100) / 100} invalidates reversal`,
    });
  }

  if (direction === "bullish" && h4TF?.trend?.direction === "bullish") {
    const ema20 = h4TF?.ema?.ema20 || price;
    const entry = ema20;
    const sl = entry - (h4TF?.volatility?.atr || 10) * 1.5;
    const riskPips = Math.abs(entry - sl);
    const tp1 = entry + riskPips * 2;

    opportunities.push({
      direction: "LONG",
      setup_type: "continuation_pullback",
      entry_zone: [Math.round((entry - 3) * 100) / 100, Math.round((entry + 3) * 100) / 100],
      stop_loss: Math.round(sl * 100) / 100,
      tp1: Math.round(tp1 * 100) / 100,
      tp2: null,
      tp3: null,
      rr_ratio: 2.0,
      probability: Math.min(75, forecast.confidence - 5),
      confidence: Math.round(forecast.confidence * 0.7),
      reasoning: `H4 bullish trend pullback to EMA20 (${Math.round(ema20 * 100) / 100}). Trend continuation expected.`,
      invalidation: `Close below ${Math.round(sl * 100) / 100} invalidates trend`,
    });
  }

  if (direction === "bearish" && support) {
    const entry = support;
    const sl = resistance || entry + (dailyTF?.volatility?.atr || 15) * 2;
    const riskPips = Math.abs(sl - entry);
    const tp1 = entry - riskPips * 1.5;
    const tp2 = entry - riskPips * 2.5;
    const rr = riskPips > 0 ? Math.abs(tp1 - entry) / riskPips : 0;

    if (rr >= 1.5) {
      opportunities.push({
        direction: "SHORT",
        setup_type: "breakdown",
        entry_zone: [Math.round((entry - 1) * 100) / 100, Math.round((entry + 1) * 100) / 100],
        stop_loss: Math.round(sl * 100) / 100,
        tp1: Math.round(tp1 * 100) / 100,
        tp2: Math.round(tp2 * 100) / 100,
        tp3: null,
        rr_ratio: Math.round(rr * 100) / 100,
        probability: Math.min(85, forecast.confidence + 5),
        confidence: Math.round(forecast.confidence * 0.8),
        reasoning: `Bearish breakdown below support ${support}. Multi-TF alignment: ${forecast.bearish_score}% bearish.`,
        invalidation: `Close above ${Math.round(sl * 100) / 100} invalidates setup`,
      });
    }
  }

  return opportunities.filter(o => o.probability > 65 && o.rr_ratio >= 1.5);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const [market, technical, macro, sentiment, session, correlation, smartMoney, patterns, risk] = await Promise.all([
      callLayer("market-data", "action=snapshot"),
      callLayer("technical-analysis", "symbol=XAUUSD"),
      callLayer("macro-fundamentals"),
      callLayer("news-sentiment"),
      callLayer("session-analyzer"),
      callLayer("correlation-analyzer"),
      callLayer("smart-money"),
      callLayer("historical-patterns"),
      callLayer("risk-manager"),
    ]);

    const marketSummary = generateMarketSummary(market, technical, session);
    const forecast = generateForecast(technical, macro, sentiment, correlation, patterns, smartMoney);
    const tradeOpportunities = generateTradeOpportunities(technical, smartMoney, patterns, risk, forecast);

    // ENHANCED: Compute all signal factors and generate primary trade recommendation
    const signalFactors = computeAllSignalFactors(technical, macro, sentiment, correlation, patterns, smartMoney, session, risk);
    const tradeRecommendation = generateTradeRecommendation(signalFactors, technical, smartMoney, risk, forecast, session, patterns);

    const fullAnalysis = {
      disclaimer: "DISCLAIMER: This is AI-generated analysis for research purposes only. Not financial advice. Past performance does not guarantee future results.",

      market_summary: marketSummary,

      macro_fundamentals: {
        indicators: macro?.indicators || {},
        composite: macro?.composite || {},
        data_quality: macro?.errors ? "partial" : "full",
      },

      news_analysis: {
        aggregated: sentiment?.aggregated || {},
        high_impact_alerts: sentiment?.high_impact_alerts || [],
        fear_greed_index: sentiment?.fear_greed_index || null,
        fakeout_warning: sentiment?.fakeout_warning || false,
        article_count: sentiment?.articles?.length || 0,
      },

      technical_analysis: {
        timeframes: technical?.timeframes || {},
        multi_tf_consensus: technical?.multi_tf_consensus || {},
      },

      session_analysis: {
        current_session: session?.current_session || {},
        statistics: session?.session_statistics || {},
        current_analysis: session?.current_session_analysis || {},
        traps: session?.session_traps || [],
      },

      historical_trend_comparison: {
        top_matches: patterns?.top_matches || [],
        probability: patterns?.probability || {},
        expected_move: patterns?.expected_move || {},
        pattern_confidence: patterns?.pattern_confidence || 0,
      },

      sentiment_analysis: {
        news_sentiment: sentiment?.aggregated?.sentiment_score || 0,
        news_sentiment_label: sentiment?.aggregated?.sentiment_label || "neutral",
        fear_greed_index: sentiment?.fear_greed_index || null,
        bullish_articles: sentiment?.aggregated?.bullish_articles || 0,
        bearish_articles: sentiment?.aggregated?.bearish_articles || 0,
      },

      correlation_analysis: {
        matrix: correlation?.correlation_matrix || {},
        strongest_influence: correlation?.strongest_influence || {},
        divergences: correlation?.divergences || [],
        impact_estimates: correlation?.impact_estimates || {},
      },

      trade_opportunities: tradeOpportunities,

      risk_management: {
        volatility_regime: risk?.volatility_regime || "normal",
        position_sizing: risk?.position_sizing || {},
        stop_recommendations: risk?.stop_loss_recommendations || {},
        danger_assessment: risk?.danger_assessment || {},
      },

      smart_money_analysis: {
        liquidity_zones: smartMoney?.liquidity_zones || [],
        institutional_footprints: smartMoney?.institutional_footprints || {},
        phase: smartMoney?.smart_money_phase || {},
        trap_warnings: smartMoney?.trap_warnings || [],
        engineered_liquidity_score: smartMoney?.engineered_liquidity_score || 0,
      },

      forecast: forecast,

      // ENHANCED: Primary trade recommendation with full factor breakdown
      trade_recommendation: tradeRecommendation,

      // ENHANCED: All signal factors for transparency
      signal_factors: signalFactors,

      final_trading_outlook: {
        overall_direction: forecast.direction,
        overall_confidence: forecast.confidence,
        recommendation: forecast.confidence >= 70
          ? `High confidence ${forecast.direction} bias. Look for ${forecast.direction} setups.`
          : forecast.confidence >= 55
          ? `Moderate confidence ${forecast.direction} bias. Wait for confirmation before entering.`
          : "Low confidence - avoid trading. Wait for clearer signals.",
        key_risks: [
          ...(risk?.danger_assessment?.warnings || []),
          ...(sentiment?.fakeout_warning ? ["News sentiment may contradict price action - fakeout risk"] : []),
          ...(correlation?.divergences?.length > 0 ? ["Cross-asset divergences detected - increased uncertainty"] : []),
        ].slice(0, 5),
        action_items: forecast.confidence >= 65
          ? [
              `Recommended: ${tradeRecommendation.action === "TRADE" ? `${tradeRecommendation.direction} ${tradeRecommendation.setup_type.replace(/_/g, " ")} at $${tradeRecommendation.entry}` : "Stay flat - no trade"}`,
              "Set alerts at key support/resistance levels",
              "Reduce position size if high-impact news within 2 hours",
            ]
          : [
              "Stay on sidelines until clarity improves",
              "Monitor for breakout of current range",
              "Watch for smart money accumulation/distribution signals",
            ],
      },

      meta: {
        layers_executed: 9,
        layers_failed: [market, technical, macro, sentiment, session, correlation, smartMoney, patterns, risk].filter(l => l?.error).length,
        timestamp: new Date().toISOString(),
        version: "2.0.0",
      },
    };

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    await supabase.from("analysis_snapshots").insert({
      analysis_type: "full_orchestration",
      data: fullAnalysis,
      confidence_score: forecast.confidence,
    });

    for (const opp of tradeOpportunities) {
      await supabase.from("trade_signals").insert({
        direction: opp.direction,
        entry_zone: opp.entry_zone,
        stop_loss: opp.stop_loss,
        tp1: opp.tp1,
        tp2: opp.tp2,
        tp3: opp.tp3,
        rr_ratio: opp.rr_ratio,
        setup_type: opp.setup_type,
        probability: opp.probability,
        confidence: opp.confidence,
        reasoning: opp.reasoning,
        invalidation_conditions: opp.invalidation,
      });
    }

    return new Response(JSON.stringify({ success: true, data: fullAnalysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
