"use client";

import { useEffect, useState } from "react";
import { resolveAccountId } from "@/lib/steamId";
import { generateCandidates, evaluateChallenge } from "@/lib/challenges";
import type { ChallengeCandidate, StoredChallenge } from "@/lib/challenges";
import { loadChallenges, saveChallenges } from "@/lib/challengeStorage";
import { ChallengeCandidateCard, StoredChallengeCard } from "./ChallengeCard";
import { SteamIcon } from "./SteamIcon";
import { SectionHeading } from "./PageHeader";
import { inputField, primaryButton, secondaryButton } from "./buttonStyles";
import type { TrendMatchSummary } from "@/lib/types";
import { pluralRu } from "@/lib/format";
import { comparableGames, kindOfSummary } from "@/lib/metrics/gameContext";

const MATCH_LIMIT = 20;

// Kept outside the component: building a challenge stamps the current time,
// which only ever happens from a click.
function startNewChallenge(candidate: ChallengeCandidate): StoredChallenge {
  const now = Date.now();
  return { ...candidate, id: `${candidate.type}-${candidate.heroId ?? "x"}-${now}`, createdAt: now, status: "active" };
}

function ConnectCard({ onResolve }: { onResolve: (accountId: number) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = resolveAccountId(input);
    if (id) {
      setError(null);
      onResolve(id);
    } else {
      setError("Не получилось распознать Steam ID или ссылку на профиль.");
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div
        className="relative overflow-hidden bg-surface border border-accent/30 rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "radial-gradient(500px 200px at 90% 0%, rgba(232,184,75,0.12), transparent), var(--color-surface)" }}
      >
        <div>
          <h2 className="font-display font-bold text-xl text-ink">Войди через Steam</h2>
          <p className="text-sm text-ink-secondary mt-2 leading-relaxed">
            Испытания строятся по твоим последним играм и засчитываются только реальными матчами. После
            входа вернись на эту страницу - цели уже будут ждать.
          </p>
        </div>
        <a href="/api/auth/steam" className={`${primaryButton} self-start px-6 py-3`}>
          <SteamIcon size={18} />
          Войти через Steam
        </a>
      </div>
      <form onSubmit={submit} className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
        <div>
          <h2 className="font-display font-bold text-xl text-ink">Или укажи профиль</h2>
          <p className="text-sm text-ink-secondary mt-2 leading-relaxed">
            Steam64 ID, ID из Dota или ссылка на профиль Steam. Профиль должен быть открыт для OpenDota.
          </p>
        </div>
        <div className="flex gap-2 mt-auto">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="steamcommunity.com/profiles/…"
            aria-label="Steam ID или ссылка на профиль"
            className={inputField}
          />
          <button type="submit" className={secondaryButton}>
            Найти
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-status-critical">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

function FormStrip({ matches }: { matches: TrendMatchSummary[] }) {
  const n = matches.length;
  const wins = matches.filter((m) => m.win).length;
  const avgDeaths = matches.reduce((s, m) => s + m.deaths, 0) / n;
  const avgKda = matches.reduce((s, m) => s + (m.kills + m.assists) / Math.max(1, m.deaths), 0) / n;
  const tiles: [string, string][] = [
    ["Игр в выборке", String(n)],
    ["Винрейт", `${Math.round((wins / n) * 100)}%`],
    ["Смертей за игру", avgDeaths.toLocaleString("ru-RU", { maximumFractionDigits: 1 })],
    ["Средний KDA", avgKda.toLocaleString("ru-RU", { maximumFractionDigits: 1 })],
  ];
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {tiles.map(([label, value]) => (
        <div key={label} className="bg-surface border border-border rounded-2xl px-4 py-3">
          <dt className="text-[11px] text-ink-muted uppercase tracking-wide">{label}</dt>
          <dd className="font-mono text-xl text-ink tabular-nums mt-1">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AccountChallenges({ accountId, onChangeAccount }: { accountId: number; onChangeAccount?: () => void }) {
  const [matches, setMatches] = useState<TrendMatchSummary[] | null>(null);
  const [challenges, setChallenges] = useState<StoredChallenge[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/player/${accountId}/matches?limit=${MATCH_LIMIT}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        if (cancelled) return;
        const fetched = data.matches as TrendMatchSummary[];
        // Re-check every active challenge against the games played since.
        const reevaluated = loadChallenges(accountId).map((c) => {
          if (c.status === "completed") return c;
          const result = evaluateChallenge(c, fetched);
          return result.status === "completed"
            ? { ...c, status: "completed" as const, completedMatchId: result.completedMatchId, completedAt: result.completedAt }
            : c;
        });
        saveChallenges(accountId, reevaluated);
        setMatches(fetched);
        setChallenges(reevaluated);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить твои матчи из OpenDota. Попробуй обновить страницу через минуту.");
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  function update(next: StoredChallenge[]) {
    setChallenges(next);
    saveChallenges(accountId, next);
  }

  if (error) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-3" role="alert">
        <p className="text-sm text-status-critical">{error}</p>
        {onChangeAccount && (
          <button type="button" onClick={onChangeAccount} className={secondaryButton}>
            Указать другой профиль
          </button>
        )}
      </div>
    );
  }

  if (!matches) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Загружаю твои последние игры">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[74px] rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[190px] rounded-2xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-ink-secondary leading-relaxed">
        Не видно ни одной недавней игры. Включи в Dota 2 опцию «Expose Public Match Data» и сыграй матч - после
        этого здесь появятся испытания.
      </div>
    );
  }

  const active = challenges.filter((c) => c.status === "active");
  const completed = challenges.filter((c) => c.status === "completed");
  const activeTypes = new Set(active.map((c) => c.type));
  // Goals and the form strip come from one kind of game: Turbo's doubled
  // income would skew every average and target.
  const sample = comparableGames(matches, kindOfSummary);
  const candidates = generateCandidates(sample.games, sample.turbo).filter((c) => !activeTypes.has(c.type));
  const skipped = sample.excludedOtherMode + sample.excludedLeft;

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading
          title="Твоя форма"
          note={`По ${sample.games.length} ${pluralRu(sample.games.length, ["последней игре", "последним играм", "последним играм"])}${sample.turbo ? " в Turbo" : ""} - от этих цифр считаются цели.${skipped > 0 ? ` Не учтено: ${skipped} ${pluralRu(skipped, ["игра", "игры", "игр"])} (${sample.turbo ? "не Turbo" : "Turbo и особые режимы"} или игры, которые ты покинул).` : ""}`}
          right={
            onChangeAccount && (
              <button type="button" onClick={onChangeAccount} className="text-sm text-ink-muted hover:text-accent transition">
                Сменить профиль
              </button>
            )
          }
        />
        {sample.games.length > 0 && <FormStrip matches={sample.games} />}
      </section>

      {challenges.length > 0 && (
        <section>
          <SectionHeading
            title="Твои испытания"
            note={`В процессе: ${active.length} · выполнено: ${completed.length}. Проверяются по каждой новой игре.`}
          />
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...active, ...completed].map((c) => {
              const result = c.status === "active" ? evaluateChallenge(c, matches) : null;
              return (
                <StoredChallengeCard
                  key={c.id}
                  challenge={c}
                  accountId={accountId}
                  qualifyingGamesSoFar={result?.qualifyingGamesSoFar ?? 0}
                  onDismiss={() => update(challenges.filter((x) => x.id !== c.id))}
                />
              );
            })}
          </div>
        </section>
      )}

      <section>
        <SectionHeading
          title="Новые вызовы"
          note="Цели чуть выше твоего текущего уровня. Прими вызов - и он засчитается первой же игрой, где ты его выполнишь."
        />
        {candidates.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-ink-secondary leading-relaxed">
            Новых предложений пока нет: в свежей статистике не видно явных слабых мест, или ты уже принял все
            предложенные испытания.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {candidates.map((c) => (
              <ChallengeCandidateCard key={c.type} candidate={c} onStart={() => update([...challenges, startNewChallenge(c)])} />
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-ink-muted">Прогресс хранится только в этом браузере - на другом устройстве его не будет.</p>
    </div>
  );
}

export function ChallengesBoard({ sessionAccountId }: { sessionAccountId: number | null }) {
  const [manualAccountId, setManualAccountId] = useState<number | null>(null);
  const accountId = sessionAccountId ?? manualAccountId;

  if (!accountId) return <ConnectCard onResolve={setManualAccountId} />;
  return (
    <AccountChallenges
      key={accountId}
      accountId={accountId}
      onChangeAccount={sessionAccountId === null ? () => setManualAccountId(null) : undefined}
    />
  );
}
