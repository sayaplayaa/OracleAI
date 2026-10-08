import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/session";
import { PassError, claimReward } from "@/lib/battlePass/service";

export async function POST(req: NextRequest) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Войди через Steam." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const level = Number(body?.level);
  if (!Number.isInteger(level)) return NextResponse.json({ error: "Некорректная награда" }, { status: 400 });
  try {
    return NextResponse.json(
      await claimReward(accountId, {
        level,
        tradeUrl: typeof body?.tradeUrl === "string" ? body.tradeUrl : undefined,
        choice: typeof body?.choice === "string" ? body.choice : undefined,
      })
    );
  } catch (err) {
    const status = err instanceof PassError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Не удалось получить награду" }, { status });
  }
}
