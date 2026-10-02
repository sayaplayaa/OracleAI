import { NextRequest, NextResponse } from "next/server";
import { getMatch, getBenchmarks } from "@/lib/opendota";
import { computeMatchMetrics } from "@/lib/metrics/matchMetrics";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId: matchIdParam } = await params;
  const matchId = Number(matchIdParam);
  const accountId = Number(req.nextUrl.searchParams.get("accountId"));

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "Некорректный id матча" }, { status: 400 });
  }
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Отсутствует или некорректен accountId" }, { status: 400 });
  }

  try {
    const match = await getMatch(matchId);
    const player = match.players.find((p) => p.account_id === accountId);
    if (!player) {
      return NextResponse.json(
        { error: "Этот игрок не играл в этом матче" },
        { status: 404 }
      );
    }

    const benchmarks = await getBenchmarks(player.hero_id).catch(() => null);
    const metrics = computeMatchMetrics(match, accountId, benchmarks);

    return NextResponse.json({ match, metrics });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось загрузить матч" },
      { status: 502 }
    );
  }
}
