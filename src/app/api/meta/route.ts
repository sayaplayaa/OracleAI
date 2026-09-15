import { NextRequest, NextResponse } from "next/server";
import { getAllHeroStats } from "@/lib/stratz";
import { computeMetaTierList } from "@/lib/metrics/heroBuild";
import { getAllHeroes } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get("role") ?? "all";

  try {
    const heroIds = getAllHeroes().map((h) => h.id);
    const stats = await getAllHeroStats(heroIds);
    return NextResponse.json(computeMetaTierList(stats, role));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load meta data" },
      { status: 502 }
    );
  }
}
