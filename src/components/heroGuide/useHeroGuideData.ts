"use client";

import { useEffect, useState } from "react";
import type { HeroBuildOverview, HeroGuideReport } from "@/lib/types";

export type BuildState = { status: "loading" } | { status: "done"; build: HeroBuildOverview } | { status: "error"; error: string };

/**
 * The role's real build (STRATZ, Legend+, this week). Builds already loaded
 * are kept, so switching roles back is instant.
 */
export function useHeroBuild(heroId: number, position: string | null) {
  const [builds, setBuilds] = useState<Record<string, BuildState>>({});

  useEffect(() => {
    if (!position || builds[position]) return;
    let cancelled = false;
    fetch(`/api/hero/${heroId}/build?position=${position}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Не удалось загрузить сборку");
        return data as HeroBuildOverview;
      })
      .then((build) => {
        if (!cancelled) setBuilds((b) => ({ ...b, [position]: { status: "done", build } }));
      })
      .catch((err) => {
        if (!cancelled) {
          const error = err instanceof Error ? err.message : "Не удалось загрузить сборку";
          setBuilds((b) => ({ ...b, [position]: { status: "error", error } }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [heroId, position, builds]);

  function retry() {
    if (!position) return;
    setBuilds((b) => {
      const rest = { ...b };
      delete rest[position];
      return rest;
    });
  }

  const state: BuildState | null = position ? (builds[position] ?? { status: "loading" }) : null;
  return { state, retry };
}

export type GuideState =
  | { status: "checking" }
  | { status: "idle"; error?: string }
  | { status: "loading"; startedAt: number }
  | { status: "done"; report: HeroGuideReport };

/**
 * The AI guide for the role. One already written for this hero and role (the
 * server keeps them half a day) shows straight away; otherwise `run` writes it.
 */
export function useHeroGuide(heroId: number, position: string | null) {
  const key = position ?? "main";
  const [guides, setGuides] = useState<Record<string, GuideState>>({});
  const state: GuideState = guides[key] ?? (position ? { status: "checking" } : { status: "idle" });

  useEffect(() => {
    if (!position || guides[key]) return;
    let cancelled = false;
    fetch(`/api/coach/hero-guide?heroId=${heroId}&position=${position}`)
      .then(async (res) => (res.status === 200 ? ((await res.json()) as HeroGuideReport) : null))
      .catch(() => null)
      .then((report) => {
        if (cancelled) return;
        setGuides((g) => ({ ...g, [key]: report ? { status: "done", report } : { status: "idle" } }));
      });
    return () => {
      cancelled = true;
    };
  }, [heroId, position, key, guides]);

  async function run() {
    setGuides((g) => ({ ...g, [key]: { status: "loading", startedAt: Date.now() } }));
    try {
      const res = await fetch("/api/coach/hero-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroId, position }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Не удалось создать ИИ-гайд");
      setGuides((g) => ({ ...g, [key]: { status: "done", report: json as HeroGuideReport } }));
    } catch (err) {
      const error = err instanceof Error ? err.message : "Не удалось создать ИИ-гайд";
      setGuides((g) => ({ ...g, [key]: { status: "idle", error } }));
    }
  }

  return { state, run };
}
