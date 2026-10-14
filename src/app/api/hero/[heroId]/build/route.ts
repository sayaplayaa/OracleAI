import { NextRequest, NextResponse } from "next/server";
import { getHeroBuild, getHeroPositionStats } from "@/lib/stratz";
import { getHeroProItemPopularity } from "@/lib/opendota";
import { computeHeroBuildOverview } from "@/lib/metrics/heroBuild";
import { withReplays } from "@/lib/metrics/replayBuild";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ heroId: string }> }
) {
  const { heroId: heroIdParam } = await params;
  const heroId = Number(heroIdParam);
  const position = req.nextUrl.searchParams.get("position");
  if (!Number.isInteger(heroId) || heroId <= 0) {
    return NextResponse.json({ error: "Некорректный id героя" }, { status: 400 });
  }
  if (!position || !/^POSITION_[1-5]$/.test(position)) {
    return NextResponse.json({ error: "Некорректная или отсутствующая позиция" }, { status: 400 });
  }

  try {
    const [positionStats, build, proItems] = await Promise.all([
      getHeroPositionStats(heroId),
      getHeroBuild(heroId, position),
      // Optional: the pro-scene strip just doesn't show without it.
      getHeroProItemPopularity(heroId).catch(() => null),
    ]);
    const totalGames = positionStats.find((s) => s.position === position)?.matchCount ?? 0;
    return NextResponse.json(await withReplays(computeHeroBuildOverview(heroId, position, totalGames, build, proItems)));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось загрузить сборку героя" },
      { status: 502 }
    );
  }
}
