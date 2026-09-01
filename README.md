# MarketMind

**A multi-agent AI system that turns real-time market data, regulatory filings, and behavioral signals into explainable, personalized investment intelligence for retail investors.**

Built for HackVerse: Into the Web — IEEE RAS, VIT Chennai (TechnoVIT 2026).

---

## What It Does

MarketMind analyzes a stock from three independent angles and synthesizes them into a single, explainable recommendation tailored to the investor's risk profile.

- **Technical Agent** — classifies price/volume behavior as Bullish, Bearish, or Neutral with a confidence score and plain-language reasoning.
- **Sentiment Agent** — reads recent news headlines and classifies overall sentiment, citing which headlines drove the call.
- **Fundamentals Agent (RAG)** — answers strictly from retrieved excerpts of filings and earnings reports, citing sources for every claim, and explicitly says when something isn't covered rather than guessing.
- **Synthesis Layer** — weighs all three agents against each other and the user's risk profile (Conservative / Moderate / Aggressive), producing one recommendation with visible reasoning — so the same market data can lead to different advice for different investors.

The app also simulates a **feed outage** to show it degrades gracefully instead of fabricating data when a data source goes down, and logs performance metrics per session.

---

## Screens

| Screen | Purpose |
|---|---|
| **Dashboard** | Watchlist, add/remove tickers, risk profile shown in header |
| **Analyze** | Pick a ticker, run analysis, toggle simulated feed outage, view synthesis + all 3 agent outputs |
| **Session History** | Past analysis sessions with an expandable trace of what each agent said |
| **Metrics** | Session-level performance metrics |

---

## Architecture

```
Frontend (React + Vite + TypeScript, Tailwind)
        │
        ▼
Supabase (Postgres + Auth + Edge Functions)
        │
        ├── stocks, price_data, filings, news        (seeded market data — public read)
        ├── watchlist, sessions, agent_runs,
        │   session_metrics                          (per-user, protected by RLS)
        │
        └── Edge Function: /analyze
                │
                ▼
        Gemini API (gemini-3.5-flash-lite)
                │
        ┌───────┼────────────┬─────────────┐
        ▼       ▼             ▼             ▼
   Technical  Sentiment  Fundamentals   Synthesis
     Agent      Agent    Agent (RAG)      Layer
                              │
                              ▼
                   gemini-embedding-001
                 (vector(768) similarity search
                  over embedded filing chunks)
```

Row-Level Security ensures each user only sees their own watchlist, sessions, agent runs, and metrics. Market data tables (stocks, prices, filings, news) are public-read since they're shared reference data.

---

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Edge Functions, Row-Level Security)
- **AI:** Google Gemini API
  - Reasoning: `gemini-3.5-flash-lite`
  - Embeddings: `gemini-embedding-001` (768 dimensions, sequential calls to respect rate limits)
- **RAG:** pgvector similarity search over embedded filing/earnings excerpts with source-level attribution

---

## AI Tools Used in Building This

- **Bolt.new** — primary AI app builder used to scaffold the schema, screens, auth, and edge functions
- **Google AI Studio** — used to design and iteratively test the three agent prompts (Technical, Sentiment, Fundamentals) before wiring them into the app
- **Gemini API** — powers the actual in-app agent reasoning, sentiment analysis, RAG-grounded fundamentals, and synthesis
- **Claude** — used for debugging (auth flow issues, Supabase CLI/deploy problems, Gemini model deprecation fix) and repo/Git workflow support

---

## Getting Started

```bash
npm install
npm run dev
```

Create a `.env` file at the project root with:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
```

Sign up with any email/password on first load, pick a risk profile, add a ticker to your watchlist, and run an analysis from the Analyze screen.

---

## Notes for Judges

- Seeded data uses US tickers (AAPL, NVDA, TSLA, MSFT, GOOGL) with synthetic filings/news for demo purposes.
- Toggle **"Simulate Feed Outage"** on the Analyze screen to see the Sentiment Agent report "Unavailable" and the Synthesis layer explicitly flag reduced confidence — rather than inventing a signal.
- Fundamentals Agent citations depend on which filings have been embedded; if a claim isn't grounded, it will say so explicitly instead of guessing.

