"use client";

import { useEffect, useState } from "react";
import type { HeroGuideReport } from "@/lib/types";
import { AiActionCard } from "./AiActionCard";
import { FindingList } from "./CoachReport";
import { ItemIcon } from "./ItemIcon";

type GuideState =
  | { status: "checking" }
  | { status: "idle"; error?: string }
  | { status: "loading"; startedAt: number }
  | { status: "done"; report: HeroGuideReport };

function CoreBuildStrip({ build }: { build: NonNullable<HeroGuideReport["build"]> }) {
  const items = [...build.boots.slice(0, 1), ...build.coreProgression];
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
        Ключевые предметы этой роли - по реальным играм этой недели
      </p>
      <ol className="flex gap-2 flex-wrap">
        {items.map((i, n) => (
          <li key={i.itemKey} className="flex items-center gap-2 rounded-xl border border-border bg-page/50 pl-1.5 pr-3 py-1.5">
            <span className="text-[10px] font-mono text-ink-muted w-3 text-right">{n + 1}</span>
            <ItemIcon itemKey={i.itemKey} size={28} />
            <span className="text-sm text-ink">{i.itemName}</span>
            <span className="text-[11px] font-mono text-ink-muted tabular-nums">
              ~{Math.round(i.avgTimeSeconds / 60)}′ · {Math.round((i.pickRate ?? 0) * 100)}%
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ItemTipCards({ tips }: { tips: HeroGuideReport["itemTips"] }) {
  if (tips.length === 0) return null;
  return (
    <section className="bg-surface border border-border rounded-2xl p-5" style={{ boxShadow: "inset 0 3px 0 0 var(--color-accent)" }}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-3">Предметы: зачем и когда</h3>
      <ol className="grid gap-3 md:grid-cols-2">
        {tips.map((t) => (
          <li key={t.itemKey} className="flex gap-3 rounded-xl bg-page/50 border border-border p-3.5">
            {/* A wrapper keeps the icon square: as a flex child it stretched to the card's height. */}
            <span className="shrink-0 self-start leading-none">
              <ItemIcon itemKey={t.itemKey} size={44} />
            </span>
            <div className="min-w-0 space-y-1.5">
              <p className="flex items-baseline gap-2 flex-wrap">
                <span className="font-display font-bold text-ink">{t.itemName}</span>
                <span className="text-[11px] font-mono text-ink-muted tabular-nums">
                  ~{Math.round(t.avgTimeSeconds / 60)}′ · {Math.round(t.pickRate * 100)}% игр
                </span>
              </p>
              <p className="text-sm text-ink leading-relaxed">{t.why}</p>
              {t.whatToDo && (
                <p className="text-sm text-ink-secondary leading-relaxed">
                  <span className="font-semibold text-accent">Когда собрал:</span> {t.whatToDo}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HeroGuideReportView({ report, heroName }: { report: HeroGuideReport; heroName: string }) {
  return (
    <div className="space-y-4 rise-in">
      <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6 space-y-4" style={{ boxShadow: "inset 4px 0 0 0 var(--color-accent)" }}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-1.5">
            ИИ-гайд · {heroName} · {report.roleLabel}
          </p>
          {report.identity && <p className="font-display font-medium text-lg text-ink leading-snug">{report.identity}</p>}
        </div>
        {report.build && <CoreBuildStrip build={report.build} />}
      </section>

      <ItemTipCards tips={report.itemTips} />
      <div className="grid gap-4 md:grid-cols-2">
        <FindingList title="Линия" findings={report.laningTips} accent="var(--color-highlight-text)" boxed />
        <FindingList title="Командные драки" findings={report.teamfightTips} accent="var(--color-series-blue)" boxed />
      </div>
      <FindingList title="Матчапы" findings={report.matchupTips} accent="var(--color-status-critical)" boxed />
    </div>
  );
}

/**
 * The AI guide for the selected role, first on the hero page. A guide already
 * written for this hero and role (the server keeps them half a day) shows
 * straight away; otherwise one click writes it.
 */
export function HeroGuidePanel({
  heroId,
  heroName,
  position,
  roleLabel,
}: {
  heroId: number;
  heroName: string;
  position: string | null;
  roleLabel: string | null;
}) {
  const key = position ?? "main";
  const [guides, setGuides] = useState<Record<string, GuideState>>({});
  const state = guides[key] ?? { status: "checking" };

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
      setGuides((g) => ({ ...g, [key]: { status: "idle", error: err instanceof Error ? err.message : "Не удалось создать ИИ-гайд" } }));
    }
  }

  if (state.status === "done") return <HeroGuideReportView report={state.report} heroName={heroName} />;
  if (state.status === "checking" && position) {
    return <div className="h-[150px] rounded-2xl bg-surface border border-border animate-pulse" aria-busy="true" aria-label="Проверяю готовый гайд" />;
  }

  const role = roleLabel ? ` - ${roleLabel.toLowerCase()}` : "";
  return (
    <AiActionCard
      title={`ИИ-гайд по ${heroName}${role}`}
      description="Тренер объяснит, как играть героя в этой роли: какие предметы собирать и зачем (по реальной сборке этой недели на Легенде и выше), когда герой силён, как стоять на линии и в драках и что делать против неудобных противников."
      actionLabel="Создать ИИ-гайд"
      loadingLabel="Пишу гайд…"
      startedAt={state.status === "loading" ? state.startedAt : null}
      error={state.status === "idle" ? (state.error ?? null) : null}
      onRun={run}
    />
  );
}
