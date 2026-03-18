# AI Integration Roadmap

## Overview

The congressional trade data is uniquely well-suited for AI integrations. We have committee membership,
hearing records, filing lag data, return calculations, and ~19K trades — a combination that enables
insights no generic financial tool can produce.

---

## ✅ Priority 1: AI Suspicion Score — SHIPPED

Score every trade 1–10 on how "suspicious" it looks based on signals already in the database.

### Signals (rule-based, no LLM)
- **Committee-sector overlap** — does the politician sit on a committee that oversees the traded sector? (+3)
- **Late filing** — filed after the 45-day STOCK Act deadline? (+3) or >30 days? (+1)
- **Near committee hearing** — traded within 30 days of a relevant committee hearing? (+2)
- **Large amount** — $500K+? (+1)
- **Options trade** — higher information asymmetry? (+1)

### Output
A color-coded badge (Low / Moderate / Elevated / High) with a tooltip breaking down the flags,
displayed on every trade row in the politician profile trade history table.

### Implementation
- `suspicion_score` (int) and `suspicion_flags` (JSON text) columns on the `trades` table (migration 0010)
- `backend/app/services/suspicion.py` — pure rule-based scorer, no API calls
- `backend/app/services/suspicion.py::score_unscored_trades` — bulk-scores all unscored trades at startup
- `frontend/components/suspicion-badge.tsx` — badge component with tooltip
- Suspicion column is sortable in the trade history table (↑↓ arrows)

---

## ✅ Priority 2: AI Politician Trading Summary — SHIPPED

On each politician profile, an AI-written plain English paragraph summarizing their trading patterns.

### Example Output
> *"Rep. Sessions engaged in 12 equity trades totaling approximately $255K between May 2024 and
> March 2026, consisting of 5 purchases and 7 sales with no options activity. NVIDIA dominated his
> trading activity with 4 transactions. His filing compliance was exemplary, with all trades disclosed
> within the required 45-day STOCK Act window and an average lag of just 2 days."*

### Implementation
- `backend/app/services/ai_summary.py` — builds context from DB, calls `claude-haiku-4-5-20251001`
- `backend/app/api/ai.py` — `GET /ai/politicians/{id}/summary` endpoint
- Redis cache with 7-day TTL — summary generated on first visit, served instantly thereafter
- `frontend/app/api/politician-summary/route.ts` — Next.js proxy route handler
- `frontend/components/politician-dashboard.tsx` — collapsible "AI Trading Profile" card, top-right column
- Styled with violet/indigo gradient border, glow shadow, and ✦ sparkle — visually distinct from data cards
- Graceful fallback: section hidden if API key not set or generation fails

### Notes
- Uses `truststore` + `AsyncAnthropic` + `httpx.AsyncClient` to handle macOS/corporate SSL inspection (Cisco)
- `ANTHROPIC_API_KEY` must be set in `backend/.env`

---

## Priority 3: Natural Language Q&A — "Ask the Data"

A chat interface where users can ask questions in plain English and get data-backed answers.

### Example Queries
- *"Which senators bought defense stocks before the Ukraine aid bill?"*
- *"Who has the worst STOCK Act compliance record?"*
- *"Show me all trades by Banking Committee members in financial stocks"*
- *"Is anyone on the Intelligence Committee trading semiconductor stocks?"*

### Why it's valuable
- Highest "wow factor" — most demo-able and press-friendly
- Grounded in real data, not hallucinated
- Extremely shareable ("I asked the AI about my congressman and...")
- Opens the data to non-technical users

### Implementation Notes
- Claude API with tool use — define tools that query the database
- Or text-to-SQL pattern: Claude generates a SQL query, backend executes it safely
- Scope responses strictly to available data to prevent hallucination
- Add suggested starter questions to reduce cold-start friction
- Rate limit per IP to control API costs

---

## Lower Priority (Future)

### Mirror Portfolio Tracker
*"If you copied every trade by Senate Intelligence Committee members, you'd be up X% vs S&P."*
- Pure data computation + AI narrative
- Very viral/shareable

### Weekly AI Digest
- Auto-generated summary of the week's notable trades
- Could be an on-site widget or email newsletter
- Drives return visits

### Legislative Correlation Alerts
- Cross-reference trades with committee hearings
- Flag: "Senator X bought $500K in pharma 3 weeks before their drug pricing hearing"
- You already have the committee hearing data to power this

### Sector Sentiment Signal
- "Congress is net-buying Technology at the highest rate in 6 months"
- Simple aggregation + AI interpretation
- Good homepage widget

### Congressional Alpha Analysis
- Do any members actually beat the market?
- Run the numbers, Claude writes the analysis
- Spoiler: most don't — which is itself the story

---

## Tech Stack for AI Features

| Feature | Approach | Model | Cost estimate | Status |
|---------|----------|-------|---------------|--------|
| Suspicion Score | Rule-based scoring | None (rule-based) | $0 | ✅ Shipped |
| Politician Summary | Structured prompt → Claude | claude-haiku-4-5-20251001 | ~$0.001/profile, cached 7d | ✅ Shipped |
| Q&A Chat | Tool use / text-to-SQL | claude-sonnet-4-6 | ~$0.01–0.05/query | Planned |

All AI features use the Anthropic Python SDK (`anthropic` package, `AsyncAnthropic` client).
