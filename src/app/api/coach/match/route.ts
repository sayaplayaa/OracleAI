import { NextRequest, NextResponse } from "next/server";
import { getMatch, getBenchmarks, ensureMatchParsed } from "@/lib/opendota";
import { getMatchDeathEvents, getMatchPlayerPositions } from "@/lib/stratz";
import { computeMatchMetrics } from "@/lib/metrics/matchMetrics";
import { computeDeathVision } from "@/lib/metrics/deathVision";
import { fetchMetaItemTiming } from "@/lib/metrics/matchItemContext";
import { resolveAllPositions } from "@/lib/metrics/matchPositions";
import { buildMatchAnalysis } from "@/lib/metrics/matchAnalysis";
import { coachMatch } from "@/lib/coach/client";
import type { CoachReport } from "@/lib/types";

class CoachRouteError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

// The analysis takes anywhere from half a minute to a couple of minutes, so
// the same game must never be generated twice at once (two tabs, a double
// click, React's dev double-mount) and a finished one is kept for a while.
// A report without phases means OpenDota hadn't parsed the replay yet - kept
// only briefly so a later visit can pick up the full analysis.
const FULL_REPORT_TTL_MS = 6 * 60 * 60 * 1000;
const PARTIAL_REPORT_TTL_MS = 5 * 60 * 1000;

const finished = new Map<string, { report: CoachReport; expiresAt: number }>();
const inFlight = new Map<string, Promise<CoachReport>>();

async function buildReport(matchId: number, accountId: number): Promise<CoachReport> {
  let match = await getMatch(matchId);
  const player = match.players.find((p) => p.account_id === accountId);
  if (!player) throw new CoachRouteError("Этот игрок не играл в этом матче", 404);

  // The coach report is much weaker without a real death/teamfight/item
  // timeline - request a parse and wait for it rather than immediately
  // settling for the degraded "no timeline data" report every time.
  match = await ensureMatchParsed(matchId, match);

  const benchmarks = await getBenchmarks(player.hero_id).catch(() => null);
  const metrics = computeMatchMetrics(match, accountId, benchmarks);

  // Best-effort: STRATZ gives a real per-match position classifier for all ten
  // players; OpenDota's own estimate and a lane heuristic are the fallbacks.
  // Every player is compared only with the enemy player on the same position.
  // Its death events (exact spot, killing ability) are best-effort too.
  const [stratzPositions, stratzDeaths] = await Promise.all([
    getMatchPlayerPositions(matchId).catch(() => null),
    getMatchDeathEvents(matchId).catch(() => null),
  ]);
  const positions = resolveAllPositions(match, stratzPositions);
  const position = positions.bySlot.get(player.player_slot) ?? 3;

  // Real core-item build timing for this hero+position, from STRATZ's
  // aggregate of the broader current playerbase.
  const metaItemTiming = await fetchMetaItemTiming(player.hero_id, `POSITION_${position}`);

  const deathVision = computeDeathVision(match, accountId, metrics.deathLog, stratzDeaths);
  const analysis = buildMatchAnalysis({ match, accountId, positions, metrics, metaItemTiming, deathVision });
  const report = await coachMatch(analysis);
  return { ...report, deathVision };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const matchId = Number(body?.matchId);
  const accountId = Number(body?.accountId);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "Некорректный matchId" }, { status: 400 });
  }
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Некорректный accountId" }, { status: 400 });
  }

  const key = `${matchId}:${accountId}`;
  const hit = finished.get(key);
  if (hit && hit.expiresAt > Date.now()) return NextResponse.json(hit.report);

  let pending = inFlight.get(key);
  if (!pending) {
    pending = buildReport(matchId, accountId)
      .then((report) => {
        const full = Boolean(report.phases && report.phases.length > 0);
        finished.set(key, {
          report,
          expiresAt: Date.now() + (full ? FULL_REPORT_TTL_MS : PARTIAL_REPORT_TTL_MS),
        });
        return report;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }

  try {
    return NextResponse.json(await pending);
  } catch (err) {
    if (err instanceof CoachRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ИИ-тренер не смог составить отчёт" },
      { status: 502 }
    );
  }
}
