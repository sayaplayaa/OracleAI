import { NextRequest, NextResponse } from "next/server";
import { getHeroMatchups } from "@/lib/opendota";
import { getHeroPositionStats } from "@/lib/stratz";
import { getHeroAbilityKit } from "@/lib/heroAbilities";
import { getHeroName } from "@/lib/constants";
import { computeHeroRoleOverview } from "@/lib/metrics/heroBuild";
import { computeDraftInsights } from "@/lib/metrics/draftInsights";
import { coachHeroGuide } from "@/lib/coach/client";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const heroId = Number(body?.heroId);

  if (!Number.isInteger(heroId) || heroId <= 0) {
    return NextResponse.json({ error: "Invalid heroId" }, { status: 400 });
  }

  try {
    const abilities = getHeroAbilityKit(heroId);
    const [positionStats, matchups] = await Promise.all([
      getHeroPositionStats(heroId).catch(() => []),
      getHeroMatchups(heroId),
    ]);
    const roleOverview = computeHeroRoleOverview(heroId, positionStats);
    const draftInsights = computeDraftInsights(heroId, matchups);

    const report = await coachHeroGuide(getHeroName(heroId), abilities, roleOverview, draftInsights);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI hero guide failed" },
      { status: 502 }
    );
  }
}
