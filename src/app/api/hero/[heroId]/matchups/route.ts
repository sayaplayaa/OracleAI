import { NextRequest, NextResponse } from "next/server";
import { getHeroMatchups } from "@/lib/opendota";
import { getLaneSynergy } from "@/lib/stratz";
import { computeDraftInsights } from "@/lib/metrics/draftInsights";

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
    const [matchups, laneSynergy] = await Promise.all([
      getHeroMatchups(heroId),
      // Optional: only present when STRATZ_API_KEY is configured. Never let
      // its absence or failure break the OpenDota counter-pick data.
      getLaneSynergy(heroId).catch((e) => {
        console.error("STRATZ lane synergy failed:", e);
        return [];
      }),
    ]);
    return NextResponse.json(computeDraftInsights(heroId, matchups, laneSynergy));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось загрузить матчапы" },
      { status: 502 }
    );
  }
}
