import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMatch, getBenchmarks, OpenDotaError } from "@/lib/opendota";
import { getMatchPlayerPositions } from "@/lib/stratz";
import { getSessionAccountId } from "@/lib/session";
import { computeMatchMetrics } from "@/lib/metrics/matchMetrics";
import { computeFullMatchOverview, NORMAL_LOBBY_NAME } from "@/lib/metrics/fullMatchMetrics";
import { computeRoleComparisons } from "@/lib/metrics/roleComparison";
import { computeMatchStory } from "@/lib/metrics/matchStory";
import { computeSkillBuild } from "@/lib/metrics/skillBuild";
import { computeMatchCoreItems } from "@/lib/metrics/matchItemContext";
import { getHeroImage } from "@/lib/constants";
import { formatMatchTime, timeAgoRu } from "@/lib/format";
import { StatBar } from "@/components/StatBar";
import { StatTile } from "@/components/StatTile";
import { AICoachPanel } from "@/components/AICoachPanel";
import { MatchItemTimeline } from "@/components/MatchItemTimeline";
import { Tabs } from "@/components/Tabs";
import { MatchOverviewInteractive, type PlayerDetail } from "@/components/MatchOverviewInteractive";
import { WardsMap } from "@/components/WardsMap";
import { MovementHeatmap } from "@/components/MovementHeatmap";
import { ParseMatchButton } from "@/components/ParseMatchButton";
import { RoleComparisonCard } from "@/components/RoleComparisonCard";
import { MatchStoryTimeline } from "@/components/MatchStoryTimeline";
import { PageContainer } from "@/components/PageContainer";
import { Breadcrumbs, PanelHeader, SectionHeading } from "@/components/PageHeader";
import { primaryButton, secondaryButton } from "@/components/buttonStyles";
import type { FullMatchOverview, MatchMetrics } from "@/lib/types";

const RADIANT = "var(--color-status-good)";
const DIRE = "var(--color-status-critical)";

export async function generateMetadata({ params }: PageProps<"/player/[accountId]/match/[matchId]">): Promise<Metadata> {
  const { matchId } = await params;
  return { title: `Матч #${matchId} - Dota Coach AI` };
}

function MatchBanner({
  overview,
  metrics,
  startTime,
  own,
}: {
  overview: FullMatchOverview;
  metrics: MatchMetrics;
  startTime: number;
  own: boolean;
}) {
  const winnerColor = overview.radiantWin ? RADIANT : DIRE;
  const playerColor = metrics.win ? RADIANT : DIRE;
  const image = getHeroImage(metrics.heroId);
  const meta = [
    overview.gameMode,
    overview.lobbyType !== NORMAL_LOBBY_NAME ? overview.lobbyType : null,
    overview.patch ? `патч ${overview.patch}` : null,
    timeAgoRu(startTime),
  ].filter(Boolean);

  return (
    <div
      className="relative overflow-hidden bg-surface border border-border rounded-2xl"
      style={{ boxShadow: `inset 4px 0 0 0 ${winnerColor}` }}
    >
      {image && (
        <div className="absolute inset-y-0 right-0 w-2/3 opacity-25 pointer-events-none" aria-hidden>
          <Image src={image} alt="" fill className="object-cover object-center" unoptimized />
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/70 to-transparent" />
        </div>
      )}
      <div className="relative px-5 py-5 sm:px-7 sm:py-6 grid lg:grid-cols-[minmax(0,1fr)_auto] gap-6 items-center">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.2em] uppercase mb-3" style={{ color: winnerColor }}>
            {overview.radiantWin ? "Победа Сил Света" : "Победа Сил Тьмы"}
          </p>
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <div className="text-right">
              <p className="text-xs text-ink-muted">Силы Света</p>
              <p className="font-display font-extrabold text-4xl sm:text-5xl tabular-nums" style={{ color: overview.radiantWin ? RADIANT : "var(--color-ink-secondary)" }}>
                {overview.radiantScore ?? "-"}
              </p>
            </div>
            <div className="text-center">
              <p className="font-mono text-sm text-ink tabular-nums rounded-lg bg-page/60 border border-border px-2.5 py-1">
                {formatMatchTime(overview.duration)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Силы Тьмы</p>
              <p className="font-display font-extrabold text-4xl sm:text-5xl tabular-nums" style={{ color: !overview.radiantWin ? DIRE : "var(--color-ink-secondary)" }}>
                {overview.direScore ?? "-"}
              </p>
            </div>
          </div>
          <p className="text-sm text-ink-muted mt-3">
            Матч #{overview.matchId} · {meta.join(" · ")}
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex items-center gap-3 rounded-xl bg-page/60 border border-border p-2 pr-4 backdrop-blur">
            {image && (
              <Image src={image} alt={metrics.heroName} width={96} height={54} className="rounded-lg border border-border" unoptimized priority />
            )}
            <div className="min-w-0">
              <p className="text-[11px] text-ink-muted">{own ? "Ты играл" : "Игрок профиля"}</p>
              <p className="font-semibold text-ink truncate">{metrics.heroName}</p>
              <p className="text-xs font-mono tabular-nums mt-0.5">
                <span className="font-sans font-bold uppercase tracking-wide text-[10px]" style={{ color: playerColor }}>
                  {metrics.win ? "Победа" : "Поражение"}
                </span>
                <span className="text-ink-secondary">
                  {" "}
                  · {metrics.kills}/{metrics.deaths}/{metrics.assists}
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {own && (
              <Link href={`/analysis/${overview.matchId}`} className={primaryButton}>
                ИИ-разбор этой игры
              </Link>
            )}
            <a
              href={`https://www.opendota.com/matches/${overview.matchId}`}
              target="_blank"
              rel="noreferrer"
              className={secondaryButton}
            >
              OpenDota ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function MatchPage({ params, searchParams }: PageProps<"/player/[accountId]/match/[matchId]">) {
  const { accountId: accountIdParam, matchId: matchIdParam } = await params;
  const { tab } = await searchParams;
  const accountId = Number(accountIdParam);
  const matchId = Number(matchIdParam);
  if (!Number.isInteger(accountId) || accountId <= 0 || !Number.isInteger(matchId) || matchId <= 0) {
    notFound();
  }

  let match;
  try {
    match = await getMatch(matchId);
  } catch (err) {
    if (err instanceof OpenDotaError && err.status === 404) notFound();
    throw err;
  }

  const player = match.players.find((p) => p.account_id === accountId);
  if (!player) notFound();
  const own = (await getSessionAccountId()) === accountId;

  // Benchmarks are fetched once per distinct hero in the lobby so every
  // player's detail panel (not just the page owner's) gets real percentiles.
  const uniqueHeroIds = [...new Set(match.players.map((p) => p.hero_id))];
  const benchmarksByHero = new Map(
    await Promise.all(
      uniqueHeroIds.map(async (heroId) => [heroId, await getBenchmarks(heroId).catch(() => null)] as const)
    )
  );

  const metrics = computeMatchMetrics(match, accountId, benchmarksByHero.get(player.hero_id) ?? null);
  const fullMatch = computeFullMatchOverview(match);

  // Best-effort: STRATZ gives a real per-match position classifier, but has
  // shown intermittent failures, so a GPM-rank estimate is always the fallback.
  const stratzPositions = await getMatchPlayerPositions(matchId).catch(() => null);
  const coreItemsByAccount = await computeMatchCoreItems(match, stratzPositions);

  const playerDetails: Record<number, PlayerDetail> = {};
  for (const p of match.players) {
    if (!p.account_id) continue;
    playerDetails[p.account_id] = {
      metrics: computeMatchMetrics(match, p.account_id, benchmarksByHero.get(p.hero_id) ?? null),
      skillBuild: computeSkillBuild(p, p.hero_id),
      coreItemKeys: [...(coreItemsByAccount.get(p.account_id) ?? [])],
    };
  }

  const roleComparisons = computeRoleComparisons(fullMatch.radiantPlayers, fullMatch.direPlayers, stratzPositions);
  const matchStory = computeMatchStory(match);

  const fullMatchContent = (
    <>
      {!fullMatch.isParsed && <ParseMatchButton matchId={matchId} />}
      <MatchOverviewInteractive
        radiantPlayers={fullMatch.radiantPlayers}
        direPlayers={fullMatch.direPlayers}
        radiantWin={fullMatch.radiantWin}
        playerDetails={playerDetails}
        matchId={matchId}
        focusedAccountId={accountId}
        focusLabel={own ? "это ты" : "профиль"}
        goldAdvantage={fullMatch.goldAdvTrend.map((p) => p.value)}
        xpAdvantage={fullMatch.xpAdvTrend.map((p) => p.value)}
      />
      {fullMatch.isParsed && (
        <section>
          <SectionHeading title="Карта" note="Где стояли варды и где каждый игрок проводил время." />
          <div className="grid xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-4 items-start">
            <WardsMap radiantPlayers={fullMatch.radiantPlayers} direPlayers={fullMatch.direPlayers} />
            <MovementHeatmap radiantPlayers={fullMatch.radiantPlayers} direPlayers={fullMatch.direPlayers} />
          </div>
        </section>
      )}
    </>
  );

  const myPerformanceContent = (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="K / D / A"
          value={`${metrics.kills}/${metrics.deaths}/${metrics.assists}`}
          sub={`KDA ${metrics.kda.toLocaleString("ru-RU")}`}
          accent={metrics.win ? RADIANT : DIRE}
        />
        <StatTile
          label="Добивания к 10:00"
          value={metrics.lastHitsAt10 !== null ? `${metrics.lastHitsAt10}` : "-"}
          sub={metrics.goldAt10 !== null ? `${metrics.goldAt10.toLocaleString("ru-RU")} золота к 10:00` : undefined}
        />
        <StatTile label="Поставлено вардов" value={`${metrics.wardsPlaced}`} sub={metrics.role} />
        <StatTile label="Байбэки" value={`${metrics.buybacks}`} sub={formatMatchTime(metrics.duration)} />
      </div>

      {own ? (
        <div
          className="relative overflow-hidden rounded-2xl border border-accent/30 bg-surface px-5 py-5 sm:px-6 flex flex-col md:flex-row md:items-center gap-4"
          style={{ background: "radial-gradient(500px 160px at 90% 50%, rgba(232,184,75,0.12), transparent), var(--color-surface)" }}
        >
          <div className="flex-1">
            <h3 className="font-display font-bold text-lg text-ink">Полный разбор этой игры</h3>
            <p className="text-sm text-ink-secondary mt-1">
              Плюсы и ошибки, вердикт по каждой фазе против врага на твоей позиции и каждая смерть на карте.
            </p>
          </div>
          <Link href={`/analysis/${matchId}`} className={primaryButton}>
            Открыть разбор →
          </Link>
        </div>
      ) : (
        <AICoachPanel
          endpoint="/api/coach/match"
          body={{ matchId, accountId }}
          label="Найти ошибки"
          title={`Разбор игры на ${metrics.heroName}`}
          description="Сравнение с врагом на той же позиции по фазам игры, разбор смертей и конкретные советы - по данным реплея."
        />
      )}

      <div className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <PanelHeader
            title={`На фоне всех игр на ${metrics.heroName}`}
            note="Перцентиль показывает, как цифра из этой игры выглядит на фоне всех игр на этом герое в OpenDota. Вертикальная черта - медиана."
          />
          <div className="divide-y divide-border">
            {metrics.stats.map((stat) => (
              <StatBar key={stat.label} stat={stat} />
            ))}
          </div>
        </div>

        {(metrics.itemTimeline.length > 0 || metrics.startingItems.length > 0) && (
          <div className="bg-surface border border-border rounded-2xl p-5">
            <PanelHeader title="Покупки по времени" />
            <MatchItemTimeline
              items={metrics.itemTimeline}
              startingItems={metrics.startingItems}
              coreItemKeys={playerDetails[accountId]?.coreItemKeys}
            />
          </div>
        )}
      </div>
    </>
  );

  const matchStoryContent = (
    <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 items-start">
      <div className="space-y-6 min-w-0">
        <AICoachPanel
          endpoint="/api/coach/match-story"
          body={{ matchId }}
          label="Объяснить исход"
          title="Что решило исход игры?"
          description="Переломные моменты, решающие драки и объекты - почему победила именно эта команда."
        />
        <section>
          <SectionHeading title="Позиция на позицию" note="Каждый игрок против врага на той же роли. Цвет полосы сверху - кто выиграл больше показателей." />
          {roleComparisons.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-ink-secondary">
              Не хватает данных, чтобы сравнить игроков по позициям в этом матче.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {roleComparisons.map((entry) => (
                <RoleComparisonCard key={entry.position} entry={entry} />
              ))}
            </div>
          )}
        </section>
      </div>
      <MatchStoryTimeline story={matchStory} />
    </div>
  );

  return (
    <PageContainer className="space-y-6">
      <Breadcrumbs
        items={[
          { href: "/", label: "Главная" },
          own ? { href: "/games", label: "Мои игры" } : { href: `/player/${accountId}`, label: player.personaname ?? "Профиль игрока" },
          { label: `Матч #${matchId}` },
        ]}
      />

      <MatchBanner overview={fullMatch} metrics={metrics} startTime={match.start_time} own={own} />

      <Tabs
        initial={typeof tab === "string" ? tab : undefined}
        tabs={[
          { id: "full", label: "Весь матч", content: fullMatchContent },
          { id: "story", label: "Ход игры", content: matchStoryContent },
          { id: "mine", label: own ? "Моя игра" : `Игрок: ${metrics.heroName}`, content: myPerformanceContent },
        ]}
      />
    </PageContainer>
  );
}
