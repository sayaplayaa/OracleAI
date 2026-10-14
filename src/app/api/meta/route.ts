import { NextResponse } from "next/server";
import { getPatchHeroStats } from "@/lib/stratz";
import { computeMetaTierList } from "@/lib/metrics/heroBuild";
import { getAllHeroes } from "@/lib/constants";

export async function GET() {
  try {
    const heroIds = getAllHeroes().map((h) => h.id);
    const { patch, since, includesPreviousPatch, stats } = await getPatchHeroStats(heroIds);
    return NextResponse.json({ patch, since, includesPreviousPatch, positions: computeMetaTierList(stats) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось загрузить мету" },
      { status: 502 }
    );
  }
}
