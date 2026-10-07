"use client";

import { useState } from "react";
import { formatSigned } from "@/lib/format";
import type {
  BreakdownAspect,
  BreakdownMistake,
  BreakdownStat,
  DeathReview,
  FightReview,
  MatchBreakdown,
  PhaseId,
  TimelineEvent,
} from "@/lib/types";
import { Tabs, type TabItem } from "./Tabs";

const GOOD = "var(--color-status-good)";
const BAD = "var(--color-status-critical)";
const WARN = "var(--color-highlight-text)";
const MUTED = "var(--color-ink-muted)";

const GRADE: Record<BreakdownAspect["grade"], { label: string; color: string }> = {
  good: { label: "Хорошо", color: GOOD },
  ok: { label: "Есть что поправить", color: WARN },
  bad: { label: "Много ошибок", color: BAD },
};

const SEVERITY: Record<BreakdownMistake["severity"], { label: string; color: string }> = {
  high: { label: "Критично", color: BAD },
  medium: { label: "Важно", color: WARN },
  low: { label: "Стоит поправить", color: MUTED },
};

const PHASE: Record<PhaseId, string> = { laning: "Линия", midGame: "Мидгейм", lateGame: "Лейтгейм" };

const TONE_COLOR: Record<NonNullable<BreakdownStat["tone"]>, string> = {
  good: GOOD,
  bad: BAD,
  neutral: "var(--color-ink)",
};

const SHORT_TITLES: Record<BreakdownAspect["id"], string> = {
  laning: "Линия",
  farm: "Фарм",
  deaths: "Смерти",
  fights: "Драки",
  items: "Предметы",
  vision: "Обзор и руны",
  objectives: "Постройки",
};

function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: color ?? MUTED }}>
      {children}
    </p>
  );
}

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border whitespace-nowrap"
      style={{ color, borderColor: color }}
    >
      {children}
    </span>
  );
}

function StatsTable({ stats, counterpart }: { stats: BreakdownStat[]; counterpart?: string }) {
  if (stats.length === 0) return null;
  const hasThem = stats.some((s) => s.counterpart !== undefined);
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-ink-muted bg-page/50">
            <th className="text-left font-semibold px-3 py-2">Показатель</th>
            <th className="text-right font-semibold px-3 py-2">Ты</th>
            {hasThem && <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">{counterpart ?? "Соперник"}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {stats.map((s) => (
            <tr key={s.label}>
              <td className="px-3 py-2 text-ink-secondary">
                {s.label}
                {s.reference && <span className="block text-xs text-ink-muted mt-0.5">{s.reference}</span>}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap" style={{ color: TONE_COLOR[s.tone ?? "neutral"] }}>
                {s.tone === "good" ? "▲ " : s.tone === "bad" ? "▼ " : ""}
                {s.you}
              </td>
              {hasThem && <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-secondary whitespace-nowrap">{s.counterpart ?? "-"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One mistake: what happened, why it's a mistake, the right move, an example for next game. */
export function MistakeCard({ mistake }: { mistake: BreakdownMistake }) {
  const sev = SEVERITY[mistake.severity];
  return (
    <li className="rounded-2xl border border-border bg-page/40 p-4 sm:p-5 space-y-3" style={{ boxShadow: `inset 3px 0 0 0 ${sev.color}` }}>
      <div className="flex items-center gap-2 flex-wrap">
        <Chip color={sev.color}>{sev.label}</Chip>
        {mistake.time && <span className="text-xs font-mono text-ink-muted bg-page px-1.5 py-0.5 rounded">{mistake.time}</span>}
        {mistake.phase && <span className="text-xs text-ink-muted">{PHASE[mistake.phase]}</span>}
      </div>
      <h4 className="font-display font-bold text-ink leading-snug">{mistake.title}</h4>
      <div>
        <Label>Что произошло</Label>
        <p className="text-sm text-ink-secondary leading-relaxed">{mistake.whatHappened}</p>
      </div>
      <div>
        <Label>Почему это ошибка</Label>
        <p className="text-sm text-ink leading-relaxed">{mistake.why}</p>
      </div>
      <div className="rounded-xl bg-accent/8 border border-accent/25 p-3">
        <Label color="var(--color-accent)">Как было правильно</Label>
        <p className="text-sm text-ink leading-relaxed">{mistake.correct}</p>
      </div>
      {mistake.example && (
        <div className="rounded-xl bg-surface-raised/60 border border-border p-3">
          <Label>Пример на следующую игру</Label>
          <p className="text-sm text-ink leading-relaxed">{mistake.example}</p>
        </div>
      )}
      {mistake.target && (
        <p className="text-xs text-accent leading-relaxed">
          <span className="font-semibold">Цель:</span> {mistake.target}
        </p>
      )}
    </li>
  );
}

const DEATH_VERDICT: Record<DeathReview["verdict"], { label: string; color: string }> = {
  mistake: { label: "Можно было избежать", color: BAD },
  fight: { label: "В драке", color: WARN },
  trade: { label: "Размен", color: GOOD },
};

function DeathCard({ death }: { death: DeathReview }) {
  const v = DEATH_VERDICT[death.verdict];
  return (
    <li>
      <details
        open={death.verdict === "mistake"}
        className="group rounded-2xl border border-border bg-page/40 overflow-hidden"
        style={{ boxShadow: `inset 3px 0 0 0 ${v.color}` }}
      >
        <summary className="list-none cursor-pointer select-none px-4 py-3 flex items-center gap-3 flex-wrap hover:bg-surface-raised/40">
          <span className="font-mono text-sm text-ink tabular-nums">{death.timeLabel}</span>
          <Chip color={v.color}>{v.label}</Chip>
          <span className="text-sm text-ink-secondary min-w-0 flex-1">{death.title}</span>
          <span className="text-ink-muted text-xs transition group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="px-4 pb-4 space-y-3">
          <ul className="space-y-1">
            {death.facts.map((f) => (
              <li key={f} className="text-xs text-ink-muted font-mono leading-snug">
                {f}
              </li>
            ))}
          </ul>
          {death.why && (
            <div>
              <Label>Почему так вышло</Label>
              <p className="text-sm text-ink leading-relaxed">{death.why}</p>
            </div>
          )}
          {death.correct && (
            <div className="rounded-xl bg-accent/8 border border-accent/25 p-3">
              <Label color="var(--color-accent)">Как было правильно</Label>
              <p className="text-sm text-ink leading-relaxed">{death.correct}</p>
            </div>
          )}
          {death.example && <p className="text-sm text-ink-secondary leading-relaxed">{death.example}</p>}
        </div>
      </details>
    </li>
  );
}

const FIGHT_RESULT: Record<FightReview["result"], { label: string; color: string }> = {
  won: { label: "Выиграна", color: GOOD },
  lost: { label: "Проиграна", color: BAD },
  even: { label: "Вничью", color: WARN },
};

function FightCard({ fight }: { fight: FightReview }) {
  const r = FIGHT_RESULT[fight.result];
  const toneColor = fight.tone === "good" ? GOOD : fight.tone === "bad" ? BAD : "var(--color-ink)";
  return (
    <li className="rounded-2xl border border-border bg-page/40 p-4 space-y-2" style={{ boxShadow: `inset 3px 0 0 0 ${r.color}` }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm text-ink tabular-nums">{fight.timeLabel}</span>
        <Chip color={r.color}>{r.label}</Chip>
        <span className="text-sm text-ink-secondary">
          {fight.place ?? "место неизвестно"} · твоя команда потеряла {fight.yourTeamDeaths}, враг - {fight.enemyDeaths}
        </span>
        {fight.leadBefore !== null && fight.leadAfter !== null && (
          <span className="text-xs font-mono text-ink-muted ml-auto">
            {formatSigned(fight.leadBefore)} → {formatSigned(fight.leadAfter)}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed" style={{ color: toneColor }}>
        Ты: {fight.you}
      </p>
      {fight.facts.length > 0 && (
        <ul className="space-y-0.5">
          {fight.facts.map((f) => (
            <li key={f} className="text-xs text-ink-muted font-mono leading-snug">
              {f}
            </li>
          ))}
        </ul>
      )}
      {fight.correct && (
        <div className="rounded-xl bg-accent/8 border border-accent/25 p-3">
          <Label color="var(--color-accent)">Как было правильно</Label>
          <p className="text-sm text-ink leading-relaxed">{fight.correct}</p>
        </div>
      )}
    </li>
  );
}

function AspectPanel({
  aspect,
  counterpart,
  deaths,
  fights,
}: {
  aspect: BreakdownAspect;
  counterpart?: string;
  deaths?: DeathReview[];
  fights?: FightReview[];
}) {
  const grade = GRADE[aspect.grade];
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 flex-wrap">
        <p className="text-base text-ink leading-relaxed flex-1 min-w-[240px]">{aspect.summary}</p>
        <Chip color={grade.color}>{grade.label}</Chip>
      </div>

      <StatsTable stats={aspect.stats} counterpart={counterpart} />

      {(aspect.good.length > 0 || aspect.notes.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2 items-start">
          {aspect.good.length > 0 && (
            <div className="rounded-xl border border-border bg-page/40 p-4">
              <Label color={GOOD}>Что получилось</Label>
              <ul className="space-y-1.5 mt-1">
                {aspect.good.map((g) => (
                  <li key={g} className="text-sm text-ink leading-relaxed flex gap-2">
                    <span style={{ color: GOOD }} aria-hidden>
                      ✓
                    </span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {aspect.notes.length > 0 && (
            <div className="rounded-xl border border-border bg-page/40 p-4">
              <Label>Подробности</Label>
              <ul className="space-y-1.5 mt-1">
                {aspect.notes.map((n) => (
                  <li key={n} className="text-sm text-ink-secondary leading-relaxed">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {aspect.mistakes.length > 0 ? (
        <div>
          <Label>Ошибки ({aspect.mistakes.length})</Label>
          <ol className="space-y-3 mt-2">
            {aspect.mistakes.map((m, i) => (
              <MistakeCard key={`${m.code}-${i}`} mistake={m} />
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Ошибок в этой части игры по данным реплея не найдено.</p>
      )}

      {deaths && deaths.length > 0 && (
        <div>
          <Label>Каждая смерть по отдельности ({deaths.length})</Label>
          <ol className="space-y-2 mt-2">
            {deaths.map((d) => (
              <DeathCard key={d.time} death={d} />
            ))}
          </ol>
        </div>
      )}

      {fights && fights.length > 0 && (
        <div>
          <Label>Каждая драка по отдельности ({fights.length})</Label>
          <ol className="space-y-2 mt-2">
            {fights.map((f) => (
              <FightCard key={f.time} fight={f} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const KIND_LABEL: Record<TimelineEvent["kind"], string> = {
  kill: "Убийство",
  death: "Смерть",
  item: "Предмет",
  level: "Уровень",
  fight: "Драка",
  building: "Постройка",
  roshan: "Roshan",
  buyback: "Выкуп",
  rune: "Руна",
  firstblood: "Первая кровь",
};

function Timeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<"all" | "bad" | "good">("all");
  const shown = filter === "all" ? events : events.filter((e) => e.tone === filter);
  const options = [
    { id: "all", label: "Всё" },
    { id: "bad", label: "Плохие моменты" },
    { id: "good", label: "Хорошие моменты" },
  ] as const;
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-page/50 border border-border rounded-xl p-1 w-fit max-w-full overflow-x-auto" role="group" aria-label="Фильтр хронологии">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setFilter(o.id)}
            aria-pressed={filter === o.id}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              filter === o.id ? "bg-accent text-page" : "text-ink-secondary hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <ol className="relative space-y-1.5 before:absolute before:left-[52px] before:top-1 before:bottom-1 before:w-px before:bg-border">
        {shown.map((e, i) => {
          const color = e.tone === "good" ? GOOD : e.tone === "bad" ? BAD : MUTED;
          return (
            <li key={`${e.time}-${i}`} className="relative flex items-start gap-3">
              <span className="w-[44px] shrink-0 text-right font-mono text-xs text-ink-muted tabular-nums pt-0.5">{e.timeLabel}</span>
              <span className="relative z-10 mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color, boxShadow: "0 0 0 3px var(--color-surface)" }} aria-hidden />
              <p className="text-sm leading-snug min-w-0">
                <span className="text-[11px] uppercase tracking-wide font-semibold mr-2" style={{ color }}>
                  {KIND_LABEL[e.kind]}
                </span>
                <span className="text-ink-secondary">{e.text}</span>
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Every aspect of the game, each death and fight, and the timeline - in tabs. */
export function FullBreakdown({ breakdown, counterpart }: { breakdown: MatchBreakdown; counterpart?: string }) {
  const tabs: TabItem[] = breakdown.aspects.map((a) => ({
    id: a.id,
    label: SHORT_TITLES[a.id] ?? a.title,
    badge: (
      <span className="inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: GRADE[a.grade].color }} aria-hidden />
        {a.mistakes.length}
      </span>
    ),
    content: (
      <AspectPanel
        aspect={a}
        counterpart={counterpart}
        deaths={a.id === "deaths" ? breakdown.deaths : undefined}
        fights={a.id === "fights" ? breakdown.fights : undefined}
      />
    ),
  }));
  tabs.push({
    id: "timeline",
    label: "Хронология",
    badge: breakdown.timeline.length,
    content: <Timeline events={breakdown.timeline} />,
  });
  const total = breakdown.aspects.reduce((s, a) => s + a.mistakes.length, 0);
  return (
    <section className="bg-surface border border-border rounded-2xl p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="font-display font-bold text-lg sm:text-xl text-ink">Полный разбор игры</h2>
        <p className="text-sm text-ink-muted mt-1 max-w-3xl">
          Каждая часть игры отдельно: твои цифры{counterpart ? ` против ${counterpart}` : ""}, что получилось и каждая
          найденная ошибка ({total}) - что произошло, почему это ошибка, как было правильно и пример на следующую игру.
          Число на вкладке - количество ошибок, цвет точки - как прошла эта часть игры.
        </p>
      </div>
      <Tabs tabs={tabs} param={null} />
    </section>
  );
}
