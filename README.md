# Dota Coach AI

A web MVP for an AI Dota 2 coach. Look up a player to see match stats and
trends (OpenDota data, presented like OpenDota/Dota2ProTracker), then request
an AI coaching report - strengths, weaknesses, and tips that each cite a real
metric from the match or profile, never invented.

## Stack

- Next.js (App Router) + TypeScript, Tailwind CSS
- Data: [OpenDota public API](https://docs.opendota.com/) (no key required for MVP volumes)
- Data: [STRATZ GraphQL API](https://stratz.com/api) (optional, key required) for real teammate lane-synergy stats
- Hero/item metadata: `dotaconstants`
- AI coach: Anthropic Claude (`@anthropic-ai/sdk`), forced structured tool-use output
- Charts: `recharts`

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. Get an Anthropic API key at
https://console.anthropic.com/ - without it, stats/trends still work, but the
"Get AI Coaching Report" buttons will return an error.

Optionally add `STRATZ_API_KEY` (from https://stratz.com/api, under your
account's API section) to unlock the "Best lane partners" section on the
Draft Explorer page. Without it, Draft Explorer still shows OpenDota's
counter-pick data.

## How it works

1. **Search** (`/`) - enter a Steam64 ID, a `steamcommunity.com/profiles/...`
   URL, an OpenDota `account_id`, or a player name.
2. **Player profile** (`/player/[accountId]`) - win rate, average KDA/GPM/XPM,
   a GPM/XPM trend chart, best/worst heroes by win rate, and recent matches -
   all computed from the last 20 matches via OpenDota. "Get AI Trend Report"
   sends this aggregated data to Claude for a pattern-level coaching report.
3. **Match detail** (`/player/[accountId]/match/[matchId]`) - two tabs:
   - **Full Match**: scoreboard for all 10 players (level, KDA, LH/DN, GPM/XPM,
     net worth, hero/tower damage, wards, final items), a team net worth/XP
     advantage graph, per-player farm-pace sparklines, a ward-placement map,
     and a position-heatmap ("where each player spent their time") - all from
     OpenDota's parsed replay data. If OpenDota hasn't parsed this match yet,
     a "Request full parse" button triggers it and reloads once ready.
   - **My Performance**: the searched player's stats with percentile bars
     against OpenDota's hero benchmarks, key item timeline, and "Get AI
     Coaching Report", which sends this match's computed metrics to Claude
     for a report grounded in that specific game.
4. **Draft Explorer** (`/drafts`) - pick a hero to see its real counter-pick
   data from OpenDota (`/heroes/{id}/matchups`): which heroes it historically
   struggles against and which it dominates, by win rate (minimum 20 recorded
   games per matchup). If `STRATZ_API_KEY` is set, also shows its best lane
   partners - real teammate match-win rates for the hero's most-played
   position, from STRATZ's `laneOutcome(isWith: true)` data for the current
   week (minimum 30 games; STRATZ scopes this query to one week at a time).

The AI is never given free rein: it receives a structured JSON object of
already-computed metrics and must return a structured report (via a forced
tool call) where every strength/weakness/tip cites one of those fields.

## Known MVP limitations

- No database - everything is fetched live from OpenDota per request, with a
  short in-memory cache (per server process, not persisted or shared).
- No accounts/auth - anyone with a profile URL or ID can view it (same as
  OpenDota itself; only public match data).
- Deaths are shown as a season-window pattern from match data, without prior
  per-death-timing breakdown (OpenDota's raw match payload doesn't expose that
  cleanly outside `teamfights`, which is out of scope for MVP).
- Trend/benchmark sample is capped at the last 20 matches for cost/latency.
- "Movement" is a position-density heatmap from OpenDota's `lane_pos` field
  (where each hero spent time), not a real minute-by-minute path trail -
  OpenDota's public API doesn't expose full positional replay data.
- The ward map plots real `obs_log`/`sen_log` coordinates on a relative grid,
  not a real minimap image.
- Draft Explorer's lane-partner section requires a `STRATZ_API_KEY`; without
  one it's omitted rather than approximated, since OpenDota's own public API
  doesn't expose teammate-synergy stats.
- STRATZ ties API keys to the IP address they were issued from. If you see a
  "different IP Addresses" (403) error server-side, the machine's outbound IP
  has changed since the key was generated - regenerate it at
  stratz.com/api and update `STRATZ_API_KEY`. **If you're on a VPN, this will
  recur every time the VPN rotates its exit IP** (reconnect, sleep/wake,
  server rebalancing) - the key only stays valid until that happens again.
  There's no app-side fix for this; it's inherent to how STRATZ issues keys.
- Full-match extras (net worth graph, farm sparklines, wards, heatmap) require
  OpenDota to have parsed the replay; very recent or low-priority matches may
  need the in-page "Request full parse" button first.

## Project layout

```
src/
  app/                    pages + API routes
  lib/
    opendota.ts           OpenDota API client (cached, retrying)
    steamId.ts             Steam32/64/URL parsing
    constants.ts            hero/item lookups (dotaconstants)
    metrics/                 raw OpenDota data -> grounded MatchMetrics/TrendMetrics
    coach/                    prompt + schema + Anthropic client for the AI coach
  components/              UI
```
