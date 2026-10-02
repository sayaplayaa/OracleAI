import type { OpenDotaMatch, OpenDotaMatchPlayer, PositionSource, StratzMatchPlayerPosition } from "../types";

export interface ResolvedPositions {
  // player_slot -> 1..5, for all ten players (anonymous ones included).
  bySlot: Map<number, number>;
  source: PositionSource;
}

function isFullTeamAssignment(match: OpenDotaMatch, bySlot: Map<number, number>): boolean {
  for (const isRadiant of [true, false]) {
    const seen = new Set<number>();
    for (const p of match.players.filter((x) => x.isRadiant === isRadiant)) {
      const pos = bySlot.get(p.player_slot);
      if (!pos || pos < 1 || pos > 5) return false;
      seen.add(pos);
    }
    if (seen.size !== 5) return false;
  }
  return true;
}

function fromStratz(
  match: OpenDotaMatch,
  stratz: StratzMatchPlayerPosition[]
): Map<number, number> | null {
  const bySlot = new Map<number, number>();
  for (const p of match.players) {
    const found = stratz.find((s) => s.heroId === p.hero_id && s.isRadiant === p.isRadiant);
    const n = found?.position?.match(/POSITION_(\d)/)?.[1];
    if (!n) return null;
    bySlot.set(p.player_slot, Number(n));
  }
  return isFullTeamAssignment(match, bySlot) ? bySlot : null;
}

function fromOpenDotaEstimate(match: OpenDotaMatch): Map<number, number> | null {
  const bySlot = new Map<number, number>();
  for (const p of match.players) {
    if (typeof p.position_est !== "number") return null;
    bySlot.set(p.player_slot, p.position_est);
  }
  return isFullTeamAssignment(match, bySlot) ? bySlot : null;
}

function byGpm(a: OpenDotaMatchPlayer, b: OpenDotaMatchPlayer): number {
  return b.gold_per_min - a.gold_per_min;
}

// Last resort: team-relative lane roles (safe/mid/off) split by farm, falling
// back to plain GPM order when a team's lane layout is unusual.
function fromLaneEstimate(match: OpenDotaMatch): Map<number, number> {
  const bySlot = new Map<number, number>();
  for (const isRadiant of [true, false]) {
    const team = match.players.filter((p) => p.isRadiant === isRadiant);
    const mid = team.filter((p) => p.lane_role === 2 && !p.is_roaming);
    const safe = team.filter((p) => p.lane_role === 1).sort(byGpm);
    const off = team.filter((p) => p.lane_role === 3).sort(byGpm);

    if (mid.length === 1 && safe.length === 2 && off.length === 2) {
      bySlot.set(mid[0].player_slot, 2);
      bySlot.set(safe[0].player_slot, 1);
      bySlot.set(safe[1].player_slot, 5);
      bySlot.set(off[0].player_slot, 3);
      bySlot.set(off[1].player_slot, 4);
    } else {
      [...team].sort(byGpm).forEach((p, i) => bySlot.set(p.player_slot, i + 1));
    }
  }
  return bySlot;
}

/**
 * Real position (1-5) of every player in the match, both teams - the basis for
 * comparing each player only with the enemy player on the same position.
 * STRATZ's per-match classifier first, then OpenDota's own estimate, then a
 * lane/farm heuristic.
 */
export function resolveAllPositions(
  match: OpenDotaMatch,
  stratzPositions: StratzMatchPlayerPosition[] | null
): ResolvedPositions {
  if (stratzPositions) {
    const bySlot = fromStratz(match, stratzPositions);
    if (bySlot) return { bySlot, source: "stratz" };
  }
  const estimated = fromOpenDotaEstimate(match);
  if (estimated) return { bySlot: estimated, source: "opendota" };
  return { bySlot: fromLaneEstimate(match), source: "lane-estimate" };
}
