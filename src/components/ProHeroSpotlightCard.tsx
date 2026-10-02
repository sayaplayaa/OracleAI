import Link from "next/link";
import type { ProHeroSpotlight } from "@/lib/types";
import { AICoachPanel } from "./AICoachPanel";
import { formatMatchTime, pluralRu } from "@/lib/format";

export function ProHeroSpotlightCard({
  accountId,
  heroId,
  spotlight,
}: {
  accountId: number;
  heroId: number;
  spotlight: ProHeroSpotlight;
}) {
  const { pro, games, winRate, avgKda, avgGpm, avgXpm, leagueGames, heroName } = spotlight;
  const stats: [string, string, string?][] = [
    [String(games), pluralRu(games, ["игра", "игры", "игр"])],
    [
      `${Math.round(winRate * 100)}%`,
      "винрейт",
      winRate >= 0.5 ? "var(--color-status-good)" : "var(--color-status-critical)",
    ],
    [avgKda.toLocaleString("ru-RU"), "средний KDA"],
  ];

  return (
    <div className="space-y-3">
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-1">Про-игрок на {heroName}</p>
          <h3 className="font-display font-bold text-lg text-ink">
            {pro.name}
            {pro.teamName && <span className="text-ink-muted font-sans font-normal text-sm"> · {pro.teamName}</span>}
          </h3>
        </div>

        <dl className="grid grid-cols-3 gap-2">
          {stats.map(([value, label, color]) => (
            <div key={label} className="rounded-xl bg-page/50 border border-border px-3 py-2.5 text-center">
              <dt className="sr-only">{label}</dt>
              <dd className="font-mono text-lg tabular-nums text-ink" style={color ? { color } : undefined}>
                {value}
              </dd>
              <p className="text-[10px] text-ink-muted uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </dl>

        {(avgGpm !== null || avgXpm !== null) && (
          <p className="text-xs text-ink-muted" title="GPM - золото в минуту, XPM - опыт в минуту">
            В среднем {avgGpm !== null && <span className="font-mono text-ink-secondary">{avgGpm} GPM</span>}
            {avgGpm !== null && avgXpm !== null && " · "}
            {avgXpm !== null && <span className="font-mono text-ink-secondary">{avgXpm} XPM</span>} за последние игры на этом
            герое
          </p>
        )}

        {leagueGames.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">Турнирные игры - открой и разбери</p>
            <ul className="space-y-1">
              {leagueGames.map((m) => (
                <li key={m.matchId}>
                  <Link
                    href={`/player/${pro.accountId}/match/${m.matchId}`}
                    className="group flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-raised transition"
                  >
                    <span
                      className="w-1 self-stretch rounded-full"
                      style={{ background: m.win ? "var(--color-status-good)" : "var(--color-status-critical)" }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-xs">
                        <span className={m.win ? "text-status-good font-semibold" : "text-status-critical font-semibold"}>
                          {m.win ? "Победа" : "Поражение"}
                        </span>
                        <span className="font-mono text-ink-secondary tabular-nums">
                          {m.kills}/{m.deaths}/{m.assists}
                        </span>
                        <span className="font-mono text-ink-muted ml-auto tabular-nums">{formatMatchTime(m.duration)}</span>
                      </span>
                      <span className="block text-[11px] text-ink-muted truncate group-hover:text-ink-secondary transition">
                        {m.leagueName}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <AICoachPanel
        endpoint="/api/coach/pro-comparison"
        body={{ accountId, heroId }}
        label="Сравнить"
        title={`Ты против ${pro.name} на ${heroName}`}
        description="Чем твоя игра на этом герое отличается от игры профессионала: фарм, KDA, темп - и что перенять в первую очередь."
      />
    </div>
  );
}
