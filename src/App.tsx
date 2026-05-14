import { useState, useCallback } from "react";
import { runFullAnalysis } from "./lib/supabase";
import type { FullAnalysis, TradeOpportunity } from "./lib/types";
import {
  TrendingUp, TrendingDown, Activity, BarChart3, Globe, Clock,
  History, MessageSquare, Link2, Target, Shield, Building2,
  Sparkles, Compass, RefreshCw, AlertTriangle, ChevronDown,
  ChevronUp, DollarSign, Zap, Eye, Crosshair, Ban, CheckCircle2,
  XCircle, ArrowUpRight, ArrowDownRight, Scale
} from "lucide-react";

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 75 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    : confidence >= 55 ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
    : "bg-red-500/20 text-red-400 border-red-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      {confidence}% conf
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  const isBull = direction === "bullish";
  const isBear = direction === "bearish";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      isBull ? "bg-emerald-500/20 text-emerald-400" : isBear ? "bg-red-500/20 text-red-400" : "bg-slate-500/20 text-slate-400"
    }`}>
      {isBull && <TrendingUp className="w-3 h-3" />}
      {isBear && <TrendingDown className="w-3 h-3" />}
      {!isBull && !isBear && <Activity className="w-3 h-3" />}
      {direction}
    </span>
  );
}

function SectionCard({ title, icon: Icon, children, confidence, defaultOpen = true }: {
  title: string;
  icon: any;
  children: React.ReactNode;
  confidence?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {confidence != null && <ConfidenceBadge confidence={confidence} />}
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      {open && <div className="px-6 pb-5 border-t border-slate-700/30">{children}</div>}
    </div>
  );
}

function MarketSummarySection({ data }: { data: FullAnalysis }) {
  const ms = data.market_summary;
  const price = ms.current_price;
  const change = ms.daily_change_percent;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
      <div className="bg-slate-900/50 rounded-lg p-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider">Price</p>
        <p className="text-2xl font-bold text-white mt-1">${price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </div>
      <div className="bg-slate-900/50 rounded-lg p-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider">Daily Change</p>
        <p className={`text-2xl font-bold mt-1 ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {change >= 0 ? "+" : ""}{change?.toFixed(2)}%
        </p>
      </div>
      <div className="bg-slate-900/50 rounded-lg p-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider">High / Low</p>
        <p className="text-lg font-semibold text-white mt-1">
          ${ms.daily_high?.toFixed(2)} <span className="text-slate-500">/</span> ${ms.daily_low?.toFixed(2)}
        </p>
      </div>
      <div className="bg-slate-900/50 rounded-lg p-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider">Trend / Session</p>
        <div className="flex items-center gap-2 mt-1">
          <DirectionBadge direction={ms.current_trend} />
          <span className="text-sm text-slate-300">{ms.current_session}</span>
        </div>
      </div>
    </div>
  );
}

function MacroSection({ data }: { data: FullAnalysis }) {
  const mf = data.macro_fundamentals;
  const comp = mf.composite;
  const entries = Object.entries(mf.indicators);
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">USD Strength</p>
          <p className={`text-xl font-bold ${comp.usd_strength_score > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {comp.usd_strength_score}/10
          </p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Inflation Regime</p>
          <p className="text-sm font-semibold text-white mt-1">{comp.inflation_regime}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Real Rate Regime</p>
          <p className="text-sm font-semibold text-white mt-1">{comp.real_rate_regime}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Gold Macro Bias</p>
          <p className="text-xl font-bold text-cyan-400">{comp.gold_macro_bias}/10</p>
          <DirectionBadge direction={comp.gold_macro_direction} />
        </div>
      </div>
      {entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase">
                <th className="text-left py-2 px-3">Indicator</th>
                <th className="text-right py-2 px-3">Current</th>
                <th className="text-right py-2 px-3">Previous</th>
                <th className="text-center py-2 px-3">Deviation</th>
                <th className="text-center py-2 px-3">Gold Impact</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 8).map(([key, v]) => (
                <tr key={key} className="border-t border-slate-700/30">
                  <td className="py-2 px-3 text-white">{v.name || key}</td>
                  <td className="py-2 px-3 text-right text-slate-200">{v.current_value}</td>
                  <td className="py-2 px-3 text-right text-slate-400">{v.previous_value}</td>
                  <td className="py-2 px-3 text-center"><span className={`text-xs px-2 py-0.5 rounded ${v.deviation === "hawkish" ? "bg-red-500/20 text-red-400" : v.deviation === "dovish" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-600/30 text-slate-300"}`}>{v.deviation}</span></td>
                  <td className="py-2 px-3 text-center"><span className={`text-xs px-2 py-0.5 rounded ${v.gold_impact === "bullish" ? "bg-emerald-500/20 text-emerald-400" : v.gold_impact === "bearish" ? "bg-red-500/20 text-red-400" : "bg-slate-600/30 text-slate-300"}`}>{v.gold_impact}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewsSection({ data }: { data: FullAnalysis }) {
  const na = data.news_analysis;
  const agg = na.aggregated;
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Sentiment</p>
          <p className={`text-xl font-bold ${agg.sentiment_score > 0 ? "text-emerald-400" : agg.sentiment_score < 0 ? "text-red-400" : "text-slate-300"}`}>
            {agg.sentiment_score?.toFixed(2)} ({agg.sentiment_label})
          </p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">News Volume</p>
          <p className="text-xl font-bold text-white">{agg.news_volume}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Fear & Greed</p>
          <p className="text-xl font-bold text-amber-400">{na.fear_greed_index ?? "N/A"}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Fakeout Warning</p>
          <p className={`text-sm font-semibold ${na.fakeout_warning ? "text-red-400" : "text-emerald-400"}`}>
            {na.fakeout_warning ? "ACTIVE" : "Clear"}
          </p>
        </div>
      </div>
      {na.high_impact_alerts?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider">High Impact Alerts</p>
          {na.high_impact_alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-300">[{a.urgency}] {a.title}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-4 text-sm">
        <span className="text-emerald-400">Bullish: {agg.bullish_articles}</span>
        <span className="text-red-400">Bearish: {agg.bearish_articles}</span>
        <span className="text-slate-400">Neutral: {agg.neutral_articles}</span>
      </div>
    </div>
  );
}

function TechnicalSection({ data }: { data: FullAnalysis }) {
  const ta = data.technical_analysis;
  const tfs = ta.timeframes;
  const consensus = ta.multi_tf_consensus;
  const tfKeys = Object.keys(tfs);
  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-4 mb-3">
        <DirectionBadge direction={consensus.direction} />
        <span className="text-sm text-slate-400">
          {consensus.bullish_timeframes} bullish / {consensus.bearish_timeframes} bearish of {consensus.total_analyzed} timeframes
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs uppercase">
              <th className="text-left py-2 px-2">TF</th>
              <th className="text-center py-2 px-2">Trend</th>
              <th className="text-center py-2 px-2">ADX</th>
              <th className="text-center py-2 px-2">RSI</th>
              <th className="text-center py-2 px-2">Zone</th>
              <th className="text-center py-2 px-2">MACD</th>
              <th className="text-center py-2 px-2">ATR%</th>
              <th className="text-center py-2 px-2">Structure</th>
            </tr>
          </thead>
          <tbody>
            {tfKeys.map(tf => {
              const d = tfs[tf];
              return (
                <tr key={tf} className="border-t border-slate-700/30">
                  <td className="py-2 px-2 font-mono text-cyan-400 font-semibold">{tf}</td>
                  <td className="py-2 px-2 text-center"><DirectionBadge direction={d.trend?.direction} /></td>
                  <td className="py-2 px-2 text-center text-slate-200">{d.trend?.adx}</td>
                  <td className="py-2 px-2 text-center text-slate-200">{d.momentum?.rsi}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${d.momentum?.rsi_zone === "overbought" ? "bg-red-500/20 text-red-400" : d.momentum?.rsi_zone === "oversold" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-600/30 text-slate-300"}`}>
                      {d.momentum?.rsi_zone}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={`text-xs ${d.momentum?.macd?.crossover === "bullish" ? "text-emerald-400" : "text-red-400"}`}>
                      {d.momentum?.macd?.crossover}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center text-slate-200">{d.volatility?.atr_percent}%</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${d.structure?.current === "bullish" ? "bg-emerald-500/20 text-emerald-400" : d.structure?.current === "bearish" ? "bg-red-500/20 text-red-400" : "bg-slate-600/30 text-slate-300"}`}>
                      {d.structure?.current}
                    </span>
                    {d.structure?.bos && <span className="ml-1 text-xs text-cyan-400">BOS</span>}
                    {d.structure?.choch && <span className="ml-1 text-xs text-amber-400">CHOCH</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionSection({ data }: { data: FullAnalysis }) {
  const sa = data.session_analysis;
  const cs = sa.current_session;
  const ca = sa.current_analysis;
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Session</p>
          <p className="text-lg font-bold text-cyan-400">{cs.name}</p>
          <p className="text-xs text-slate-400">{cs.start_utc} - {cs.end_utc} UTC</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Time Remaining</p>
          <p className="text-lg font-bold text-white">{cs.minutes_remaining} min</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Range vs Avg</p>
          <p className="text-lg font-bold text-white">{ca.range_vs_historical_percentile}%</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Volatility</p>
          <p className={`text-lg font-bold ${ca.volatility_regime === "expanding" ? "text-amber-400" : ca.volatility_regime === "squeeze" ? "text-red-400" : "text-white"}`}>
            {ca.volatility_regime}
          </p>
        </div>
      </div>
      {sa.traps?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Session Traps</p>
          {sa.traps.map((t, i) => (
            <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <p className="text-sm font-medium text-amber-300">{t.type.replace(/_/g, " ")}</p>
              <p className="text-xs text-slate-400">{t.description} ({Math.round(t.probability * 100)}%)</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoricalSection({ data }: { data: FullAnalysis }) {
  const ht = data.historical_trend_comparison;
  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-3 mb-2">
        <DirectionBadge direction={ht.probability?.direction || "neutral"} />
        <span className="text-sm text-slate-400">Strength: {ht.probability?.strength?.toFixed(2)}</span>
        <ConfidenceBadge confidence={ht.pattern_confidence || 30} />
      </div>
      {ht.top_matches?.map((m, i) => (
        <div key={i} className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-white">{i + 1}. {m.name}</p>
            <span className="text-xs text-slate-400">Similarity: {m.similarity} | Win Rate: {Math.round(m.win_rate * 100)}%</span>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-slate-400">Type: {m.event_type}</span>
            <span className={m.expected_outcome?.direction === "bullish" ? "text-emerald-400" : "text-red-400"}>
              {m.expected_outcome?.direction}
            </span>
            <span className="text-slate-300">1D: {m.expected_outcome?.move_1d_pips > 0 ? "+" : ""}{m.expected_outcome?.move_1d_pips} pips</span>
            <span className="text-slate-300">1W: {m.expected_outcome?.move_1w_pips > 0 ? "+" : ""}{m.expected_outcome?.move_1w_pips} pips</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CorrelationSection({ data }: { data: FullAnalysis }) {
  const ca = data.correlation_analysis;
  const matrix = ca.matrix;
  const assets = Object.keys(matrix);
  return (
    <div className="space-y-4 pt-4">
      <div className="bg-slate-900/50 rounded-lg p-3 mb-3">
        <p className="text-xs text-slate-400">Strongest Influence</p>
        <p className="text-lg font-bold text-cyan-400">{ca.strongest_influence?.asset} <span className="text-sm text-slate-400">(1D corr: {ca.strongest_influence?.correlation_1d})</span></p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs uppercase">
              <th className="text-left py-2 px-2">Asset</th>
              <th className="text-center py-2 px-2">1H</th>
              <th className="text-center py-2 px-2">4H</th>
              <th className="text-center py-2 px-2">1D</th>
              <th className="text-center py-2 px-2">1W</th>
            </tr>
          </thead>
          <tbody>
            {assets.map(asset => {
              const c = matrix[asset];
              return (
                <tr key={asset} className="border-t border-slate-700/30">
                  <td className="py-2 px-2 font-semibold text-white">{asset}</td>
                  <td className="py-2 px-2 text-center">
                    <CorrCell value={c["1H"]} />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <CorrCell value={c["4H"]} />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <CorrCell value={c["1D"]} />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <CorrCell value={c["1W"]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {ca.divergences?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Divergences</p>
          {ca.divergences.map((d, i) => (
            <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <p className="text-sm font-medium text-amber-300">{d.asset}: {d.type.replace(/_/g, " ")}</p>
              <p className="text-xs text-slate-400">{d.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CorrCell({ value }: { value: number }) {
  if (value == null) return <span className="text-slate-500">--</span>;
  const color = value > 0.5 ? "text-emerald-400" : value > 0 ? "text-emerald-400/60" : value < -0.5 ? "text-red-400" : value < 0 ? "text-red-400/60" : "text-slate-400";
  return <span className={`font-mono ${color}`}>{value.toFixed(2)}</span>;
}

function TradeSection({ trades }: { trades: TradeOpportunity[] }) {
  if (trades.length === 0) {
    return (
      <div className="pt-4 text-center py-8">
        <p className="text-slate-400">No trade opportunities meet the 65% probability threshold.</p>
        <p className="text-sm text-slate-500 mt-1">Wait for clearer signals before entering.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4 pt-4">
      {trades.map((t, i) => (
        <div key={i} className={`border rounded-lg p-4 ${t.direction === "LONG" ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className={`text-lg font-bold ${t.direction === "LONG" ? "text-emerald-400" : "text-red-400"}`}>
                {t.direction}
              </span>
              <span className="text-sm text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded">{t.setup_type.replace(/_/g, " ")}</span>
            </div>
            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={t.confidence} />
              <span className="text-sm text-slate-300">Prob: {t.probability}%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-3">
            <div>
              <p className="text-xs text-slate-400">Entry</p>
              <p className="text-white font-mono">${t.entry_zone?.[0]?.toFixed(2)} - ${t.entry_zone?.[1]?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Stop Loss</p>
              <p className="text-red-400 font-mono">${t.stop_loss?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">TP1</p>
              <p className="text-emerald-400 font-mono">${t.tp1?.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">TP2 / TP3</p>
              <p className="text-slate-200 font-mono">{t.tp2 ? `$${t.tp2.toFixed(2)}` : "--"} / {t.tp3 ? `$${t.tp3.toFixed(2)}` : "--"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">R:R</p>
              <p className="text-cyan-400 font-bold text-lg">{t.rr_ratio}</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 mb-1">{t.reasoning}</p>
          <p className="text-xs text-slate-500">Invalidation: {t.invalidation}</p>
        </div>
      ))}
    </div>
  );
}

function RiskSection({ data }: { data: FullAnalysis }) {
  const rm = data.risk_management;
  const da = rm.danger_assessment;
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Volatility Regime</p>
          <p className="text-lg font-bold text-white">{rm.volatility_regime}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Recommended Risk</p>
          <p className="text-lg font-bold text-cyan-400">{rm.position_sizing?.recommended_risk_percent}%</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Max Position</p>
          <p className="text-lg font-bold text-white">{rm.position_sizing?.max_position_oz} oz</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Danger Level</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${da.danger_level <= 3 ? "bg-emerald-500" : da.danger_level <= 6 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${da.danger_level * 10}%` }}
              />
            </div>
            <span className="text-sm font-bold text-white">{da.danger_level}/10</span>
          </div>
        </div>
      </div>
      {da.warnings?.length > 0 && (
        <div className="space-y-2">
          {da.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-sm text-amber-300">{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SmartMoneySection({ data }: { data: FullAnalysis }) {
  const sm = data.smart_money_analysis;
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Smart Money Phase</p>
          <p className="text-lg font-bold text-cyan-400 capitalize">{sm.phase?.phase?.replace(/_/g, " ")}</p>
          <p className="text-xs text-slate-400">{sm.phase?.description}</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Engineered Liquidity</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${sm.engineered_liquidity_score}%` }} />
            </div>
            <span className="text-sm font-bold text-white">{sm.engineered_liquidity_score}/100</span>
          </div>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Stop Hunts</p>
          <p className="text-lg font-bold text-white">{sm.institutional_footprints?.stop_hunts?.length || 0}</p>
        </div>
      </div>
      {sm.liquidity_zones?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Key Liquidity Zones</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sm.liquidity_zones.slice(0, 6).map((z, i) => (
              <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${z.type === "resistance" ? "border-red-500/20 bg-red-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                <div>
                  <span className={`text-sm font-semibold ${z.type === "resistance" ? "text-red-400" : "text-emerald-400"}`}>
                    ${z.level?.toFixed(2)}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">{z.source?.replace(/_/g, " ")}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${z.magnitude === "high" ? "bg-amber-500/20 text-amber-400" : "bg-slate-600/30 text-slate-300"}`}>
                  {z.magnitude}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {sm.trap_warnings?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Trap Warnings</p>
          {sm.trap_warnings.map((t, i) => (
            <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <p className="text-sm font-medium text-red-300">{t.type?.replace(/_/g, " ")} at ${t.level?.toFixed(2)}</p>
              <p className="text-xs text-slate-400">{t.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ForecastSection({ data }: { data: FullAnalysis }) {
  const fc = data.forecast;
  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-4 mb-2">
        <DirectionBadge direction={fc.direction} />
        <ConfidenceBadge confidence={fc.confidence} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Bullish Score</p>
          <p className="text-xl font-bold text-emerald-400">{fc.bullish_score}%</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Bearish Score</p>
          <p className="text-xl font-bold text-red-400">{fc.bearish_score}%</p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Expected 1D Move</p>
          <p className={`text-xl font-bold ${fc.expected_move_1d_pips >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {fc.expected_move_1d_pips >= 0 ? "+" : ""}{fc.expected_move_1d_pips} pips
          </p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Expected 1W Move</p>
          <p className={`text-xl font-bold ${fc.expected_move_1w_pips >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {fc.expected_move_1w_pips >= 0 ? "+" : ""}{fc.expected_move_1w_pips} pips
          </p>
        </div>
      </div>
      <p className="text-sm text-slate-400">Key Driver: <span className="text-white">{fc.key_driver?.replace(/_/g, " ")}</span></p>
    </div>
  );
}

function TradeRecommendationSection({ data }: { data: FullAnalysis }) {
  const rec = data.trade_recommendation;
  if (!rec) return null;

  const isTrade = rec.action === "TRADE";
  const isLong = rec.direction === "LONG";

  return (
    <div className="space-y-5 pt-4">
      {/* Primary Action Banner */}
      <div className={`relative overflow-hidden rounded-xl border-2 ${
        isTrade
          ? isLong ? "border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
                   : "border-red-500/50 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent"
          : "border-slate-600/50 bg-gradient-to-br from-slate-700/20 via-slate-800/10 to-transparent"
      }`}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              {isTrade ? (
                isLong ? (
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <ArrowUpRight className="w-8 h-8 text-emerald-400" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                    <ArrowDownRight className="w-8 h-8 text-red-400" />
                  </div>
                )
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-600/20 border border-slate-600/30 flex items-center justify-center">
                  <Ban className="w-8 h-8 text-slate-400" />
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Recommended Action</p>
                <h3 className={`text-3xl font-bold ${isTrade ? (isLong ? "text-emerald-400" : "text-red-400") : "text-slate-300"}`}>
                  {isTrade ? `${rec.direction} ${rec.setup_type?.replace(/_/g, " ")}` : "NO TRADE - Stay Flat"}
                </h3>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <ConfidenceBadge confidence={rec.confidence} />
                <span className="text-sm text-slate-400">Probability: {rec.probability}%</span>
              </div>
              <p className="text-xs text-slate-500">Composite Score: {rec.composite_score}</p>
            </div>
          </div>

          {/* Trade Levels - only show for TRADE */}
          {isTrade && rec.entry != null && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
              <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/30">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Entry</p>
                <p className="text-lg font-bold text-white font-mono">${rec.entry?.toFixed(2)}</p>
                {rec.entry_zone && <p className="text-[10px] text-slate-500">${rec.entry_zone[0]?.toFixed(2)} - ${rec.entry_zone[1]?.toFixed(2)}</p>}
              </div>
              <div className="bg-slate-900/60 rounded-lg p-3 border border-red-500/20">
                <p className="text-[10px] text-red-400 uppercase tracking-wider">Stop Loss</p>
                <p className="text-lg font-bold text-red-400 font-mono">${rec.stop_loss?.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-3 border border-emerald-500/20">
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider">TP1</p>
                <p className="text-lg font-bold text-emerald-400 font-mono">${rec.tp1?.toFixed(2)}</p>
                <p className="text-[10px] text-slate-500">R:R {rec.rr_ratio_tp1}</p>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-3 border border-emerald-500/20">
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider">TP2</p>
                <p className="text-lg font-bold text-emerald-300 font-mono">${rec.tp2?.toFixed(2)}</p>
                <p className="text-[10px] text-slate-500">R:R {rec.rr_ratio_tp2}</p>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-3 border border-emerald-500/20">
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider">TP3</p>
                <p className="text-lg font-bold text-emerald-200 font-mono">${rec.tp3?.toFixed(2)}</p>
                <p className="text-[10px] text-slate-500">R:R {rec.rr_ratio_tp3}</p>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-3 border border-cyan-500/20">
                <p className="text-[10px] text-cyan-400 uppercase tracking-wider">Position</p>
                <p className="text-lg font-bold text-cyan-400 font-mono">{rec.position_size_oz} oz</p>
                <p className="text-[10px] text-slate-500">{rec.risk_percent}% risk (${rec.dollar_risk})</p>
              </div>
            </div>
          )}

          {/* Reasoning */}
          <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/30 mb-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Reasoning</p>
            <p className="text-sm text-slate-200 leading-relaxed">{rec.reasoning}</p>
          </div>

          {/* Invalidation */}
          {isTrade && rec.invalidation_conditions && (
            <div className="bg-red-500/5 rounded-lg p-4 border border-red-500/20 mb-4">
              <p className="text-xs text-red-400 uppercase tracking-wider mb-2">Invalidation Conditions</p>
              <ul className="space-y-1">
                {rec.invalidation_conditions.map((ic, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-red-300">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {ic}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What would change - for NO_TRADE */}
          {!isTrade && rec.what_would_change && (
            <div className="bg-cyan-500/5 rounded-lg p-4 border border-cyan-500/20">
              <p className="text-xs text-cyan-400 uppercase tracking-wider mb-2">What Would Trigger a Trade</p>
              <ul className="space-y-1">
                {rec.what_would_change.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-cyan-500" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Confluence & Factor Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Confluence Summary */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4 text-cyan-400" />
            Signal Confluence
          </h4>
          <div className="flex items-center gap-6 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-400">{rec.confluence.bullish_count}</p>
              <p className="text-xs text-slate-400">Bullish</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-400">{rec.confluence.total_factors - rec.confluence.bullish_count - rec.confluence.bearish_count}</p>
              <p className="text-xs text-slate-400">Neutral</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-400">{rec.confluence.bearish_count}</p>
              <p className="text-xs text-slate-400">Bearish</p>
            </div>
          </div>
          {/* Visual bar */}
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden flex">
            {rec.confluence.total_factors > 0 && (
              <>
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(rec.confluence.bullish_count / rec.confluence.total_factors) * 100}%` }} />
                <div className="bg-slate-500 h-full transition-all" style={{ width: `${((rec.confluence.total_factors - rec.confluence.bullish_count - rec.confluence.bearish_count) / rec.confluence.total_factors) * 100}%` }} />
                <div className="bg-red-500 h-full transition-all" style={{ width: `${(rec.confluence.bearish_count / rec.confluence.total_factors) * 100}%` }} />
              </>
            )}
          </div>
        </div>

        {/* Top Factors */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-cyan-400" />
            Key Driving Factors
          </h4>
          <div className="space-y-2">
            {(rec.top_bullish_factors || []).slice(0, 3).map((f, i) => (
              <div key={`b${i}`} className="flex items-start gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-medium">{f.name}</p>
                  <p className="text-xs text-slate-400">{f.detail}</p>
                </div>
              </div>
            ))}
            {(rec.top_bearish_factors || []).slice(0, 3).map((f, i) => (
              <div key={`s${i}`} className="flex items-start gap-2">
                <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-medium">{f.name}</p>
                  <p className="text-xs text-slate-400">{f.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All Signal Factors Table */}
      {rec.factors_summary && rec.factors_summary.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
          <h4 className="text-sm font-semibold text-white mb-3">All Signal Factors ({rec.factors_summary.length})</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase">
                  <th className="text-left py-2 px-2">Factor</th>
                  <th className="text-center py-2 px-2">Direction</th>
                  <th className="text-center py-2 px-2">Score</th>
                  <th className="text-center py-2 px-2">Weight</th>
                  <th className="text-center py-2 px-2">Impact</th>
                </tr>
              </thead>
              <tbody>
                {rec.factors_summary.map((f, i) => (
                  <tr key={i} className="border-t border-slate-700/30">
                    <td className="py-1.5 px-2">
                      <p className="text-white text-xs font-medium">{f.name}</p>
                      <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{f.detail}</p>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${f.direction === "bullish" ? "bg-emerald-500/20 text-emerald-400" : f.direction === "bearish" ? "bg-red-500/20 text-red-400" : "bg-slate-600/30 text-slate-400"}`}>
                        {f.direction}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono text-xs">
                      <span className={f.score > 0 ? "text-emerald-400" : f.score < 0 ? "text-red-400" : "text-slate-400"}>
                        {f.score > 0 ? "+" : ""}{f.score}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-center text-xs text-slate-300">{f.weight}</td>
                    <td className="py-1.5 px-2 text-center font-mono text-xs">
                      <span className={f.weighted_impact > 0 ? "text-emerald-400" : f.weighted_impact < 0 ? "text-red-400" : "text-slate-400"}>
                        {f.weighted_impact > 0 ? "+" : ""}{f.weighted_impact}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FinalOutlookSection({ data }: { data: FullAnalysis }) {
  const fto = data.final_trading_outlook;
  return (
    <div className="space-y-4 pt-4">
      <div className={`border rounded-lg p-5 ${fto.overall_direction === "bullish" ? "border-emerald-500/30 bg-emerald-500/5" : fto.overall_direction === "bearish" ? "border-red-500/30 bg-red-500/5" : "border-slate-600/30 bg-slate-700/20"}`}>
        <div className="flex items-center gap-4 mb-3">
          <DirectionBadge direction={fto.overall_direction} />
          <span className="text-2xl font-bold text-white">{fto.overall_confidence}%</span>
          <ConfidenceBadge confidence={fto.overall_confidence} />
        </div>
        <p className="text-lg text-white font-medium">{fto.recommendation}</p>
      </div>
      {fto.key_risks?.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Key Risks</p>
          {fto.key_risks.map((r, i) => (
            <div key={i} className="flex items-start gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-sm text-slate-300">{r}</span>
            </div>
          ))}
        </div>
      )}
      {fto.action_items?.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Action Items</p>
          {fto.action_items.map((a, i) => (
            <div key={i} className="flex items-start gap-2 mb-1">
              <Target className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span className="text-sm text-slate-300">{a}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [analysis, setAnalysis] = useState<FullAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runFullAnalysis();
      setAnalysis(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">XAUUSD Intelligence</h1>
              <p className="text-xs text-slate-400">Multi-Agent Trading Analysis System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {analysis?.meta?.timestamp && (
              <span className="text-xs text-slate-500 hidden sm:block">
                Updated: {new Date(analysis.meta.timestamp).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg font-medium text-sm transition-colors"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {loading ? "Analyzing..." : "Run Analysis"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Disclaimer */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2 text-xs text-amber-300">
          DISCLAIMER: This is AI-generated analysis for research purposes only. Not financial advice. Past performance does not guarantee future results.
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-300">
            Error: {error}
          </div>
        )}

        {!analysis && !loading && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center">
              <Eye className="w-10 h-10 text-cyan-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">XAUUSD Trading Intelligence</h2>
            <p className="text-slate-400 mb-8 max-w-lg mx-auto">
              13-layer multi-agent system analyzing technicals, macro fundamentals, news sentiment,
              smart money, correlations, session behavior, and historical patterns.
            </p>
            <button
              onClick={runAnalysis}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors"
            >
              Launch Full Analysis
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
            <p className="text-lg text-white font-medium">Running 13-Layer Analysis...</p>
            <p className="text-sm text-slate-400 mt-2">Fetching market data, computing indicators, analyzing sentiment</p>
          </div>
        )}

        {analysis && !loading && (
          <div className="space-y-4">
            {/* Forecast Banner */}
            <div className={`rounded-xl p-5 border ${
              analysis.forecast.direction === "bullish" ? "bg-emerald-500/10 border-emerald-500/30" :
              analysis.forecast.direction === "bearish" ? "bg-red-500/10 border-red-500/30" :
              "bg-slate-800/50 border-slate-700/50"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {analysis.forecast.direction === "bullish" ? (
                    <TrendingUp className="w-8 h-8 text-emerald-400" />
                  ) : analysis.forecast.direction === "bearish" ? (
                    <TrendingDown className="w-8 h-8 text-red-400" />
                  ) : (
                    <Activity className="w-8 h-8 text-slate-400" />
                  )}
                  <div>
                    <p className="text-sm text-slate-400 uppercase tracking-wider">Overall Forecast</p>
                    <p className="text-2xl font-bold text-white capitalize">{analysis.forecast.direction} ({analysis.forecast.confidence}%)</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Price</p>
                  <p className="text-3xl font-bold text-white">${analysis.market_summary.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <p className={`text-sm font-medium ${analysis.market_summary.daily_change_percent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {analysis.market_summary.daily_change_percent >= 0 ? "+" : ""}{analysis.market_summary.daily_change_percent?.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            {/* 13 Sections */}
            <SectionCard title="Market Summary" icon={BarChart3} confidence={70}>
              <MarketSummarySection data={analysis} />
            </SectionCard>

            {/* PRIMARY TRADE RECOMMENDATION - most prominent */}
            <SectionCard title="Recommended Trade" icon={Crosshair} confidence={analysis.trade_recommendation?.confidence} defaultOpen={true}>
              <TradeRecommendationSection data={analysis} />
            </SectionCard>

            <SectionCard title="Macro Fundamentals" icon={Globe} confidence={65}>
              <MacroSection data={analysis} />
            </SectionCard>

            <SectionCard title="News Analysis" icon={MessageSquare} confidence={55}>
              <NewsSection data={analysis} />
            </SectionCard>

            <SectionCard title="Technical Analysis" icon={Activity} confidence={75} defaultOpen={true}>
              <TechnicalSection data={analysis} />
            </SectionCard>

            <SectionCard title="Session Analysis" icon={Clock} confidence={65}>
              <SessionSection data={analysis} />
            </SectionCard>

            <SectionCard title="Historical Trend Comparison" icon={History} confidence={analysis.historical_trend_comparison.pattern_confidence}>
              <HistoricalSection data={analysis} />
            </SectionCard>

            <SectionCard title="Sentiment Analysis" icon={MessageSquare} confidence={50}>
              <div className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">News Sentiment</p>
                  <p className="text-lg font-bold text-white">{analysis.sentiment_analysis.news_sentiment} ({analysis.sentiment_analysis.news_sentiment_label})</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Fear & Greed</p>
                  <p className="text-lg font-bold text-amber-400">{analysis.sentiment_analysis.fear_greed_index ?? "N/A"}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Bull / Bear Articles</p>
                  <p className="text-lg font-bold text-white">{analysis.sentiment_analysis.bullish_articles} / {analysis.sentiment_analysis.bearish_articles}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Correlation Analysis" icon={Link2} confidence={70}>
              <CorrelationSection data={analysis} />
            </SectionCard>

            <SectionCard title="Trade Opportunities" icon={Target} confidence={analysis.trade_opportunities[0]?.confidence}>
              <TradeSection trades={analysis.trade_opportunities} />
            </SectionCard>

            <SectionCard title="Risk Management" icon={Shield} confidence={75}>
              <RiskSection data={analysis} />
            </SectionCard>

            <SectionCard title="Institutional Smart Money Analysis" icon={Building2} confidence={60}>
              <SmartMoneySection data={analysis} />
            </SectionCard>

            <SectionCard title="Forecast" icon={Sparkles} confidence={analysis.forecast.confidence}>
              <ForecastSection data={analysis} />
            </SectionCard>

            <SectionCard title="Final Trading Outlook" icon={Compass} confidence={analysis.final_trading_outlook.overall_confidence} defaultOpen={true}>
              <FinalOutlookSection data={analysis} />
            </SectionCard>

            {/* Meta */}
            <div className="text-center py-4 text-xs text-slate-600">
              Layers: {analysis.meta.layers_executed} | Failed: {analysis.meta.layers_failed} | Version: {analysis.meta.version}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
