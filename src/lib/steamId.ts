const STEAM64_BASE = 76561197960265728n;

/**
 * Accepts a Steam32 (OpenDota account_id), a Steam64 id, or a full
 * steamcommunity.com/profiles/<id64> URL and returns the account_id
 * OpenDota expects. Returns null if the input can't be parsed.
 */
export function resolveAccountId(raw: string): number | null {
  const input = raw.trim();
  if (!input) return null;

  const profileUrlMatch = input.match(/steamcommunity\.com\/profiles\/(\d+)/);
  const digits = profileUrlMatch ? profileUrlMatch[1] : input;

  if (!/^\d+$/.test(digits)) return null;

  const asBigInt = BigInt(digits);

  // Steam64 ids are always greater than the Steam64 base offset.
  if (asBigInt >= STEAM64_BASE) {
    const accountId = asBigInt - STEAM64_BASE;
    return accountId >= 0n && accountId <= 0xffffffffn
      ? Number(accountId)
      : null;
  }

  // Otherwise treat it as an already-valid Steam32/account_id.
  return asBigInt >= 0n && asBigInt <= 0xffffffffn ? Number(asBigInt) : null;
}
