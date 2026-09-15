import type { StoredChallenge } from "./challenges";

function storageKey(accountId: number): string {
  return `dota-coach-challenges:${accountId}`;
}

/** Every access is guarded - private browsing or blocked site data should
 * degrade to "no saved challenges," never throw. */
export function loadChallenges(accountId: number): StoredChallenge[] {
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredChallenge[]) : [];
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
