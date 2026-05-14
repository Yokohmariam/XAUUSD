export interface MarketSummary {
  current_price: number;
  daily_change_percent: number;
  daily_high: number;
  daily_low: number;
  current_trend: string;
  current_session: string;
  market_status: string;
}

export interface MacroFundamentals {
  indicators: Record<string, MacroIndicator>;
  composite: MacroComposite;
  data_quality: string;
}

export interface MacroIndicator {
  name: string;
  current_value: number;
  previous_value: number;
  date: string;
  impact_type: string;
  deviation: string;
  gold_impact: string;
  confidence: number;
}

export interface MacroComposite {
  usd_strength_score: number;
  inflation_regime: string;
  real_rate_regime: string;
  yield_curve_spread: number;
  real_yields: number;
  gold_macro_bias: number;
  gold_macro_direction: string;
}

export interface NewsAnalysis {
  aggregated: {
    sentiment_score: number;
    sentiment_label: string;
    news_volume: number;
    bullish_articles: number;
    bearish_articles: number;
    neutral_articles: number;
  };
  high_impact_alerts: { title: string; event: string; urgency: string }[];
  fear_greed_index: number | null;
  fakeout_warning: boolean;
  article_count: number;
}

export interface TechnicalTimeframe {
  timeframe: string;
  price: number;
  trend: { direction: string; strength: string; adx: number; pdi: number; mdi: number; regression_slope: number };
  ema: { ema9: number; ema20: number; ema50: number; ema200: number };
  structure: { current: string; bos: boolean; choch: boolean; swing_highs: number[]; swing_lows: number[] };
  support_resistance: { support: number[]; resistance: number[]; fair_value_gaps: any[] };
  momentum: {
    rsi: number;
    rsi_zone: string;
    rsi_divergence: { type: string; confidence: number } | null;
    macd: { line: number; signal: number; histogram: number; crossover: string };
    stochastic: { k: number; d: number };
  };
  volatility: { atr: number; atr_percent: number; bollinger: { upper: number; middle: number; lower: number; bandwidth: number; percentB: number } };
}

export interface TechnicalAnalysis {
  timeframes: Record<string, TechnicalTimeframe>;
  multi_tf_consensus: { direction: string; bullish_timeframes: number; bearish_timeframes: number; total_analyzed: number };
}

export interface SessionAnalysis {
  current_session: { name: string; start_utc: string; end_utc: string; minutes_remaining: number };
  statistics: { avg_range_pips: number; direction_bias: string; manipulation_window_minutes: number; reversal_time_utc: string; kill_zone: { start_utc: string; end_utc: string }; liquidity_grab_pattern: string };
  current_analysis: { current_range_pips: number; session_high: number; session_low: number; range_vs_historical_percentile: number; volatility_regime: string; expected_outcome: string };
  traps: { type: string; description: string; probability: number }[];
}

export interface HistoricalPattern {
  name: string;
  event_type: string;
  timeframe: string;
  similarity: number;
  setup_conditions: any;
  expected_outcome: { direction: string; move_1d_pips: number; move_3d_pips: number; move_1w_pips: number };
  win_rate: number;
  confidence: number;
}

export interface CorrelationAnalysis {
  matrix: Record<string, Record<string, number>>;
  strongest_influence: { asset: string; correlation_1d: number; impact_score: number };
  divergences: { asset: string; type: string; description: string; significance: string }[];
  impact_estimates: Record<string, string>;
}

export interface TradeOpportunity {
  direction: string;
  setup_type: string;
  entry_zone: number[];
  stop_loss: number;
  tp1: number;
  tp2: number | null;
  tp3: number | null;
  rr_ratio: number;
  probability: number;
  confidence: number;
  reasoning: string;
  invalidation: string;
}

export interface RiskManagement {
  volatility_regime: string;
  position_sizing: { recommended_risk_percent: number; adjusted_sl_pips: number; max_position_oz: number; dollar_risk: number };
  stop_recommendations: { atr_based_sl: number; structural_sl: string; time_stop_hours: number };
  danger_assessment: { danger_level: number; warnings: string[]; trade_recommended: boolean };
}

export interface SmartMoneyAnalysis {
  liquidity_zones: { level: number; type: string; magnitude: string; source: string; distance_from_current: number }[];
  institutional_footprints: { volume_spikes: any[]; wick_rejections: any[]; stop_hunts: any[] };
  phase: { phase: string; confidence: number; description: string };
  trap_warnings: { level: number; type: string; description: string }[];
  engineered_liquidity_score: number;
}

export interface Forecast {
  direction: string;
  confidence: number;
  bullish_score: number;
  bearish_score: number;
  key_driver: string;
  expected_move_1d_pips: number;
  expected_move_1w_pips: number;
}

export interface SignalFactor {
  name: string;
  direction: "bullish" | "bearish" | "neutral";
  weight: number;
  score: number;
  detail: string;
}

export interface TradeRecommendation {
  action: "TRADE" | "NO_TRADE";
  direction: string;
  setup_type?: string;
  composite_score: number;
  probability: number;
  confidence: number;
  entry?: number;
  entry_zone?: number[];
  stop_loss?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
  rr_ratio_tp1?: number;
  rr_ratio_tp2?: number;
  rr_ratio_tp3?: number;
  risk_percent?: number;
  position_size_oz?: number;
  dollar_risk?: number;
  reasoning: string;
  invalidation?: string;
  invalidation_conditions?: string[];
  factors_summary: { name: string; direction: string; score: number; weight: number; weighted_impact: number; detail: string }[];
  confluence: { bullish_count: number; bearish_count: number; total_factors: number; aligned_count?: number };
  what_would_change?: string[];
  top_bullish_factors?: { name: string; detail: string; score: number; weight: number }[];
  top_bearish_factors?: { name: string; detail: string; score: number; weight: number }[];
}

export interface FullAnalysis {
  disclaimer: string;
  market_summary: MarketSummary;
  macro_fundamentals: MacroFundamentals;
  news_analysis: NewsAnalysis;
  technical_analysis: TechnicalAnalysis;
  session_analysis: SessionAnalysis;
  historical_trend_comparison: { top_matches: HistoricalPattern[]; probability: { direction: string; strength: number; weighted_win_rate: number }; expected_move: { move_1d_pips: number; move_1w_pips: number }; pattern_confidence: number };
  sentiment_analysis: { news_sentiment: number; news_sentiment_label: string; fear_greed_index: number | null; bullish_articles: number; bearish_articles: number };
  correlation_analysis: CorrelationAnalysis;
  trade_opportunities: TradeOpportunity[];
  risk_management: RiskManagement;
  smart_money_analysis: SmartMoneyAnalysis;
  forecast: Forecast;
  trade_recommendation: TradeRecommendation;
  signal_factors: SignalFactor[];
  final_trading_outlook: { overall_direction: string; overall_confidence: number; recommendation: string; key_risks: string[]; action_items: string[] };
  meta: { layers_executed: number; layers_failed: number; timestamp: string; version: string };
}
