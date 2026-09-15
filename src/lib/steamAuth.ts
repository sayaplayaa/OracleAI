import { createHmac, timingSafeEqual } from "node:crypto";

const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";
export const SESSION_COOKIE_NAME = "dc_session";

export function getSteamLoginUrl(origin: string): string {
  const returnTo = `${origin}/api/auth/steam/callback`;
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID_URL}?${params.toString()}`;
}

/**
 * Verifies a Steam OpenID 2.0 callback by re-posting the signed params back
 * to Steam with openid.mode=check_authentication (the standard OpenID 2.0
 * verification step - no API key needed). Returns the SteamID64 on success.
 */
export async function verifySteamCallback(
  params: URLSearchParams
): Promise<string | null> {
  const verifyParams = new URLSearchParams(params);
  verifyParams.set("openid.mode", "check_authentication");

  const res = await fetch(STEAM_OPENID_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyParams.toString(),
  });
  const text = await res.text();
  if (!res.ok || !text.includes("is_valid:true")) return null;

  const claimedId = params.get("openid.claimed_id");
  const match = claimedId?.match(/\/id\/(\d+)$/);
  return match ? match[1] : null;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function createSessionCookieValue(accountId: number): string {
  const value = String(accountId);
  return `${value}.${sign(value)}`;
}

export function verifySessionCookieValue(cookieValue: string | undefined): number | null {
  if (!cookieValue) return null;
  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const value = cookieValue.slice(0, dotIndex);
  const signature = cookieValue.slice(dotIndex + 1);
  const expected = sign(value);

  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const accountId = Number(value);
  return Number.isInteger(accountId) && accountId > 0 ? accountId : null;
}
