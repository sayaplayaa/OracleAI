import Link from "next/link";
import type { ProHeroSpotlight } from "@/lib/types";
import { AICoachPanel } from "./AICoachPanel";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1">
          How a pro plays {heroName}
        </h3>
        <p className="text-sm text-ink">
          <span className="font-semibold">{pro.name}</span>
          {pro.teamName && <span className="text-ink-muted"> · {pro.teamName}</span>}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-ink">{games}</p>
          <p className="text-[10px] text-ink-muted uppercase tracking-wide">games</p>
        </div>
        <div>
          <p
            className="text-lg font-bold"
            style={{
              color:
                winRate >= 0.5 ? "var(--color-status-good)" : "var(--color-status-critical)",
            }}
          >
            {Math.round(winRate * 100)}%
          </p>
          <p className="text-[10px] text-ink-muted uppercase tracking-wide">win rate</p>
        </div>
        <div>
          <p className="text-lg font-bold text-ink">{avgKda}</p>
          <p className="text-[10px] text-ink-muted uppercase tracking-wide">avg KDA</p>
        </div>
      </div>

      {(avgGpm !== null || avgXpm !== null) && (
        <p className="text-xs text-ink-muted">
          {avgGpm !== null && `${avgGpm} GPM`}
          {avgGpm !== null && avgXpm !== null && " · "}
          {avgXpm !== null && `${avgXpm} XPM`} avg across their recent games on this hero
        </p>
      )}

      {leagueGames.length > 0 && (
        <div>
          <p className="text-[10px] text-ink-muted uppercase tracking-wide mb-1">
            Real tournament games - click to review
          </p>
          <ul className="divide-y divide-border">
            {leagueGames.map((m) => (
              <li key={m.matchId}>
                <Link
                  href={`/player/${pro.accountId}/match/${m.matchId}`}
                  className="block py-1.5 text-xs hover:text-accent transition"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={
                        m.win
                          ? "text-status-good font-medium"
                          : "text-status-critical font-medium"
                      }
                    >
                      {m.win ? "Win" : "Loss"}
                    </span>
                    <span className="font-mono text-ink-secondary">
                      {m.kills}/{m.deaths}/{m.assists}
                    </span>
                    <span className="text-ink-muted">{formatDuration(m.duration)}</span>
                  </div>
                  <p className="text-[10px] text-ink-muted truncate">{m.leagueName}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AICoachPanel
        endpoint="/api/coach/pro-comparison"
        body={{ accountId, heroId }}
        label={`Compare me to ${pro.name}`}
      />
    </div>
  );
}
