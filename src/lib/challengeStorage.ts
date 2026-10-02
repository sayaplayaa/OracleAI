import type { StoredChallenge } from "./challenges";

function storageKey(accountId: number): string {
  return `dota-coach-challenges:${accountId}`;
}

/** Challenges saved by older versions also stored their (English) display
 * text. The text is now built at render time from type/target, so the old
 * field is just dropped on load - status and progress are kept as is. */
type LegacyStoredChallenge = StoredChallenge & { description?: unknown };

/** Every access is guarded - private browsing or blocked site data should
 * degrade to "no saved challenges," never throw. */
export function loadChallenges(accountId: number): StoredChallenge[] {
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as LegacyStoredChallenge[]).map((c) => {
      const copy = { ...c };
      delete copy.description;
      return copy;
    });
  } catch {
    return [];
  }
}

export function saveChallenges(accountId: number, challenges: StoredChallenge[]): void {
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(challenges));
  } catch {
    // Storage disabled/full - challenges just won't persist this session.
  }
}
