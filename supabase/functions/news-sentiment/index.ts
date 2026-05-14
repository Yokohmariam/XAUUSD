import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOLD_KEYWORDS = [
  "gold", "xauusd", "precious metal", "safe haven", "inflation hedge",
  "fed", "fomc", "powell", "interest rate", "cpi", "inflation", "nfp",
  "nonfarm", "unemployment", "dollar", "dxy", "treasury", "yield",
  "geopolitical", "war", "conflict", "sanctions", "tariff",
  "recession", "bank crisis", "liquidity", "quantitative",
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Fed: ["fed", "fomc", "powell", "federal reserve", "interest rate", "rate decision", "dot plot"],
  Inflation: ["cpi", "inflation", "ppi", "core cpi", "deflation", "disinflation"],
  Jobs: ["nfp", "nonfarm", "unemployment", "payroll", "jobless", "employment", "adp"],
  Geopolitics: ["war", "conflict", "sanctions", "tariff", "nuclear", "military", "invasion", "escalation"],
  Dollar: ["dollar", "dxy", "usd", "currency", "forex", "reserve currency"],
  Risk: ["vix", "risk", "fear", "panic", "crash", "selloff", "flight to safety"],
  Gold_specific: ["gold", "xauusd", "precious metal", "bullion", "gold etf", "gold demand", "central bank gold"],
};

const HIGH_IMPACT_EVENTS = [
  { name: "FOMC Meeting", pattern: /fomc|rate decision|fed meeting/i, typicalVol: "extreme" },
  { name: "CPI Release", pattern: /cpi|consumer price/i, typicalVol: "high" },
  { name: "NFP Release", pattern: /nonfarm|nfp|payroll/i, typicalVol: "high" },
  { name: "Powell Speech", pattern: /powell.*speak|powell.*testif|powell.*press/i, typicalVol: "high" },
  { name: "GDP Release", pattern: /gdp.*release|gdp.*report/i, typicalVol: "medium" },
];

function classifyRelevance(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  const matchCount = GOLD_KEYWORDS.filter(kw => text.includes(kw)).length;
  if (matchCount >= 3) return "direct";
  if (matchCount >= 1) return "indirect";
  return "ignore";
}

function classifyCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  let bestCategory = "General";
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > bestScore) { bestScore = score; bestCategory = cat; }
  }
  return bestCategory;
}

function simpleSentiment(text: string): { score: number; goldImpact: string; confidence: number } {
  const lower = text.toLowerCase();
  const bullishWords = ["surge", "rally", "gain", "rise", "bullish", "support", "boost", "safe haven", "demand", "buy", "hawk", "inflation up", "dollar weak", "yields fall", "cut rates", "dovish", "geopolitical tension", "war", "conflict", "crisis", "uncertainty"];
  const bearishWords = ["fall", "drop", "decline", "bearish", "sell", "pressure", "dollar strong", "yields rise", "rate hike", "hawkish", "risk-on", "optimism", "recovery", "growth", "strong dollar", "fed tight"];

  let bullScore = 0, bearScore = 0;
  for (const w of bullishWords) { if (lower.includes(w)) bullScore++; }
  for (const w of bearishWords) { if (lower.includes(w)) bearScore++; }

  const total = bullScore + bearScore;
  if (total === 0) return { score: 0, goldImpact: "neutral", confidence: 2 };

  const score = (bullScore - bearScore) / total;
  const goldImpact = score > 0.2 ? "bullish" : score < -0.2 ? "bearish" : "neutral";
  const confidence = Math.min(10, 3 + total);
  return { score: Math.round(score * 100) / 100, goldImpact, confidence };
}

function detectEventType(title: string): { type: string; event: string | null; urgency: string } {
  for (const evt of HIGH_IMPACT_EVENTS) {
    if (evt.pattern.test(title)) {
      return { type: "scheduled", event: evt.name, urgency: evt.typicalVol };
    }
  }
  const crisisWords = /war|crisis|attack|invasion|bank failure|crash|emergency/i;
  if (crisisWords.test(title)) return { type: "unexpected", event: "Geopolitical/Financial Flash", urgency: "high" };
  return { type: "routine", event: null, urgency: "low" };
}

async function fetchRSSFeed(url: string): Promise<{ title: string; description: string; pubDate: string; link: string }[]> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok) return [];
    const text = await response.text();
    const items: { title: string; description: string; pubDate: string; link: string }[] = [];
    const itemRegex = /<item[\s\S]*?<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const item = match[0];
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
      const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/i);
      const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/i);
      const linkMatch = item.match(/<link>(.*?)<\/link>/i);
      if (titleMatch) {
        items.push({
          title: (titleMatch[1] || titleMatch[2] || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
          description: (descMatch?.[1] || descMatch?.[2] || "").replace(/&amp;/g, "&"),
          pubDate: dateMatch?.[1] || "",
          link: linkMatch?.[1] || "",
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchFearGreedIndex(): Promise<number | null> {
  try {
    const response = await fetch("https://api.alternative.me/fng/?limit=1");
    if (!response.ok) return null;
    const data = await response.json();
    return parseInt(data?.data?.[0]?.value || "0");
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const feeds = [
      "https://www.reuters.com/rssFeed/businessNews",
      "https://www.reuters.com/rssFeed/worldNews",
      "https://feeds.feedburner.com/ForexLive",
    ];

    const allArticles: any[] = [];
    for (const feed of feeds) {
      const items = await fetchRSSFeed(feed);
      allArticles.push(...items);
    }

    const processedArticles = allArticles
      .map(article => {
        const relevance = classifyRelevance(article.title, article.description);
        if (relevance === "ignore") return null;
        const category = classifyCategory(article.title, article.description);
        const sentiment = simpleSentiment(`${article.title} ${article.description}`);
        const eventType = detectEventType(article.title);
        return {
          title: article.title,
          category,
          relevance,
          sentiment_score: sentiment.score,
          gold_impact: sentiment.goldImpact,
          urgency: eventType.urgency,
          confidence: sentiment.confidence,
          event_type: eventType.type,
          event_name: eventType.event,
          published: article.pubDate,
          link: article.link,
        };
      })
      .filter(Boolean)
      .slice(0, 50);

    // Aggregate sentiment
    const relevantArticles = processedArticles.filter(a => a.relevance !== "ignore");
    const avgSentiment = relevantArticles.length > 0
      ? relevantArticles.reduce((sum, a) => sum + a.sentiment_score, 0) / relevantArticles.length
      : 0;

    const bullishCount = relevantArticles.filter(a => a.gold_impact === "bullish").length;
    const bearishCount = relevantArticles.filter(a => a.gold_impact === "bearish").length;

    // High impact alerts
    const highImpactAlerts = processedArticles
      .filter(a => a.urgency === "high" || a.urgency === "extreme")
      .map(a => ({ title: a.title, event: a.event_name, urgency: a.urgency }));

    // Fear & Greed Index
    const fngIndex = await fetchFearGreedIndex();

    // Fakeout warning: when news sentiment contradicts recent price action
    const fakeoutWarning = Math.abs(avgSentiment) > 0.5 && relevantArticles.length < 3;

    const result = {
      articles: processedArticles,
      aggregated: {
        sentiment_score: Math.round(avgSentiment * 100) / 100,
        sentiment_label: avgSentiment > 0.2 ? "bullish" : avgSentiment < -0.2 ? "bearish" : "neutral",
        news_volume: relevantArticles.length,
        bullish_articles: bullishCount,
        bearish_articles: bearishCount,
        neutral_articles: relevantArticles.length - bullishCount - bearishCount,
      },
      high_impact_alerts: highImpactAlerts,
      fear_greed_index: fngIndex,
      fakeout_warning: fakeoutWarning,
      timestamp: new Date().toISOString(),
    };

    // Store
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from("analysis_snapshots").insert({
      analysis_type: "news_sentiment",
      data: result,
      confidence_score: relevantArticles.length > 5 ? 70 : 40,
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
