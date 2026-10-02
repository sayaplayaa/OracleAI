import { NextRequest, NextResponse } from "next/server";
import { getHeroBuild, getHeroPositionStats } from "@/lib/stratz";
import { computeHeroBuildOverview } from "@/lib/metrics/heroBuild";

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
    const [positionStats, build] = await Promise.all([
      getHeroPositionStats(heroId),
      getHeroBuild(heroId, position),
    ]);
    const totalGames = positionStats.find((s) => s.position === position)?.matchCount ?? 0;
    return NextResponse.json(computeHeroBuildOverview(heroId, position, totalGames, build));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось загрузить сборку героя" },
      { status: 502 }
    );
  }
}
