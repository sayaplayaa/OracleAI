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
  xp_per_min: number;
  gold_per_min: number;
  hero_damage: number;
  tower_damage: number;
  hero_healing: number;
  last_hits: number;
  lane?: number;
  lane_role?: number;
  is_roaming?: boolean;
  party_size?: number | null;
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
  purchase_log?: { time: number; key: string }[];
  kills_log?: { time: number; key: string }[];
  runes_log?: { time: number; key: string }[];
  obs_log?: WardLogEntry[];
  sen_log?: WardLogEntry[];
  // lane_pos[y][x] = number of position samples observed at that grid cell.
  lane_pos?: Record<string, Record<string, number>>;
  benchmarks?: Record<
    string,
    { raw: number; pct: number }
  >;
  // e.g. {"3": 2, "4": 1} = two triple-kills and one rampage.
  multi_kills?: Record<string, number>;
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

// ---- App-level computed types ----

export interface MetricPoint {
  label: string;
  value: number | string;
  unit?: string;
  percentile?: number; // 0-100, when compared against a hero benchmark
  benchmarkMedian?: number;
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
  stats: MetricPoint[];
  itemTimeline: { time: number; itemName: string; itemKey: string }[];
  wardsPlaced: number;
  buybacks: number;
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
  gpm: number;
  xpm: number;
}

export interface TrendMetrics {
  accountId: number;
  sampleSize: number;
  winRate: number;
  avgKda: number;
  avgGpm: number;
  avgXpm: number;
  avgDeaths: number;
  gpmTrend: { match: number; value: number }[];
  xpmTrend: { match: number; value: number }[];
  deathsTrend: { match: number; value: number }[];
  roleDistribution: Record<string, number>;
  topHeroes: {
    heroId: number;
    heroName: string;
    games: number;
    winRate: number;
  }[];
  worstHeroes: {
    heroId: number;
    heroName: string;
    games: number;
    winRate: number;
  }[];
  recentMatches: TrendMatchSummary[];
}

export interface CoachFinding {
  point: string;
  metric: string; // the specific metric/value that grounds this claim
}

export interface CoachReport {
  summary: string;
  strengths: CoachFinding[];
  weaknesses: CoachFinding[];
  tips: CoachFinding[];
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
}

export interface ItemProgressionPoint extends ItemStat {
  avgTimeSeconds: number;
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
  startingItems: ItemStat[];
  coreProgression: ItemProgressionPoint[];
  situationalItems: ItemStat[];
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
