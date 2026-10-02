"use client";

import { useEffect, useState } from "react";
import type { HeroBuildOverview, RolePickStat } from "@/lib/types";
import { RoleTabs } from "./RoleTabs";
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
      <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] gap-4">
        <div className="h-[260px] rounded-2xl bg-surface border border-border animate-pulse" />
        <div className="h-[260px] rounded-2xl bg-surface border border-border animate-pulse" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-[340px] rounded-2xl bg-surface border border-border animate-pulse" />
        <div className="h-[340px] rounded-2xl bg-surface border border-border animate-pulse" />
      </div>
    </div>
  );
}

/**
 * A hero's real build for one position (STRATZ, this week): role picker, then
 * starting items, core order with timings, talents, situational and neutral
 * items. Builds already loaded are kept, so switching roles back is instant.
 */
export function HeroBuildPanel({
  heroId,
  roles,
  initialPosition,
}: {
  heroId: number;
  roles: RolePickStat[];
  initialPosition: string | null;
}) {
  const [position, setPosition] = useState(initialPosition);
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

  function select(next: string) {
    setPosition(next);
    const url = new URL(window.location.href);
    url.searchParams.set("pos", next);
    window.history.replaceState(null, "", url);
  }

  function retry() {
    if (!position) return;
    setBuilds((b) => {
      const rest = { ...b };
      delete rest[position];
      return rest;
    });
  }

  if (roles.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-ink-secondary leading-relaxed">
        Нет данных по ролям на этой неделе: STRATZ не ответил или на этом герое пока слишком мало игр
        на ранге Легенда и выше.
      </div>
    );
  }

  const state = position ? builds[position] : undefined;

  return (
    <div className="space-y-4">
      <RoleTabs roles={roles} active={position} onSelect={select} />

      {!state ? (
        <BuildSkeleton />
      ) : "error" in state ? (
        <div className="bg-surface border border-border rounded-2xl p-6 space-y-3" role="alert">
          <p className="text-sm text-status-critical">{state.error}</p>
          <button type="button" onClick={retry} className={secondaryButton}>
            Повторить
          </button>
        </div>
      ) : (
        <div className="space-y-4 rise-in" key={position}>
          <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
            <ItemBuildList
              title="Стартовый закуп"
              description="Самый частый набор на старте."
              items={state.build.startingItems}
            />
            <div className="bg-surface border border-border rounded-2xl p-5">
              <PanelHeader
                title="Ключевые предметы по порядку"
                note="Предметы, которые на этой неделе купили хотя бы 25% игроков на этом герое и позиции, в их реальном среднем порядке и тайминге. Дальше игры расходятся под матчап - смотри ситуативные предметы."
              />
              <ItemTimeline items={state.build.coreProgression} />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="bg-surface border border-border rounded-2xl p-5">
              <PanelHeader
                title="Таланты"
                note="Золотая рамка - вариант, который чаще берут; зелёный процент - вариант с более высоким винрейтом."
              />
              <TalentTable levels={state.build.talents} />
            </div>
            <ItemBuildList
              title="Ситуативные предметы"
              description="Берут реже, чем в 25% игр: покупки под лейтгейм и конкретный матчап, сначала самые частые."
              items={state.build.situationalItems}
            />
          </div>

          <div className="bg-surface border border-border rounded-2xl p-5">
            <PanelHeader
              title="Нейтральные предметы"
              note="По тирам, отсортированы по винрейту. Обведён лучший в тире."
            />
            <NeutralItemTiers tiers={state.build.neutralTiers} />
          </div>
        </div>
      )}
    </div>
  );
}
