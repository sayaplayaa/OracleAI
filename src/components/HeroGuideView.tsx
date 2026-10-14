"use client";

import { useEffect, useState } from "react";
import type { DraftInsights, HeroAbility, RolePickStat } from "@/lib/types";
import { FindingList } from "./CoachReport";
import { HeroAbilitiesSection } from "./heroGuide/HeroAbilitiesSection";
import { HeroItemsSection } from "./heroGuide/HeroItemsSection";
import { HeroSkillBuild } from "./heroGuide/HeroSkillBuild";
import { HeroMatchupsSection } from "./heroGuide/HeroMatchupsSection";
import { HeroPlanSection } from "./heroGuide/HeroPlanSection";
import { useHeroBuild, useHeroGuide } from "./heroGuide/useHeroGuideData";
import { SectionHeading } from "./PageHeader";
import { RoleTabs } from "./RoleTabs";
import { secondaryButton } from "./buttonStyles";

// Old links opened a tab (?tab=build); they now scroll to that part of the guide.
const TAB_TO_SECTION: Record<string, string> = { guide: "plan", build: "items", skills: "skills", abilities: "abilities", matchups: "matchups" };

function BuildSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[180px] rounded-2xl bg-surface border border-border animate-pulse" />
        ))}
      </div>
      <div className="h-[320px] rounded-2xl bg-surface border border-border animate-pulse" />
    </div>
  );
}

/**
 * The whole hero guide as one page, read top to bottom: the AI coach's plan
 * and how the hero wins, then items (each core item with its timing and the
 * coach's why), abilities with their real mechanics and the coach's tricks,
 * how to play the lane and fights, and matchups. One role picker drives all
 * of it; the AI parts appear in place once the guide is written.
 */
export function HeroGuideView({
  heroId,
  heroName,
  roles,
  initialPosition,
  initialTab,
  abilities,
  matchups,
}: {
  heroId: number;
  heroName: string;
  roles: RolePickStat[];
  initialPosition: string | null;
  initialTab: string | null;
  abilities: HeroAbility[];
  matchups: DraftInsights | null;
}) {
  const [position, setPosition] = useState(initialPosition);
  const role = roles.find((r) => r.position === position) ?? null;
  const build = useHeroBuild(heroId, position);
  const guide = useHeroGuide(heroId, position);
  const report = guide.state.status === "done" ? guide.state.report : null;

  useEffect(() => {
    const section = initialTab ? TAB_TO_SECTION[initialTab] : null;
    if (section) document.getElementById(section)?.scrollIntoView({ block: "start" });
  }, [initialTab]);

  function select(next: string) {
    setPosition(next);
    const url = new URL(window.location.href);
    url.searchParams.set("pos", next);
    url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }

  const roleSuffix = role ? ` - ${role.roleLabel.toLowerCase()}` : "";
  const aiHint = report ? null : "Создай ИИ-гайд вверху страницы - тренер объяснит здесь каждый предмет.";

  return (
    <div className="space-y-12">
      {roles.length > 0 && (
        <section aria-label="Роль">
          <SectionHeading title="Роль" note="Весь гайд ниже - для выбранной роли. Процент - винрейт на этой неделе на Легенде и выше." />
          <RoleTabs roles={roles} active={position} onSelect={select} />
        </section>
      )}

      <section id="plan" className="scroll-mt-24">
        <HeroPlanSection
          heroName={heroName}
          roleLabel={role?.roleLabel ?? null}
          guide={guide.state}
          onRunGuide={guide.run}
          buildState={build.state}
        />
      </section>

      <section id="items" className="scroll-mt-24">
        <SectionHeading
          title={`Предметы${roleSuffix}`}
          note={`Покупки этой недели на Легенде и выше (STRATZ) и разбор реплеев этого патча: турнирные игры (OpenDota) и игры Divine/Immortal на этой позиции (STRATZ). Ничего не придумано - всё из реальных игр.${aiHint ? ` ${aiHint}` : ""}`}
        />
        {!build.state ? (
          <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-ink-secondary leading-relaxed">
            Нет данных по ролям на этой неделе: STRATZ не ответил или на этом герое пока слишком мало игр на ранге Легенда и выше.
          </div>
        ) : build.state.status === "loading" ? (
          <BuildSkeleton />
        ) : build.state.status === "error" ? (
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-3" role="alert">
            <p className="text-sm text-status-critical">{build.state.error}</p>
            <button type="button" onClick={build.retry} className={secondaryButton}>
              Повторить
            </button>
          </div>
        ) : (
          <div key={position} className="rise-in">
            <HeroItemsSection
              build={build.state.build}
              heroName={heroName}
              earlyTips={report?.earlyItems ?? []}
              itemTips={report?.itemTips ?? []}
              lateNotes={report?.lateItems ?? []}
            />
          </div>
        )}
      </section>

      {build.state?.status === "done" && (
        <section id="skills" className="scroll-mt-24">
          <SectionHeading title={`Прокачка${roleSuffix}`} note="Порядок способностей и таланты - из реальных игр, а не по памяти." />
          <div key={position} className="rise-in">
            <HeroSkillBuild build={build.state.build} abilities={abilities} tips={report?.skillTips ?? []} />
          </div>
        </section>
      )}

      <section id="abilities" className="scroll-mt-24">
        <SectionHeading
          title="Способности и механики"
          note="Официальные описания, значения и примечания из файлов игры - то, как способность работает на самом деле, и что меняют Aghanim's Scepter и Shard."
        />
        <HeroAbilitiesSection abilities={abilities} tricks={report?.tricks ?? []} />
      </section>

      {report && (report.laningTips.length > 0 || report.teamfightTips.length > 0) && (
        <section id="play" className="scroll-mt-24">
          <SectionHeading title="Как играть" note={`Линия и драки на ${heroName}${roleSuffix} - от ИИ-тренера.`} />
          <div className="grid gap-4 md:grid-cols-2">
            <FindingList title="Линия" findings={report.laningTips} accent="var(--color-highlight-text)" boxed />
            <FindingList title="Командные драки" findings={report.teamfightTips} accent="var(--color-series-blue)" boxed />
          </div>
        </section>
      )}

      <section id="matchups" className="scroll-mt-24 space-y-4">
        <SectionHeading title="Матчапы" note={`Против кого ${heroName} силён и слаб, и с кем лучше стоять на линии.`} />
        <HeroMatchupsSection heroName={heroName} insights={matchups} />
        {report && <FindingList title="Как играть против них - от ИИ-тренера" findings={report.matchupTips} accent="var(--color-status-critical)" boxed />}
      </section>
    </div>
  );
}
