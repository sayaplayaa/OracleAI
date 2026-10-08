import { NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/session";
import { battlePassFor } from "@/lib/battlePass/service";

// The signed-in player's pass: this week's challenges are issued and new
// games credited on every load. Only ever for the session's own account.
export async function GET() {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Войди через Steam, чтобы открыть боевой пропуск." }, { status: 401 });
  try {
    return NextResponse.json(await battlePassFor(accountId));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Не удалось загрузить боевой пропуск" },
      { status: 500 }
    );
  }
}
