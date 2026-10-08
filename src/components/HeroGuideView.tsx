"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { RolePickStat } from "@/lib/types";
import { HeroBuildPanel } from "./HeroBuildPanel";
import { HeroGuidePanel } from "./HeroGuidePanel";
import { SectionHeading } from "./PageHeader";
import { RoleTabs } from "./RoleTabs";

const SECTIONS = [
  { id: "ai-guide", label: "ИИ-гайд" },
  { id: "build", label: "Сборка" },
  { id: "abilities", label: "Способности" },
  { id: "matchups", label: "Матчапы" },
] as const;

// Old links opened a tab (?tab=build); they now scroll to that section.
const TAB_TO_SECTION: Record<string, string> = { guide: "ai-guide", build: "build", abilities: "abilities", matchups: "matchups" };

/**
 * The whole hero guide on one page: the AI guide first, then the build, the
 * abilities and the matchups. One role picker drives both the AI guide and
 * the build; a sticky row of links jumps between the sections.
 */
export function HeroGuideView({
  heroId,
  heroName,
  roles,
  initialPosition,
  initialTab,
  abilities,
  abilityCount,
  matchups,
}: {
  heroId: number;
  heroName: string;
  roles: RolePickStat[];
  initialPosition: string | null;
  initialTab: string | null;
  abilities: ReactNode;
  abilityCount: number;
  matchups: ReactNode;
}) {
  const [position, setPosition] = useState(initialPosition);
  const role = roles.find((r) => r.position === position) ?? null;

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

  return (
    <div className="space-y-10">
      <div className="sticky top-[64px] z-20 -mx-4 px-4 sm:mx-0 sm:px-0 py-2 bg-page/90 backdrop-blur">
        <nav aria-label="Разделы гайда" className="flex gap-1 bg-surface border border-border rounded-xl p-1 overflow-x-auto scrollbar-none w-fit max-w-full">
          {SECTIONS.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                i === 0 ? "bg-accent text-page hover:brightness-110" : "text-ink-secondary hover:text-ink hover:bg-surface-raised"
              }`}
            >
              {s.label}
              {s.id === "abilities" && abilityCount > 0 && (
                <span className="text-[11px] font-mono tabular-nums px-1.5 rounded-md bg-page/60 text-ink-muted">{abilityCount}</span>
              )}
            </a>
          ))}
        </nav>
      </div>

      {roles.length > 0 && (
        <section aria-label="Роль">
          <SectionHeading title="Роль" note="ИИ-гайд и сборка ниже - для выбранной роли. Процент - винрейт на этой неделе на Легенде и выше." />
          <RoleTabs roles={roles} active={position} onSelect={select} />
        </section>
      )}

      <section id="ai-guide" className="scroll-mt-36">
        <HeroGuidePanel heroId={heroId} heroName={heroName} position={position} roleLabel={role?.roleLabel ?? null} />
      </section>

      <section id="build" className="scroll-mt-36">
        <SectionHeading title={`Сборка${role ? ` - ${role.roleLabel.toLowerCase()}` : ""}`} note="Реальные предметы и таланты этой недели на Легенде и выше (STRATZ)." />
        <HeroBuildPanel heroId={heroId} position={position} />
      </section>

      <section id="abilities" className="scroll-mt-36">
        <SectionHeading title="Способности" note="Официальные описания и значения из файлов игры." />
        {abilities}
      </section>

      <section id="matchups" className="scroll-mt-36">
        <SectionHeading title="Матчапы" note={`Против кого ${heroName} силён и слаб, и с кем лучше стоять на линии.`} />
        {matchups}
      </section>
    </div>
  );
}
