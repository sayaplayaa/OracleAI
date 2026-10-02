import { NextRequest, NextResponse } from "next/server";
import { searchPlayers } from "@/lib/opendota";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Пустой запрос" }, { status: 400 });
  }

  try {
    const results = await searchPlayers(q);
    return NextResponse.json(results.slice(0, 10));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Поиск не удался" },
      { status: 502 }
    );
  }
}
