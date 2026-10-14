import { NextRequest, NextResponse } from "next/server";
import { getHeroMatchups, getHeroProItemPopularity } from "@/lib/opendota";
import { getHeroBuild, getHeroPositionStats } from "@/lib/stratz";
import { getHeroAbilityKit } from "@/lib/heroAbilities";
import { getHeroInternalName, getHeroName } from "@/lib/constants";
import { computeHeroBuildOverview, computeHeroRoleOverview, roleLabelForPosition } from "@/lib/metrics/heroBuild";
import { computeDraftInsights } from "@/lib/metrics/draftInsights";
import { withReplays } from "@/lib/metrics/replayBuild";
import { coachHeroGuide } from "@/lib/coach/client";
import type { HeroGuideReport } from "@/lib/types";

// A guide takes the local model up to a minute: one per hero and role is
// written at a time and kept for half a day, so reopening it is instant.
const TTL_MS = 12 * 60 * 60 * 1000;
const finished = new Map<string, { report: HeroGuideReport; expiresAt: number }>();
const inFlight = new Map<string, Promise<HeroGuideReport>>();

function parse(heroIdRaw: unknown, positionRaw: unknown): { heroId: number; position: string | null } | null {
  const heroId = Number(heroIdRaw);
  if (!Number.isInteger(heroId) || heroId <= 0 || !getHeroInternalName(heroId)) return null;
  const position = typeof positionRaw === "string" && /^POSITION_[1-5]$/.test(positionRaw) ? positionRaw : null;
  return { heroId, position };
}

async function writeGuide(heroId: number, requested: string | null): Promise<HeroGuideReport> {
  const [positionStats, matchups, proItems] = await Promise.all([
    getHeroPositionStats(heroId).catch(() => []),
    getHeroMatchups(heroId).catch(() => null),
    getHeroProItemPopularity(heroId).catch(() => null),
  ]);
  const roleOverview = computeHeroRoleOverview(heroId, positionStats);
  // The role asked for, else the one the hero is played in most.
  const position = requested ?? [...roleOverview.roles].sort((a, b) => b.games - a.games)[0]?.position ?? "POSITION_1";
  const games = positionStats.find((s) => s.position === position)?.matchCount ?? 0;
  const build = games > 0 ? await getHeroBuild(heroId, position).then((b) => withReplays(computeHeroBuildOverview(heroId, position, games, b, proItems))).catch(() => null) : null;

  return coachHeroGuide({
    heroId,
    heroName: getHeroName(heroId),
    position,
    roleLabel: roleLabelForPosition(position),
    abilities: getHeroAbilityKit(heroId),
    roleOverview,
    matchups: matchups ? computeDraftInsights(heroId, matchups) : null,
    build,
  });
}

/** A guide already written for this hero and role, or 204. */
export async function GET(req: NextRequest) {
  const parsed = parse(req.nextUrl.searchParams.get("heroId"), req.nextUrl.searchParams.get("position"));
  if (!parsed?.position) return NextResponse.json({ error: "Некорректный герой или роль" }, { status: 400 });
  const hit = finished.get(`${parsed.heroId}:${parsed.position}`);
  if (!hit || hit.expiresAt < Date.now()) return new NextResponse(null, { status: 204 });
  return NextResponse.json(hit.report);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = parse(body?.heroId, body?.position);
  if (!parsed) return NextResponse.json({ error: "Некорректный heroId" }, { status: 400 });

  const key = `${parsed.heroId}:${parsed.position ?? "main"}`;
  const hit = finished.get(key);
  if (hit && hit.expiresAt > Date.now()) return NextResponse.json(hit.report);

  let pending = inFlight.get(key);
  if (!pending) {
    pending = writeGuide(parsed.heroId, parsed.position)
      .then((report) => {
        const entry = { report, expiresAt: Date.now() + TTL_MS };
        finished.set(key, entry);
        finished.set(`${parsed.heroId}:${report.position}`, entry);
        return report;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }

  try {
    return NextResponse.json(await pending);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ИИ не смог составить гайд по герою" },
      { status: 502 }
    );
  }
}
