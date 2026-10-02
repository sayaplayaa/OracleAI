import { NextResponse } from "next/server";
import { getAllHeroStats } from "@/lib/stratz";
import { computeMetaTierList } from "@/lib/metrics/heroBuild";
import { getAllHeroes } from "@/lib/constants";

export async function GET() {
  try {
    const heroIds = getAllHeroes().map((h) => h.id);
    const stats = await getAllHeroStats(heroIds);
    return NextResponse.json(computeMetaTierList(stats));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось загрузить мету" },
      { status: 502 }
    );
  }
}
