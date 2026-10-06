import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProfile,
  getWinLoss,
  getRecentMatches,
  getHeroStats,
  getProPlayers,
  getHeroLeagueMatches,
  getMatchesForHero,
  OpenDotaError,
} from "@/lib/opendota";
import { getSessionAccountId } from "@/lib/session";
import { computeTrendMetrics, selectNotableMatches } from "@/lib/metrics/trendMetrics";
import { findSignatureHero } from "@/lib/metrics/signatureHero";
import { computeProHeroSpotlight, findProForHero } from "@/lib/metrics/proComparison";
import { getHeroImage, getHeroName, getRankInfo } from "@/lib/constants";
import { pluralRu } from "@/lib/format";
import { StatTile } from "@/components/StatTile";
import { RankTile } from "@/components/RankTile";
import { MmrTile } from "@/components/MmrTile";
import { ProHeroSpotlightCard } from "@/components/ProHeroSpotlightCard";
import { RecentForm } from "@/components/RecentForm";
import { MatchCard } from "@/components/MatchCard";
import { MatchHistory } from "@/components/MatchHistory";
import { SignatureHeroCard } from "@/components/SignatureHeroCard";
import { AICoachPanel } from "@/components/AICoachPanel";
import { Tabs } from "@/components/Tabs";
import { PageContainer } from "@/components/PageContainer";
import { Breadcrumbs, SectionHeading } from "@/components/PageHeader";
import { primaryButton, secondaryButton } from "@/components/buttonStyles";
import type { ProHeroSpotlight } from "@/lib/types";

// Overview pulls from this larger pool so it can pick the matches most worth
// reviewing rather than just whatever happened most recently; Match History
// reuses the same pool as its first page so "Load more" continues correctly.
const POOL_SIZE = 20;
const HIGHLIGHT_COUNT = 10;

export const metadata: Metadata = {
  title: "Профиль игрока - Dota Coach AI",
};

function ProfileBanner({
  name,
  avatar,
  steamUrl,
  win,
  lose,
  heroId,
  own,
  latestMatchId,
}: {
  name: string;
  avatar: string | null;
  steamUrl: string;
  win: number;
  lose: number;
  heroId: number | null;
  own: boolean;
  latestMatchId: number | null;
}) {
  const total = win + lose;
  const winShare = total > 0 ? win / total : 0;
  const image = heroId ? getHeroImage(heroId) : "";

  return (
    <div
      className="relative overflow-hidden bg-surface border border-border rounded-2xl"
      style={{ boxShadow: "inset 4px 0 0 0 var(--color-accent)" }}
    >
      {image && (
        <div className="absolute inset-y-0 right-0 w-2/3 opacity-25 pointer-events-none" aria-hidden>
          <Image src={image} alt="" fill className="object-cover object-center" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/70 to-transparent" />
        </div>
      )}
      <div className="relative px-5 py-5 sm:px-7 sm:py-7 flex items-center gap-5 sm:gap-6 flex-wrap">
        {avatar && (
          <Image
            src={avatar}
            alt=""
            width={88}
            height={88}
            className="rounded-2xl border border-border shrink-0 w-[72px] h-[72px] sm:w-[88px] sm:h-[88px]"
            unoptimized
            priority
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase mb-1.5">
            {own ? "Твой профиль" : "Профиль игрока"}
          </p>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-ink truncate">{name}</h1>
          {total > 0 && (
            <div className="mt-3 max-w-md">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-ink-muted">За всё время</span>
                <span className="font-mono tabular-nums">
                  <span className="text-status-good">{win.toLocaleString("ru-RU")}</span>
                  <span className="text-ink-muted"> - </span>
                  <span className="text-status-critical">{lose.toLocaleString("ru-RU")}</span>
                  <span className="text-ink-secondary"> · {Math.round(winShare * 100)}%</span>
                </span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-page" aria-hidden>
                <div style={{ width: `${winShare * 100}%`, background: "var(--color-status-good)" }} />
                <div className="flex-1" style={{ background: "var(--color-status-critical)", opacity: 0.8 }} />
              </div>
              <p className="sr-only">
                {win} {pluralRu(win, ["победа", "победы", "побед"])} и {lose}{" "}
                {pluralRu(lose, ["поражение", "поражения", "поражений"])}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap w-full lg:w-auto">
          {own && latestMatchId && (
            <Link href={`/analysis/${latestMatchId}`} className={primaryButton}>
              Разобрать последнюю игру
            </Link>
          )}
          {own && (
            <Link href="/games" className={secondaryButton}>
              Мои игры
            </Link>
          )}
          <a href={steamUrl} target="_blank" rel="noreferrer" className={secondaryButton}>
            Steam ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function NoSpotlight({ unavailable, hasHero }: { unavailable: boolean; hasHero: boolean }) {
  return (
    <section className="bg-surface border border-border rounded-2xl p-5">
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-1">Про-игрок на твоём герое</p>
      <p className="text-sm text-ink-secondary leading-relaxed mt-2">
        {unavailable
          ? "Сейчас не получилось загрузить данные про-игроков из OpenDota - попробуй ещё раз через минуту."
          : hasHero
            ? "Пока не нашли недавних турнирных игр на этом герое."
            : "Сыграй несколько игр, чтобы появился сигнатурный герой, - и посмотри, как на нём играет про-игрок."}
      </p>
    </section>
  );
}

export default async function PlayerPage({ params, searchParams }: PageProps<"/player/[accountId]">) {
  const { accountId: accountIdParam } = await params;
  const { tab } = await searchParams;
  const accountId = Number(accountIdParam);
  if (!Number.isInteger(accountId) || accountId <= 0) notFound();

  let profile, winLoss, matches, heroStats;
  try {
    [profile, winLoss, matches, heroStats] = await Promise.all([
      getProfile(accountId),
      getWinLoss(accountId),
      getRecentMatches(accountId, POOL_SIZE),
      getHeroStats(accountId),
    ]);
  } catch (err) {
    if (err instanceof OpenDotaError && err.status === 404) notFound();
    throw err;
  }
  const own = (await getSessionAccountId()) === accountId;

  const trends = computeTrendMetrics(accountId, matches);
  const notableMatches = selectNotableMatches(trends.recentMatches, trends.avgKda, HIGHLIGHT_COUNT);
  const signatureHero = findSignatureHero(heroStats);
  const rankInfo = getRankInfo(profile.computed_mmr, profile.leaderboard_rank);

  // Find a real, currently-active pro who has actually played the same
  // signature hero in a recent tournament game - never a ladder grinder
  // who happens to be tagged pro, and never a fabricated example.
  let proSpotlight: ProHeroSpotlight | null = null;
  let proSpotlightUnavailable = false;
  if (signatureHero) {
    // Optional card: the pro roster is a very large response, so a flaky or
    // throttled connection must not take the whole player page down with it.
    try {
      const [proPlayers, leagueMatches] = await Promise.all([
        getProPlayers(),
        getHeroLeagueMatches(signatureHero.hero_id),
      ]);
      const found = findProForHero(leagueMatches, proPlayers);
      if (found) {
        const [proHeroStats, proMatches] = await Promise.all([
          getHeroStats(found.pro.accountId),
          getMatchesForHero(found.pro.accountId, signatureHero.hero_id, 20),
        ]);
        const proHeroStat = proHeroStats.find((h) => h.hero_id === signatureHero.hero_id);
        proSpotlight = computeProHeroSpotlight(
          signatureHero.hero_id,
          found.pro,
          proHeroStat,
          proMatches,
          found.leagueGames
        );
      }
    } catch (err) {
      if (!(err instanceof OpenDotaError)) throw err;
      proSpotlightUnavailable = true;
    }
  }

  const overviewContent =
    trends.recentMatches.length === 0 ? (
      <div className="bg-surface border border-border rounded-2xl p-8 text-center text-sm text-ink-secondary">
        Не нашли недавних игр этого игрока. Возможно, у него выключена опция «Expose Public Match Data».
      </div>
    ) : (
      <div className="space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label={`Винрейт · ${trends.sampleSize} ${trends.turbo ? "Turbo-" : ""}${pluralRu(trends.sampleSize, ["игра", "игры", "игр"])}`}
            value={`${Math.round(trends.winRate * 100)}%`}
            accent={trends.winRate >= 0.5 ? "var(--color-status-good)" : "var(--color-status-critical)"}
          />
          <StatTile
            label="Средний KDA"
            value={trends.avgKda.toLocaleString("ru-RU")}
            sub={`${trends.avgDeaths.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} смертей за игру`}
          />
          <RankTile rank={rankInfo} />
          <MmrTile rank={rankInfo} />
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          <div className="space-y-8 min-w-0">
            <section>
              <SectionHeading
                title="Игры, которые стоит разобрать"
                note={`Из последних ${trends.recentMatches.length} ${pluralRu(trends.recentMatches.length, ["игры", "игр", "игр"])}: сначала поражения, потом игры, где KDA или смерти заметно хуже среднего.`}
              />
              <div className="bg-surface border border-border rounded-2xl divide-y divide-border overflow-hidden">
                {notableMatches.map((m) => (
                  <MatchCard key={m.matchId} accountId={accountId} match={m} analyzable={own} />
                ))}
              </div>
            </section>

            <section>
              <SectionHeading title="Тренды" note="Что повторяется из игры в игру - по всем последним матчам сразу." />
              <AICoachPanel
                endpoint="/api/coach/trends"
                body={{ accountId, limit: POOL_SIZE }}
                label="Разобрать тренды"
                title="Что мешает расти по последним играм"
                description="Повторяющиеся ошибки и сильные стороны по всем недавним матчам: смерти, линия, фарм, герои. С цифрами, на которых основан каждый вывод."
              />
            </section>
          </div>

          <aside className="space-y-4">
            {signatureHero && (
              <SignatureHeroCard
                accountId={accountId}
                heroId={signatureHero.hero_id}
                heroName={getHeroName(signatureHero.hero_id)}
                games={signatureHero.games}
                winRate={signatureHero.games > 0 ? signatureHero.win / signatureHero.games : 0}
              />
            )}
            <RecentForm accountId={accountId} matches={trends.recentMatches.slice(0, 10)} />
            {proSpotlight && signatureHero ? (
              <ProHeroSpotlightCard accountId={accountId} heroId={signatureHero.hero_id} spotlight={proSpotlight} />
            ) : (
              <NoSpotlight unavailable={proSpotlightUnavailable} hasHero={Boolean(signatureHero)} />
            )}
          </aside>
        </div>
      </div>
    );

  return (
    <PageContainer className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          ...(own ? [{ href: "/games", label: "Мои игры" }] : []),
          { label: profile.profile.personaname },
        ]}
      />

      <ProfileBanner
        name={profile.profile.personaname}
        avatar={profile.profile.avatarfull ?? null}
        steamUrl={profile.profile.profileurl}
        win={winLoss.win}
        lose={winLoss.lose}
        heroId={signatureHero?.hero_id ?? null}
        own={own}
        latestMatchId={trends.recentMatches[0]?.matchId ?? null}
      />

      <Tabs
        initial={typeof tab === "string" ? tab : undefined}
        tabs={[
          { id: "overview", label: "Обзор", content: overviewContent },
          {
            id: "history",
            label: "История игр",
            content: <MatchHistory accountId={accountId} initialMatches={trends.recentMatches} analyzable={own} />,
          },
        ]}
      />
    </PageContainer>
  );
}
