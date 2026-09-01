/*
# MarketMind — Full Schema Creation

## Overview
Creates the complete database schema for MarketMind, a multi-agent investment
intelligence app for retail investors. Eight tables with pgvector for RAG-based
fundamentals retrieval, full RLS policies, and seed data.

## Tables Created
1. stocks — ticker master data (public read)
2. price_data — daily OHLCV (public read)
3. filings — SEC excerpts with 768-dim embeddings for RAG (public read)
4. news — headlines for sentiment (public read)
5. watchlist — user watchlist (owner-scoped)
6. sessions — analysis sessions (owner-scoped)
7. agent_runs — agent execution logs (owner-scoped)
8. session_metrics — computed metrics (owner-scoped)

## Security
- Public read: stocks, price_data, filings, news (SELECT to anon, authenticated)
- Owner-scoped: watchlist, sessions, agent_runs, session_metrics (CRUD to authenticated, auth.uid() = user_id)
- All owner-scoped tables have user_id DEFAULT auth.uid()

## Seed Data
- 5 stocks, 15 days price data each, 3 filings each (with placeholder embeddings), 4-5 news each

## Notes
1. vector extension enabled for embeddings
2. vector(768) matches Gemini gemini-embedding-001 outputDimensionality
3. A helper function gen_random_vector_768() creates placeholder embeddings
*/

CREATE EXTENSION IF NOT EXISTS vector;

-- Helper: generate a random 768-dim vector (placeholder embeddings)
CREATE OR REPLACE FUNCTION gen_random_vector_768()
RETURNS vector
LANGUAGE sql
AS $$
  SELECT array_agg(random() * 0.1)::vector(768)
  FROM generate_series(1, 768);
$$;

-- ============================================
-- 1. stocks
-- ============================================
CREATE TABLE IF NOT EXISTS stocks (
  ticker TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  sector TEXT NOT NULL,
  market_cap BIGINT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_stocks" ON stocks;
CREATE POLICY "public_read_stocks" ON stocks FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================
-- 2. price_data
-- ============================================
CREATE TABLE IF NOT EXISTS price_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
  date DATE NOT NULL,
  open NUMERIC(12,2) NOT NULL,
  high NUMERIC(12,2) NOT NULL,
  low NUMERIC(12,2) NOT NULL,
  close NUMERIC(12,2) NOT NULL,
  volume BIGINT NOT NULL,
  avg_volume_20d BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ticker, date)
);
ALTER TABLE price_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_price_data" ON price_data;
CREATE POLICY "public_read_price_data" ON price_data FOR SELECT
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_price_data_ticker_date ON price_data(ticker, date DESC);

-- ============================================
-- 3. filings
-- ============================================
CREATE TABLE IF NOT EXISTS filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
  filing_type TEXT NOT NULL,
  filing_date DATE NOT NULL,
  excerpt TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE filings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_filings" ON filings;
CREATE POLICY "public_read_filings" ON filings FOR SELECT
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_filings_ticker ON filings(ticker);

-- ============================================
-- 4. news
-- ============================================
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  source TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  sentiment_hint TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_news" ON news;
CREATE POLICY "public_read_news" ON news FOR SELECT
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_news_ticker_date ON news(ticker, published_at DESC);

-- ============================================
-- 5. watchlist
-- ============================================
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ticker)
);
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_watchlist" ON watchlist;
CREATE POLICY "select_own_watchlist" ON watchlist FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_watchlist" ON watchlist;
CREATE POLICY "insert_own_watchlist" ON watchlist FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_watchlist" ON watchlist;
CREATE POLICY "delete_own_watchlist" ON watchlist FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- 6. sessions
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL REFERENCES stocks(ticker),
  risk_profile TEXT NOT NULL DEFAULT 'moderate',
  final_recommendation JSONB,
  feed_outage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_sessions" ON sessions;
CREATE POLICY "select_own_sessions" ON sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_sessions" ON sessions;
CREATE POLICY "insert_own_sessions" ON sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_sessions" ON sessions;
CREATE POLICY "update_own_sessions" ON sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_sessions" ON sessions;
CREATE POLICY "delete_own_sessions" ON sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON sessions(user_id, created_at DESC);

-- ============================================
-- 7. agent_runs
-- ============================================
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  signal TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 0,
  reasoning TEXT,
  sources JSONB,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_agent_runs" ON agent_runs;
CREATE POLICY "select_own_agent_runs" ON agent_runs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_agent_runs" ON agent_runs;
CREATE POLICY "insert_own_agent_runs" ON agent_runs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_agent_runs" ON agent_runs;
CREATE POLICY "delete_own_agent_runs" ON agent_runs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_session ON agent_runs(session_id);

-- ============================================
-- 8. session_metrics
-- ============================================
CREATE TABLE IF NOT EXISTS session_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC(12,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE session_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_session_metrics" ON session_metrics;
CREATE POLICY "select_own_session_metrics" ON session_metrics FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_session_metrics" ON session_metrics;
CREATE POLICY "insert_own_session_metrics" ON session_metrics FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_session_metrics" ON session_metrics;
CREATE POLICY "delete_own_session_metrics" ON session_metrics FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_session ON session_metrics(session_id);

-- ============================================
-- SEED: Stocks
-- ============================================
INSERT INTO stocks (ticker, company_name, sector, market_cap, description) VALUES
  ('AAPL', 'Apple Inc.', 'Technology', 3400000000000, 'Designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories.'),
  ('NVDA', 'NVIDIA Corporation', 'Semiconductors', 3100000000000, 'Provides graphics, compute and networking solutions for gaming, data centers, and AI.'),
  ('TSLA', 'Tesla, Inc.', 'Automotive', 780000000000, 'Designs, develops, manufactures, and sells electric vehicles, energy generation, and storage systems.'),
  ('MSFT', 'Microsoft Corporation', 'Technology', 3000000000000, 'Develops, licenses, and supports software, services, devices, and solutions worldwide.'),
  ('GOOGL', 'Alphabet Inc.', 'Communication Services', 2100000000000, 'Parent company of Google, providing online advertising, cloud computing, search, and AI services.')
ON CONFLICT (ticker) DO NOTHING;

-- ============================================
-- SEED: Price data (15 days per stock)
-- ============================================
DO $$
DECLARE
  t TEXT; base_close NUMERIC; base_vol BIGINT;
  d INTEGER; cur_date DATE; cur_close NUMERIC; cur_vol BIGINT; avg_vol BIGINT;
  change_pct NUMERIC;
BEGIN
  FOR t, base_close, base_vol IN
    SELECT ticker, close, volume FROM (VALUES
      ('AAPL', 195.00, 55000000),
      ('NVDA', 880.00, 42000000),
      ('TSLA', 245.00, 95000000),
      ('MSFT', 420.00, 23000000),
      ('GOOGL', 165.00, 28000000)
    ) AS v(ticker, close, volume)
  LOOP
    cur_close := base_close;
    cur_date := CURRENT_DATE - 15;
    FOR d IN 0..14 LOOP
      change_pct := (random() - 0.48) * 0.05;
      cur_close := ROUND((cur_close * (1 + change_pct))::numeric, 2);
      cur_vol := base_vol + FLOOR((random() - 0.5) * base_vol * 0.4)::bigint;
      avg_vol := base_vol + FLOOR((random() - 0.5) * base_vol * 0.15)::bigint;
      INSERT INTO price_data (ticker, date, open, high, low, close, volume, avg_volume_20d)
      VALUES (
        t, cur_date,
        ROUND((cur_close * (1 - (random() * 0.01)))::numeric, 2),
        ROUND((cur_close * (1 + (random() * 0.015)))::numeric, 2),
        ROUND((cur_close * (1 - (random() * 0.015)))::numeric, 2),
        cur_close, cur_vol, avg_vol
      ) ON CONFLICT (ticker, date) DO NOTHING;
      cur_date := cur_date + 1;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- SEED: Filings with placeholder embeddings
-- ============================================
INSERT INTO filings (ticker, filing_type, filing_date, excerpt, embedding) VALUES
  ('AAPL', '10-K', '2024-11-01', 'Apple reported total net sales of $383.3 billion for fiscal 2024, a decline of 2.8% year-over-year. iPhone revenue was $201.2 billion, representing 52.5% of total revenue. Services revenue reached $96.2 billion, growing 12.9% and now contributing 25.1% of total net sales. Gross margin improved to 46.2% from 44.1% in fiscal 2023, driven by a favorable product mix and leverage from Services. The company maintained a strong cash position of $65.2 billion and generated $118.3 billion in operating cash flow. Research and development expenses increased to $31.4 billion, reflecting investments in AI and silicon engineering. Risk factors include supply chain concentration, geopolitical tensions affecting manufacturing in China, and regulatory scrutiny over App Store practices.', gen_random_vector_768()),
  ('AAPL', '10-Q', '2024-08-01', 'For the third quarter of fiscal 2024, Apple posted revenue of $85.8 billion, up 5% year-over-year, beating consensus estimates. EPS was $1.40, an all-time Q3 record. iPhone revenue was $39.3 billion, reflecting strong demand for iPhone 15 lineup. Services achieved a quarterly revenue record of $24.2 billion. iPad revenue was $7.2 billion following the launch of new iPad Pro with M4 chip. The company repurchased $34 billion of common stock during the quarter. Management guided for low-to-mid single digit revenue growth in Q4. Gross margin guidance was 45.5-46.5%. Apple Intelligence, the companys AI platform, is expected to drive an upgrade super cycle in fiscal 2025.', gen_random_vector_768()),
  ('AAPL', '10-K', '2023-11-03', 'Apple reported fiscal 2023 total net sales of $383.3 billion, down 2.8% from 2022. Products revenue was $285.5 billion, declining 4.4% due to macroeconomic headwinds and foreign exchange. Services set an all-time revenue record of $85.2 billion, up 9.1%. Operating margin was 30.1%, near the high end of guidance. The installed base of active devices reached a new all-time high across all product categories. Capital expenditures were $10.9 billion, focused on data center expansion for Services and AI. The Board authorized an additional $90 billion share buyback program. Key risk factors include China dependency for assembly, antitrust legislation in the EU targeting App Store fees, and component shortages for advanced semiconductors.', gen_random_vector_768()),
  ('NVDA', '10-K', '2025-01-26', 'NVIDIA reported record annual revenue of $130.5 billion for fiscal 2025, up 114% from $60.9 billion in fiscal 2024. Data Center revenue was $115.2 billion, representing 88% of total revenue and growing 142% year-over-year, driven by unprecedented demand for H100, H200, and Blackwell GPUs for AI training and inference. Gaming revenue was $11.1 billion, up 11%. Gross margin expanded to 75.1% from 72.7%, reflecting favorable product mix toward data center. Operating income was $81.4 billion with operating margin of 62.4%. The company generated $64.1 billion in free cash flow. R&D investment was $12.3 billion, focused on next-generation Rubin architecture and CUDA ecosystem expansion. Risk factors include cyclicality in AI infrastructure spending, competition from custom silicon (ASICs) by hyperscalers, export controls on advanced GPUs to China, and supply chain dependency on TSMC for manufacturing.', gen_random_vector_768()),
  ('NVDA', '10-Q', '2024-11-20', 'For the third quarter of fiscal 2025, NVIDIA reported revenue of $35.1 billion, up 94% year-over-year and exceeding guidance of $32.5 billion. Data Center revenue was $30.8 billion, driven by strong demand for Hopper and initial Blackwell shipments. Gross margin was 75.2%, above the guided range of 73.5-74.5%. EPS was $0.81, up 111% YoY. The company guided Q4 revenue to $37.5 billion, plus or minus 2%. Management noted supply constraints on Blackwell GPUs, with demand exceeding supply for several quarters ahead. The CUDA software ecosystem now has over 5 million registered developers. Key risks include potential inventory correction if AI capex slows, U.S. export restriction impacts estimated at $2.5 billion quarterly, and increasing competition from AMD MI400 and custom ASICs.', gen_random_vector_768()),
  ('NVDA', '10-K', '2024-02-21', 'NVIDIA achieved fiscal 2024 revenue of $60.9 billion, more than doubling from $26.9 billion in fiscal 2023. Data Center revenue was $47.5 billion, up 217%, fueled by the AI revolution and generative AI adoption across industries. The company introduced the H100 GPU and announced Blackwell architecture for fiscal 2025. Gross margin was 72.7%, a significant increase from 56.9%, reflecting the high value of data center products. Operating income reached $32.9 billion. Free cash flow was $27.1 billion. The company returned $9.5 billion to shareholders via buybacks. Risk factors highlighted include customer concentration risk with top 4 customers representing over 40% of data center revenue, geopolitical risks including U.S.-China trade tensions, potential for AI infrastructure spending to decelerate, and dependence on TSMC for advanced manufacturing.', gen_random_vector_768()),
  ('TSLA', '10-K', '2025-01-30', 'Tesla reported full year 2024 revenue of $97.7 billion, a 1% increase from 2023. Automotive revenue was $77.1 billion, declining 6% due to reduced average selling prices and competitive pressure. Energy storage revenue reached $10.1 billion, growing 67% with deployments of 31.4 GWh. Total vehicle deliveries were 1.79 million, below the target of 2 million. The Model Y remained the best-selling vehicle globally. Operating margin compressed to 6.2% from 9.2% in 2023, reflecting price cuts and factory ramp costs. Free cash flow was $3.6 billion. The company announced the Cybercab robotaxi targeting production in 2026. Risk factors include intensifying EV competition from Chinese manufacturers, regulatory uncertainty for autonomous driving, raw material price volatility for battery cells, and potential delays in FSD regulatory approval.', gen_random_vector_768()),
  ('TSLA', '10-Q', '2024-10-23', 'For Q3 2024, Tesla reported revenue of $25.2 billion, up 8% year-over-year. Automotive gross margin improved to 17.1% from 14.3% in Q2, driven by cost reductions and carbon credit revenue. Energy storage deployed 6.9 GWh, a quarterly record. Operating income was $2.7 billion with operating margin of 10.8%. The company reaffirmed guidance for vehicle volume growth in 2025 and announced plans for a more affordable vehicle model in 2025. FSD (Supervised) miles driven surpassed 2 billion. Management noted that energy storage gross margin per gigawatt-hour is improving significantly. Key risks include potential demand softness from high interest rates, competition from BYD and NIO in China, and dependency on government subsidies for energy storage growth.', gen_random_vector_768()),
  ('TSLA', '10-K', '2024-01-29', 'Tesla reported 2023 revenue of $96.8 billion, up 19% from 2022. Vehicle production was 1.85 million, up 35%. Deliveries were 1.81 million. Automotive gross margin was 18.9% excluding carbon credits, down from 28.5% in 2022 due to significant price cuts throughout the year. Energy storage deployments were 14.7 GWh, up 125%. Solar deployment was 223 MW. Free cash flow was $4.4 billion. The company began deliveries of the updated Model 3 (Highland) and started Cybertruck deliveries in late 2023. Risk factors include increasing competition in the EV market, potential for further price reductions, supply chain risks for lithium and battery components, regulatory hurdles for FSD, and macroeconomic headwinds from high interest rates affecting auto financing costs.', gen_random_vector_768()),
  ('MSFT', '10-K', '2024-07-30', 'Microsoft reported fiscal 2024 revenue of $245.1 billion, up 16% year-over-year. Intelligent Cloud revenue was $105.2 billion, growing 21%, with Azure and other cloud services revenue up 29%. Productivity and Business Processes (Office, LinkedIn, Dynamics) was $77.7 billion, up 12%. More Personal Computing (Windows, Devices, Gaming) was $62.2 billion, up 13%, boosted by Activision Blizzard acquisition. Operating income was $109.4 billion with operating margin of 44.7%. Microsoft Cloud revenue surpassed $135 billion annualized. Capital expenditures were $55.7 billion, primarily for AI datacenter infrastructure. The company partnered with OpenAI and launched Copilot across its product suite. Risk factors include competition from AWS and Google Cloud, regulatory scrutiny of AI and cloud practices, cybersecurity threats, and capital intensity of AI infrastructure investment.', gen_random_vector_768()),
  ('MSFT', '10-Q', '2024-10-30', 'For Q1 of fiscal 2025, Microsoft reported revenue of $65.6 billion, up 16% year-over-year. Azure revenue grew 33%, accelerating from 29% in the prior quarter and above consensus of 31%. Microsoft Cloud revenue was $38.9 billion, up 22%. Office 365 commercial revenue grew 16%. EPS was $3.09, up 10%. Capital expenditures were $20.0 billion for the quarter, with $15 billion for AI datacenter infrastructure. Management guided Azure growth of 31-32% for Q2, noting that demand exceeds available capacity. AI contribution to Azure growth was 12 points, up from 8 points in the prior quarter. Copilot for Microsoft 365 seat count doubled quarter-over-quarter. Key risks include high capex intensity potentially pressuring margins, supply constraints for AI GPUs, and competition from Google Cloud and AWS in the AI platform space.', gen_random_vector_768()),
  ('MSFT', '10-K', '2023-07-27', 'Microsoft reported fiscal 2023 revenue of $211.9 billion, up 7% from fiscal 2022. Intelligent Cloud revenue was $87.9 billion, growing 17%, with Azure growing 27%. Productivity and Business Processes was $69.3 billion, up 9%. More Personal Computing was $54.7 billion, down 3% due to PC market weakness. Operating income was $88.5 billion with operating margin of 41.8%. The company announced a multi-billion dollar investment in OpenAI and began integrating GPT-4 across products. Capital expenditures were $43.9 billion. Free cash flow was $63.3 billion. Risk factors include macroeconomic uncertainty impacting IT spending, competition in cloud from AWS and Google, antitrust scrutiny of cloud and productivity software, and cybersecurity threats following high-profile attacks on Exchange Server and other products.', gen_random_vector_768()),
  ('GOOGL', '10-K', '2025-01-29', 'Alphabet reported 2024 revenue of $350.0 billion, up 14% from 2023. Google Search revenue was $198.0 billion, up 11%. YouTube advertising was $31.5 billion, up 9%. Google Cloud revenue was $43.2 billion, growing 31% and achieving full-year profitability. Other Bets revenue was $1.6 billion. Operating income was $112.4 billion with operating margin of 32.1%. The company announced $75 billion in share buyback authorization. Capital expenditures were $52.0 billion, primarily for AI infrastructure including Tensor Processing Units (TPUs). Gemini AI models were integrated across Search, Workspace, and Cloud. Risk factors include antitrust enforcement actions, competition from Microsoft-backed OpenAI in search, regulatory pressure on ad-tech business model, and AI-related risks including model hallucination and responsible AI concerns.', gen_random_vector_768()),
  ('GOOGL', '10-Q', '2024-10-29', 'For Q3 2024, Alphabet reported revenue of $88.3 billion, up 15% year-over-year. Google Search revenue was $49.7 billion, up 12%. YouTube ad revenue was $8.9 billion, up 12%. Google Cloud revenue was $11.4 billion, up 35% with operating income of $1.95 billion. Total operating income was $28.3 billion with operating margin of 32%. EPS was $1.64, beating estimates. Capital expenditures were $13.1 billion for the quarter. Management highlighted strong traction with Gemini Enterprise and Vertex AI, with Cloud backlog at a record level. The company launched AI-powered search overviews, now reaching over 1 billion users monthly. Key risks include DOJ antitrust ruling potentially requiring business model changes, competition from AI-native search alternatives, and high capital intensity of AI investment pressuring free cash flow.', gen_random_vector_768()),
  ('GOOGL', '10-K', '2024-01-31', 'Alphabet reported 2023 revenue of $307.4 billion, up 9% from 2022. Google Search was $175.0 billion, up 8%. YouTube ads was $31.5 billion, up 8%. Google Cloud was $33.1 billion, up 26%, reaching profitability for the first time. Operating income was $84.3 billion with operating margin of 27.4%. The company announced workforce reductions of 12,000 roles in early 2023 and continued office space optimization. Capital expenditures were $32.3 billion. The company launched Gemini, its most capable AI model, in December 2023. Risk factors include antitrust litigation from DOJ regarding search defaults, competition in cloud from AWS and Azure, AI competition from OpenAI and Microsoft, and regulatory pressure in EU on data practices and ad-tech.', gen_random_vector_768())
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED: News
-- ============================================
INSERT INTO news (ticker, headline, source, published_at, sentiment_hint) VALUES
  ('AAPL', 'Apple Intelligence launch drives record iPhone upgrade interest, analysts say', 'Bloomberg', NOW() - INTERVAL '2 days', 'positive'),
  ('AAPL', 'Apple faces EU antitrust probe over App Store compliance with Digital Markets Act', 'Reuters', NOW() - INTERVAL '5 days', 'negative'),
  ('AAPL', 'Apple Services revenue hits all-time high as subscription growth accelerates', 'CNBC', NOW() - INTERVAL '1 day', 'positive'),
  ('AAPL', 'Apple supplier Foxconn reports manufacturing delays in China', 'Wall Street Journal', NOW() - INTERVAL '7 days', 'negative'),
  ('AAPL', 'Apple expands Vision Pro to international markets amid mixed adoption signals', 'The Verge', NOW() - INTERVAL '3 days', 'neutral'),
  ('NVDA', 'NVIDIA Blackwell GPU orders outpace supply by 3x, cloud providers scramble', 'Bloomberg', NOW() - INTERVAL '1 day', 'positive'),
  ('NVDA', 'NVIDIA faces new U.S. export restrictions on AI chips to Middle East countries', 'Reuters', NOW() - INTERVAL '4 days', 'negative'),
  ('NVDA', 'NVIDIA announces partnership with Toyota for autonomous driving AI platform', 'CNBC', NOW() - INTERVAL '2 days', 'positive'),
  ('NVDA', 'Hyperscalers ramp custom AI silicon development, challenging NVIDIA pricing power', 'Wall Street Journal', NOW() - INTERVAL '6 days', 'negative'),
  ('NVDA', 'NVIDIA GTC 2025 unveils Rubin architecture with 3x performance over Blackwell', 'TechCrunch', NOW() - INTERVAL '3 days', 'positive'),
  ('TSLA', 'Tesla vehicle deliveries miss estimates as competition intensifies in China', 'Bloomberg', NOW() - INTERVAL '2 days', 'negative'),
  ('TSLA', 'Tesla Energy storage deployments hit record quarterly high, grid business surges', 'Reuters', NOW() - INTERVAL '1 day', 'positive'),
  ('TSLA', 'Tesla FSD regulatory approval delayed by NHTSA safety investigation', 'CNBC', NOW() - INTERVAL '5 days', 'negative'),
  ('TSLA', 'Tesla announces affordable model launch for mid-2025 at $30,000 price point', 'Electrek', NOW() - INTERVAL '3 days', 'positive'),
  ('TSLA', 'Tesla robotaxi event underwhelms investors with vague timeline and no revenue plan', 'Bloomberg', NOW() - INTERVAL '6 days', 'negative'),
  ('MSFT', 'Microsoft Azure AI revenue growth accelerates as enterprise Copilot adoption surges', 'Bloomberg', NOW() - INTERVAL '1 day', 'positive'),
  ('MSFT', 'Microsoft faces EU probe over cloud licensing practices and bundling concerns', 'Reuters', NOW() - INTERVAL '4 days', 'negative'),
  ('MSFT', 'Microsoft Activision integration delivers strong gaming revenue growth', 'CNBC', NOW() - INTERVAL '2 days', 'positive'),
  ('MSFT', 'Microsoft warns of AI datacenter capacity constraints limiting cloud growth', 'Wall Street Journal', NOW() - INTERVAL '5 days', 'negative'),
  ('GOOGL', 'Google Cloud revenue growth accelerates as enterprise AI demand surges', 'Bloomberg', NOW() - INTERVAL '1 day', 'positive'),
  ('GOOGL', 'DOJ antitrust ruling could force Google to divest Chrome browser, analysts warn', 'Reuters', NOW() - INTERVAL '3 days', 'negative'),
  ('GOOGL', 'Google Gemini Enterprise sees rapid enterprise adoption, challenging Microsoft Copilot', 'CNBC', NOW() - INTERVAL '2 days', 'positive'),
  ('GOOGL', 'Google Search ad revenue faces pressure from AI-powered search alternatives', 'Wall Street Journal', NOW() - INTERVAL '5 days', 'negative'),
  ('GOOGL', 'Alphabet announces $70 billion buyback, signals confidence in AI investment returns', 'Bloomberg', NOW() - INTERVAL '4 days', 'positive')
ON CONFLICT DO NOTHING;
