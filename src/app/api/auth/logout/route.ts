import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/steamAuth";

export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/", req.nextUrl.origin));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
