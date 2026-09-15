import { NextRequest, NextResponse } from "next/server";
import { getSteamLoginUrl } from "@/lib/steamAuth";

export async function GET(req: NextRequest) {
  return NextResponse.redirect(getSteamLoginUrl(req.nextUrl.origin));
}
