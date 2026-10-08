// Minimal typed slices of the OpenDota API responses we actually use.
// OpenDota returns much more than this; we only declare the fields the app reads.

export interface OpenDotaProfile {
  profile: {
    account_id: number;
    personaname: string;
    name: string | null;
    avatarfull: string;
    profileurl: string;
    plus: boolean;
  };
  rank_tier: number | null;
  leaderboard_rank: number | null;
  // OpenDota's own MMR estimate, computed from recorded match history/
  // opponent skill - not Valve's official MMR (which no public API exposes),
  // but a real fetched number rather than something we derive ourselves.
  computed_mmr?: number | null;
}

export interface OpenDotaWinLoss {
  win: number;
  lose: number;
}

export interface OpenDotaRecentMatch {
  match_id: number;
  player_slot: number;
  radiant_win: boolean;
  duration: number;
  game_mode: number;
  lobby_type: number;
  hero_id: number;
  start_time: number;
  kills: number;
  deaths: number;
  assists: number;
  skill?: number;
  average_rank?: number;
  // A small fraction of matches (very old or unusual game modes) come back
  // without these - never assume present.
  xp_per_min?: number;
  gold_per_min?: number;
  hero_damage: number;
  tower_damage: number;
  hero_healing: number;
  last_hits: number;
  lane?: number;
  lane_role?: number;
  is_roaming?: boolean;
  party_size?: number | null;
  // 0 = stayed; 1 = disconnected but came back; 2+ = left the game for good
  // (abandoned, AFK, never connected).
  leaver_status?: number | null;
}

export interface OpenDotaHeroStat {
  hero_id: number;
  last_played: number;
  games: number;
  win: number;
  with_games: number;
  with_win: number;
  against_games: number;
  against_win: number;
}

export interface WardLogEntry {
  time: number;
  x: number;
  y: number;
  // Entity handle - pairs a placement with its obs_left_log/sen_left_log
  // entry (the moment the ward expired or was destroyed).
  ehandle?: number;
  player_slot?: number;
  // Left logs only: who destroyed the ward (absent when it simply expired).
  attackername?: string;
}

export interface OpenDotaMatchPlayer {
  account_id?: number;
  personaname?: string | null;
  player_slot: number;
  hero_id: number;
  isRadiant: boolean;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  gold_per_min: number;
  xp_per_min: number;
  level: number;
  hero_damage: number;
  tower_damage: number;
  hero_healing: number;
  gold: number;
  gold_spent: number;
  net_worth?: number;
  stuns?: number;
  obs_placed?: number;
  sen_placed?: number;
  buyback_count?: number;
  lane?: number;
  lane_role?: number;
  is_roaming?: boolean;
  lane_efficiency?: number;
  item_0?: number;
  item_1?: number;
  item_2?: number;
  item_3?: number;
  item_4?: number;
  item_5?: number;
  item_neutral?: number;
  backpack_0?: number;
  backpack_1?: number;
  backpack_2?: number;
  gold_t?: number[];
  xp_t?: number[];
  lh_t?: number[];
  dn_t?: number[];
  // True net worth (items + gold) at each minute mark; gold_t is cumulative
  // gold earned, which is a different number.
  networth_t?: number[];
  // OpenDota's own 1-5 position estimate for this player.
  position_est?: number;
  // 0 = stayed; 1 = disconnected but came back; 2+ = left the game for good
  // (abandoned, AFK, never connected).
  leaver_status?: number;
  connection_log?: { time: number; event: string }[];
  // Times an item was used, by item key (e.g. tpscroll).
  item_uses?: Record<string, number>;
  deaths_log?: { time: number; key: string; gold_lost?: number; time_dead?: number }[];
  buyback_log?: { time: number }[];
  // Seconds by life state: "0" alive, "2" dead (1 is the brief dying state).
  life_state?: Record<string, number>;
  teamfight_participation?: number;
  towers_killed?: number;
  roshans_killed?: number;
  camps_stacked?: number;
  observer_kills?: number;
  sentry_kills?: number;
  purchase_log?: { time: number; key: string }[];
  // Flat, ordered list of ability ids leveled up (talent levels 10/15/20/25
  // are excluded, not just unlabeled) - no per-entry timestamp from OpenDota.
  ability_upgrades_arr?: number[];
  kills_log?: { time: number; key: string }[];
  runes_log?: { time: number; key: string }[];
  obs_log?: WardLogEntry[];
  sen_log?: WardLogEntry[];
  obs_left_log?: WardLogEntry[];
  sen_left_log?: WardLogEntry[];
  // lane_pos[x][y] = number of position samples observed at that grid cell
  // (outer key is x, inner is y - verified against known lanes).
  lane_pos?: Record<string, Record<string, number>>;
  benchmarks?: Record<
    string,
    { raw: number; pct: number }
  >;
  // e.g. {"3": 2, "4": 1} = two triple-kills and one rampage.
  multi_kills?: Record<string, number>;
  // Cumulative hero damage at each minute mark.
  hero_damage_t?: number[];
  // Gold earned by source (Valve's reason codes: 11 buildings, 12 heroes,
  // 13 lane creeps, 14 neutrals, 15 Roshan, 17 bounty runes; 1 = lost on death).
  gold_reasons?: Record<string, number>;
  // Damage taken from each enemy ability/item ("null" = right-click attacks).
  damage_inflictor_received?: Record<string, number>;
  // Times killed by each unit (hero internal name).
  killed_by?: Record<string, number>;
  lane_kills?: number;
  neutral_kills?: number;
  ancient_kills?: number;
  rune_pickups?: number;
}

export interface OpenDotaObjective {
  time: number;
  type: string;
  key?: string;
  slot?: number;
  player_slot?: number;
  team?: number;
}

export interface OpenDotaTeamfightPlayer {
  // Where this player died in this fight: deaths_pos[x][y] = count.
  deaths_pos?: Record<string, Record<string, number>>;
  deaths: number;
  buybacks: number;
  damage: number;
  healing: number;
  gold_delta: number;
  xp_delta: number;
  killed: Record<string, number>;
}

export interface OpenDotaTeamfight {
  start: number;
  end: number;
  last_death: number;
  deaths: number;
  players: OpenDotaTeamfightPlayer[];
}

export interface OpenDotaMatch {
  match_id: number;
  radiant_win: boolean;
  duration: number;
  start_time: number;
  game_mode: number;
  lobby_type: number;
  radiant_score?: number;
  dire_score?: number;
  patch?: number;
  // Present only once OpenDota has fully parsed the replay.
  radiant_gold_adv?: number[];
  radiant_xp_adv?: number[];
  objectives?: OpenDotaObjective[];
  teamfights?: OpenDotaTeamfight[];
  players: OpenDotaMatchPlayer[];
}

export type BenchmarkBucket = { percentile: number; value: number };

export interface OpenDotaBenchmarks {
  hero_id: number;
  result: Record<string, BenchmarkBucket[]>;
}

export interface OpenDotaSearchResult {
  account_id: number;
  personaname: string;
  avatarfull: string;
  similarity: number;
}

export interface OpenDotaMatchupEntry {
  hero_id: number;
  games_played: number;
  wins: number;
}

export interface ParseJobResponse {
  job?: { jobId: number };
}

export interface OpenDotaProPlayer {
  account_id: number;
  name: string | null;
  team_name: string | null;
  team_tag: string | null;
  team_id: number | null;
  // ISO timestamp of this account's last recorded match - used to tell a
  // currently active competitive player from a retired/inactive one.
  last_match_time: string | null;
  // True while the player's team roster is locked for an active Fantasy
  // Dota period, i.e. they're actively competing in an ongoing tournament -
  // the best available real signal for "currently pro," as opposed to just
  // being tagged in OpenDota's broader historical pro roster.
  is_locked: boolean | null;
}

// A finished league/tournament match from OpenDota's proMatches feed.
export interface OpenDotaProMatch {
  match_id: number;
  duration: number;
  start_time: number;
  radiant_team_id: number | null;
  radiant_name: string | null;
  dire_team_id: number | null;
  dire_name: string | null;
  leagueid: number;
  league_name: string;
  radiant_score: number;
  dire_score: number;
  radiant_win: boolean;
}

// A currently-live match from OpenDota's spectate feed. league_id is 0 for
// plain public games - only non-zero entries are real tournament games.
export interface OpenDotaLiveMatch {
  match_id: string;
  league_id: number;
  game_time: number;
  team_name_radiant: string;
  team_name_dire: string;
  radiant_score: number;
  dire_score: number;
}

export interface OpenDotaLeague {
  leagueid: number;
  name: string;
  tier: string | null;
}

// One row from OpenDota's recent-matches-for-a-hero feed. Unlike /rankings
// (top public-match performers, not necessarily pros), every match here has
// a leagueid - these are genuine tournament/league games.
export interface OpenDotaHeroLeagueMatch {
  match_id: number;
  start_time: number;
  duration: number;
  radiant_win: boolean;
  leagueid: number;
  league_name: string;
  radiant: boolean;
  player_slot: number;
  account_id: number;
  kills: number;
  deaths: number;
  assists: number;
}

// ---- App-level computed types ----

export interface MetricPoint {
  label: string;
  value: number | string;
  unit?: string;
  percentile?: number; // 0-100, when compared against a hero benchmark
  benchmarkMedian?: number;
}

export interface MatchDeathEvent {
  time: number;
  killerHeroId: number;
  killerHeroName: string;
}

// One real teamfight (from OpenDota's parsed teamfights) this player was
// actually involved in (nonzero kills/deaths/damage) - not every fight in
// the match, just this player's participation in it.
export interface MatchTeamfightMoment {
  time: number;
  kills: number;
  deaths: number;
  heroDamage: number;
  goldDelta: number;
}

export interface MatchMetrics {
  matchId: number;
  accountId: number;
  heroId: number;
  heroName: string;
  win: boolean;
  duration: number;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  lastHitsAt10: number | null;
  goldAt10: number | null;
  xpAt10: number | null;
  // OpenDota's real (gold_t/xp_t-derived) lane-phase efficiency vs an ideal
  // solo-lane baseline, as a 0-100 percentage - null when unparsed/unavailable.
  laneEfficiency: number | null;
  stats: MetricPoint[];
  itemTimeline: { time: number; itemName: string; itemKey: string }[];
  // Real pre-horn (and just-after) shop purchases - unlike itemTimeline,
  // includes consumables/wards/components, since that's what a starting
  // build actually is.
  startingItems: { time: number; itemName: string; itemKey: string }[];
  // Real death events, derived from the killing player's own kills_log (an
  // entry there naming this hero) - the killer's identity comes from that
  // same player record, so it's real, never inferred/invented. Empty when
  // the match isn't parsed.
  deathLog: MatchDeathEvent[];
  teamfights: MatchTeamfightMoment[];
  wardsPlaced: number;
  buybacks: number;
  // The real hero(es) on the opposing team who shared this player's real
  // physical lane (OpenDota's `lane` field, not the team-relative lane_role -
  // matching on the latter would pair a team's safe lane with the enemy's
  // safe lane, which are on opposite sides of the map and never actually
  // fight each other). Empty when lane data isn't available (unparsed match).
  laneOpponents: {
    heroName: string;
    goldAt10: number | null;
    xpAt10: number | null;
    lastHitsAt10: number | null;
  }[];
}

export interface TrendMatchSummary {
  matchId: number;
  heroId: number;
  heroName: string;
  win: boolean;
  startTime: number;
  duration: number;
  kills: number;
  deaths: number;
  assists: number;
  // OpenDota's match-list endpoint doesn't always include these - null means
  // genuinely unavailable for this match, never a fabricated 0.
  gpm: number | null;
  xpm: number | null;
  gameMode: number;
  // The player left this game (abandon/disconnect for good).
  leftGame: boolean;
}

// A count of how many sampled games this player was ahead/behind/tied
// against their real lane opponent on one stat - a recurring pattern, not
// one game's result.
export interface LaneTally {
  ahead: number;
  behind: number;
  tied: number;
  sampledGames: number;
}

// Real recurring patterns mined from a bounded sample of this player's own
// recent full matches (deaths, lane comparisons) - see trendPatterns.ts.
// Games OpenDota hasn't parsed contribute nothing (never guessed).
export interface CrossMatchPatterns {
  parsedGamesSampled: number;
  // Position (1-5) -> games, as estimated per match.
  positions: Record<number, number>;
  // End of the laning stage these patterns use ("10:00", or "7:00" in Turbo).
  laneEndLabel: string;
  deaths: {
    total: number;
    beforeLaneEnd: number;
    // Deaths outside any teamfight - caught alone.
    outsideFights: number;
    // Games with 2+ deaths before the end of laning.
    gamesWithRoughLane: number;
  };
  // Enemy heroes that killed the player in at least two different games.
  recurringKillers: { killerHeroName: string; deaths: number; games: number }[];
  // Against the enemy on the same position at the end of laning.
  laneNetWorth: LaneTally;
  // Core positions only: last hits are no measure of a support.
  laneLastHits: LaneTally;
}

export interface TrendSplit {
  games: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgGpm: number | null;
  avgLastHitsPerMin: number | null;
}

export interface TrendHero {
  heroId: number;
  heroName: string;
  games: number;
  winRate: number;
}

export interface TrendMetrics {
  accountId: number;
  // Comparable games only (see comparableGames): the player's main kind of
  // game - Turbo or normal - minus games they left.
  sampleSize: number;
  turbo: boolean;
  // Recent games left out of the averages (other mode, or the player left).
  excludedGames: number;
  winRate: number;
  avgKda: number;
  avgGpm: number | null;
  avgXpm: number | null;
  avgDeaths: number;
  // What changes between this player's wins and their losses - the most
  // direct pointer at what loses them games. Null with fewer than 3 of either.
  winsVsLosses: { wins: TrendSplit; losses: TrendSplit } | null;
  // Over the last `heroWindowDays` days, ranked with the sample size taken
  // into account (Wilson bound), not by raw win rate.
  heroWindowDays: number;
  topHeroes: TrendHero[];
  worstHeroes: TrendHero[];
  // Every recent game, newest first (for lists).
  recentMatches: TrendMatchSummary[];
}

// ---- Pro hero spotlight (profile page: how a real pro plays your signature hero) ----

// A real tournament/league game, not a pub match - the "showcase" sample.
export interface ProHeroLeagueGame {
  matchId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  duration: number;
  startTime: number;
  leagueName: string;
}

export interface ProHeroSpotlight {
  heroId: number;
  heroName: string;
  pro: { accountId: number; name: string; teamName: string | null };
  games: number;
  winRate: number;
  avgKda: number;
  avgGpm: number | null;
  avgXpm: number | null;
  // Real recent league/tournament games this specific pro has played on this
  // hero, found via OpenDota's hero-match feed - always at least one entry.
  leagueGames: ProHeroLeagueGame[];
}

export interface CoachFinding {
  point: string;
  metric: string; // the specific metric/value that grounds this claim
  // A measurable goal for the next game, worked out in code from this game's
  // real numbers (e.g. "0 смертей до 10:00 (в этой игре - 3)").
  target?: string;
  // Single-match priorities only, worked out in code: why it cost the game
  // something, the right move in that exact situation, and how it looks in
  // the next game.
  why?: string;
  correct?: string;
  example?: string;
}

// A real chronological moment (a death, a teamfight, an item timing) from a
// single match's timeline - the "watched the replay" part of the report.
// Only the single-match coach report populates this; other report types
// (trends, hero guide, pro comparison) leave it undefined.
export interface MatchKeyMoment {
  time: string; // real in-game time from this match, e.g. "14:32"
  whatHappened: string;
  whatToDoDifferently: string;
}

// A real ward placement (x/y already converted to 0-100 map percent, time in
// match seconds) from this match's obs_log/sen_log - the only real positional
// data OpenDota's public API exposes. Never a hero's position - that data
// doesn't exist in this API.
export interface WardPoint {
  x: number;
  y: number;
  time: number;
  team: "radiant" | "dire";
  kind: "observer" | "sentry";
  // Hero of the player who placed it.
  placedBy?: string | null;
  // Observer vision radius in map percent (for drawing the vision circle).
  radius?: number;
  // True when this ward's vision covered the death spot.
  coversDeath?: boolean;
  // Placed by the analysed player's own team.
  own?: boolean;
}

export type DeathKillerKind = "hero" | "creeps" | "neutrals" | "tower" | "roshan" | "other";

export interface DeathTag {
  text: string;
  tone: "bad" | "warn" | "info";
}

// Real map context for one real death, computed server-side from the replay
// data (STRATZ death events + OpenDota ward/death logs), never by the AI model:
// where it happened, what killed the player, which enemy ward saw them, and
// both teams' wards that were actually standing at that moment.
export interface DeathVisionMoment {
  time: number;
  timeLabel: string;
  // Exact death spot in map percent (0-100); null when no source has it.
  position: { x: number; y: number } | null;
  // Map area, e.g. "вражеский оффлейн (топ)".
  place: string | null;
  side: "own" | "enemy" | "river" | null;
  deepInEnemyTerritory: boolean;
  killer: { kind: DeathKillerKind; heroId: number | null; name: string };
  // In-game (English) name of the killing ability or item, e.g. "Arcane Orb".
  killingBlow: string | null;
  // Every enemy hero credited with the kill or an assist.
  enemiesInvolved: { heroId: number; name: string }[];
  inTeamfight: boolean;
  // Last hits gained right before the death, when the player was farming.
  farmingLastHits: number | null;
  // The enemy Observer Ward whose vision covered the death spot, if any.
  enemyWard: WardPoint | null;
  // Whether the player's own team had an Observer Ward covering the spot
  // (null when the position is unknown).
  ownVision: boolean | null;
  tags: DeathTag[];
  // One deterministic sentence: what killed the player and why.
  reason: string;
  timeDead: number | null;
  goldLost: number | null;
  // Both teams' wards standing at the moment of death.
  wards: WardPoint[];
}

// ---- Role-aware single-match analysis (worked out in code, narrated by the AI) ----

// Things about the game itself that change how it should be read: Turbo's
// different economy, and players who left. Worked out in code from the match.
export interface MatchLeaver {
  heroId: number;
  heroName: string;
  yourTeam: boolean;
  isYou: boolean;
  isCounterpart: boolean;
  // When they left for good (last disconnect without a reconnect); null when
  // the replay doesn't say.
  time: number | null;
}

export interface GameContext {
  turbo: boolean;
  leavers: MatchLeaver[];
  // Short lines for the player, in Russian - shown above the report.
  notes: string[];
}

// How the whole game went for the player's team - a lead that was thrown, a
// comeback, a stomp - and the fights that decided it. Worked out in code from
// the team gold curve, the replay's teamfights and every player's deaths.
export type GameFlowKind = "throw" | "comeback" | "stomp-win" | "stomp-loss" | "close-win" | "close-loss";

export interface FlowFight {
  time: number;
  timeLabel: string;
  // Where the deaths happened, relative to the player's team ("вражеская база").
  place: string | null;
  yourTeamDeaths: number;
  enemyDeaths: number;
  // The team's gold lead the minute before and the minute after.
  leadBefore: number | null;
  leadAfter: number | null;
  // The team had a fresh Aegis.
  aegis: boolean;
  // What the player did in it, one short phrase ("погиб первым из команды").
  yourPart: string;
}

export interface GameFlow {
  kind: GameFlowKind;
  headline: string;
  peakLead: { minute: number; gold: number } | null;
  peakDeficit: { minute: number; gold: number } | null;
  // The team's gold lead per minute (negative = behind).
  lead: number[];
  keyFights: FlowFight[];
  // Lines for the model and the evidence list, in Russian.
  facts: string[];
}

export type PhaseId = "laning" | "midGame" | "lateGame";
export type PhaseVerdict = "won" | "even" | "lost";
export type PositionSource = "stratz" | "opendota" | "lane-estimate";

// Net worth at one minute mark vs the player on the SAME position of the
// opposing team (pos 1 vs pos 1, pos 5 vs pos 5, ...), never a lane-mate.
export interface NetWorthCheckpoint {
  minute: number;
  you: number;
  counterpart: number;
  diff: number;
}

export interface PhaseAnalysis {
  id: PhaseId;
  label: string;
  window: string;
  // Won/even/lost vs the same-position counterpart, decided in code.
  verdict: PhaseVerdict | null;
  verdictBasis: string;
  // Real, already-verified facts about this phase.
  facts: string[];
  // Verified catalyst candidates for how the phase went, most damaging first.
  causes: string[];
  // What a strong coach teaches for those causes, for this role.
  principles: string[];
}

export interface MatchAnalysis {
  matchId: number;
  heroId: number;
  heroName: string;
  win: boolean;
  durationSeconds: number;
  position: number;
  positionLabel: string;
  positionSource: PositionSource;
  counterpart: { heroId: number; heroName: string } | null;
  laneSummary: string;
  netWorth: NetWorthCheckpoint[];
  phases: PhaseAnalysis[];
  // End-of-game comparison lines vs the counterpart, only stats that matter for this role.
  endStateVsCounterpart: string[];
  // End-of-game stats relevant to this role only (with hero-benchmark percentiles).
  stats: MetricPoint[];
  // Every time label (m:ss) the analysis produced - used to reject invented timestamps.
  knownTimes: string[];
  // Heroes that killed this player 2+ times over the whole game.
  repeatKillers: { heroId: number; heroName: string; count: number }[];
  // Display names of every item bought, held or benchmarked - the only items the coach may name.
  knownItems: string[];
  // Real strengths found in the data (empty when there are none).
  strengths: CoachFinding[];
  // The top verified problems across all phases, each with what a coach teaches for it.
  priorities: CoachFinding[];
  buybacksUsed: number;
  context: GameContext;
  // Every death of this player (seconds), for checking count claims.
  deathTimes: number[];
  // Null when the replay has no team gold curve.
  gameFlow: GameFlow | null;
  // Every aspect of the game broken down in code; null without a parsed replay.
  breakdown: MatchBreakdown | null;
}

// ---- Full breakdown: every aspect of one game, worked out in code ----

export type BreakdownAspectId = "laning" | "farm" | "deaths" | "fights" | "items" | "vision" | "objectives";

export type MistakeSeverity = "high" | "medium" | "low";

// One mistake, explained the way a coach reviewing the replay would: what
// the replay shows, why it cost something, what the right move was in that
// exact spot, and how it looks in the next game.
export interface BreakdownMistake {
  code: string;
  severity: MistakeSeverity;
  phase: PhaseId | null;
  // Time label of the moment it's about, when there is one.
  time: string | null;
  title: string;
  whatHappened: string;
  why: string;
  correct: string;
  example: string;
  target?: string;
}

// One row of an aspect's table: the player, the enemy on the same position,
// and a reference (the median player on this hero, or the game's own bar).
export interface BreakdownStat {
  label: string;
  you: string;
  counterpart?: string;
  reference?: string;
  tone?: "good" | "bad" | "neutral";
}

export interface BreakdownAspect {
  id: BreakdownAspectId;
  title: string;
  grade: "good" | "ok" | "bad";
  // One line: how this part of the game went.
  summary: string;
  stats: BreakdownStat[];
  good: string[];
  // Facts that aren't a mistake or a strength but belong to the picture.
  notes: string[];
  mistakes: BreakdownMistake[];
}

// Every death of the player, one by one.
export interface DeathReview {
  time: number;
  timeLabel: string;
  // mistake: avoidable; fight: died in a fight the team lost or drew;
  // trade: died in a fight the team won - a fair price.
  verdict: "mistake" | "fight" | "trade";
  title: string;
  // Everything the replay says about it.
  facts: string[];
  why: string | null;
  correct: string | null;
  example: string | null;
}

// Every teamfight of the game and what the player did in it.
export interface FightReview {
  time: number;
  timeLabel: string;
  place: string | null;
  result: "won" | "lost" | "even";
  yourTeamDeaths: number;
  enemyDeaths: number;
  leadBefore: number | null;
  leadAfter: number | null;
  // One phrase: what the player did ("участвовал и выжил").
  you: string;
  tone: "good" | "bad" | "neutral";
  facts: string[];
  // What the right play was, when the player's part was a mistake.
  correct: string | null;
}

export type TimelineEventKind =
  | "kill"
  | "death"
  | "item"
  | "level"
  | "fight"
  | "building"
  | "roshan"
  | "buyback"
  | "rune"
  | "firstblood";

export interface TimelineEvent {
  time: number;
  timeLabel: string;
  kind: TimelineEventKind;
  text: string;
  tone: "good" | "bad" | "neutral";
}

export interface MatchBreakdown {
  aspects: BreakdownAspect[];
  deaths: DeathReview[];
  fights: FightReview[];
  timeline: TimelineEvent[];
}

export interface CoachPhaseReport {
  id: PhaseId;
  label: string;
  window: string;
  verdict: PhaseVerdict | null;
  // Facts from the analysis (code), shown as evidence under the AI's write-up.
  evidence: string[];
  // Verified catalyst candidates worked out in code, most damaging first.
  catalysts: string[];
  whatWentWrong: string;
  // The decision/habit that caused it.
  decision: string;
  doInstead: string;
}

export interface CoachComparison {
  counterpartHero: string;
  positionLabel: string;
  positionSource: PositionSource;
  netWorth: NetWorthCheckpoint[];
}

export interface CoachReport {
  summary: string;
  // Phase-by-phase breakdown (single-match report only).
  phases?: CoachPhaseReport[];
  // Net worth vs the same-position enemy player (single-match report only).
  comparison?: CoachComparison;
  keyMoments?: MatchKeyMoment[];
  // Only the single-match coach report populates this - computed
  // deterministically from real match data, not part of the AI's own output.
  deathVision?: DeathVisionMoment[];
  // Single-match report only: Turbo / leavers, shown above everything else.
  context?: GameContext;
  // Single-match report only: how the whole game went and what decided it.
  gameFlow?: GameFlow;
  // Single-match report only: every aspect of the game, worked out in code.
  breakdown?: MatchBreakdown;
  strengths: CoachFinding[];
  weaknesses: CoachFinding[];
  tips: CoachFinding[];
}

// ---- Hero guide (real ability kit + AI write-up grounded in it) ----

export interface HeroAbility {
  key: string;
  name: string;
  // Official Russian client text when available, else the English original.
  description: string;
  // Always the English original - keyword checks (does this kit stun/heal?)
  // are written against it.
  descriptionEn: string;
  isInnate: boolean;
  // `localized`: the label is Russian (official client text or a standard
  // term). Internal values the game client never shows keep an English label
  // and are only passed to the AI, not displayed.
  attributes: { header: string; value: string; localized: boolean }[];
  iconUrl: string;
}

export interface HeroGuideReport {
  identity: string;
  // The role the guide is written for.
  position: string;
  roleLabel: string;
  // The real build it was written from - shown as-is, never written by the model.
  build: Pick<HeroBuildOverview, "games" | "earlyItems" | "boots" | "coreProgression"> | null;
  // Boots and core items: why each one, and what to do once it's bought.
  itemTips: HeroGuideItemTip[];
  laningTips: CoachFinding[];
  teamfightTips: CoachFinding[];
  matchupTips: CoachFinding[];
}

export interface HeroGuideItemTip {
  itemKey: string;
  itemName: string;
  // From the build data, never from the model.
  pickRate: number;
  avgTimeSeconds: number;
  why: string;
  whatToDo: string;
}

// ---- Skill build (real, per-match ability level-up order) ----

export interface SkillBuildEntry {
  level: number;
  abilityKey: string;
  abilityName: string;
  iconUrl: string;
  // Which point this is in that specific ability (1st, 2nd, ...) - lets the
  // coach cite the real numeric value for the rank actually reached, instead
  // of guessing which entry in the ability's value array applies.
  rank: number;
  // Interpolated from this player's real xp_t series against dotaconstants'
  // official xp_level thresholds - a real-data estimate, not a logged
  // timestamp (OpenDota doesn't record exactly when a level-up happened).
  approxTimeSeconds: number | null;
}

// ---- Power Spike (real, per-match item/level timing coaching) ----

export interface PowerSpikeMoment {
  trigger: string; // e.g. "Battle Fury completed" or "Level 6 (ultimate unlocked)"
  timing: string; // real or "~" interpolated time from this match, e.g. "14:32" or "~9:40"
  why: CoachFinding;
  whatToDo: CoachFinding;
}

export interface PowerSpikeReport {
  summary: string;
  moments: PowerSpikeMoment[];
}

// ---- Full match (all 10 players) ----

export interface WardPlacement {
  time: number;
  x: number;
  y: number;
}

export interface HeatmapCell {
  x: number;
  y: number;
  count: number;
}

export interface FarmPoint {
  minute: number;
  lastHits: number;
  gold: number;
}

export interface FullMatchPlayer {
  accountId: number | null;
  personaname: string | null;
  heroId: number;
  heroName: string;
  isRadiant: boolean;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  netWorth: number;
  gpm: number;
  xpm: number;
  heroDamage: number;
  heroHealing: number;
  towerDamage: number;
  lastHits: number;
  denies: number;
  obsPlaced: number;
  senPlaced: number;
  itemKeys: string[];
  farmTrend: FarmPoint[];
  // Per-minute values (index = minute) for the post-game style graphs;
  // empty arrays when the replay isn't parsed.
  series: {
    netWorth: number[];
    xp: number[];
    lastHits: number[];
    denies: number[];
  };
  observerWards: WardPlacement[];
  sentryWards: WardPlacement[];
  positionHeatmap: HeatmapCell[] | null;
}

export interface FullMatchOverview {
  matchId: number;
  radiantWin: boolean;
  duration: number;
  radiantScore: number | null;
  direScore: number | null;
  gameMode: string;
  lobbyType: string;
  patch: string | null;
  isParsed: boolean;
  goldAdvTrend: { minute: number; value: number }[];
  xpAdvTrend: { minute: number; value: number }[];
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
}

// ---- Draft / matchup explorer ----

export interface HeroMatchup {
  heroId: number;
  heroName: string;
  gamesPlayed: number;
  wins: number;
  winRate: number;
}

export interface DraftInsights {
  heroId: number;
  heroName: string;
  toughestMatchups: HeroMatchup[]; // opponents this hero historically loses to
  bestMatchups: HeroMatchup[]; // opponents this hero historically beats
  // Real teammate lane-pairing win rates from STRATZ, for this hero's most
  // common lane position. Empty when STRATZ_API_KEY isn't configured.
  bestLanePartners: HeroMatchup[];
  lanePosition: string | null;
}

export interface HeroSummary {
  id: number;
  name: string;
  primaryAttr: string;
  roles: string[];
}

// ---- Hero Build Inspector ----

export interface RolePickStat {
  position: string; // raw enum, e.g. "POSITION_1"
  roleLabel: string; // "Carry", "Mid", "Offlane", "Support", "Hard Support"
  games: number;
  winRate: number;
}

export interface HeroRoleOverview {
  heroId: number;
  heroName: string;
  roles: RolePickStat[];
}

export interface ItemStat {
  itemKey: string;
  itemName: string;
  matchCount: number;
  winRate: number;
  // Share of this hero+position's games (Legend+, this week) it was bought in.
  pickRate?: number;
}

export interface ItemProgressionPoint extends ItemStat {
  // Median minute it's bought in, as seconds.
  avgTimeSeconds: number;
  // Components bought on the way that are popular in their own right
  // (Skull Basher before Abyssal Blade), folded into this item.
  builtFrom?: ItemStat[];
}

export interface NeutralItemTier {
  tier: number;
  items: ItemStat[];
}

export interface TalentOption {
  label: string; // exact Dota display text, e.g. "+10 Strength"
  matchCount: number;
  winRate: number;
  isTopChoice: boolean;
  isHighestWin: boolean;
}

export interface TalentLevel {
  level: number;
  options: TalentOption[];
}

export interface MetaTierEntry {
  heroId: number;
  heroName: string;
  position: string;
  roleLabel: string;
  games: number;
  winRate: number;
}

export interface HeroBuildOverview {
  heroId: number;
  position: string;
  roleLabel: string;
  // Games this build is drawn from (Legend+, this week).
  games: number;
  // `copies`: how many of it the usual start has (Iron Branch x3).
  startingItems: (ItemStat & { copies: number })[];
  // Cheap items bought in the first minutes (Magic Wand, Wraith Band).
  earlyItems: ItemProgressionPoint[];
  boots: ItemProgressionPoint[];
  // Bought in 20%+ of games, in their usual order.
  coreProgression: ItemProgressionPoint[];
  situationalItems: ItemProgressionPoint[];
  neutralTiers: NeutralItemTier[];
  talents: TalentLevel[];
}

// ---- Role comparison (same-position head-to-head within one match) ----

export interface RoleComparisonStat {
  label: string;
  unit?: string;
  radiantValue: number;
  direValue: number;
  radiantWins: boolean;
}

export interface RoleComparisonEntry {
  position: string; // "Position 1".."Position 5"
  positionConfirmed: boolean; // true if STRATZ supplied it, false if estimated by GPM rank
  radiant: FullMatchPlayer;
  dire: FullMatchPlayer;
  stats: RoleComparisonStat[];
  radiantStatsWon: number;
  direStatsWon: number;
}

export interface StratzMatchPlayerPosition {
  heroId: number;
  isRadiant: boolean;
  // Raw enum, e.g. "POSITION_1" - null when STRATZ can't confidently classify
  // this player (e.g. unusual game modes, very short/one-sided games).
  position: string | null;
}

// ---- Match story (key moments + outcome explanation) ----

export type MatchStoryEventType =
  | "first_blood"
  | "tower"
  | "barracks"
  | "roshan"
  | "teamfight"
  | "swing"
  | "multi_kill";

export interface MatchStoryEvent {
  time: number;
  type: MatchStoryEventType;
  team: "radiant" | "dire" | null;
  description: string;
  detail?: string;
}

export interface MatchStory {
  events: MatchStoryEvent[]; // chronological - only events with a real timestamp
  // Real but untimed highlights (e.g. multi-kills - OpenDota doesn't record
  // when they happened, only the count), shown separately from the timeline.
  highlights: string[];
  biggestSwing: { minute: number; delta: number; towardTeam: "radiant" | "dire" } | null;
  peakRadiantLead: { minute: number; value: number } | null;
  peakDireLead: { minute: number; value: number } | null;
}
