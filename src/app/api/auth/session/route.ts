import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/steamAuth";
import { getProfile } from "@/lib/opendota";

export async function GET() {
  const cookieStore = await cookies();
  const accountId = verifySessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!accountId) return NextResponse.json(null);

  const profile = await getProfile(accountId).catch(() => null);
  return NextResponse.json({
    accountId,
    personaname: profile?.profile.personaname ?? null,
  });
}
