import { NextRequest, NextResponse } from "next/server";
import { getHeroPositionStats } from "@/lib/stratz";
import { computeHeroRoleOverview } from "@/lib/metrics/heroBuild";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ heroId: string }> }
) {
  const { heroId: heroIdParam } = await params;
  const heroId = Number(heroIdParam);
  if (!Number.isInteger(heroId) || heroId <= 0) {
    return NextResponse.json({ error: "Некорректный id героя" }, { status: 400 });
  }

  try {
    const stats = await getHeroPositionStats(heroId);
    return NextResponse.json(computeHeroRoleOverview(heroId, stats));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось загрузить статистику по ролям" },
      { status: 502 }
    );
  }
}
