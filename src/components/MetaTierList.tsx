import Image from "next/image";
import Link from "next/link";
import { getAllHeroStats } from "@/lib/stratz";
import { computeMetaTierList, roleLabelForPosition } from "@/lib/metrics/heroBuild";
import { getAllHeroes, getHeroImage } from "@/lib/constants";
import { pluralRu } from "@/lib/format";
import type { MetaTierEntry } from "@/lib/types";
import { HeroIcon } from "./HeroIcon";
import { Notice, SectionHeading } from "./PageHeader";

const POSITIONS = ["POSITION_1", "POSITION_2", "POSITION_3", "POSITION_4", "POSITION_5"];

function winColor(winRate: number): string {
  return winRate >= 0.5 ? "var(--color-status-good)" : "var(--color-status-critical)";
}

function heroBuildHref(entry: MetaTierEntry): string {
  return `/heroes/${entry.heroId}?pos=${entry.position}`;
}

function formatWinRate(winRate: number): string {
  return `${(winRate * 100).toFixed(1)}%`;
}

/** Win rate bar centered on 50%: the 40-60% range fills the track. */
function WinRateBar({ winRate }: { winRate: number }) {
  const offset = Math.max(-1, Math.min(1, (winRate - 0.5) / 0.1));
  const width = Math.abs(offset) * 50;
  return (
    <span className="relative block h-1 rounded-full bg-page overflow-hidden" aria-hidden>
      <span className="absolute inset-y-0 left-1/2 w-px bg-ink-muted/40" />
      <span
        className="absolute inset-y-0 rounded-full"
        style={{
          left: offset >= 0 ? "50%" : `${50 - width}%`,
          width: `${Math.max(width, 2)}%`,
          background: winColor(winRate),
        }}
      />
    </span>
  );
}

function LeaderCard({ entry, index }: { entry: MetaTierEntry; index: number }) {
  const image = getHeroImage(entry.heroId);
  return (
    <Link
      href={heroBuildHref(entry)}
      className="group relative block bg-surface border border-border hover:border-accent/60 rounded-2xl overflow-hidden transition hover:-translate-y-0.5"
    >
      <div className="relative aspect-[16/9] bg-surface-raised overflow-hidden">
        {image && (
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1024px) 20vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-300 group-hover:scale-105"
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-page/85 backdrop-blur text-ink">
          <span className="font-mono text-accent">{index + 1}</span>
          {roleLabelForPosition(entry.position)}
        </span>
      </div>
      <div className="px-4 pb-4 -mt-6 relative">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">Лидер позиции</p>
        <h3 className="font-display font-bold text-lg text-ink truncate">{entry.heroName}</h3>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="font-mono text-2xl tabular-nums" style={{ color: winColor(entry.winRate) }}>
            {formatWinRate(entry.winRate)}
          </span>
          <span className="text-xs text-ink-muted font-mono tabular-nums">
            {entry.games.toLocaleString("ru-RU")} {pluralRu(entry.games, ["игра", "игры", "игр"])}
          </span>
        </div>
      </div>
    </Link>
  );
}

function PositionColumn({ position, index, entries }: { position: string; index: number; entries: MetaTierEntry[] }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-md bg-surface-raised text-ink-secondary text-xs font-mono font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <h3 className="text-sm font-semibold text-ink">{roleLabelForPosition(position)}</h3>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-ink-muted leading-relaxed">На этой неделе мало игр на ранге Легенда и выше.</p>
      ) : (
        <ol className="space-y-1">
          {entries.map((e, i) => (
            <li key={e.heroId}>
              <Link
                href={heroBuildHref(e)}
                title={`${e.heroName}: ${e.games.toLocaleString("ru-RU")} ${pluralRu(e.games, ["игра", "игры", "игр"])} на этой позиции`}
                className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 -mx-1.5 hover:bg-surface-raised transition"
              >
                <span className="font-mono text-[11px] text-ink-muted w-3 text-right shrink-0">{i + 1}</span>
                <HeroIcon heroId={e.heroId} size={28} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-ink truncate group-hover:text-accent transition">{e.heroName}</span>
                    <span className="font-mono text-xs tabular-nums shrink-0" style={{ color: winColor(e.winRate) }}>
                      {formatWinRate(e.winRate)}
                    </span>
                  </span>
                  <span className="mt-1 block">
                    <WinRateBar winRate={e.winRate} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * This week's meta per position (STRATZ, Legend+), ranked by
 * confidence-adjusted win rate. Rendered on the server; every hero links to
 * its guide with the build for that exact position open.
 */
export async function MetaTierList() {
  const tiers = await getAllHeroStats(getAllHeroes().map((h) => h.id))
    .then(computeMetaTierList)
    .catch(() => null);

  if (!tiers) {
    return (
      <Notice title="Не удалось загрузить мету">
        STRATZ сейчас не отвечает или не настроен ключ STRATZ_API_KEY. Попробуй обновить страницу через минуту.
      </Notice>
    );
  }

  const leaders = POSITIONS.map((p) => tiers[p]?.[0]).filter((e): e is MetaTierEntry => Boolean(e));

  return (
    <div className="space-y-12">
      {leaders.length > 0 && (
        <section>
          <SectionHeading
            title="Лидеры позиций"
            note="Самый надёжный герой на каждой роли. Нажми на героя - откроется его сборка именно для этой позиции."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {leaders.map((entry) => (
              <LeaderCard key={entry.position} entry={entry} index={POSITIONS.indexOf(entry.position)} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading
          title="Топ по позициям"
          note="Полоса показывает отклонение от 50% винрейта: вправо и зелёным - чаще побеждают, влево и красным - чаще проигрывают."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-start">
          {POSITIONS.map((p, i) => (
            <PositionColumn key={p} position={p} index={i} entries={tiers[p] ?? []} />
          ))}
        </div>
      </section>

      <div className="bg-surface border border-border rounded-2xl p-5 flex gap-4 items-start">
        <span className="w-9 h-9 rounded-xl bg-accent/12 text-accent flex items-center justify-center shrink-0 font-bold" aria-hidden>
          i
        </span>
        <div className="text-sm text-ink-secondary leading-relaxed">
          <p className="font-semibold text-ink mb-1">Как считается рейтинг</p>
          Только игры на ранге Легенда и выше за текущую неделю. Сортировка - по винрейту с поправкой на
          размер выборки: герою нужно реальное число игр на позиции, поэтому случайные офф-мета пики с
          парой удачных матчей в список не попадают.
        </div>
      </div>
    </div>
  );
}

export function MetaTierListSkeleton() {
  return (
    <div className="space-y-12" aria-hidden>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[230px] rounded-2xl bg-surface border border-border animate-pulse" />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[380px] rounded-2xl bg-surface border border-border animate-pulse" />
        ))}
      </div>
    </div>
  );
}
