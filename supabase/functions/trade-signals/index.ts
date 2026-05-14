const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SignalInput {
  direction: string;
  entry_zone: number[];
  stop_loss: number;
  tp1: number;
  tp2: number | null;
  tp3: number | null;
  rr_ratio: number;
  setup_type: string;
  probability: number;
  confidence: number;
  reasoning: string;
  invalidation: string;
  current_price: number;
  atr: number;
  multi_tf_alignment: number;
  smart_money_confirmation: boolean;
  historical_match: number;
  has_news_event: boolean;
  liquidity_level: string;
}

function adjustProbability(signal: SignalInput): number {
  let prob = signal.probability;

  // Multi-timeframe alignment bonus
  if (signal.multi_tf_alignment >= 3) prob += 10;
  else if (signal.multi_tf_alignment >= 2) prob += 5;

  // Smart money confirmation
  if (signal.smart_money_confirmation) prob += 10;

  // Historical pattern match
  if (signal.historical_match > 0.7) prob += 10;
  else if (signal.historical_match > 0.5) prob += 5;

  // News event penalty
  if (signal.has_news_event) prob -= 10;

  // Low liquidity penalty
  if (signal.liquidity_level === "low") prob -= 20;
  else if (signal.liquidity_level === "thin") prob -= 10;

  return Math.max(20, Math.min(95, prob));
}

function calculateRR(entry: number, sl: number, tp1: number, tp2: number | null, tp3: number | null): {
  rr1: number;
  rr2: number | null;
  rr3: number | null;
} {
  const risk = Math.abs(entry - sl);
  if (risk === 0) return { rr1: 0, rr2: null, rr3: null };
  return {
    rr1: Math.round((Math.abs(tp1 - entry) / risk) * 100) / 100,
    rr2: tp2 ? Math.round((Math.abs(tp2 - entry) / risk) * 100) / 100 : null,
    rr3: tp3 ? Math.round((Math.abs(tp3 - entry) / risk) * 100) / 100 : null,
  };
}

function validateSignal(signal: SignalInput): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const adjustedProb = adjustProbability(signal);

  if (adjustedProb < 65) issues.push("Adjusted probability below 65% threshold");
  if (signal.rr_ratio < 1.5) issues.push("Risk:reward ratio below 1.5 minimum");
  if (signal.has_news_event && signal.liquidity_level === "low") issues.push("News event + low liquidity = dangerous combination");
  if (Math.abs(signal.current_price - signal.entry_zone[0]) > signal.atr * 3) issues.push("Entry zone too far from current price");

  return { valid: issues.length === 0, issues };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method === "POST") {
      const body = await req.json();
      const signals = Array.isArray(body) ? body : [body];

      const processed = signals.map((sig: SignalInput) => {
        const adjustedProb = adjustProbability(sig);
        const rr = calculateRR(sig.entry_zone[0], sig.stop_loss, sig.tp1, sig.tp2, sig.tp3);
        const validation = validateSignal(sig);

        return {
          direction: sig.direction,
          setup_type: sig.setup_type,
          entry_zone: sig.entry_zone,
          stop_loss: sig.stop_loss,
          tp1: sig.tp1,
          tp2: sig.tp2,
          tp3: sig.tp3,
          rr_ratio: rr.rr1,
          rr2: rr.rr2,
          rr3: rr.rr3,
          probability: adjustedProb,
          confidence: sig.confidence,
          reasoning: sig.reasoning,
          invalidation_conditions: sig.invalidation,
          valid: validation.valid,
          validation_issues: validation.issues,
          risk_per_trade_percent: adjustedProb > 75 ? 1.5 : adjustedProb > 65 ? 1.0 : 0.5,
        };
      }).filter(s => s.valid);

      return new Response(JSON.stringify({
        success: true,
        signals: processed,
        count: processed.length,
        timestamp: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // GET: Return recent signals from orchestrator output
    return new Response(JSON.stringify({
      success: true,
      message: "POST trade signal data to validate and process. Use orchestrator for full analysis.",
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
