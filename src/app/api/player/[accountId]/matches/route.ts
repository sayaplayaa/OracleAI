import { NextRequest, NextResponse } from "next/server";
import { getRecentMatches } from "@/lib/opendota";
import { toMatchSummary } from "@/lib/metrics/trendMetrics";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId: accountIdParam } = await params;
  const accountId = Number(accountIdParam);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid account id" }, { status: 400 });
  }

  const limit = Number(req.nextUrl.searchParams.get("limit")) || 20;
  const offset = Number(req.nextUrl.searchParams.get("offset")) || 0;

  try {
    const matches = await getRecentMatches(accountId, limit, offset);
    return NextResponse.json({
      matches: matches.map(toMatchSummary),
      hasMore: matches.length === limit,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load matches" },
      { status: 502 }
    );
  }
}
