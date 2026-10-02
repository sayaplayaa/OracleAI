// Client-side store for the AI match analysis: one request per game, shared
// by every component that shows it (so React's dev double-mount can't fire
// the slow model twice), with finished analyses kept in localStorage so
// reopening a game is instant instead of another minute of generation.

import type { CoachReport } from "./types";

export type AnalysisState =
  | { status: "idle" }
  | { status: "loading"; startedAt: number }
  | { status: "done"; report: CoachReport; fromCache: boolean }
  | { status: "error"; title: string; hint: string; details: string };

const IDLE: AnalysisState = { status: "idle" };

// Bump when the analysis logic changes enough that old saved reports are stale.
// v2: reports are generated in Russian.
// v3: deaths carry place, cause and the wards standing at that moment.
const CACHE_VERSION = "v3";
const CACHE_PREFIX = `dc.analysis.${CACHE_VERSION}:`;
const CACHE_INDEX_KEY = `dc.analysis.index.${CACHE_VERSION}`;
const MAX_CACHED_REPORTS = 25;

const states = new Map<string, AnalysisState>();
const listeners = new Set<() => void>();

const keyOf = (accountId: number, matchId: number) => `${accountId}:${matchId}`;

function set(key: string, state: AnalysisState): void {
  states.set(key, state);
  listeners.forEach((l) => l());
}

export function subscribeAnalysis(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAnalysisSnapshot(accountId: number, matchId: number): AnalysisState {
  return states.get(keyOf(accountId, matchId)) ?? IDLE;
}

export function getServerAnalysisSnapshot(): AnalysisState {
  return IDLE;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readCachedReport(accountId: number, matchId: number): CoachReport | null {
  try {
    const raw = storage()?.getItem(CACHE_PREFIX + keyOf(accountId, matchId));
    return raw ? (JSON.parse(raw) as CoachReport) : null;
  } catch {
    return null;
  }
}

export function hasCachedReport(accountId: number, matchId: number): boolean {
  try {
    return storage()?.getItem(CACHE_PREFIX + keyOf(accountId, matchId)) != null;
  } catch {
    return false;
  }
}

function writeCachedReport(accountId: number, matchId: number, report: CoachReport): void {
  const store = storage();
  if (!store) return;
  try {
    const key = keyOf(accountId, matchId);
    const index: string[] = JSON.parse(store.getItem(CACHE_INDEX_KEY) ?? "[]");
    const next = [...index.filter((k) => k !== key), key];
    while (next.length > MAX_CACHED_REPORTS) {
      const oldest = next.shift();
      if (oldest) store.removeItem(CACHE_PREFIX + oldest);
    }
    store.setItem(CACHE_PREFIX + key, JSON.stringify(report));
    store.setItem(CACHE_INDEX_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked - the analysis still shows, it just isn't kept.
  }
}

function friendlyError(message: string): { title: string; hint: string } {
  if (/ollama/i.test(message)) {
    return {
      title: "ИИ-тренер сейчас недоступен",
      hint: "Запусти Ollama (команда ollama serve) и убедись, что модель qwen3:8b скачана, затем нажми «Повторить».",
    };
  }
  if (/timed out|stalled|OpenDota request failed|OpenDota не отвечает|запрос к OpenDota/i.test(message)) {
    return {
      title: "Не удалось загрузить данные матча",
      hint: "OpenDota не отвечает. Если ты без VPN, большие ответы могут зависать - включи VPN и нажми «Повторить».",
    };
  }
  if (/did not play|Invalid|не играл|некорректн/i.test(message)) {
    return {
      title: "Эта игра не найдена в твоём профиле",
      hint: "Вернись к списку и выбери другую игру.",
    };
  }
  return {
    title: "Не получилось составить разбор",
    hint: "Попробуй ещё раз через минуту.",
  };
}

async function run(key: string, accountId: number, matchId: number): Promise<void> {
  try {
    const res = await fetch("/api/coach/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, accountId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(data?.error ?? `HTTP ${res.status}`);

    const report = data as CoachReport;
    // A report without phases means OpenDota had no parsed replay yet - don't
    // keep it, the next visit may get the full analysis.
    if (report.phases && report.phases.length > 0) writeCachedReport(accountId, matchId, report);
    set(key, { status: "done", report, fromCache: false });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    set(key, { status: "error", ...friendlyError(details), details });
  }
}

/** Starts (or reuses) the analysis of one game. Safe to call repeatedly. */
export function startAnalysis(
  accountId: number,
  matchId: number,
  options: { force?: boolean } = {}
): void {
  const key = keyOf(accountId, matchId);
  const current = states.get(key);
  if (current?.status === "loading") return;

  if (!options.force) {
    if (current?.status === "done") return;
    const cached = readCachedReport(accountId, matchId);
    if (cached) {
      set(key, { status: "done", report: cached, fromCache: true });
      return;
    }
  }

  set(key, { status: "loading", startedAt: Date.now() });
  void run(key, accountId, matchId);
}
