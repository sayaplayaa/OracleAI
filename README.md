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
- AI coach: local [Ollama](https://ollama.com) running `qwen3:8b`, structured JSON output
- Charts: `recharts`

## Setup

```bash
ollama pull qwen3:8b
ollama serve                 # if not already running as a service
npm install
cp .env.example .env.local   # then fill in SESSION_SECRET
npm run dev
```

Open http://localhost:3000.

- **Ollama + `qwen3:8b`** (required for AI features) - install
  [Ollama](https://ollama.com), run `ollama pull qwen3:8b`, and make sure
  `ollama serve` is reachable at `http://localhost:11434` (override via
  `OLLAMA_URL`/`OLLAMA_MODEL` in `.env.local`). Without it, all stats/trends/
  pages still work, but every "AI Coach" / "Get tips" / "Get AI Trend Report"
  action returns an error.
  - **Context window.** Each request gets the smallest window its prompt and
    answer fit in (4096 or 8192 tokens, capped by `OLLAMA_NUM_CTX`), so a
    prompt is never silently cut - Ollama would drop its start, the rules.
  - **8 GB GPUs.** `qwen3:8b` with an 8192 window may not fit next to the
    desktop, browser and other GPU apps. When Ollama's own placement fails
    to load, the app retries with part of the layers on the CPU (24, then
    16, then 8 on the GPU) and remembers what worked - reports then take a
    few minutes instead of under one. `OLLAMA_NUM_GPU` pins the layer count;
    a smaller model (`ollama pull qwen3:4b`, `OLLAMA_MODEL=qwen3:4b`) keeps
    everything on the GPU at some cost in report quality.
- **`BATTLE_PASS_DEV_UNLOCK`** (test setups only) - `1` lets the battle pass
  "buy" button activate the pass for free, since payment isn't connected yet.
- **`SESSION_SECRET`** (required for Steam login) - any long random string
  used to sign the session cookie, e.g. `openssl rand -hex 32`. It's a local
  secret, not a third-party credential.
- **`STRATZ_API_KEY`** (optional but recommended) - from https://stratz.com/api.
  Powers the Meta page, the build tab and lane partners on hero pages, and
  per-match role classification on Match Story.
  Without it those are omitted (Meta, item builds/talents, lane partners)
  or fall back to an estimate (role comparisons use a GPM-rank heuristic
  instead of STRATZ's real classifier) - OpenDota-backed features are
  unaffected.

## How it works

### The simple flow (what a new player sees)

The UI is built around four steps, in Russian, with nothing else on screen:

1. **Home (`/`) signed out** - just a **Войти через Steam** button (real
   OpenID 2.0, verified server-side against Steam - no Steam Web API key
   needed).
2. **Home signed in** - the player's own last 20 games (hero, win/loss, KDA,
   duration), Turbo included and marked as such (OpenDota's default filter
   hides Turbo, which showed Turbo players weeks-old games as their "last
   games"); a game whose analysis is already saved on this device is marked
   "Разбор готов".
3. **Pick a game -> `/analysis/[matchId]`** - the AI analysis of that game
   starts immediately (no button): the same grounded match analysis as
   before (phase-by-phase, compared only with the enemy player on the same
   position), laid out as *summary -> what to fix first -> what went well ->
   how each phase went -> full breakdown -> details*. It takes 1-3 minutes on the local model
   (up to ~5 on an 8 GB GPU, see Setup), so the page shows progress; finished
   analyses are cached (server memory
   for 6 h, and `localStorage` on the device) so reopening a game is instant.
4. **Подробная статистика** - a button on the analysis page that opens the
   full data view of that match (`/player/[accountId]/match/[matchId]`).

What the single-game analysis takes into account, all worked out in code
before the model writes a word:

- **Game context, said first.** Turbo (its own phase windows - laning to
  7:00, mid game to 16:00 - and no comparison with normal-game percentiles
  or meta item timings, which every Turbo game would "beat"); players who
  left, with the time, from the replay's connection log: a teammate leaving
  is named as what decided the game, a counterpart leaving ends the
  comparison with them, and a player who left themselves is analysed only up
  to that moment (later deaths on the map were their teammates' doing).
- **Fair asks only.** No "push buildings" or "get late kills" while the team
  is far behind or a player down - those phases are labelled as defence, and
  the model is told to advise on defending. A late game under 5 minutes is
  folded into the mid game instead of being judged on two minutes.
- **Strengths that mean something.** An edge over the counterpart counts
  only past a real margin (4 deaths against 5 isn't one), phase wins are one
  line instead of three, kills/assists/kill share count once, and real
  habits are credited: being in nearly every fight, kill participation, and
  for supports Observer Wards the enemy never found.
- **A measurable goal per priority** - "не больше 1 смерти до 10:00 (в этой
  игре - 3)", "9 уровень к 10:00 - как у Lion (у тебя был 8)" - from the
  game's own numbers, so the next game can be checked against it. Also new:
  level-6 timing against the counterpart, and Observer Wards the enemy
  removed (support).
- **The whole game, not just one opponent.** A "Как решилась игра" card
  classifies the game from the team gold curve - a thrown lead, a comeback, a
  stomp, a close game - and lists the fights that decided it: where they
  happened, what each side lost, the lead before and after, a fresh Aegis,
  and what the player did in each (died first, died seconds before it, was
  dead, stayed out). In a thrown game the priorities lead with how the lead
  was lost - no buildings taken after the peak, fights lost on the enemy
  half while ahead, Aegis spent on a chase, no buyback as the base fell -
  instead of the lane.
- **Behaviour and positioning.** Deaths just before a fight and first deaths
  in lost fights are found for every game. When STRATZ has the replay's
  movement data, the report also checks who stood closest to the enemy as
  each fight began (wrong for a carry, mid or support; the job of position
  3), how far the nearest ally was at each death outside a fight, and where
  the player was during the fights they missed.
- **Checked narration.** Besides the existing number/time/item checks, any
  sentence that contradicts a phase verdict ("ты проиграл лейтгейм" for a won
  one, or for a phase that was folded away) or the result of the game, or
  miscounts deaths before a time ("2 раза до 5:00" with one), is dropped.
  English names keep no Russian case endings ("Huskarу" -> "Huskar").
- **Every mistake explained, not just named.** Each problem carries four
  parts written in code from the replay: what happened, why it's a mistake
  (what it cost in gold, seconds in the tavern, creep waves, fights the team
  played a hero down), the right move in that exact spot, and an example
  for the next game - with this game's heroes, times and numbers ("держись
  дальше 850 ед. от Zeus - это дальность Lightning Bolt"; "больше всего
  добиваний ты упустил между 6:00 и 8:00: +4 у тебя против +14 у Drow
  Ranger"). Enemy disables, cast ranges and cooldowns come from the game data.
- **Full breakdown, every aspect.** Below the phases, a tabbed section covers
  the lane, farm and income sources, deaths, fights, items/skills/buyback,
  vision/runes/map and buildings/Roshan. Each tab has a table against the
  enemy on your position and the median player on your hero, what went well,
  and every mistake found (not just the top three). Every death is reviewed
  one by one: who killed you and with what, where, under whose ward, where
  the killers were 25 seconds earlier, the nearest ally, what the team lost
  while you were dead, and a verdict (avoidable / lost fight / fair trade).
  So is every teamfight: your part in it, damage against the counterpart and
  the gold swing. A timeline lists kills, deaths, items, levels, fights,
  buildings, Roshan, runes and buybacks. Also checked now: a late
  ultimate, power runes given to the enemy mid, minutes alive without farm
  or fights, TP Scroll use against missed fights, and a Black King Bar never
  bought on a hero that normally builds it. This part is worked out in code
  rather than by the model: an 8B model with an 8k window can't hold it all
  and invents numbers.
- **Coaching rules from real material.** Each problem carries a rule distilled
  from public coaching guides, with the mechanics checked (buyback 200 + net
  worth / 13, uphill misses for ranged attacks only, comeback gold) -
  sources and the rule per problem are in `docs/coach-knowledge.md`.

Everything else is in the header on every page: Meta, Guides, Tournaments,
the battle pass, Riddles, the full player profile and the search bar
(`/advanced` lists the same tools). The floating AI Coach button is hidden
on the home and analysis pages (the analysis is the page itself there) and
shown everywhere else.

AI reports are written in Russian; hero, item and ability names stay in
English, as in the game client.

Every section page shares one visual language with the home page: a page
header (mono eyebrow, display title), rounded cards with a colored top edge,
segmented tabs whose state is kept in the URL (`?tab=`), and the same AI
action card everywhere an AI report can be requested (it shows elapsed time
while the local model works).

### Player profile (`/player/[accountId]`)

A banner with the avatar, lifetime wins/losses and, on your own profile,
"analyze my last game" / "my games" buttons; on your own profile every game
row also has a **Разбор** button straight into `/analysis/[matchId]`.

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
- **Get AI Trend Report** - a pattern-level report over your recent games,
  built only from games that can be compared: your main kind of game (Turbo
  or normal - their numbers never mix) minus games you left, and at least 5
  of them. It gets what changes between your wins and your losses (deaths,
  kills, GPM, last hits per minute - the most direct pointer at what loses
  you games), your heroes over the last 90 days with 5+ games, ranked by a
  Wilson bound rather than raw win rate (3-0 on a hero from years ago no
  longer tops the list), and, from your parsed games: deaths before the end
  of laning and outside fights, heroes that killed you in several different
  games, and lane results against the enemy on your own position. Findings
  whose numbers aren't in that data are dropped.

**Match History** tab: the full match list with a wins/losses filter,
paginated ("Load more").

### Match detail (`/player/[accountId]/match/[matchId]`)

A banner with the team score, duration, mode and patch, the profile player's
hero and result, and - on your own game - a button into the AI analysis.
Three tabs:
- **Full Match** - Dota-style post-game graphs (team gold/XP advantage,
  per-player net worth/XP/last hits/denies), a scoreboard per team with team
  totals, one ward map filterable by ward type, side and game phase, and a
  position-density heatmap - all from OpenDota's parsed replay data.
  Unparsed matches get a "Request full parse" card (with a progress bar)
  and an end-of-game net worth bar chart instead of the per-minute graphs.
  Click any player (in the graphs or the scoreboard) to open their **detail
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
  key item timeline, and either a link into the full analysis (your own
  game) or the match AI report (anyone else's).

### Floating AI Coach (every page)

Bottom-right button, opens a panel. On a match page it auto-detects that
match and your account; elsewhere it asks for a match ID/link (and your
Steam ID if you're not signed in), then produces the same grounded personal
match report as before.

### Meta (`/drafts`)

This week's strongest heroes per position (STRATZ, Legend and above,
batched query - see limitations), rendered on the server: the leader of
each position as a card, then the top 8 per position with a win-rate bar
centered on 50%. Every hero links to its page with the build for that
position open (`/heroes/{id}?pos=POSITION_N`). Old `/drafts?hero={id}` links
redirect to the hero page.

Every ranked list (meta, toughest/best matchups, best lane partners) is
sorted by a Wilson score confidence interval, not raw win rate - a hero at
100% over 3 games no longer outranks one at 58% over 5,000, and a hero rarely
played in a role (e.g. Anti-Mage as Hard Support) doesn't get inflated by a
tiny lucky sample.

### Guides (`/heroes`, `/heroes/[heroId]`)

`/heroes` is the hero grid grouped by primary attribute, as in the game,
with search and attribute/role filters. Each hero page has a banner (week
win rate, games, main role) and then everything on one page, in this order,
with a sticky row of links to jump between the parts:

- **Role** - one picker (win rate and share of games per position) that
  drives both the AI guide and the build below.
- **AI guide, first** - so it never has to be looked for. One click writes
  it for the selected role; once written it's kept on the server for 12 hours
  and opens straight away for everyone. It's built from the role's real
  build: the core items are shown from the data as they are, and the model
  explains each one (what it gives this hero, what to do once it's bought),
  plus laning, teamfights and matchups. What the model writes is checked:
  item cards pick their item from the build itself (a fixed list, so no
  renamed or remembered items); any sentence naming an item outside the
  build - in English or transliterated ("блинк-даггер") - is dropped, as is
  one that gives an opponent an ability it doesn't have, or a tip whose
  numbers aren't in the data. Matchup tips get each opponent's real disables
  (with cast range) to work from.
- **Build** - the real STRATZ current-week build for that position (Legend+):
  core items in their usual order with how often they're built and at which
  minute, the components bought on the way ("через Skull Basher"), boots and
  early items, starting items (with copies, "Iron Branch ×2"), talents (most
  picked / highest win rate) and situational items. Talents read as the
  Russian client shows them, with their real numbers ("+200 к радиусу Mana
  Void") from Valve's ability files.
- **Abilities** - every real ability (name, official description, numeric
  attributes, icon), straight from `dotaconstants`' game-client data.
- **Matchups** - toughest and easiest opponents (OpenDota) and best lane
  partners (STRATZ).

How core items are worked out (the old list missed real core items):
STRATZ answers with one row per item, per purchase (first copy, second...)
and per game minute. An item's pick count is the sum of its first-purchase
rows over every minute - keeping only the biggest minute counted Battle Fury
on Anti-Mage at a third of its real number. Boots come from their own STRATZ
query (the full-purchase list never has them - Power Treads, bought in
almost every Anti-Mage game, was missing). Item counts and the game count are
both Legend+ (item counts used to cover every bracket against a Legend+ game
count), and the game count is every game: STRATZ's position stats without a
time filter return only the games that reached minute 35 (91 300 of 126 723
for Anti-Mage carry), which made every pick rate ~40% too high. Core = bought
in 20%+ of games, ordered by median purchase minute; a component bought on
the way to a popular item (Perseverance, Yasha, Skull Basher) is shown inside
that item; cheap first-minutes items (Magic Wand, Wraith Band) are listed
separately. The same build data feeds the match analysis' item timings.

### Tournaments (`/tournaments`)

Real competitive Dota, not personal stats:
- **Live now** - currently-live tournament games (OpenDota's live-match feed
  filtered to ones with a real `league_id`) as scoreboards. OpenDota keeps
  games in that feed for a while after they end, so anything already in the
  results list is left out of "live".
- **Recent results** - real finished league/tournament matches (teams,
  final score, league name), grouped by league, with team/league search and
  league chips, each linking to a full
  match breakdown via `/matches/[matchId]` (a new account-less entry point
  that resolves a real participant from the match and forwards to the
  existing match page - also used now by the header search for match-ID
  lookups when you're signed out, which previously required signing in).
- There's no public schedule of upcoming matches on OpenDota, so this is
  results + live only, not a fixture list.

### Battle pass (`/challenges`)

A season (12 weeks, `src/lib/battlePass/season.ts`) of 30 levels: every
1 000 points is a level, and key levels unlock a reward - ward and hero skins,
a taunt, Dota Plus, a courier, an Immortal and an Arcana (placeholders until
the real rewards and their cost against the pass price are decided).

- **Weekly challenges.** Every Monday at 00:00 UTC (03:00 Moscow) the
  signed-in player gets six challenges built from their own last 20 games,
  each a bit above their current average: fewer deaths, KDA, GPM on their
  main hero, last hits per minute (cores) or three clean games, two wins, and
  an AI review of one of their own games. Targets are clamped, so games fed
  on purpose can't make them trivial. Each is worth 250-800 points, about
  2 950 a week - enough for level 30 by the end of the season with most
  challenges done.
- **Checked against real games.** A game counts only if it was played after
  the challenge was issued and before its week ended, in public matchmaking
  or ranked (not a lobby or a bot game), lasted 15+ minutes (Turbo 10+),
  wasn't left, and is the same kind of game the target was set from (Turbo
  or normal). The review challenge counts when the signed-in player opens
  the AI analysis of their own game (once per game).
- **On the server, tied to Steam login.** Points and rewards are worth real
  items, so progress isn't kept in the browser: it lives in a JSON file
  (`.data/battle-pass.json`, git-ignored; `BATTLE_PASS_STORE` moves it),
  written one request at a time and atomically. The API
  (`/api/battle-pass`, `/purchase`, `/claim`) only ever serves the session's
  own account.
- **Buying the pass - not connected yet.** One-time pass or subscription is
  still to be decided, so the button reads "Скоро в продаже". Points still
  accrue without it; rewards for levels already reached unlock once the pass
  is active. `BATTLE_PASS_DEV_UNLOCK=1` lets a test setup activate it for
  free - never set it in production.
- **Claiming rewards.** Needs an active pass and the level. Item rewards ask
  for the item/hero and a Steam trade link, whose `partner` must be the
  player's own account; Dota Plus is sent as a Steam gift. A claim is stored
  as "pending" for someone to send by hand - there's no admin page or trade
  bot yet; the claims are in the store file.

### Dota Riddles (`/riddles`)

Scenario-based, multiple-choice questions on map awareness, vision, timing,
and decision-making (hand-authored coaching content, not tied to any match),
each with a real explanation. A round asks every riddle once in random
order; answers can be given with keys 1-4 / A-D and Enter moves on; score,
streak and accuracy are shown, with a summary at the end. Alongside it, a
**Map Guide**: your real Dota 2 minimap with an Early/Mid/Late game-phase
selector and numbered markers for ward spots, farm priorities, and
objectives per phase (hand-authored guidance, marker positions calibrated by
eye against real map landmarks).

The AI is never given free rein: every coach entry point sends a structured
JSON object of already-computed metrics and gets back a structured report
(Ollama structured-output schema, run locally against `qwen3:8b`) where every
strength/weakness/tip cites one of those fields.

## Known limitations

- No database - everything is fetched live per request, with a short
  in-memory cache (per server process, not persisted or shared).
- **Turbo phase windows are an estimate** (laning to 7:00, mid game to
  16:00, from Turbo's roughly doubled income and ~20-minute games) - there's
  no official Turbo laning length. Turbo games are only ever compared with
  the counterpart in the same game.
- **Fight positioning needs STRATZ's movement data**, which STRATZ has for
  most games within a day but not all; without it the report still finds
  deaths before and first in fights (from OpenDota), just not who stood
  where. OpenDota's teamfights don't record each player's death order within
  a fight, so "died first" compares death times from the replay's death log.
- **Leave times** come from the replay's connection log (the last disconnect
  without a reconnect); a player marked as having left whose replay has no
  such entry is still named, but the analysis can't cut at an exact time.
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
- The Meta page, hero builds and lane partners require `STRATZ_API_KEY`;
  without one they're omitted rather than approximated.
- **Neutral items**: STRATZ currently returns no neutral item stats at all
  (since the neutral item rework), so that block is hidden on hero pages
  until it does.
- **AI guide quality** is bounded by the local 8B model: the checks keep it
  to real items, abilities and numbers, but its wording can still be plain
  or repetitive (near-duplicate tips are dropped rather than shown).
- STRATZ ties API keys to the IP address they were issued from. A
  "different IP Addresses" (403) error means the machine's outbound IP has
  changed since the key was generated - regenerate it at stratz.com/api.
  **On a VPN, this recurs every time the VPN rotates its exit IP** - no
  app-side fix, it's inherent to how STRATZ issues keys.
- STRATZ's `stats` query fails outright if you pass too many hero IDs in one
  call (used for the Meta page) - already worked around by batching in
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
- **Battle pass** progress is a JSON file on the server: fine for one
  server, but it needs a database before the app runs on several. Games are
  credited when the player opens the pass page (the last 50 games are
  checked), and only if their Dota profile exposes public match data.
  Payment and reward delivery aren't connected yet (see Battle pass above).
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
    api/hero/[heroId]/        matchups, roles, build (hero page Build tab)
    api/meta/                 meta tier list as JSON
    drafts/                   Meta page (tier list per position)
    heroes/, heroes/[heroId]/ hero grid + hero page (build, abilities, matchups, AI guide)
    tournaments/              Tournament Tracker (live + recent results)
    matches/[matchId]/        account-less match entry point (redirects)
    challenges/               Battle pass (season, weekly challenges, rewards)
    api/battle-pass/          battle pass state, purchase (not connected yet), reward claims
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
    battlePass/                     battle pass: season and rewards, weekly challenges, server-side store, service
    metrics/                        raw data -> grounded metrics (match, trend, role comparison, match story, hero build, signature hero, draft insights, pro comparison, tournaments, skill build)
    coach/                           prompt + schema + Ollama client for the AI coach
  components/                UI
public/
  minimap.png                the real Dota 2 minimap used on /riddles
```
