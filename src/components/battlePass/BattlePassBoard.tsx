"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { pluralRu } from "@/lib/format";
import type { BattlePassView, PassChallengeType, PassChallengeView, RewardView } from "@/lib/battlePass/types";
import { primaryButton, secondaryButton } from "../buttonStyles";
import { SectionHeading } from "../PageHeader";
import { SteamIcon } from "../SteamIcon";
import { LevelLadder, RewardGrid } from "./RewardTrack";

const GOOD = "var(--color-status-good)";
const ACCENT = "var(--color-accent)";
const MUTED = "var(--color-ink-muted)";

function timeLeft(until: number, now: number): string {
  const ms = Math.max(0, until - now);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days} ${pluralRu(days, ["день", "дня", "дней"])} ${hours} ч`;
  return `${hours} ${pluralRu(hours, ["час", "часа", "часов"])}`;
}

function dateRu(ms: number): string {
  return new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

async function fetchPass(): Promise<BattlePassView> {
  const res = await fetch("/api/battle-pass", { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as BattlePassView;
}

async function postJson(url: string, body?: unknown): Promise<BattlePassView> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as BattlePassView;
}

// ---- Header card: level, progress, pass ----

function PassHero({ view, now, onPurchase }: { view: BattlePassView; now: number; onPurchase: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { season, level, maxLevel, pointsInLevel, pointsPerLevel, points, pass } = view;
  const maxed = level >= maxLevel;
  const next = view.rewards.find((r) => r.level > level);
  const running = season.week >= 0 && season.week < season.weeks;

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      await onPurchase();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не получилось");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-accent/30 p-5 sm:p-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      style={{ background: "radial-gradient(700px 260px at 15% 0%, rgba(232,184,75,0.16), transparent), var(--color-surface)" }}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
          {season.name} ·{" "}
          {running
            ? `неделя ${season.week + 1} из ${season.weeks} · до конца сезона ${timeLeft(season.endsAt, now)}`
            : season.week < 0
              ? `стартует ${dateRu(season.startsAt)}`
              : "сезон завершён"}
        </p>
        <div className="flex items-end gap-4 mt-3 flex-wrap">
          <div>
            <p className="text-xs text-ink-muted">Уровень</p>
            <p className="font-display font-extrabold text-6xl text-ink leading-none tabular-nums">{level}</p>
          </div>
          <p className="text-sm text-ink-secondary pb-1">
            из {maxLevel} · всего {points.toLocaleString("ru-RU")} {pluralRu(points, ["очко", "очка", "очков"])}
          </p>
        </div>
        <div className="mt-4 max-w-xl">
          <div className="h-3 rounded-full bg-page overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={pointsPerLevel} aria-valuenow={pointsInLevel}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${(pointsInLevel / pointsPerLevel) * 100}%` }} />
          </div>
          <p className="text-xs text-ink-muted mt-1.5 font-mono tabular-nums">
            {maxed ? "Максимальный уровень сезона" : `${pointsInLevel.toLocaleString("ru-RU")} / ${pointsPerLevel.toLocaleString("ru-RU")} до ${level + 1} уровня`}
          </p>
        </div>
        {next && (
          <p className="text-sm text-ink-secondary mt-4">
            Следующая награда - <span className="text-ink font-semibold">{next.title}</span> на {next.level} уровне (ещё{" "}
            {Math.max(0, (next.level - 1) * pointsPerLevel - points).toLocaleString("ru-RU")} очков).
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-page/50 p-4 flex flex-col gap-3">
        {pass.owned ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: GOOD }}>
              ✓ Пропуск активен
            </p>
            <p className="text-sm text-ink-secondary leading-relaxed">
              {pass.since ? `С ${dateRu(pass.since)}. ` : ""}Награды открываются, как только ты достигаешь их уровня, - забирай их в списке ниже.
            </p>
          </>
        ) : (
          <>
            <p className="font-display font-bold text-lg text-ink">Боевой пропуск</p>
            <ul className="text-sm text-ink-secondary space-y-1.5">
              <li>· {view.rewards.length} наград в сезоне - от скина на варды до Arcana</li>
              <li>· Новые испытания каждую неделю</li>
              <li>· Очки копятся уже сейчас - награды за набранные уровни откроются после покупки</li>
            </ul>
            {pass.purchase.available ? (
              <button type="button" onClick={buy} disabled={busy} className={`${primaryButton} w-full`}>
                {busy ? "Подключаю…" : pass.purchase.devUnlock ? "Активировать (тестовый режим)" : `Купить за ${pass.purchase.price}`}
              </button>
            ) : (
              <button type="button" disabled className={`${primaryButton} w-full`}>
                Скоро в продаже
              </button>
            )}
            {error && (
              <p role="alert" className="text-xs text-status-critical">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ---- Challenges ----

const TYPE_META: Record<PassChallengeType, { color: string; icon: React.ReactNode }> = {
  fewer_deaths: { color: "var(--color-status-critical)", icon: <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z" /> },
  clean_streak: { color: "var(--color-status-critical)", icon: <path d="M4 12l4 4L20 6M4 19h16" /> },
  kda: { color: "var(--color-series-blue)", icon: <path d="M3 17l5-5 4 4 8-9M14 7h6v6" /> },
  hero_gpm: {
    color: ACCENT,
    icon: (
      <>
        <ellipse cx="12" cy="7" rx="7" ry="3" />
        <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      </>
    ),
  },
  last_hits: { color: ACCENT, icon: <path d="M14.5 4l5.5 5.5-9 9H5.5v-5.5l9-9ZM12 7l5 5" /> },
  wins: { color: GOOD, icon: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" /> },
  review: { color: "var(--color-series-aqua)", icon: <path d="M4 5h16v11H8l-4 4V5ZM8 9h8M8 12h5" /> },
};

const DIFFICULTY = { easy: "Лёгкое", medium: "Среднее", hard: "Сложное" } as const;

function ChallengeCard({ c, accountId }: { c: PassChallengeView; accountId: number | null }) {
  const meta = TYPE_META[c.type];
  const done = c.status === "completed";
  const expired = c.status === "expired";
  const color = done ? GOOD : expired ? MUTED : meta.color;
  return (
    <li className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-4" style={{ boxShadow: `inset 0 3px 0 0 ${color}`, opacity: expired ? 0.7 : 1 }}>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }} aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {meta.icon}
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-ink">{c.title}</h3>
            <span className="text-[10px] uppercase tracking-wide text-ink-muted">{DIFFICULTY[c.difficulty]}</span>
          </div>
          <p className="text-sm text-ink-secondary mt-1 leading-relaxed">{c.description}</p>
        </div>
        <span className="font-mono text-sm font-bold tabular-nums shrink-0" style={{ color: done ? GOOD : ACCENT }}>
          +{c.points}
        </span>
      </div>
      <div className="mt-auto">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-ink-secondary">
            {done ? "✓ Выполнено" : expired ? "Неделя закончилась" : c.type === "review" ? "Разборов" : "Игр с целью"}
          </span>
          <span className="font-mono tabular-nums text-ink">
            {c.progress} / {c.required}
          </span>
        </div>
        <div className="h-2 rounded-full bg-page overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${(c.progress / c.required) * 100}%`, background: color }} />
        </div>
        {c.matchIds.length > 0 && accountId !== null && c.type !== "review" && (
          <p className="text-xs text-ink-muted mt-2">
            Засчитано:{" "}
            {c.matchIds.map((id, i) => (
              <span key={id}>
                {i > 0 && ", "}
                <Link href={`/player/${accountId}/match/${id}`} className="underline underline-offset-2 hover:text-ink">
                  матч {id}
                </Link>
              </span>
            ))}
          </p>
        )}
        {c.type === "review" && !done && !expired && (
          <p className="text-xs text-ink-muted mt-2">
            <Link href="/games" className="underline underline-offset-2 hover:text-ink">
              Выбрать игру для разбора
            </Link>
          </p>
        )}
      </div>
    </li>
  );
}

// ---- Signed out ----

function SignInCard() {
  return (
    <section
      className="rounded-2xl border border-accent/30 p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5 justify-between"
      style={{ background: "radial-gradient(600px 220px at 10% 0%, rgba(232,184,75,0.14), transparent), var(--color-surface)" }}
    >
      <div className="max-w-2xl">
        <h2 className="font-display font-bold text-xl text-ink">Войди через Steam, чтобы начать сезон</h2>
        <p className="text-sm text-ink-secondary mt-2 leading-relaxed">
          Испытания строятся по твоим последним играм и засчитываются только реальными матчами твоего аккаунта, поэтому
          пропуск привязан ко входу через Steam.
        </p>
      </div>
      <a href="/api/auth/steam" className={`${primaryButton} px-6 py-3 self-start sm:self-auto`}>
        <SteamIcon size={18} />
        Войти через Steam
      </a>
    </section>
  );
}

const RULES = [
  "Каждый понедельник в 03:00 по Москве приходят новые испытания - цели считаются от твоих последних игр.",
  "Засчитываются только обычные и рейтинговые игры, сыгранные после выдачи испытания, - не лобби и не игры, которые ты покинул.",
  "Игра должна длиться не меньше 15 минут (в Turbo - 10).",
  "Профиль в Dota 2 должен быть открыт (опция «Expose Public Match Data»), иначе игры не видны.",
  "Каждые 1 000 очков - новый уровень. Набранные уровни сохраняются до конца сезона.",
];

export function BattlePassBoard({
  signedIn,
  accountId,
  preview,
}: {
  signedIn: boolean;
  accountId: number | null;
  // The season's rewards, shown to players who aren't signed in.
  preview: RewardView[];
}) {
  const [view, setView] = useState<BattlePassView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  function show(next: BattlePassView) {
    setView(next);
    setNow(Date.now());
  }

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetchPass()
      .then((next) => {
        if (cancelled) return;
        setView(next);
        setNow(Date.now());
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Не удалось загрузить пропуск");
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  async function refresh() {
    setRefreshing(true);
    try {
      show(await fetchPass());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить");
    } finally {
      setRefreshing(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="space-y-10">
        <SignInCard />
        <section>
          <SectionHeading title="Награды сезона" note="Скины, предметы и Dota Plus за уровни пропуска." />
          <div className="space-y-4">
            <LevelLadder level={0} maxLevel={30} rewards={preview} />
            <RewardGrid rewards={preview} level={0} points={0} pointsPerLevel={1000} />
          </div>
        </section>
      </div>
    );
  }

  if (error && !view) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-3" role="alert">
        <p className="text-sm text-status-critical">{error}</p>
        <button type="button" onClick={refresh} className={secondaryButton}>
          Повторить
        </button>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Загружаю боевой пропуск">
        <div className="h-[230px] rounded-2xl bg-surface border border-border animate-pulse" />
        <div className="h-16 rounded-2xl bg-surface border border-border animate-pulse" />
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[190px] rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const current = view.challenges.current;
  const done = current.filter((c) => c.status === "completed").length;
  const weekPoints = current.reduce((s, c) => s + c.points, 0);
  const seasonDone = [...current, ...view.challenges.past].filter((c) => c.status === "completed").length;

  return (
    <div className="space-y-10">
      {view.notice && (
        <div className="rounded-2xl border border-border bg-surface px-5 py-4 text-sm text-ink-secondary" style={{ boxShadow: "inset 4px 0 0 0 var(--color-highlight-text)" }}>
          {view.notice}
        </div>
      )}

      <PassHero view={view} now={now} onPurchase={async () => show(await postJson("/api/battle-pass/purchase"))} />

      <section>
        <SectionHeading
          title="Награды сезона"
          note={view.pass.owned ? "Достиг уровня - забирай награду: предметы приходят обменом в Steam, Dota Plus - подарком." : "Уровни уже копятся. Забрать награды можно с активным пропуском."}
        />
        <div className="space-y-4">
          <LevelLadder level={view.level} maxLevel={view.maxLevel} rewards={view.rewards} />
          <RewardGrid
            rewards={view.rewards}
            level={view.level}
            points={view.points}
            pointsPerLevel={view.pointsPerLevel}
            onClaim={async (level, input) => show(await postJson("/api/battle-pass/claim", { level, ...input }))}
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Испытания недели"
          note={
            current.length > 0
              ? `Выполнено ${done} из ${current.length} · до ${weekPoints.toLocaleString("ru-RU")} очков за неделю${view.season.weekEndsAt ? ` · обновятся через ${timeLeft(view.season.weekEndsAt, now)}` : ""}. Каждая новая игра проверяется автоматически.`
              : "Испытаний на эту неделю пока нет."
          }
          right={
            <button type="button" onClick={refresh} disabled={refreshing} className={secondaryButton}>
              {refreshing ? "Проверяю…" : "Проверить новые игры"}
            </button>
          }
        />
        {error && (
          <p role="alert" className="text-sm text-status-critical mb-3">
            {error}
          </p>
        )}
        {current.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-ink-secondary leading-relaxed">
            {view.season.week < 0
              ? "Сезон ещё не начался - первые испытания придут в день старта."
              : view.season.week >= view.season.weeks
                ? "Сезон завершён. Набранные награды можно забрать выше."
                : "Не удалось выдать испытания: OpenDota пока не отдаёт твои игры. Нажми «Проверить новые игры» чуть позже."}
          </div>
        ) : (
          <ol className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {current.map((c) => (
              <ChallengeCard key={c.id} c={c} accountId={accountId} />
            ))}
          </ol>
        )}
      </section>

      {view.form && (
        <section>
          <SectionHeading
            title="Твоя форма"
            note={`По ${view.form.games} ${pluralRu(view.form.games, ["последней игре", "последним играм", "последним играм"])}${view.form.turbo ? " в Turbo" : ""} - от этих цифр считаются цели испытаний.`}
          />
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                ["Игр в выборке", String(view.form.games)],
                ["Винрейт", `${view.form.winRate}%`],
                ["Смертей за игру", view.form.deaths.toLocaleString("ru-RU", { maximumFractionDigits: 1 })],
                ["Средний KDA", view.form.kda.toLocaleString("ru-RU", { maximumFractionDigits: 1 })],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="bg-surface border border-border rounded-2xl px-4 py-3">
                <dt className="text-[11px] text-ink-muted uppercase tracking-wide">{label}</dt>
                <dd className="font-mono text-xl text-ink tabular-nums mt-1">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <section className="bg-surface border border-border rounded-2xl p-5">
          <h2 className="font-display font-bold text-ink">Очки сезона</h2>
          <p className="text-xs text-ink-muted mt-1">Выполнено испытаний за сезон: {seasonDone}.</p>
          {view.history.length === 0 ? (
            <p className="text-sm text-ink-secondary mt-3">Пока ни одного выполненного испытания - первое засчитается твоей следующей игрой.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {view.history.map((h, i) => (
                <li key={`${h.at}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-ink-secondary">{h.title}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-ink-muted">{dateRu(h.at)}</span>
                    <span className="font-mono font-bold tabular-nums" style={{ color: GOOD }}>
                      +{h.points}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {view.challenges.past.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-ink-muted cursor-pointer select-none hover:text-ink">
                Испытания прошлых недель ({view.challenges.past.length})
              </summary>
              <ul className="mt-2 space-y-1.5">
                {view.challenges.past.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-secondary">{c.title}</span>
                    <span className="text-xs" style={{ color: c.status === "completed" ? GOOD : MUTED }}>
                      {c.status === "completed" ? `+${c.points}` : "не выполнено"}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
        <section className="bg-surface border border-border rounded-2xl p-5">
          <h2 className="font-display font-bold text-ink">Как засчитываются испытания</h2>
          <ul className="mt-3 space-y-2">
            {RULES.map((r) => (
              <li key={r} className="text-sm text-ink-secondary leading-relaxed flex gap-2">
                <span className="text-accent" aria-hidden>
                  ·
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
