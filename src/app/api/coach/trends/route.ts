import { NextRequest, NextResponse } from "next/server";
import { getRecentMatches, getRecentHeroStats, getMatch } from "@/lib/opendota";
import { computeTrendMetrics, HERO_WINDOW_DAYS } from "@/lib/metrics/trendMetrics";
import { computeCrossMatchPatterns } from "@/lib/metrics/trendPatterns";
import { inFamily, leftTheGame } from "@/lib/metrics/gameContext";
import { coachTrends } from "@/lib/coach/client";
import { pluralRu } from "@/lib/format";
import type { OpenDotaMatch } from "@/lib/types";

// Independent of the lightweight match-list `limit` - fetching full match
// detail for every recent game would be slow, so the deep cross-match
// analysis (deaths, lane comparisons) always looks at at most this many,
// newest first. Matches computeCrossMatchPatterns' own bound.
const DEEP_SAMPLE_SIZE = 10;
// Fewer comparable games than this and a "trend" is one or two games' story.
const MIN_TREND_GAMES = 5;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const accountId = Number(body?.accountId);
  const limit = Number.isInteger(Number(body?.limit)) ? Number(body?.limit) : 20;

  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Некорректный accountId" }, { status: 400 });
  }

  try {
    const matches = await getRecentMatches(accountId, limit);
    const base = computeTrendMetrics(accountId, matches);
    if (base.sampleSize < MIN_TREND_GAMES) {
      return NextResponse.json(
        {
          error:
            matches.length === 0
              ? "Не видно ни одной недавней игры - проверь, что в Dota 2 включена опция «Expose Public Match Data»."
              : `Для трендов нужно хотя бы ${MIN_TREND_GAMES} сравнимых игр, а среди последних ${matches.length} их ${base.sampleSize} ${pluralRu(base.sampleSize, ["игра", "игры", "игр"])} (Turbo и обычные игры не смешиваются, игры, которые ты покинул, не учитываются).`,
        },
        { status: 422 }
      );
    }

    // Best-effort: a match that fails to fetch just contributes nothing to
    // the cross-match patterns rather than failing the whole report.
    const deep = matches
      .filter((m) => inFamily(m.game_mode, base.turbo) && !leftTheGame(m.leaver_status))
      .slice(0, DEEP_SAMPLE_SIZE);
    const [heroStats, fullMatches] = await Promise.all([
      getRecentHeroStats(accountId, HERO_WINDOW_DAYS, base.turbo).catch(() => []),
      Promise.all(deep.map((m) => getMatch(m.match_id).catch(() => null))),
    ]);

    const metrics = computeTrendMetrics(accountId, matches, heroStats);
    const patterns = computeCrossMatchPatterns(
      accountId,
      fullMatches.filter((m): m is OpenDotaMatch => m !== null),
      metrics.turbo
    );

    const report = await coachTrends(metrics, patterns);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ИИ-тренер не смог составить отчёт" },
      { status: 502 }
    );
  }
}
