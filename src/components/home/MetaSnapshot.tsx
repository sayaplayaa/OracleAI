import Link from "next/link";
import { getPatchHeroStats } from "@/lib/stratz";
import { computeMetaTierList, roleLabelForPosition } from "@/lib/metrics/heroBuild";
import { getAllHeroes } from "@/lib/constants";
import { pluralRu } from "@/lib/format";
import { HeroIcon } from "../HeroIcon";

const POSITIONS = ["POSITION_1", "POSITION_2", "POSITION_3", "POSITION_4", "POSITION_5"];
const PER_POSITION = 3;

/**
 * The current patch's strongest heroes per position (STRATZ, Legend+ games,
 * ranked by the meta index) - the same data as the Meta page, condensed.
 * Renders nothing when STRATZ is unavailable rather than an error block on
 * the landing page.
 */
export async function MetaSnapshot() {
  const data = await getPatchHeroStats(getAllHeroes().map((h) => h.id))
    .then((patchStats) => ({ patch: patchStats.patch, tiers: computeMetaTierList(patchStats.stats) }))
    .catch(() => null);
  if (!data || POSITIONS.every((p) => (data.tiers[p]?.length ?? 0) === 0)) return null;
  const { patch, tiers } = data;

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase mb-2">Живые данные · STRATZ</p>
          <h2 className="font-display font-bold text-2xl text-ink">Мета патча {patch.name}</h2>
          <p className="text-sm text-ink-muted mt-1">
            Лучшие герои каждой позиции по индексу меты: винрейт и число игр на роли, Legend и выше.
          </p>
        </div>
        <Link href="/drafts" className="text-sm font-medium text-accent hover:brightness-110 transition">
          Вся мета →
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {POSITIONS.map((position, i) => (
          <div key={position} className="bg-surface border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-md bg-surface-raised text-ink-secondary text-xs font-mono font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-sm font-semibold text-ink">{roleLabelForPosition(position)}</span>
            </div>
            <ol className="space-y-2">
              {(tiers[position] ?? []).slice(0, PER_POSITION).map((hero) => (
                <li key={hero.heroId}>
                  <Link
                    href={`/heroes/${hero.heroId}`}
                    title={`Индекс ${hero.index}: винрейт ${(hero.winRate * 100).toFixed(1)}%, ${hero.games.toLocaleString("ru-RU")} ${pluralRu(hero.games, ["игра", "игры", "игр"])} на позиции`}
                    className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-surface-raised transition"
                  >
                    <HeroIcon heroId={hero.heroId} size={28} />
                    <span className="text-sm text-ink truncate flex-1 min-w-0">{hero.heroName}</span>
                    <span className="font-mono text-xs text-ink-secondary tabular-nums">{hero.index}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MetaSnapshotSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-[150px] rounded-2xl bg-surface border border-border animate-pulse" />
      ))}
    </div>
  );
}
