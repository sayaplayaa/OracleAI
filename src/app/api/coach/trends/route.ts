import { NextRequest, NextResponse } from "next/server";
import { getRecentMatches, getHeroStats, getMatch } from "@/lib/opendota";
import { computeTrendMetrics } from "@/lib/metrics/trendMetrics";
import { computeCrossMatchPatterns } from "@/lib/metrics/trendPatterns";
import { coachTrends } from "@/lib/coach/client";
import type { OpenDotaMatch } from "@/lib/types";

// Independent of the lightweight match-list `limit` - fetching full match
// detail for every recent game would be slow, so the deep cross-match
// analysis (deaths, lane comparisons) always looks at at most this many,
// newest first. Matches computeCrossMatchPatterns' own bound.
const DEEP_SAMPLE_SIZE = 10;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const accountId = Number(body?.accountId);
  const limit = Number.isInteger(Number(body?.limit)) ? Number(body?.limit) : 20;

  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Некорректный accountId" }, { status: 400 });
  }

  try {
    const [matches, heroStats] = await Promise.all([
      getRecentMatches(accountId, limit),
      getHeroStats(accountId),
    ]);

    // Best-effort: a match that fails to fetch just contributes nothing to
    // the cross-match patterns rather than failing the whole report.
    const fullMatches = (
      await Promise.all(
        matches.slice(0, DEEP_SAMPLE_SIZE).map((m) => getMatch(m.match_id).catch(() => null))
      )
    ).filter((m): m is OpenDotaMatch => m !== null);

    const patterns = computeCrossMatchPatterns(accountId, fullMatches);
    const metrics = computeTrendMetrics(accountId, matches, heroStats);

    const report = await coachTrends(metrics, patterns);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ИИ-тренер не смог составить отчёт" },
      { status: 502 }
    );
  }
}
