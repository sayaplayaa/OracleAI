"use client";

import Image from "next/image";
import { pluralRu } from "@/lib/format";
import type { CoachFinding, HeroAbility, HeroBuildOverview, ReplaySkillStep } from "@/lib/types";
import { FindingList } from "../CoachReport";
import { PanelHeader } from "../PageHeader";
import { TalentTable } from "../TalentTable";

// Below this share the level's pick is a common choice, not the rule.
const FIRM_SHARE = 0.75;

function SkillGrid({ steps, abilities }: { steps: ReplaySkillStep[]; abilities: HeroAbility[] }) {
  // Rows in kit order, only abilities the build actually levels.
  const leveled = new Set(steps.filter((s) => !s.isTalent).map((s) => s.abilityKey));
  const rows = abilities.filter((a) => leveled.has(a.key));
  const talents = steps.filter((s) => s.isTalent);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto scrollbar-none">
        <table className="border-separate border-spacing-1 min-w-max">
          <thead>
            <tr>
              <th className="w-40" />
              {steps.map((s) => (
                <th key={s.level} className="w-7 text-[10px] font-mono font-normal text-ink-muted">
                  {s.level}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.key}>
                <td className="pr-2">
                  <span className="flex items-center gap-2">
                    {a.iconUrl && <Image src={a.iconUrl} alt="" width={24} height={24} className="rounded-md border border-border" unoptimized />}
                    <span className="text-xs text-ink truncate max-w-[120px]">{a.name}</span>
                  </span>
                </td>
                {steps.map((s) => {
                  const here = s.abilityKey === a.key;
                  return (
                    <td key={s.level}>
                      <span
                        className={`flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-mono font-bold ${
                          here ? "bg-accent text-page" : "bg-page/60 border border-border"
                        }`}
                        style={here && s.share < FIRM_SHARE ? { opacity: 0.55 } : undefined}
                        title={here ? `${s.level} уровень: ${a.name} - ${Math.round(s.share * 100)}% игр` : undefined}
                      >
                        {here ? s.level : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {talents.length > 0 && (
              <tr>
                <td className="pr-2 text-xs text-ink-secondary">Таланты</td>
                {steps.map((s) => (
                  <td key={s.level}>
                    <span
                      className={`flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-mono font-bold ${
                        s.isTalent ? "bg-[var(--color-series-blue)] text-page" : "bg-page/60 border border-border"
                      }`}
                      title={s.isTalent ? `${s.level} уровень: ${s.abilityName} - ${Math.round(s.share * 100)}% игр` : undefined}
                    >
                      {s.isTalent ? "T" : ""}
                    </span>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {talents.length > 0 && (
        <ul className="flex gap-2 flex-wrap">
          {talents.map((t) => (
            <li key={t.level} className="text-xs rounded-lg border border-border bg-page/50 px-2.5 py-1.5">
              <span className="font-mono text-ink-muted">{t.level} ур.</span> <span className="text-ink">{t.abilityName}</span>{" "}
              <span className="font-mono text-ink-muted">{Math.round(t.share * 100)}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The skill build players really use: level by level from parsed games of
 * this patch (pro and Divine/Immortal), the talents (STRATZ, this week) and
 * the AI coach's notes on why it goes that way.
 */
export function HeroSkillBuild({
  build,
  abilities,
  tips,
}: {
  build: HeroBuildOverview;
  abilities: HeroAbility[];
  tips: CoachFinding[];
}) {
  const replays = build.replays;
  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-2xl p-5" style={{ boxShadow: "inset 0 3px 0 0 var(--color-accent)" }}>
        <PanelHeader
          title="Прокачка по уровням"
          note={
            replays
              ? `Из ${replays.games} ${pluralRu(replays.games, ["разобранной игры", "разобранных игр", "разобранных игр"])} этого патча (турнирных ${replays.proGames}, Divine/Immortal ${replays.highMmrGames}): на каждом уровне - то, что выбирали игроки с тем же порядком до него. Бледная клетка - выбор меньше чем в 75% игр.`
              : "Разобранных игр этого патча на этой роли пока мало - порядок прокачки появится, когда их наберётся хотя бы пять."
          }
        />
        {replays && replays.skillBuild.length > 0 && <SkillGrid steps={replays.skillBuild} abilities={abilities} />}
      </div>
      <FindingList title="Почему так качают - от ИИ-тренера" findings={tips} accent="var(--color-accent)" boxed />
      <div className="bg-surface border border-border rounded-2xl p-5">
        <PanelHeader title="Таланты" note="Эта неделя, Легенда и выше (STRATZ). Золотая рамка - вариант, который чаще берут; зелёный процент - вариант с более высоким винрейтом." />
        <TalentTable levels={build.talents} />
      </div>
    </div>
  );
}
