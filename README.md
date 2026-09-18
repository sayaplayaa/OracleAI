# Dota Coach AI

An AI Dota 2 coach. Sign in with Steam (or look up any player), see real
match stats and trends styled after OpenDota/Dota2ProTracker, then get a
coaching report - strengths, weaknesses, and tips that each cite a real
number from the match or profile, never invented.

## Stack

- Next.js (App Router) + TypeScript, Tailwind CSS
- Data: [OpenDota public API](https://docs.opendota.com/) (no key required for MVP volumes)
- Data: [STRATZ GraphQL API](https://stratz.com/api) (optional, key required) - role win rates, item builds/talents, lane synergy, per-match position classification
- Hero/item/ability metadata: `dotaconstants`
- Auth: Steam OpenID 2.0 (no API key needed), verified server-side, signed session cookie
- AI coach: Anthropic Claude (`@anthropic-ai/sdk`), forced structured tool-use output
- Charts: `recharts`

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY and SESSION_SECRET
npm run dev
```

Open http://localhost:3000.

- **`ANTHROPIC_API_KEY`** (required for AI features) - get one at
  https://console.anthropic.com/. Without it, all stats/trends/pages still
  work, but every "AI Coach" / "Get tips" / "Get AI Trend Report" action
  returns an error.
- **`SESSION_SECRET`** (required for Steam login) - any long random string
  used to sign the session cookie, e.g. `openssl rand -hex 32`. It's a local
  secret, not a third-party credential.
- **`STRATZ_API_KEY`** (optional but recommended) - from https://stratz.com/api.
  Powers the Heroes page's Meta tab and Build Inspector, per-match role
  classification on Match Story, and Draft Explorer's lane-partner section.
  Without it those are omitted (Meta tab, item builds/talents, lane partners)
  or fall back to an estimate (role comparisons use a GPM-rank heuristic
  instead of STRATZ's real classifier) - OpenDota-backed features are
  unaffected.

## How it works

### Home (`/`) and the header

Home leads with **Sign in through Steam** (real OpenID 2.0, verified
server-side against Steam - no Steam Web API key needed) behind a small
parallax/blur decorative background. The header (present on every page) has
a compact search bar (player by ID/URL/name, or a match ID/link - opens
under your own signed-in account when you have one, otherwise via the
account-less `/matches/[matchId]` entry point) and nav to Heroes, Guides,
Tournaments, Challenges, and Riddles; the logo links to your own profile
once signed in, or home otherwise.

### Player profile (`/player/[accountId]`)

**Overview** tab:
- Win rate, average KDA, **Rank** and **MMR** - derived from OpenDota's
  `computed_mmr` (its own estimate from match history; Valve doesn't expose
  official MMR through any public API). Rank/star and "MMR to next rank" are
  both computed from that same number against a community-cited rank-MMR
  ladder (~154 MMR/star through Ancient, ~200/star in Divine) - see
  "Known limitations" below for the honesty caveat on that ladder.
- **Signature hero** - your most-played hero, in an interactive tilt card
  (mouse-driven perspective/rotation on real hero art - see limitations for
  why this isn't a literal 3D model) with real games/win-rate and an
  on-demand AI report ("Get tips for X") grounded in your recent games on
  that hero specifically.
- **Pro spotlight** - a real, currently-active pro player (rostered on a
  team, Fantasy-locked into an ongoing tournament period) who has actually
  played your signature hero in a recent league game - found from OpenDota's
  hero match feed (every row there is a real tournament game, unlike
  `/rankings`' top public-ladder performers, which are a different set of
  people entirely), cross-referenced against the `proPlayers` roster for a
  real name/team. Shows their real games/win rate/KDA on that hero, links
  into the actual tournament match(es) found, and a "Compare me to {pro}" AI
  report grounded in both players' real numbers side by side.
- **Recent form** (last 10 results as clickable, win/loss-ringed hero icons).
- **Matches worth reviewing** - a curated 10 out of your last 20 games:
  losses weighted highest, then games where KDA/deaths were notably off your
  own average - not just "most recent."
- **Get AI Trend Report** - sends the last 20 games' aggregated stats to
  Claude for a pattern-level report.

**Match History** tab: the full match list, paginated ("Load more").

### Match detail (`/player/[accountId]/match/[matchId]`)

Hero splash-art header, three tabs:
- **Full Match** - a **net worth chart** for the whole lobby (all 10
  players, sorted highest to lowest, real end-of-game net worth), the
  scoreboard, team net worth/XP advantage graph, per-player farm-pace
  sparklines, a ward-placement map, and a position-density heatmap - all
  from OpenDota's parsed replay data. Unparsed matches get a "Request full
  parse" button instead of the charts (the net worth chart and scoreboard
  still work either way - net worth doesn't need a full parse).
  Click any player (in the chart or the scoreboard) to open their **detail
  panel**: real percentile stat bars, their real item-purchase timeline,
  their real **skill build** (ability level-up order, with an interpolated
  "~" timestamp derived from their real XP curve against Dota's official
  per-level XP thresholds - OpenDota doesn't log an exact time per level-up,
  so this is a real-data estimate, never invented), an on-demand AI
  "mistakes & strengths" report (the same one "My Performance" uses, now
  usable for any of the 10 players, not just your own), and a **Power
  Spike** report: 3-5 real moments from that exact player's real item/level
  timeline where they got a tangible edge, each explaining why (citing the
  item/ability's real official effect) and what to actually do with that
  window (map objective, camp, rotation).
- **Match Story** - position-vs-position role comparisons (Radiant vs Dire
  in the same role, stat-by-stat - position comes from STRATZ's real
  per-match classifier when available, else a GPM-rank estimate, labeled
  either way), a key-moments timeline (first blood, towers, Roshan, biggest
  teamfight, biggest momentum swing - all from data already in the match
  fetch), and a "What decided this game?" AI report.
- **My Performance** - percentile bars against OpenDota's hero benchmarks,
  key item timeline. Personal AI coaching now lives in the floating widget
  (see below) rather than a button on this tab.

### Floating AI Coach (every page)

Bottom-right button, opens a panel. On a match page it auto-detects that
match and your account; elsewhere it asks for a match ID/link (and your
Steam ID if you're not signed in), then produces the same grounded personal
match report as before.

### Heroes (`/drafts`)

Two tabs:
- **Meta** - current-week pick/win rate for every hero, filterable by role
  (STRATZ, batched query - see limitations).
- **Hero Explorer** - pick a hero for a real Build Inspector (role win-rate
  pills, starting items, item timing progression, situational items, neutral
  items by tier, talent picks with "Most picked"/"Highest win", all from
  STRATZ's current-week data) plus counter-pick data from OpenDota and
  lane-partner synergy from STRATZ, under "Matchups."

Every ranked list here (Meta tier list, toughest/best matchups, best lane
partners) is sorted by a Wilson score confidence interval, not raw win rate -
a hero at 100% over 3 games no longer outranks one at 58% over 5,000, and a
hero rarely played in a role (e.g. Anti-Mage as Hard Support) doesn't get
inflated by a tiny lucky sample.

### Guides (`/heroes`, `/heroes/[heroId]`)

A per-hero reference page, distinct from the Heroes/`/drafts` stats hub
above:
- **Ability kit** - every real ability (name, official description,
  numeric attributes, icon), straight from `dotaconstants`' game-client
  data. No fetch, no fabrication - it's always present.
- **Role win rates** and **matchups** - the same STRATZ/OpenDota data shown
  in Hero Explorer, reused here rather than recomputed, with a link back to
  the full Build Inspector for that hero (`/drafts?hero={id}`, which now
  deep-links Hero Explorer to a preselected hero).
- **AI hero guide** - a written guide (laning, power spikes, teamfighting,
  matchups) grounded in the real ability kit and stats above, via its own
  forced-tool-use schema (separate from personal coaching - this is general
  hero knowledge, not about any one player's performance).

### Tournaments (`/tournaments`)

Real competitive Dota, not personal stats:
- **Live now** - currently-live tournament games (OpenDota's live-match feed
  filtered to ones with a real `league_id`), shown only when something
  actually is live - OpenDota tracks live pro games sparsely, so this
  section is simply absent otherwise rather than showing a placeholder.
- **Recent results** - real finished league/tournament matches (teams,
  final score, league name), filterable by league, each linking to a full
  match breakdown via `/matches/[matchId]` (a new account-less entry point
  that resolves a real participant from the match and forwards to the
  existing match page - also used now by the header search for match-ID
  lookups when you're signed out, which previously required signing in).
- There's no public schedule of upcoming matches on OpenDota, so this is
  results + live only, not a fixture list.

### Challenges (`/challenges`)

Training goals generated from your own real recent games (last 20), not
canned suggestions - e.g. "finish a game with fewer than N deaths" or "hit
N GPM on {your most-played hero}," with N computed from your own recent
average. Deliberately rule-based rather than AI-generated, since these are
precise numeric thresholds where a model could plausibly invent a
slightly-wrong number. A challenge only completes when a real subsequent
match actually clears the bar (checked against freshly fetched matches, not
self-reported) and links to that match. Progress is saved in
`localStorage`, tied to this browser rather than your account - there's no
database, consistent with the rest of the app.

### Dota Riddles (`/riddles`)

Scenario-based, multiple-choice questions on map awareness, vision, timing,
and decision-making (hand-authored coaching content, not tied to any match),
each with a real explanation. Alongside it, a **Map Guide**: your real Dota 2
minimap with an Early/Mid/Late game-phase selector, marking ward spots, farm
priorities, and objectives per phase (hand-authored guidance, marker
positions calibrated by eye against real map landmarks).

The AI is never given free rein: every coach entry point sends a structured
JSON object of already-computed metrics and gets back a structured report
(forced tool call) where every strength/weakness/tip cites one of those
fields.

## Known limitations

- No database - everything is fetched live per request, with a short
  in-memory cache (per server process, not persisted or shared).
- **MMR is an estimate, twice over**: OpenDota's `computed_mmr` is itself
  OpenDota's own estimate (not Valve's official number, which no public API
  exposes), and the rank-tier ladder used to compute "MMR to next rank" is
  community-cited, not officially published by Valve either. It's the best
  available real, fetched number - not something invented, but not official
  ground truth.
- **No literal 3D hero model or a scraped in-game minimap**: there's no
  public API/CDN for Dota 2 hero 3D models (the community tools that exist
  extract assets from a local game install, which isn't something to build a
  hosted feature on), so the signature hero card is an interactive tilt-card
  effect on real hero art instead. The Riddles map, by contrast, *is* the
  real official minimap image (provided directly for this project) with a
  hand-placed marker overlay - the markers are approximate, not the map
  itself.
- "Movement" (Full Match tab) is a position-density heatmap from OpenDota's
  `lane_pos` field, not a real path trail - OpenDota's public API doesn't
  expose full positional replay data. The ward map similarly plots real
  `obs_log`/`sen_log` coordinates on a relative grid, not a map image.
- Draft Explorer's lane-partner section and the Heroes Meta/Build Inspector
  tabs require `STRATZ_API_KEY`; without one they're omitted rather than
  approximated.
- STRATZ ties API keys to the IP address they were issued from. A
  "different IP Addresses" (403) error means the machine's outbound IP has
  changed since the key was generated - regenerate it at stratz.com/api.
  **On a VPN, this recurs every time the VPN rotates its exit IP** - no
  app-side fix, it's inherent to how STRATZ issues keys.
- STRATZ's `stats` query fails outright if you pass too many hero IDs in one
  call (used for the Meta tab) - already worked around by batching in
  `getAllHeroStats`, but worth knowing if you extend it further.
- Full-match extras (team gold/XP advantage graph, farm sparklines, wards,
  heatmap, item timeline, skill build, Match Story's timeline) require
  OpenDota to have parsed the replay; the in-page "Request full parse"
  button handles that. The net worth bar chart and scoreboard don't need a
  parse (final net worth is basic match data), so they still work on
  unparsed matches.
- OpenDota's match-list endpoint doesn't always include `gold_per_min`/
  `xp_per_min` - handled as `null` (never a fabricated 0) everywhere it
  flows through.
- **Pro spotlight** only looks at each hero's ~100 most recent league games
  (OpenDota's hero match feed) for a player who's also on the `proPlayers`
  roster - for very rarely-played heroes in the current pro meta that can
  come up empty, in which case the card says so rather than showing a
  fallback player. It prefers a player whose team is currently Fantasy-locked
  into an active tournament period (the closest real signal to "playing
  right now"), falling back to any tagged pro who's shown up in one of those
  recent league games otherwise - "pro" here spans regional/qualifier-level
  competition, not just Tier 1.
- **Tournaments** has no upcoming-match schedule - OpenDota's public API
  doesn't expose one. Live tournament coverage is also sparse (most live pro
  games aren't tracked by OpenDota's spectate feed), so "Live now" is often
  empty even during an active tournament.
- **Challenges** progress lives in `localStorage`: it's per-browser, not
  per-account - switching devices or browsers starts fresh. Verification
  only looks at your most recent 20 matches fetched at the time you check
  back, so a qualifying game outside that window won't be picked up.
- **No true net-worth-over-time series**: OpenDota's public match data only
  has end-of-game net worth per player, not a per-minute history - the Full
  Match net worth chart is a sorted bar chart of final values (100% real),
  not a time series, since approximating one from gold/purchases would
  drift over a long game.
- **Skill build timestamps are estimates**: OpenDota records which ability
  was leveled at which real hero level, but not the exact second - the "~"
  time is interpolated from the player's real XP curve against Dota's
  official per-level XP thresholds, not a logged event.

## Project layout

```
src/
  app/                        pages + API routes
    api/auth/                 Steam OpenID login/callback/session/logout
    api/coach/                match, trends, match-story, hero, hero-guide, pro-comparison, power-spike AI reports
    api/hero/[heroId]/        matchups, roles, build (Hero Explorer)
    api/meta/                 Heroes Meta tab
    drafts/                   Heroes page (Meta + Hero Explorer)
    heroes/, heroes/[heroId]/ Guides (ability kit + AI hero guide)
    tournaments/              Tournament Tracker (live + recent results)
    matches/[matchId]/        account-less match entry point (redirects)
    challenges/               Training Challenges
    riddles/                  Dota Riddles + Map Guide
    player/[accountId]/       profile (Overview + Match History)
    player/[accountId]/match/[matchId]/   match detail (3 tabs)
  lib/
    opendota.ts                OpenDota API client (cached, retrying)
    stratz.ts                   STRATZ GraphQL client (cached, batched)
    steamAuth.ts                 Steam OpenID + session cookie signing
    steamId.ts                    Steam32/64/URL and match-ID parsing
    constants.ts, heroAbilities.ts  hero/item/rank/ability lookups (dotaconstants)
    riddles.ts, mapGuides.ts        hand-authored coaching content
    challenges.ts, challengeStorage.ts   rule-based challenge generation + localStorage
    metrics/                        raw data -> grounded metrics (match, trend, role comparison, match story, hero build, signature hero, draft insights, pro comparison, tournaments, skill build)
    coach/                           prompt + schema + Anthropic client for the AI coach
  components/                UI
public/
  minimap.png                the real Dota 2 minimap used on /riddles
```
