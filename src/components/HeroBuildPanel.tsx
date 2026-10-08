"use client";

import { useEffect, useState } from "react";
import type { HeroBuildOverview } from "@/lib/types";
import { ItemBuildList } from "./ItemBuildList";
import { ItemTimeline } from "./ItemTimeline";
import { NeutralItemTiers } from "./NeutralItemTiers";
import { TalentTable } from "./TalentTable";
import { PanelHeader } from "./PageHeader";
import { secondaryButton } from "./buttonStyles";

type BuildState = { build: HeroBuildOverview } | { error: string };

function BuildSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-[200px] rounded-2xl bg-surface border border-border animate-pulse" />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-[260px] rounded-2xl bg-surface border border-border animate-pulse" />
        <div className="h-[260px] rounded-2xl bg-surface border border-border animate-pulse" />
      </div>
    </div>
  );
}

/**
 * A hero's real build for one position (STRATZ, Legend+, this week): core
 * items in order with how often they're built and when, boots and early
 * items, starting items, talents, situational and neutral items. Builds
 * already loaded are kept, so switching roles back is instant.
 */
export function HeroBuildPanel({ heroId, position }: { heroId: number; position: string | null }) {
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
        if (!cancelled) setBuilds((b) => ({ ...b, [position]: { build } }));
      })
      .catch((err) => {
        if (!cancelled)
          setBuilds((b) => ({
            ...b,
            [position]: { error: err instanceof Error ? err.message : "Не удалось загрузить сборку" },
          }));
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

  if (!position) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-ink-secondary leading-relaxed">
        Нет данных по ролям на этой неделе: STRATZ не ответил или на этом герое пока слишком мало игр
        на ранге Легенда и выше.
      </div>
    );
  }

  const state = builds[position];
  if (!state) return <BuildSkeleton />;
  if ("error" in state) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-3" role="alert">
        <p className="text-sm text-status-critical">{state.error}</p>
        <button type="button" onClick={retry} className={secondaryButton}>
          Повторить
        </button>
      </div>
    );
  }

  const { build } = state;
  return (
    <div className="space-y-4 rise-in" key={position}>
      <div className="bg-surface border border-border rounded-2xl p-5" style={{ boxShadow: "inset 0 3px 0 0 var(--color-accent)" }}>
        <PanelHeader
          title="Ключевые предметы по порядку"
          note={`Предметы, которые собирают хотя бы в 20% игр (${build.games.toLocaleString("ru-RU")} игр на Легенде и выше за эту неделю), в их обычном порядке: минута покупки и доля игр. Компоненты, которые покупают по пути, указаны под предметом.`}
        />
        <ItemTimeline items={build.coreProgression} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <ItemBuildList
          title="Стартовый закуп"
          description="Что берут на старте: доля игр и винрейт."
          items={build.startingItems}
        />
        <ItemBuildList
          title="Ранние предметы"
          description="Недорогие предметы первых минут."
          items={build.earlyItems}
          showTime
          emptyMessage="На этой роли ранних предметов почти не берут."
        />
        <ItemBuildList title="Обувь" description="Какие сапоги собирают и к какой минуте." items={build.boots} showTime emptyMessage="Нет данных об обуви." />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <PanelHeader
            title="Таланты"
            note="Золотая рамка - вариант, который чаще берут; зелёный процент - вариант с более высоким винрейтом."
          />
          <TalentTable levels={build.talents} />
        </div>
        <ItemBuildList
          title="Ситуативные предметы"
          description="Берут реже, чем в 20% игр: под конкретный матчап или затяжную игру. Сначала самые частые."
          items={build.situationalItems}
        />
      </div>

      {/* STRATZ currently returns no neutral item stats at all; the block only shows when it does. */}
      {build.neutralTiers.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <PanelHeader title="Нейтральные предметы" note="По тирам, отсортированы по винрейту. Обведён лучший в тире." />
          <NeutralItemTiers tiers={build.neutralTiers} />
        </div>
      )}
    </div>
  );
}
