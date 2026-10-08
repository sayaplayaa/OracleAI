import { NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/session";
import { PassError, purchasePass } from "@/lib/battlePass/service";

export async function POST() {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Войди через Steam." }, { status: 401 });
  try {
    return NextResponse.json(await purchasePass(accountId));
  } catch (err) {
    const status = err instanceof PassError ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Не удалось активировать пропуск" }, { status });
  }
}
