const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SessionDef {
  name: string;
  startUTC: number;
  endUTC: number;
}

const SESSIONS: SessionDef[] = [
  { name: "Asia", startUTC: 0, endUTC: 8 },
  { name: "London", startUTC: 8, endUTC: 16 },
  { name: "NY", startUTC: 13, endUTC: 22 },
  { name: "London-NY Overlap", startUTC: 13, endUTC: 17 },
  { name: "Asia-London Overlap", startUTC: 8, endUTC: 9 },
];

function getCurrentSession(utcHour: number): SessionDef {
  // Check overlaps first (they're more specific)
  for (const s of SESSIONS) {
    if (s.name.includes("Overlap") && utcHour >= s.startUTC && utcHour < s.endUTC) return s;
  }
  for (const s of SESSIONS) {
    if (!s.name.includes("Overlap") && utcHour >= s.startUTC && utcHour < s.endUTC) return s;
  }
  return SESSIONS[0]; // Default to Asia
}

function getSessionStats(sessionName: string): {
  avgRangePips: number;
  directionBias: string;
  manipulationWindowMin: number;
  reversalTimeUTC: string;
  killZoneStart: string;
  killZoneEnd: string;
  liquidityGrabPattern: string;
} {
  const stats: Record<string, any> = {
    "Asia": {
      avgRangePips: 150,
      directionBias: "consolidation",
      manipulationWindowMin: 30,
      reversalTimeUTC: "06:00",
      killZoneStart: "00:00",
      killZoneEnd: "02:00",
      liquidityGrabPattern: "Asian_range_break_fakeout",
    },
    "London": {
      avgRangePips: 350,
      directionBias: "trend_setting",
      manipulationWindowMin: 45,
      reversalTimeUTC: "10:00",
      killZoneStart: "08:00",
      killZoneEnd: "10:00",
      liquidityGrabPattern: "London_open_reversal",
    },
    "NY": {
      avgRangePips: 300,
      directionBias: "continuation_or_reversal",
      manipulationWindowMin: 30,
      reversalTimeUTC: "15:00",
      killZoneStart: "13:00",
      killZoneEnd: "15:00",
      liquidityGrabPattern: "NY_london_correction",
    },
    "London-NY Overlap": {
      avgRangePips: 450,
      directionBias: "high_volatility_trend",
      manipulationWindowMin: 15,
      reversalTimeUTC: "15:30",
      killZoneStart: "13:00",
      killZoneEnd: "16:00",
      liquidityGrabPattern: "Stop_hunt_before_news",
    },
    "Asia-London Overlap": {
      avgRangePips: 200,
      directionBias: "breakout_setup",
      manipulationWindowMin: 20,
      reversalTimeUTC: "08:30",
      killZoneStart: "08:00",
      killZoneEnd: "09:00",
      liquidityGrabPattern: "Session_transition_sweep",
    },
  };
  return stats[sessionName] || stats["Asia"];
}

async function fetchRecentCandles(): Promise<{
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}[]> {
  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=5d&interval=1h";
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok) return [];
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0];
    return timestamps.map((t: number, i: number) => ({
      timestamp: new Date(t * 1000).toISOString(),
      open: quotes?.open?.[i] ?? 0,
      high: quotes?.high?.[i] ?? 0,
      low: quotes?.low?.[i] ?? 0,
      close: quotes?.close?.[i] ?? 0,
      volume: quotes?.volume?.[i] ?? 0,
    })).filter((c: any) => c.close > 0);
  } catch {
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const utcNow = new Date();
    const utcHour = utcNow.getUTCHours();
    const currentSession = getCurrentSession(utcHour);
    const currentStats = getSessionStats(currentSession.name);

    // Fetch recent candles for session analysis
    const candles = await fetchRecentCandles();

    // Calculate current session range
    const sessionCandles = candles.filter(c => {
      const hour = new Date(c.timestamp).getUTCHours();
      return hour >= currentSession.startUTC && hour < currentSession.endUTC;
    });

    let currentRange = 0;
    let sessionHigh = 0;
    let sessionLow = Infinity;
    if (sessionCandles.length > 0) {
      sessionHigh = Math.max(...sessionCandles.map(c => c.high));
      sessionLow = Math.min(...sessionCandles.map(c => c.low));
      currentRange = (sessionHigh - sessionLow) * 100; // Convert to pips approx
    }

    // Range percentile vs historical
    const rangePercentile = currentStats.avgRangePips > 0
      ? Math.min(100, Math.round((currentRange / currentStats.avgRangePips) * 100))
      : 50;

    // Volatility regime
    let volatilityRegime = "normal";
    if (rangePercentile > 130) volatilityRegime = "expanding";
    else if (rangePercentile < 50) volatilityRegime = "contracting";
    else if (rangePercentile < 30) volatilityRegime = "squeeze";

    // Session-specific trap detection
    const traps: { type: string; description: string; probability: number }[] = [];

    if (currentSession.name === "Asia") {
      traps.push({
        type: "Asian_range_break_fakeout",
        description: "Price breaks Asian session range then reverses during London",
        probability: 0.65,
      });
    }
    if (currentSession.name === "London") {
      traps.push({
        type: "London_open_reversal",
        description: "Initial London direction reverses within first 45 minutes",
        probability: 0.55,
      });
    }
    if (currentSession.name === "NY") {
      traps.push({
        type: "NY_london_correction",
        description: "NY session corrects the London move by 38-62%",
        probability: 0.50,
      });
    }
    if (currentSession.name === "London-NY Overlap") {
      traps.push({
        type: "Stop_hunt_before_news",
        description: "Price sweeps key levels before scheduled news releases",
        probability: 0.60,
      });
    }

    // Expected session outcome
    let expectedOutcome = "neutral";
    if (sessionCandles.length > 2) {
      const firstCandle = sessionCandles[0];
      const lastCandle = sessionCandles[sessionCandles.length - 1];
      if (lastCandle.close > firstCandle.open + currentStats.avgRangePips * 0.3 / 100) {
        expectedOutcome = "bullish_continuation";
      } else if (lastCandle.close < firstCandle.open - currentStats.avgRangePips * 0.3 / 100) {
        expectedOutcome = "bearish_continuation";
      }
    }

    // Time remaining in session
    const minutesRemaining = (currentSession.endUTC - utcHour) * 60 - utcNow.getUTCMinutes();

    const result = {
      current_session: {
        name: currentSession.name,
        start_utc: `${String(currentSession.startUTC).padStart(2, "0")}:00`,
        end_utc: `${String(currentSession.endUTC).padStart(2, "0")}:00`,
        minutes_remaining: Math.max(0, minutesRemaining),
      },
      session_statistics: {
        avg_range_pips: currentStats.avgRangePips,
        direction_bias: currentStats.directionBias,
        manipulation_window_minutes: currentStats.manipulationWindowMin,
        reversal_time_utc: currentStats.reversalTimeUTC,
        kill_zone: {
          start_utc: currentStats.killZoneStart,
          end_utc: currentStats.killZoneEnd,
        },
        liquidity_grab_pattern: currentStats.liquidityGrabPattern,
      },
      current_session_analysis: {
        current_range_pips: Math.round(currentRange * 10) / 10,
        session_high: Math.round(sessionHigh * 100) / 100,
        session_low: sessionLow < Infinity ? Math.round(sessionLow * 100) / 100 : 0,
        range_vs_historical_percentile: rangePercentile,
        volatility_regime: volatilityRegime,
        expected_outcome: expectedOutcome,
      },
      session_traps: traps,
      next_session: (() => {
        const nextHour = utcHour + 1;
        for (const s of SESSIONS) {
          if (nextHour >= s.startUTC && nextHour < s.endUTC && s.name !== currentSession.name) {
            return s.name;
          }
        }
        return "Asia";
      })(),
      timestamp: utcNow.toISOString(),
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
