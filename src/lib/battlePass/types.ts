// What the battle pass page receives from /api/battle-pass. Safe to import
// on the client: no server code here.

export type PassChallengeType =
  | "fewer_deaths"
  | "clean_streak"
  | "kda"
  | "hero_gpm"
  | "last_hits"
  | "wins"
  | "review";

export type ChallengeDifficulty = "easy" | "medium" | "hard";

export interface PassChallengeView {
  id: string;
  type: PassChallengeType;
  title: string;
  description: string;
  difficulty: ChallengeDifficulty;
  points: number;
  // Games (or reviews) that already met the bar, and how many are needed.
  progress: number;
  required: number;
  status: "active" | "completed" | "expired";
  // When it stops counting (end of its week), ms.
  endsAt: number;
  // Games that counted toward it.
  matchIds: number[];
  turbo: boolean;
}

export type RewardKind = "wards" | "hero_set" | "taunt" | "dota_plus" | "rare_set" | "courier" | "immortal" | "arcana";

export type RewardState =
  // Level not reached yet.
  | "locked"
  // Level reached, but the pass isn't bought.
  | "need_pass"
  // Ready to claim.
  | "available"
  // Claimed: waiting to be sent, or sent.
  | "pending"
  | "sent";

export interface RewardView {
  level: number;
  kind: RewardKind;
  title: string;
  description: string;
  // The player picks the hero or item (a set "на выбор").
  needsChoice: boolean;
  // Delivered as a Steam trade offer, so a trade link is needed.
  needsTradeUrl: boolean;
  state: RewardState;
  claimedAt?: number;
  choice?: string;
}

export interface PointsEvent {
  at: number;
  points: number;
  title: string;
}

export interface BattlePassView {
  season: {
    id: string;
    name: string;
    startsAt: number;
    endsAt: number;
    // 0-based week of the season; -1 before it starts, `weeks` after it ends.
    week: number;
    weeks: number;
    weekEndsAt: number | null;
  };
  level: number;
  maxLevel: number;
  points: number;
  pointsPerLevel: number;
  // Points already earned toward the next level.
  pointsInLevel: number;
  pass: {
    owned: boolean;
    since: number | null;
    // Payment isn't connected yet: `devUnlock` lets a test setup activate it.
    purchase: { available: boolean; devUnlock: boolean; price: string | null };
  };
  rewards: RewardView[];
  challenges: { current: PassChallengeView[]; past: PassChallengeView[] };
  history: PointsEvent[];
  form: { games: number; turbo: boolean; winRate: number; deaths: number; kda: number } | null;
  // Something the player should know (matches couldn't be loaded, etc.).
  notice: string | null;
}
