import { NextRequest, NextResponse } from "next/server";
import { getProfile, getWinLoss, getRecentMatches } from "@/lib/opendota";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId: accountIdParam } = await params;
  const accountId = Number(accountIdParam);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Некорректный id аккаунта" }, { status: 400 });
  }

  try {
    const [profile, winLoss, recentMatches] = await Promise.all([
      getProfile(accountId),
      getWinLoss(accountId),
      getRecentMatches(accountId, 20),
    ]);
    return NextResponse.json({ profile, winLoss, recentMatches });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось загрузить игрока" },
      { status: 502 }
    );
  }
}
