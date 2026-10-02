import { getProMatches, getLiveMatches, getLeagues } from "@/lib/opendota";
import { computeLiveTournamentMatches } from "@/lib/metrics/tournaments";
import { TournamentResultsList } from "@/components/TournamentResultsList";
import { PageContainer } from "@/components/PageContainer";

function formatGameTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function TournamentsPage() {
  const [proMatches, liveMatches, leagues] = await Promise.all([
    getProMatches(),
    getLiveMatches().catch(() => []),
    getLeagues().catch(() => []),
  ]);
  const liveTournamentMatches = computeLiveTournamentMatches(liveMatches, leagues);

  return (
    <PageContainer>
      <div className="space-y-2 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Трекер турниров
        </p>
        <h1 className="text-2xl font-bold text-ink">Турниры</h1>
        <p className="text-sm text-ink-secondary max-w-2xl">
          Свежие результаты лиг и турниров и турнирные матчи, которые идут
          прямо сейчас, - из ленты профессиональных матчей OpenDota.
          Публичного расписания будущих матчей нет, поэтому здесь только
          результаты и лайв, а не календарь игр.
        </p>
      </div>

      {liveTournamentMatches.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-critical animate-pulse" />
            Идут сейчас
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {liveTournamentMatches.map((m) => (
              <div
                key={m.matchId}
                className="bg-surface border border-border rounded-lg p-4"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink font-semibold">{m.radiantName}</span>
                  <span className="font-mono text-ink-secondary">
                    {m.radiantScore}-{m.direScore}
                  </span>
                  <span className="text-ink font-semibold">{m.direName}</span>
                </div>
                <p className="text-xs text-ink-muted mt-2 truncate">{m.leagueName}</p>
                <p className="text-[11px] text-ink-muted font-mono mt-1">
                  {formatGameTime(m.gameTimeSeconds)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-ink mb-3">Последние результаты</h2>
        <TournamentResultsList matches={proMatches} />
      </div>
    </PageContainer>
  );
}
