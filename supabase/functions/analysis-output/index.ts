const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function formatConfidence(conf: number): string {
  return `[${conf}% conf]`;
}

function formatPrice(price: number): string {
  return price ? `$${price.toFixed(2)}` : "N/A";
}

function formatPips(pips: number): string {
  return `${pips > 0 ? "+" : ""}${Math.round(pips)} pips`;
}

function formatSection(title: string, content: string): string {
  return `## ${title}\n\n${content}`;
}

function generateFormattedOutput(data: any): string {
  const sections: string[] = [];

  // Disclaimer
  sections.push("---\n**DISCLAIMER: This is AI-generated analysis for research purposes only. Not financial advice. Past performance does not guarantee future results.**\n---");

  // 1. Market Summary
  const ms = data.market_summary || {};
  sections.push(formatSection("Market Summary", [
    `- **Current Price**: ${formatPrice(ms.current_price)}`,
    `- **Daily Change**: ${ms.daily_change_percent?.toFixed(2) || "0.00"}%`,
    `- **Daily High**: ${formatPrice(ms.daily_high)}`,
    `- **Daily Low**: ${formatPrice(ms.daily_low)}`,
    `- **Trend**: ${ms.current_trend || "neutral"} ${formatConfidence(70)}`,
    `- **Session**: ${ms.current_session || "Unknown"}`,
    `- **Market Status**: ${ms.market_status || "neutral"}`,
  ].join("\n")));

  // 2. Macro Fundamentals
  const mf = data.macro_fundamentals || {};
  const comp = mf.composite || {};
  const indicators = mf.indicators || {};
  const indicatorLines = Object.entries(indicators).slice(0, 8).map(([k, v]: [string, any]) =>
    `- **${v.name || k}**: ${v.current_value} (${v.deviation || "stable"}, gold impact: ${v.gold_impact || "neutral"})`
  ).join("\n");
  sections.push(formatSection("Macro Fundamentals", [
    indicatorLines || "- Insufficient macro data available",
    "",
    `- **USD Strength**: ${comp.usd_strength_score || 0}/10 ${formatConfidence(60)}`,
    `- **Inflation Regime**: ${comp.inflation_regime || "unknown"}`,
    `- **Real Rate Regime**: ${comp.real_rate_regime || "unknown"}`,
    `- **Yield Curve Spread**: ${comp.yield_curve_spread || 0} bps`,
    `- **Gold Macro Bias**: ${comp.gold_macro_bias || 5}/10 (${comp.gold_macro_direction || "neutral"}) ${formatConfidence(65)}`,
  ].join("\n")));

  // 3. News Analysis
  const na = data.news_analysis || {};
  const agg = na.aggregated || {};
  sections.push(formatSection("News Analysis", [
    `- **Sentiment Score**: ${agg.sentiment_score || 0} (${agg.sentiment_label || "neutral"}) ${formatConfidence(55)}`,
    `- **News Volume**: ${agg.news_volume || 0} relevant articles`,
    `- **Bullish/Bearish/Neutral**: ${agg.bullish_articles || 0}/${agg.bearish_articles || 0}/${agg.neutral_articles || 0}`,
    `- **Fear & Greed Index**: ${na.fear_greed_index || "N/A"}`,
    `- **Fakeout Warning**: ${na.fakeout_warning ? "YES - news contradicts price action" : "No"}`,
    na.high_impact_alerts?.length > 0
      ? `\n**High Impact Alerts:**\n${na.high_impact_alerts.map((a: any) => `- [${a.urgency}] ${a.title}`).join("\n")}`
      : "- No high-impact alerts",
  ].join("\n")));

  // 4. Technical Analysis
  const ta = data.technical_analysis || {};
  const tfData = ta.timeframes || {};
  const consensus = ta.multi_tf_consensus || {};
  const tfLines = Object.entries(tfData).slice(0, 5).map(([tf, d]: [string, any]) =>
    `- **${tf}**: ${d.trend?.direction || "neutral"} (ADX: ${d.trend?.adx || 0}, RSI: ${d.momentum?.rsi || 50} ${d.momentum?.rsi_zone || ""})`
  ).join("\n");
  sections.push(formatSection("Technical Analysis", [
    tfLines || "- Insufficient technical data",
    "",
    `- **Multi-TF Consensus**: ${consensus.direction || "mixed"} (${consensus.bullish_timeframes || 0} bullish / ${consensus.bearish_timeframes || 0} bearish) ${formatConfidence(75)}`,
    `- **Market Structure (Daily)**: ${tfData["1D"]?.structure?.current || "unknown"} | BOS: ${tfData["1D"]?.structure?.bos ? "Yes" : "No"} | CHOCH: ${tfData["1D"]?.structure?.choch ? "Yes" : "No"}`,
    `- **Volatility (Daily ATR)**: ${tfData["1D"]?.volatility?.atr_percent || 0}% | BB Width: ${tfData["1D"]?.volatility?.bollinger?.bandwidth || 0}%`,
  ].join("\n")));

  // 5. Session Analysis
  const sa = data.session_analysis || {};
  const cs = sa.current_session || {};
  const ca = sa.current_analysis || {};
  sections.push(formatSection("Session Analysis", [
    `- **Current Session**: ${cs.name || "Unknown"} (${cs.start_utc || "?"} - ${cs.end_utc || "?"} UTC)`,
    `- **Minutes Remaining**: ${cs.minutes_remaining || 0}`,
    `- **Avg Range**: ${sa.statistics?.avg_range_pips || 0} pips`,
    `- **Current Range**: ${ca.current_range_pips || 0} pips (${ca.range_vs_historical_percentile || 50}% of avg)`,
    `- **Volatility Regime**: ${ca.volatility_regime || "normal"} ${formatConfidence(65)}`,
    `- **Direction Bias**: ${sa.statistics?.direction_bias || "unknown"}`,
    `- **Kill Zone**: ${sa.statistics?.kill_zone?.start_utc || "?"} - ${sa.statistics?.kill_zone?.end_utc || "?"} UTC`,
    sa.traps?.length > 0
      ? `\n**Session Traps:**\n${sa.traps.map((t: any) => `- ${t.type}: ${t.description} (${Math.round(t.probability * 100)}% probability)`).join("\n")}`
      : "",
  ].join("\n")));

  // 6. Historical Trend Comparison
  const ht = data.historical_trend_comparison || {};
  sections.push(formatSection("Historical Trend Comparison", [
    ht.top_matches?.length > 0
      ? ht.top_matches.map((m: any, i: number) =>
          `${i + 1}. **${m.name}** (${m.event_type}) - Similarity: ${m.similarity}, Win Rate: ${Math.round(m.win_rate * 100)}%\n   Expected: ${m.expected_outcome?.direction || "?"} | 1D: ${formatPips(m.expected_outcome?.move_1d_pips || 0)} | 1W: ${formatPips(m.expected_outcome?.move_1w_pips || 0)}`
        ).join("\n")
      : "- No matching historical patterns",
    "",
    `- **Probability Direction**: ${ht.probability?.direction || "neutral"} (strength: ${ht.probability?.strength || 0}) ${formatConfidence(ht.pattern_confidence || 30)}`,
    `- **Expected 1D Move**: ${formatPips(ht.expected_move?.move_1d_pips || 0)}`,
    `- **Expected 1W Move**: ${formatPips(ht.expected_move?.move_1w_pips || 0)}`,
  ].join("\n")));

  // 7. Sentiment Analysis
  const se = data.sentiment_analysis || {};
  sections.push(formatSection("Sentiment Analysis", [
    `- **News Sentiment**: ${se.news_sentiment || 0} (${se.news_sentiment_label || "neutral"}) ${formatConfidence(50)}`,
    `- **Fear & Greed Index**: ${se.fear_greed_index || "N/A"}`,
    `- **Article Breakdown**: ${se.bullish_articles || 0} bullish / ${se.bearish_articles || 0} bearish`,
  ].join("\n")));

  // 8. Correlation Analysis
  const ca2 = data.correlation_analysis || {};
  const matrix = ca2.matrix || {};
  const corrLines = Object.entries(matrix).map(([asset, corrs]: [string, any]) =>
    `- **${asset}**: 1H=${corrs["1H"] || 0}, 4H=${corrs["4H"] || 0}, 1D=${corrs["1D"] || 0}, 1W=${corrs["1W"] || 0}`
  ).join("\n");
  sections.push(formatSection("Correlation Analysis", [
    corrLines || "- Correlation data unavailable",
    "",
    `- **Strongest Influence**: ${ca2.strongest_influence?.asset || "DXY"} (1D corr: ${ca2.strongest_influence?.correlation_1d || 0}) ${formatConfidence(70)}`,
    ca2.divergences?.length > 0
      ? `\n**Divergences:**\n${ca2.divergences.map((d: any) => `- **${d.asset}**: ${d.type} - ${d.description} (${d.significance})`).join("\n")}`
      : "- No significant divergences detected",
  ].join("\n")));

  // 9. Trade Opportunities
  const to = data.trade_opportunities || [];
  if (to.length > 0) {
    sections.push(formatSection("Trade Opportunities", to.map((t: any, i: number) => [
      `### Trade ${i + 1}: ${t.direction} - ${t.setup_type}`,
      `- **Entry Zone**: ${t.entry_zone?.[0]?.toFixed(2) || "N/A"} - ${t.entry_zone?.[1]?.toFixed(2) || "N/A"}`,
      `- **Stop Loss**: ${formatPrice(t.stop_loss)}`,
      `- **TP1**: ${formatPrice(t.tp1)} | **TP2**: ${t.tp2 ? formatPrice(t.tp2) : "N/A"} | **TP3**: ${t.tp3 ? formatPrice(t.tp3) : "N/A"}`,
      `- **R:R Ratio**: ${t.rr_ratio} ${formatConfidence(t.confidence || 60)}`,
      `- **Probability**: ${t.probability}%`,
      `- **Reasoning**: ${t.reasoning}`,
      `- **Invalidation**: ${t.invalidation}`,
    ].join("\n")).join("\n\n")));
  } else {
    sections.push(formatSection("Trade Opportunities", "- No trade opportunities meet the 65% probability threshold. Wait for clearer signals."));
  }

  // 10. Risk Management
  const rm = data.risk_management || {};
  sections.push(formatSection("Risk Management", [
    `- **Volatility Regime**: ${rm.volatility_regime || "normal"}`,
    `- **Recommended Risk**: ${rm.position_sizing?.recommended_risk_percent || 1}% of account`,
    `- **Adjusted SL**: ${rm.position_sizing?.adjusted_sl_pips || 0} pips`,
    `- **Max Position**: ${rm.position_sizing?.max_position_oz || 0} oz`,
    `- **Danger Level**: ${rm.danger_assessment?.danger_level || 1}/10`,
    rm.danger_assessment?.trade_recommended ? "- **Trade Approved**: Yes" : "- **Trade Approved**: No - risk too high",
    rm.danger_assessment?.warnings?.length > 0
      ? `\n**Warnings:**\n${rm.danger_assessment.warnings.map((w: string) => `- ${w}`).join("\n")}`
      : "",
  ].join("\n")));

  // 11. Institutional Smart Money Analysis
  const sm = data.smart_money_analysis || {};
  sections.push(formatSection("Institutional Smart Money Analysis", [
    `- **Smart Money Phase**: ${sm.phase?.phase || "unknown"} ${formatConfidence(sm.phase?.confidence ? sm.phase.confidence * 100 : 40)}`,
    `- **Engineered Liquidity Score**: ${sm.engineered_liquidity_score || 0}/100`,
    sm.liquidity_zones?.length > 0
      ? `\n**Key Liquidity Zones:**\n${sm.liquidity_zones.slice(0, 5).map((z: any) => `- ${z.type} at ${formatPrice(z.level)} (${z.magnitude}, ${z.source}, ${z.distance_from_current?.toFixed(1)} away)`).join("\n")}`
      : "",
    sm.trap_warnings?.length > 0
      ? `\n**Trap Warnings:**\n${sm.trap_warnings.map((t: any) => `- ${t.type} at ${formatPrice(t.level)}: ${t.description}`).join("\n")}`
      : "",
    sm.institutional_footprints?.stop_hunts?.length > 0
      ? `\n**Stop Hunts Detected:**\n${sm.institutional_footprints.stop_hunts.map((h: any) => `- ${h.direction} at ${formatPrice(h.level)} (confidence: ${h.confidence})`).join("\n")}`
      : "",
  ].join("\n")));

  // 12. Forecast
  const fc = data.forecast || {};
  sections.push(formatSection("Forecast", [
    `- **Direction**: ${fc.direction || "neutral"} ${formatConfidence(fc.confidence || 50)}`,
    `- **Bullish Score**: ${fc.bullish_score || 50}% | **Bearish Score**: ${fc.bearish_score || 50}%`,
    `- **Key Driver**: ${fc.key_driver || "mixed signals"}`,
    `- **Expected 1D Move**: ${formatPips(fc.expected_move_1d_pips || 0)}`,
    `- **Expected 1W Move**: ${formatPips(fc.expected_move_1w_pips || 0)}`,
  ].join("\n")));

  // 13. Final Trading Outlook
  const fto = data.final_trading_outlook || {};
  sections.push(formatSection("Final Trading Outlook", [
    `- **Overall Direction**: ${fto.overall_direction || "neutral"}`,
    `- **Overall Confidence**: ${fto.overall_confidence || 50}%`,
    "",
    `**Recommendation**: ${fto.recommendation || "Insufficient data for recommendation"}`,
    "",
    fto.key_risks?.length > 0
      ? `**Key Risks:**\n${fto.key_risks.map((r: string) => `- ${r}`).join("\n")}`
      : "",
    "",
    fto.action_items?.length > 0
      ? `**Action Items:**\n${fto.action_items.map((a: string) => `- ${a}`).join("\n")}`
      : "",
  ].join("\n")));

  return sections.join("\n\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let data: any;

    if (req.method === "POST") {
      data = await req.json();
    } else {
      // GET: fetch from orchestrator and format
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const response = await fetch(`${supabaseUrl}/functions/v1/orchestrator`, {
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(60000),
      });
      const result = await response.json();
      data = result.success ? result.data : {};
    }

    const formatted = generateFormattedOutput(data);

    return new Response(JSON.stringify({
      success: true,
      formatted_output: formatted,
      raw_data: data,
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
