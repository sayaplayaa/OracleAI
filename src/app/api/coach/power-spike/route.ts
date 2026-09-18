import { NextRequest, NextResponse } from "next/server";
import { getMatch, OpenDotaError } from "@/lib/opendota";
import { computeMatchMetrics } from "@/lib/metrics/matchMetrics";
import { computeSkillBuild } from "@/lib/metrics/skillBuild";
import { getHeroAbilityKit } from "@/lib/heroAbilities";
import { coachPowerSpike } from "@/lib/coach/client";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const matchId = Number(body?.matchId);
  const accountId = Number(body?.accountId);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "Invalid matchId" }, { status: 400 });
  }
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid accountId" }, { status: 400 });
  }

  try {
    const match = await getMatch(matchId);
    const player = match.players.find((p) => p.account_id === accountId);
    if (!player) {
      return NextResponse.json(
        { error: "Player did not play in this match" },
        { status: 404 }
      );
    }

    const metrics = computeMatchMetrics(match, accountId, null);
    const skillBuild = computeSkillBuild(player, player.hero_id);
    const abilities = getHeroAbilityKit(player.hero_id);

    if (metrics.itemTimeline.length === 0 && skillBuild.length === 0) {
      return NextResponse.json(
        { error: "This match doesn't have parsed item/level data yet." },
        { status: 404 }
      );
    }

    const report = await coachPowerSpike(metrics.heroName, abilities, metrics.itemTimeline, skillBuild);
    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof OpenDotaError && err.status === 404) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI coach failed" },
      { status: 502 }
    );
  }
}
