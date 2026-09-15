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
  // Present only once OpenDota has fully parsed the replay.
  radiant_gold_adv?: number[];
  radiant_xp_adv?: number[];
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
