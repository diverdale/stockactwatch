# AI Integration Roadmap

## Overview

The congressional trade data is uniquely well-suited for AI integrations. We have committee membership,
hearing records, filing lag data, return calculations, and ~19K trades — a combination that enables
insights no generic financial tool can produce.

---

## Priority 1: AI Suspicion Score

Score every trade 1–10 on how "suspicious" it looks based on signals already in the database.

### Inputs
- Does the politician sit on a committee that oversees this sector?
- Was the filing late (>45 days past the STOCK Act deadline)?
- Large amount ($$$+, i.e. $500K+)?
- Options trade (higher information asymmetry, harder to detect)?
- Bought right before a significant price move?

### Output
A score (1–10) + short explanation displayed as a badge on each trade row and politician profile.

### Why it's valuable
- Defensible and data-driven — not opinion
- Committee hearing data makes it uniquely possible here
- Press-worthy: "AI flags most suspicious congressional trades"
- No user interaction required — runs on ingest

### Implementation Notes
- Compute score server-side at ingest time, store in `trades` table
- Rule-based scoring weighted by signal strength (no LLM needed for the score itself)
- Claude generates the human-readable explanation for each flagged trade
- Surface as a colored badge: green (1–3), yellow (4–6), orange (7–8), red (9–10)

---

## Priority 2: AI Politician Trading Summary

On each politician profile, an AI-written plain English paragraph summarizing their trading patterns.

### Example Output
> *"Ro Khanna has made 312 trades totaling an estimated $100M in volume over the past 2 years.
> He trades heavily in technology and semiconductors — sectors his House Science Committee oversees.
> His average filing lag of 12 days is well within legal limits, but 14 trades were filed after the
> 45-day STOCK Act deadline. His buy/sell ratio skews heavily bullish (74% buys), with a concentration
> in large-cap tech. Estimated portfolio return on calculable trades: +8.2%."*

### Why it's valuable
- Makes the data accessible to non-financial users
- Every politician gets a unique, data-grounded narrative
- Drives engagement — people will share their rep's summary
- Low cost: one Claude call per profile, cached and regenerated periodically

### Implementation Notes
- Generate via Claude API with structured trade data as context
- Cache in database or Redis, regenerate weekly or on significant new trades
- Add a "Last updated" timestamp below the summary
- Graceful fallback if generation fails (just hide the section)

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

| Feature | Approach | Model | Cost estimate |
|---------|----------|-------|---------------|
| Suspicion Score | Rule-based scoring + Claude explanation | claude-haiku-4-5 | ~$0.001/trade |
| Politician Summary | Structured prompt → Claude | claude-sonnet-4-6 | ~$0.01/profile, cached |
| Q&A Chat | Tool use / text-to-SQL | claude-sonnet-4-6 | ~$0.01–0.05/query |

All features use the Anthropic SDK (`@anthropic-ai/sdk` for Next.js, `anthropic` for Python).
