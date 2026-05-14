/*
  # XAUUSD Trading Intelligence System - Core Schema

  1. New Tables
    - `market_data`: Stores OHLCV data for XAUUSD and correlated instruments
    - `analysis_snapshots`: Stores full analysis output from the orchestrator
    - `trade_signals`: Stores generated trade signals
    - `historical_patterns`: Stores labeled historical pattern data
    - `session_stats`: Stores session behavior statistics
    - `correlation_snapshots`: Stores correlation matrices
    - `news_events`: Stores processed news and sentiment data
    - `macro_indicators`: Stores macro fundamental data

  2. Security
    - Enable RLS on all tables
    - All tables are read-only for authenticated users (no inserts from client)
    - Service role handles all writes via edge functions
*/

-- Market data for all instruments
CREATE TABLE IF NOT EXISTS market_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  timeframe text NOT NULL,
  timestamp timestamptz NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  volume numeric DEFAULT 0,
  session_label text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(symbol, timeframe, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_market_data_symbol_tf ON market_data(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp DESC);

-- Full analysis snapshots
CREATE TABLE IF NOT EXISTS analysis_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_type text NOT NULL,
  data jsonb NOT NULL,
  confidence_score numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_type ON analysis_snapshots(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analysis_created ON analysis_snapshots(created_at DESC);

-- Trade signals
CREATE TABLE IF NOT EXISTS trade_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  entry_zone numeric[] NOT NULL,
  stop_loss numeric NOT NULL,
  tp1 numeric NOT NULL,
  tp2 numeric,
  tp3 numeric,
  rr_ratio numeric NOT NULL,
  setup_type text NOT NULL,
  probability numeric NOT NULL,
  confidence numeric NOT NULL,
  reasoning text,
  invalidation_conditions text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'hit_tp1', 'hit_tp2', 'hit_tp3', 'stopped', 'expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Historical patterns
CREATE TABLE IF NOT EXISTS historical_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name text NOT NULL,
  event_type text NOT NULL,
  timeframe text NOT NULL,
  setup_conditions jsonb NOT NULL,
  actual_outcome jsonb NOT NULL,
  win_rate numeric,
  created_at timestamptz DEFAULT now()
);

-- Session statistics
CREATE TABLE IF NOT EXISTS session_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name text NOT NULL,
  date date NOT NULL,
  avg_range_pips numeric,
  direction_bias text,
  manipulation_window_minutes numeric,
  reversal_time_utc text,
  kill_zone_start_utc text,
  kill_zone_end_utc text,
  liquidity_grab_pattern text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(session_name, date)
);

-- Correlation snapshots
CREATE TABLE IF NOT EXISTS correlation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_pair text NOT NULL,
  rolling_1h numeric,
  rolling_4h numeric,
  rolling_1d numeric,
  rolling_1w numeric,
  divergence_detected boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- News events
CREATE TABLE IF NOT EXISTS news_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  title text NOT NULL,
  url text,
  category text NOT NULL,
  relevance text NOT NULL,
  sentiment_score numeric,
  gold_impact text,
  urgency text DEFAULT 'low',
  confidence numeric,
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_category ON news_events(category);
CREATE INDEX IF NOT EXISTS idx_news_published ON news_events(published_at DESC);

-- Macro indicators
CREATE TABLE IF NOT EXISTS macro_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_name text NOT NULL,
  current_value numeric,
  previous_value numeric,
  consensus_forecast numeric,
  deviation_impact text,
  confidence_score numeric,
  gold_impact_short text,
  gold_impact_medium text,
  gold_impact_long text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(indicator_name)
);

-- Enable RLS on all tables
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE correlation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE macro_indicators ENABLE ROW LEVEL SECURITY;

-- RLS Policies: authenticated users can read all tables
CREATE POLICY "Authenticated users can read market data"
  ON market_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read analysis snapshots"
  ON analysis_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read trade signals"
  ON trade_signals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read historical patterns"
  ON historical_patterns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read session stats"
  ON session_stats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read correlation snapshots"
  ON correlation_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read news events"
  ON news_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read macro indicators"
  ON macro_indicators FOR SELECT
  TO authenticated
  USING (true);
