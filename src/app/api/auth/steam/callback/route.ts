import { NextRequest, NextResponse } from "next/server";
import { verifySteamCallback, createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/steamAuth";
import { resolveAccountId } from "@/lib/steamId";

export async function GET(req: NextRequest) {
  const steamId64 = await verifySteamCallback(req.nextUrl.searchParams).catch(() => null);
  if (!steamId64) {
    return NextResponse.redirect(new URL("/?error=steam_login_failed", req.nextUrl.origin));
  }

  const accountId = resolveAccountId(steamId64);
  if (!accountId) {
    return NextResponse.redirect(new URL("/?error=steam_login_failed", req.nextUrl.origin));
  }

  const response = NextResponse.redirect(new URL(`/player/${accountId}`, req.nextUrl.origin));
  response.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(accountId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return response;
}
