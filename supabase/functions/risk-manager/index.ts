const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TradeSetup {
  direction: string;
  entry: number;
  stopLoss: number;
  accountBalance: number;
  currentATR: number;
  currentPrice: number;
  hasHighImpactNews: boolean;
  spreadPips: number;
  avgSpreadPips: number;
  recentTradeCount: number;
  correlatedVolatility: string;
}

function calculatePositionSize(setup: TradeSetup): {
  riskPercent: number;
  adjustedSLPips: number;
  maxPositionOz: number;
  dollarRisk: number;
} {
  const baseRisk = 1.0; // 1% base risk

  // Volatility scaler
  const normalATR = setup.currentPrice * 0.0075; // ~0.75% daily ATR normal for gold
  const volatilityScaler = normalATR / Math.max(setup.currentATR, 0.01);
  let adjustedRisk = baseRisk * Math.min(volatilityScaler, 2);
  adjustedRisk = Math.max(0.5, Math.min(2.0, adjustedRisk));

  // News scaler
  if (setup.hasHighImpactNews) adjustedRisk *= 0.5;

  // Correlation scaler
  if (setup.correlatedVolatility === "high") adjustedRisk *= 0.7;
  if (setup.correlatedVolatility === "extreme") adjustedRisk *= 0.5;

  // SL calculation
  const slDistance = Math.abs(setup.entry - setup.stopLoss);
  const slPips = slDistance * 100 / setup.currentPrice;
  const atrBasedSL = setup.currentATR * 1.5;
  const adjustedSLPips = Math.max(slPips, atrBasedSL * 100 / setup.currentPrice);

  // Position size
  const dollarRisk = setup.accountBalance * (adjustedRisk / 100);
  const pipValue = 1; // $1 per pip per oz for XAUUSD approximately
  const maxPositionOz = dollarRisk / (adjustedSLPips * pipValue);

  return {
    riskPercent: Math.round(adjustedRisk * 100) / 100,
    adjustedSLPips: Math.round(adjustedSLPips * 10) / 10,
    maxPositionOz: Math.round(maxPositionOz * 100) / 100,
    dollarRisk: Math.round(dollarRisk * 100) / 100,
  };
}

function assessDanger(setup: TradeSetup): {
  dangerLevel: number;
  warnings: string[];
} {
  let dangerLevel = 1;
  const warnings: string[] = [];

  // Low liquidity check
  if (setup.spreadPips > setup.avgSpreadPips * 2) {
    dangerLevel += 3;
    warnings.push(`Low liquidity: spread ${setup.spreadPips} pips vs avg ${setup.avgSpreadPips}`);
  }

  // Pre-news manipulation
  if (setup.hasHighImpactNews) {
    dangerLevel += 2;
    warnings.push("High-impact news event within 2 hours - increased manipulation risk");
  }

  // Overtrading
  if (setup.recentTradeCount > 3) {
    dangerLevel += 2;
    warnings.push(`Overtrading alert: ${setup.recentTradeCount} trades in last 4 hours`);
  }

  // High volatility
  const dailyATRPercent = (setup.currentATR / setup.currentPrice) * 100;
  if (dailyATRPercent > 1.5) {
    dangerLevel += 2;
    warnings.push(`High volatility: ATR ${dailyATRPercent.toFixed(1)}% of price`);
  } else if (dailyATRPercent > 1.2) {
    dangerLevel += 1;
    warnings.push(`Elevated volatility: ATR ${dailyATRPercent.toFixed(1)}% of price`);
  }

  // Correlated volatility
  if (setup.correlatedVolatility === "extreme") {
    dangerLevel += 2;
    warnings.push("Extreme volatility in correlated assets (DXY, yields)");
  }

  return { dangerLevel: Math.min(10, dangerLevel), warnings };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    let setup: TradeSetup;

    if (req.method === "POST") {
      const body = await req.json();
      setup = {
        direction: body.direction || "LONG",
        entry: body.entry || 0,
        stopLoss: body.stopLoss || 0,
        accountBalance: body.accountBalance || 10000,
        currentATR: body.currentATR || 0,
        currentPrice: body.currentPrice || 0,
        hasHighImpactNews: body.hasHighImpactNews || false,
        spreadPips: body.spreadPips || 3,
        avgSpreadPips: body.avgSpreadPips || 3,
        recentTradeCount: body.recentTradeCount || 0,
        correlatedVolatility: body.correlatedVolatility || "normal",
      };
    } else {
      // GET request - use defaults with current market data
      const marketUrl = "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?range=5d&interval=1h";
      const marketResponse = await fetch(marketUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      let currentPrice = 2350;
      let currentATR = 18;

      if (marketResponse.ok) {
        const data = await marketResponse.json();
        const result = data?.chart?.result?.[0];
        const closes = result?.indicators?.quote?.[0]?.close?.filter((c: number) => c != null) || [];
        if (closes.length > 14) {
          currentPrice = closes[closes.length - 1];
          // Simple ATR approximation
          const highs = result?.indicators?.quote?.[0]?.high?.filter((h: number) => h != null) || [];
          const lows = result?.indicators?.quote?.[0]?.low?.filter((l: number) => l != null) || [];
          if (highs.length > 14 && lows.length > 14) {
            let atrSum = 0;
            for (let i = highs.length - 14; i < highs.length; i++) {
              atrSum += highs[i] - lows[i];
            }
            currentATR = atrSum / 14;
          }
        }
      }

      setup = {
        direction: "LONG",
        entry: currentPrice,
        stopLoss: currentPrice - currentATR * 1.5,
        accountBalance: 10000,
        currentATR,
        currentPrice,
        hasHighImpactNews: false,
        spreadPips: 3,
        avgSpreadPips: 3,
        recentTradeCount: 0,
        correlatedVolatility: "normal",
      };
    }

    const positionSize = calculatePositionSize(setup);
    const danger = assessDanger(setup);

    // Volatility regime
    const atrPercent = (setup.currentATR / setup.currentPrice) * 100;
    let volatilityRegime = "normal";
    if (atrPercent < 0.5) volatilityRegime = "low";
    else if (atrPercent > 1.2) volatilityRegime = "high";

    // Time stop recommendation
    const timeStopHours = volatilityRegime === "low" ? 8 : volatilityRegime === "high" ? 4 : 6;

    const result = {
      current_atr: Math.round(setup.currentATR * 100) / 100,
      atr_percent: Math.round(atrPercent * 100) / 100,
      volatility_regime: volatilityRegime,
      position_sizing: {
        recommended_risk_percent: positionSize.riskPercent,
        adjusted_sl_pips: positionSize.adjustedSLPips,
        max_position_oz: positionSize.maxPositionOz,
        dollar_risk: positionSize.dollarRisk,
      },
      stop_loss_recommendations: {
        atr_based_sl: Math.round(setup.currentATR * 1.5 * 100) / 100,
        structural_sl: "Below nearest swing low (long) / above swing high (short)",
        time_stop_hours: timeStopHours,
      },
      danger_assessment: {
        danger_level: danger.dangerLevel,
        warnings: danger.warnings,
        trade_recommended: danger.dangerLevel <= 5,
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
