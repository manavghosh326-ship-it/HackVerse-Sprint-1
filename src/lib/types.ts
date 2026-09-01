export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';

export interface Stock {
  ticker: string;
  company_name: string;
  sector: string;
  market_cap: number | null;
  description: string | null;
}

export interface PriceData {
  id: string;
  ticker: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  avg_volume_20d: number | null;
}

export interface NewsItem {
  id: string;
  ticker: string;
  headline: string;
  source: string;
  published_at: string;
  sentiment_hint: string | null;
}

export interface Filing {
  id: string;
  ticker: string;
  filing_type: string;
  filing_date: string;
  excerpt: string;
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  created_at: string;
  stocks?: Stock;
}

export interface AgentRun {
  id: string;
  session_id: string;
  agent_name: string;
  signal: string;
  confidence: number;
  reasoning: string;
  sources: any;
  latency_ms: number | null;
  created_at: string;
}

export interface SessionMetric {
  id: string;
  session_id: string;
  metric_name: string;
  metric_value: number;
  created_at: string;
}

export interface AnalysisSession {
  id: string;
  ticker: string;
  risk_profile: string;
  final_recommendation: FinalRecommendation | null;
  feed_outage: boolean;
  created_at: string;
}

export interface FinalRecommendation {
  recommendation: string;
  confidence: number;
  reasoning: string;
  agents: {
    agent_name: string;
    signal: string;
    confidence: number;
  }[];
}

export interface AgentResult {
  agent_name: string;
  signal: string;
  confidence: number;
  reasoning: string;
  sources: any;
  latency_ms: number;
}

export interface AnalysisResponse {
  session_id: string;
  ticker: string;
  risk_profile: string;
  feed_outage: boolean;
  agents: AgentResult[];
  synthesis: FinalRecommendation;
  metrics: { session_id: string; metric_name: string; metric_value: number }[];
}
