import Image from "next/image";
import Link from "next/link";
import { getPatchHeroStats, type PatchHeroStats } from "@/lib/stratz";
import {
  computeMetaTierList,
  META_INDEX_WIN_RATE_WEIGHT,
  MIN_META_PICK_SHARE,
  MIN_SHARE_OF_MAIN_POSITION,
  roleLabelForPosition,
} from "@/lib/metrics/heroBuild";
import { getAllHeroes, getHeroImage } from "@/lib/constants";
import { pluralRu } from "@/lib/format";
import type { MetaTierEntry } from "@/lib/types";
import { HeroIcon } from "./HeroIcon";
import { Notice, SectionHeading } from "./PageHeader";

const POSITIONS = ["POSITION_1", "POSITION_2", "POSITION_3", "POSITION_4", "POSITION_5"];
// The rest of each position's ranking sits behind "show more".
const VISIBLE_PER_POSITION = 8;

const compactNumber = new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 });

function winColor(winRate: number): string {
  return winRate >= 0.5 ? "var(--color-status-good)" : "var(--color-status-critical)";
}

function heroBuildHref(entry: MetaTierEntry): string {
  return `/heroes/${entry.heroId}?pos=${entry.position}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function gamesLabel(games: number): string {
  return `${games.toLocaleString("ru-RU")} ${pluralRu(games, ["игра", "игры", "игр"])}`;
}

// STRATZ dates are midnight UTC - formatting in local time can land on the day before.
function formatDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
}

function entryTitle(e: MetaTierEntry): string {
  return `${e.heroName}, ${e.roleLabel.toLowerCase()}: индекс ${e.index}, винрейт ${formatPercent(e.winRate)}, ${gamesLabel(e.games)} (${formatPercent(e.pickShare)} игр позиции)`;
}

function PatchStrip({ data }: { data: PatchHeroStats }) {
  // Every match has ten heroes on positions.
  const matches = Math.round(data.stats.reduce((sum, s) => sum + s.matchCount, 0) / 10);
  // "4 млн матчей": after тыс./млн the noun is always plural genitive.
  const matchesWord = matches >= 1000 ? "матчей" : pluralRu(matches, ["матч", "матча", "матчей"]);
  return (
    <div className="bg-surface border border-border rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
      <span className="font-display font-bold text-ink text-lg">
        Патч <span className="text-accent">{data.patch.name}</span>
      </span>
      <span className="text-sm text-ink-secondary">В игре с {formatDay(data.patch.releasedAt)}</span>
      <span className="text-sm text-ink-secondary">
        ≈{compactNumber.format(matches)} {matchesWord} на ранге Легенда и выше
        {data.includesPreviousPatch ? "" : ` с ${formatDay(data.since)}`}
      </span>
      {data.includesPreviousPatch && (
        <p className="basis-full text-xs text-ink-muted leading-relaxed">
          Патч вышел меньше недели назад. STRATZ считает игры по неделям, поэтому пока в выборку попадают и последние
          дни прошлого патча - с началом новой недели останется только {data.patch.name}.
        </p>
      )}
    </div>
  );
}

function LeaderCard({ entry, index }: { entry: MetaTierEntry; index: number }) {
  const image = getHeroImage(entry.heroId);
  return (
    <Link
      href={heroBuildHref(entry)}
      title={entryTitle(entry)}
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
        <div className="mt-2 flex items-end justify-between gap-2">
          <span className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl tabular-nums text-ink">{entry.index}</span>
            <span className="text-[11px] text-ink-muted">индекс</span>
          </span>
          <span className="text-right text-xs font-mono tabular-nums leading-relaxed">
            <span className="block" style={{ color: winColor(entry.winRate) }}>
              {formatPercent(entry.winRate)}
            </span>
            <span className="block text-ink-muted">{compactNumber.format(entry.games)} игр</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function HeroRow({ entry, rank }: { entry: MetaTierEntry; rank: number }) {
  return (
    <li>
      <Link
        href={heroBuildHref(entry)}
        title={entryTitle(entry)}
        className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 -mx-1.5 hover:bg-surface-raised transition"
      >
        <span className="font-mono text-[11px] text-ink-muted w-4 text-right shrink-0">{rank}</span>
        <HeroIcon heroId={entry.heroId} size={28} />
        <span className="flex-1 min-w-0">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-ink truncate group-hover:text-accent transition">{entry.heroName}</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-ink shrink-0">{entry.index}</span>
          </span>
          <span className="block text-[11px] font-mono tabular-nums text-ink-muted truncate">
            <span style={{ color: winColor(entry.winRate) }}>{formatPercent(entry.winRate)}</span>
            {" · "}
            {compactNumber.format(entry.games)} игр
          </span>
        </span>
      </Link>
    </li>
  );
}

function PositionColumn({ position, index, entries }: { position: string; index: number; entries: MetaTierEntry[] }) {
  const top = entries.slice(0, VISIBLE_PER_POSITION);
  const rest = entries.slice(VISIBLE_PER_POSITION);
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-md bg-surface-raised text-ink-secondary text-xs font-mono font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <h3 className="text-sm font-semibold text-ink flex-1">{roleLabelForPosition(position)}</h3>
        <span className="text-[11px] text-ink-muted">индекс</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-ink-muted leading-relaxed">На этом патче мало игр на ранге Легенда и выше.</p>
      ) : (
        <>
          <ol className="space-y-1">
            {top.map((e, i) => (
              <HeroRow key={e.heroId} entry={e} rank={i + 1} />
            ))}
          </ol>
          {rest.length > 0 && (
            <details className="group mt-2">
              <summary className="list-none cursor-pointer select-none flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 -mx-1.5 text-xs text-ink-muted hover:text-ink hover:bg-surface-raised transition">
                <span>
                  <span className="group-open:hidden">Ещё</span>
                  <span className="hidden group-open:inline">Скрыть</span> {rest.length}{" "}
                  {pluralRu(rest.length, ["герой", "героя", "героев"])}
                </span>
                <span className="transition group-open:rotate-180" aria-hidden>
                  ▾
                </span>
              </summary>
              <ol className="space-y-1 mt-1">
                {rest.map((e, i) => (
                  <HeroRow key={e.heroId} entry={e} rank={VISIBLE_PER_POSITION + i + 1} />
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The current patch's meta per position (STRATZ, Legend+), ranked by the
 * meta index - win rate on the role blended with games on it. Rendered on
 * the server; every hero links to its guide with the build for that exact
 * position open.
 */
export async function MetaTierList() {
  const data = await getPatchHeroStats(getAllHeroes().map((h) => h.id))
    .then((patchStats) => ({ ...patchStats, tiers: computeMetaTierList(patchStats.stats) }))
    .catch(() => null);

  if (!data) {
    return (
      <Notice title="Не удалось загрузить мету">
        STRATZ сейчас не отвечает или не настроен ключ STRATZ_API_KEY. Попробуй обновить страницу через минуту.
      </Notice>
    );
  }

  const { tiers } = data;
  const leaders = POSITIONS.map((p) => tiers[p]?.[0]).filter((e): e is MetaTierEntry => Boolean(e));
  const winRateWeight = Math.round(META_INDEX_WIN_RATE_WEIGHT * 100);

  return (
    <div className="space-y-12">
      <PatchStrip data={data} />

      {leaders.length > 0 && (
        <section>
          <SectionHeading
            title="Лидеры позиций"
            note="Герой с самым высоким индексом на каждой роли. Нажми на героя - откроется его сборка именно для этой позиции."
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
          title="Индекс по позициям"
          note="Справа - индекс от 0 до 100, под именем - винрейт на этой позиции (зелёный - выше 50%) и сколько игр на ней сыграно за патч."
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
        <div className="text-sm text-ink-secondary leading-relaxed space-y-2">
          <p className="font-semibold text-ink">Как считается индекс</p>
          <p>
            Только игры на ранге Легенда и выше на текущем патче и только на этой позиции. Индекс складывается из
            двух частей:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="text-ink">{winRateWeight}% - винрейт</span> относительно среднего по позиции: +5 п.п. и
              выше дают максимум, −5 п.п. и ниже - ноль. Если игр немного, винрейт подтягивается к среднему, чтобы
              удачная серия не выглядела как сильный герой.
            </li>
            <li>
              <span className="text-ink">{100 - winRateWeight}% - число игр на роли</span>, по логарифмической шкале:
              максимум у самого популярного героя позиции, вдвое больше игр - одинаковый шаг вверх на любом уровне.
            </li>
          </ul>
          <p>
            Герой стоит только на своих позициях: там, где его чаще всего играют на этом патче, и там, где его играют
            почти так же часто (не меньше {Math.round(MIN_SHARE_OF_MAIN_POSITION * 100)}% от игр на основной роли).
            Поэтому мидера не будет среди керри из-за редких игр, где он забрал фарм. Ещё не попадают герои, на которых
            приходится меньше {(MIN_META_PICK_SHARE * 100).toLocaleString("ru-RU")}% игр позиции.
          </p>
        </div>
      </div>
    </div>
  );
}

export function MetaTierListSkeleton() {
  return (
    <div className="space-y-12" aria-hidden>
      <div className="h-[60px] rounded-2xl bg-surface border border-border animate-pulse" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[230px] rounded-2xl bg-surface border border-border animate-pulse" />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[440px] rounded-2xl bg-surface border border-border animate-pulse" />
        ))}
      </div>
    </div>
  );
}
