# Congressional Stock Tracker

## What This Is

A public website that tracks stock trades disclosed by US Congress members (House and Senate) under the STOCK Act. It surfaces leaderboards, politician profiles, stock-level activity, and smart analysis to serve retail investors, journalists, and curious citizens who want to understand what their representatives are trading while they legislate.

## Core Value

Make congressional trading data so clear, current, and compelling that it becomes the go-to reference for anyone asking "what is Congress buying?"

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Leaderboards ranked by estimated trade performance (returns) and trade activity volume
- [ ] Politician profile pages showing full trade history, sectors traded, and performance metrics
- [ ] Stock/ticker pages showing which members traded a given stock and when
- [ ] Activity feed of recent/new disclosures as they arrive
- [ ] Smart analysis: flag unusual activity, sector concentration vs legislative committee assignments, timing relative to legislation
- [ ] Data ingested from existing congressional trade API (Quiver Quant or Capitol Trades)
- [ ] No user accounts in v1 — fully public, read-only site
- [ ] Python backend (FastAPI preferred), Next.js frontend

### Out of Scope

- User accounts, watchlists, personalized alerts — deferred to v2
- Mobile native app — web-first
- Real-time streaming data — periodic ingestion is sufficient for v1

## Context

- STOCK Act (2012) requires Congress members to disclose trades within 45 days; disclosures are public record
- Quiver Quantitative and Capitol Trades are established data providers with APIs for this data
- Existing tools (Quiver Quant, Capitol Trades website) exist but are not optimized for the viral/accountability angle
- The "conflict of interest" angle (trading in sectors they regulate) is the most politically charged and shareable hook
- Estimated returns require calculating unrealized/realized gains against market price at time of disclosure — this introduces estimation complexity

## Constraints

- **Data**: Dependent on third-party API for trade disclosures — API rate limits and data freshness SLAs apply
- **Legal**: Display only public STOCK Act disclosures; no speculation beyond what data supports
- **Tech Stack**: Python backend (FastAPI preferred); frontend stack is flexible (Next.js recommended)
- **Performance**: Leaderboard pages must be fast — these are the viral entry points

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No user accounts in v1 | Reduce complexity; public read-only site is sufficient for initial launch | — Pending |
| Use existing trade data API vs. scraping | APIs (Quiver Quant / Capitol Trades) provide cleaner, more reliable data than raw filings | — Pending |
| Python backend | User preference; FastAPI is a natural fit for data-heavy API layer | — Pending |
| Performance-based leaderboard as anchor | Most shareable and differentiated feature vs existing tools | — Pending |

---
*Last updated: 2026-03-12 after initialization*
