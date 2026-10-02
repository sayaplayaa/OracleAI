import type { Metadata } from "next";
import { getProMatches, getLiveMatches, getLeagues } from "@/lib/opendota";
import { computeLiveTournamentMatches, type LiveTournamentMatch } from "@/lib/metrics/tournaments";
import { formatMatchTime, pluralRu } from "@/lib/format";
import { TournamentResultsList } from "@/components/TournamentResultsList";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader, SectionHeading } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Турниры - Dota Coach AI",
};

function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-status-critical/12 text-status-critical border border-status-critical/30">
      <span className="w-1.5 h-1.5 rounded-full bg-status-critical animate-pulse" aria-hidden />
      Live
    </span>
  );
}

function LiveCard({ match }: { match: LiveTournamentMatch }) {
  const radiantAhead = match.radiantScore > match.direScore;
  const direAhead = match.direScore > match.radiantScore;
  return (
    <article
      className="bg-surface border border-border rounded-2xl p-5"
      style={{ boxShadow: "inset 0 3px 0 0 var(--color-status-critical)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <LivePill />
        <span className="font-mono text-xs text-ink-secondary tabular-nums">{formatMatchTime(match.gameTimeSeconds)}</span>
        <span className="text-xs text-ink-muted truncate ml-auto max-w-[60%]" title={match.leagueName}>
          {match.leagueName}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="text-right min-w-0">
          <p className="font-semibold text-ink truncate">{match.radiantName}</p>
          <p className="text-[11px] text-status-good mt-0.5">Силы Света</p>
        </div>
        <p className="font-display font-bold text-3xl tabular-nums text-ink whitespace-nowrap" title="Счёт по убийствам">
          <span className={radiantAhead ? "text-ink" : "text-ink-secondary"}>{match.radiantScore}</span>
          <span className="text-ink-muted mx-1.5">:</span>
          <span className={direAhead ? "text-ink" : "text-ink-secondary"}>{match.direScore}</span>
        </p>
        <div className="min-w-0">
          <p className="font-semibold text-ink truncate">{match.direName}</p>
          <p className="text-[11px] text-status-critical mt-0.5">Силы Тьмы</p>
        </div>
      </div>
    </article>
  );
}

export default async function TournamentsPage() {
  const [proMatches, liveMatches, leagues] = await Promise.all([
    getProMatches().catch(() => []),
    getLiveMatches().catch(() => []),
    getLeagues().catch(() => []),
  ]);
  // OpenDota's live feed keeps games for a while after they end; anything
  // already in the results list is finished, not live.
  const finished = new Set(proMatches.map((m) => String(m.match_id)));
  const live = computeLiveTournamentMatches(liveMatches, leagues).filter((m) => !finished.has(String(m.matchId)));
  const leagueCount = new Set(proMatches.map((m) => m.league_name)).size;

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        eyebrow="Про-сцена · данные OpenDota"
        title={
          <>
            Турниры <span className="text-accent">и про-матчи</span>
          </>
        }
        description="Свежие результаты лиг и турнирные игры, которые идут прямо сейчас. Нажми на матч - откроется полная статистика с графиками, вардами и ходом игры."
        aside={
          <dl className="grid grid-cols-3 gap-2 sm:min-w-[380px]">
            {[
              [String(live.length), "идут сейчас"],
              [String(proMatches.length), pluralRu(proMatches.length, ["результат", "результата", "результатов"])],
              [String(leagueCount), pluralRu(leagueCount, ["лига", "лиги", "лиг"])],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-border bg-surface px-3 py-3">
                <dt className="font-display font-bold text-ink text-lg tabular-nums">{value}</dt>
                <dd className="text-[11px] text-ink-muted mt-0.5">{label}</dd>
              </div>
            ))}
          </dl>
        }
      />

      <section>
        <SectionHeading
          title={
            <span className="flex items-center gap-3">
              Идут сейчас <LivePill />
            </span>
          }
          note={live.length === 0 ? undefined : "Счёт обновляется при перезагрузке страницы."}
        />
        {live.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-ink-secondary">
            Сейчас нет турнирных игр в эфире. Загляни позже - или посмотри последние результаты ниже.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {live.map((m) => (
              <LiveCard key={m.matchId} match={m} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title="Последние результаты"
          note="Публичного расписания будущих матчей нет, поэтому здесь только сыгранные игры и лайв. Зелёная точка - победитель."
        />
        <TournamentResultsList matches={proMatches} />
      </section>
    </PageContainer>
  );
}
