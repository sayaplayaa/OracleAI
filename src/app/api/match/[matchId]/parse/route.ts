import { NextRequest, NextResponse } from "next/server";
import { requestMatchParse } from "@/lib/opendota";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId: matchIdParam } = await params;
  const matchId = Number(matchIdParam);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "Некорректный id матча" }, { status: 400 });
  }

  try {
    const result = await requestMatchParse(matchId);
    const jobId = result?.job?.jobId;
    if (!jobId) {
      return NextResponse.json(
        { error: "OpenDota не вернула задачу на разбор реплея" },
        { status: 502 }
      );
    }
    return NextResponse.json({ jobId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось запросить разбор реплея" },
      { status: 502 }
    );
  }
}
