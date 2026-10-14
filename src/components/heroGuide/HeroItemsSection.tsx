import { itemDeadline, laningItems, pubStatus, situationalChoices, spineItems, type LaningEntry, type SituationalChoice } from "@/lib/buildItems";
import { pluralRu } from "@/lib/format";
import type {
  HeroBuildOverview,
  HeroGuideEarlyItem,
  HeroGuideItemTip,
  HeroGuideLateItem,
  ItemProgressionPoint,
  ReplayBuild,
} from "@/lib/types";
import { ItemIcon } from "../ItemIcon";
import { NeutralItemTiers } from "../NeutralItemTiers";
import { PanelHeader } from "../PageHeader";

function pct(share: number | undefined | null): string {
  return `${Math.round((share ?? 0) * 100)}%`;
}

function winColor(rate: number, baseline: number | null): string {
  return rate >= (baseline ?? 0.5) ? "var(--color-status-good)" : "var(--color-status-critical)";
}

function gamesWord(n: number): string {
  return pluralRu(n, ["игра", "игры", "игр"]);
}

/** Win rate by the minute it's finished: the fastest and slowest quarter of purchases. */
function TimingLine({ item, roleWinRate }: { item: ItemProgressionPoint; roleWinRate: number | null }) {
  const t = item.timing;
  if (!t) return null;
  const deadline = itemDeadline(t);
  return (
    <p className="flex items-center gap-x-2 gap-y-1 flex-wrap text-[11px] font-mono tabular-nums text-ink-muted">
      <span title="Винрейт игр, где предмет был готов к этой минуте (самая быстрая четверть покупок)">
        к {t.fastMinute}′ <span style={{ color: winColor(t.fastWinRate, roleWinRate) }}>{pct(t.fastWinRate)}</span>
      </span>
      <span aria-hidden>→</span>
      <span title="Винрейт игр, где предмет купили с этой минуты и позже (самая медленная четверть)">
        с {t.slowMinute}′ <span style={{ color: winColor(t.slowWinRate, roleWinRate) }}>{pct(t.slowWinRate)}</span>
      </span>
      {deadline && (
        <span
          className="font-sans font-semibold text-accent bg-accent/12 px-1.5 py-0.5 rounded-md"
          title="До этой минуты игры с этим предметом выигрываются не реже, чем в среднем на герое"
        >
          успеть к {deadline}′
        </span>
      )}
    </p>
  );
}

function AiNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink leading-relaxed border-l-2 border-accent/60 pl-2.5">{children}</p>;
}

// ---- Start and lane ----

function LaneRow({ entry, roleWinRate, tip }: { entry: LaningEntry; roleWinRate: number | null; tip: HeroGuideEarlyItem | undefined }) {
  const { item, alternatives, optional, towards } = entry;
  return (
    <li className="flex gap-3 rounded-xl bg-page/50 border border-border p-3">
      <span className="shrink-0 self-start leading-none">
        <ItemIcon itemKey={item.itemKey} size={36} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-baseline gap-x-2 flex-wrap">
          <span className="text-sm font-semibold text-ink">{item.itemName}</span>
          <span className="text-[11px] font-mono text-ink-muted tabular-nums">
            ~{Math.round(item.avgTimeSeconds / 60)}′ · {pct(item.pickRate)} игр ·{" "}
            <span style={{ color: winColor(item.winRate, roleWinRate) }}>{pct(item.winRate)}</span>
          </span>
          {optional && <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">по ситуации</span>}
        </p>
        {towards && <p className="text-[11px] text-ink-muted">на пути к {towards}</p>}
        {alternatives.length > 0 && (
          <p className="flex items-center gap-1.5 flex-wrap text-[11px] text-ink-muted">
            вместо них:
            {alternatives.map((a) => (
              <span key={a.itemKey} className="inline-flex items-center gap-1">
                <ItemIcon itemKey={a.itemKey} size={16} />
                {a.itemName} <span className="font-mono">{pct(a.pickRate)}</span>
              </span>
            ))}
          </p>
        )}
        {tip && <AiNote>{tip.why}</AiNote>}
      </div>
    </li>
  );
}

function StartAndLane({ build, tips }: { build: HeroBuildOverview; tips: HeroGuideEarlyItem[] }) {
  const lane = laningItems(build);
  // An AI note on the alternative boots belongs to the row they're listed in.
  const tipFor = (e: LaningEntry) => tips.find((t) => t.itemKey === e.item.itemKey || e.alternatives.some((a) => a.itemKey === t.itemKey));
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
      <PanelHeader
        title="Старт и линия"
        note="С чем выходить и что покупать на линии - по порядку, с минутой, долей игр и винрейтом. Обувь здесь же: её выбирают на линии, вместе с остальным."
      />
      {build.startingItems.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">Старт</p>
          <ul className="flex gap-2 flex-wrap">
            {build.startingItems.map((i) => (
              <li key={i.itemKey} className="flex items-center gap-2 rounded-xl border border-border bg-page/50 pl-1.5 pr-3 py-1.5">
                <ItemIcon itemKey={i.itemKey} size={26} />
                <span className="text-xs text-ink">
                  {i.itemName}
                  {i.copies > 1 && <span className="text-ink-muted"> ×{i.copies}</span>}
                </span>
                <span className="text-[11px] font-mono text-ink-muted tabular-nums">{pct(i.pickRate)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {lane.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">Линия, первые ~12 минут</p>
          <ol className="grid gap-2 md:grid-cols-2">
            {lane.map((e) => (
              <LaneRow key={e.item.itemKey} entry={e} roleWinRate={build.winRate} tip={tipFor(e)} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ---- Core ----

function SpineCard({ item, number, tip, roleWinRate }: { item: ItemProgressionPoint; number: number; tip: HeroGuideItemTip | undefined; roleWinRate: number | null }) {
  return (
    <li className="flex gap-3 rounded-xl bg-page/50 border border-border p-3.5">
      {/* A wrapper keeps the icon square: as a flex child it stretched to the card's height. */}
      <span className="relative shrink-0 self-start leading-none">
        <ItemIcon itemKey={item.itemKey} size={44} />
        <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-accent text-page text-[9px] font-bold font-mono flex items-center justify-center">
          {number}
        </span>
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex items-baseline gap-x-2 flex-wrap">
          <span className="font-display font-bold text-ink">{item.itemName}</span>
          <span className="text-[11px] font-mono text-ink-muted tabular-nums">
            ~{Math.round(item.avgTimeSeconds / 60)}′ · {pct(item.pickRate)} игр
          </span>
        </p>
        {item.builtFrom && item.builtFrom.length > 0 && (
          <p className="text-[11px] text-ink-muted">через {item.builtFrom.map((b) => b.itemName).join(", ")}</p>
        )}
        <TimingLine item={item} roleWinRate={roleWinRate} />
        {tip && (
          <div className="space-y-1.5 pt-1">
            {tip.abilityName && (
              <span className="inline-block text-[11px] font-semibold text-accent bg-accent/12 px-2 py-0.5 rounded-full">усиливает {tip.abilityName}</span>
            )}
            <p className="text-sm text-ink leading-relaxed">{tip.why}</p>
            {tip.whatToDo && (
              <p className="text-sm text-ink-secondary leading-relaxed">
                <span className="font-semibold text-accent">После покупки:</span> {tip.whatToDo}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** The orders the first big items were really finished in, from parsed games. */
function ReplayPaths({ replays }: { replays: ReplayBuild }) {
  if (replays.paths.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
        Порядок в разобранных играх ({replays.games} {gamesWord(replays.games)} этого патча)
      </p>
      <ul className="space-y-1.5">
        {replays.paths.map((p) => (
          <li key={p.items.map((i) => i.itemKey).join(">")} className="flex items-center gap-2 flex-wrap rounded-xl bg-page/50 border border-border px-3 py-2">
            {p.items.map((i, n) => (
              <span key={i.itemKey} className="flex items-center gap-1.5">
                {n > 0 && <span className="text-ink-muted" aria-hidden>→</span>}
                <ItemIcon itemKey={i.itemKey} size={24} />
                <span className="text-xs text-ink">{i.itemName}</span>
                <span className="text-[11px] font-mono text-ink-muted">{i.minute}′</span>
              </span>
            ))}
            <span className="ml-auto text-[11px] font-mono text-ink-muted tabular-nums">
              {p.games} из {replays.games} · побед{" "}
              <span style={{ color: winColor(p.wins / p.games, null) }}>{pct(p.wins / p.games)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Core({ build, tips }: { build: HeroBuildOverview; tips: HeroGuideItemTip[] }) {
  const spine = spineItems(build);
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 space-y-4" style={{ boxShadow: "inset 0 3px 0 0 var(--color-accent)" }}>
      <PanelHeader
        title="Основа"
        note={`Большие предметы, которые собирают почти всегда, по порядку (${build.games.toLocaleString("ru-RU")} игр за неделю, STRATZ). Под предметом - винрейт по минуте покупки: быстрая четверть покупок против медленной. Быстрый предмет чаще бывает в игре, которая и так идёт хорошо, - это ориентир, а не гарантия.`}
      />
      {spine.length === 0 ? (
        <p className="text-sm text-ink-muted">Для этой роли пока мало данных.</p>
      ) : (
        <ol className="grid gap-3 md:grid-cols-2">
          {spine.map((item, i) => (
            <SpineCard key={item.itemKey} item={item} number={i + 1} tip={tips.find((t) => t.itemKey === item.itemKey)} roleWinRate={build.winRate} />
          ))}
        </ol>
      )}
      {build.replays && <ReplayPaths replays={build.replays} />}
    </div>
  );
}

// ---- By situation ----

function SituationCard({ choice, total, note, roleWinRate }: { choice: SituationalChoice; total: number | null; note: HeroGuideLateItem | undefined; roleWinRate: number | null }) {
  const { stats, evidence } = choice;
  return (
    <li className="flex gap-3 rounded-xl bg-page/50 border border-border p-3">
      <span className="shrink-0 self-start leading-none">
        <ItemIcon itemKey={choice.itemKey} size={36} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-baseline gap-x-2 flex-wrap">
          <span className="text-sm font-semibold text-ink">{choice.itemName}</span>
          {stats && (
            <span className="text-[11px] font-mono text-ink-muted tabular-nums" title="Доля игр, доживших до обычной минуты покупки, где предмет собрали (STRATZ)">
              ~{Math.round(stats.avgTimeSeconds / 60)}′ · {pct(stats.pickRateIfReached ?? stats.pickRate)} ·{" "}
              <span style={{ color: winColor(stats.winRate, roleWinRate) }}>{pct(stats.winRate)}</span>
            </span>
          )}
        </p>
        {evidence && total !== null && (
          <div className="text-[11px] text-ink-muted space-y-0.5">
            <p>
              В разобранных играх: {evidence.games} из {total}, ~{evidence.minute}′
            </p>
            {evidence.traits.map((t) => (
              <p key={t.key} className="text-accent">
                У врагов больше «{t.label}»: {t.withItem} против {t.withoutItem} без него
              </p>
            ))}
            {evidence.enemies.length > 0 && <p>Чаще против: {evidence.enemies.map((e) => `${e.heroName} (${e.games})`).join(", ")}</p>}
          </div>
        )}
        {note && <AiNote>{note.when}</AiNote>}
      </div>
    </li>
  );
}

function BySituation({ build, notes }: { build: HeroBuildOverview; notes: HeroGuideLateItem[] }) {
  const choices = situationalChoices(build);
  if (choices.length === 0) return null;
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 space-y-3">
      <PanelHeader
        title="По ситуации"
        note="Один-два за игру, не все сразу. Под предметом - что было у врагов в разобранных играх, где его собрали: так видно, против чего его на самом деле берут."
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {choices.map((c) => (
          <SituationCard key={c.itemKey} choice={c} total={build.replays?.games ?? null} note={notes.find((n) => n.itemKey === c.itemKey)} roleWinRate={build.winRate} />
        ))}
      </ul>
    </div>
  );
}

// ---- Pro scene ----

const PUB_STATUS_LABEL = {
  core: () => "основа в пабах",
  late: (share: string) => `поздний вариант в пабах, ${share}`,
  boots: (share: string) => `обувь в пабах, ${share}`,
  other: (share: string) => `в пабах ${share}`,
  none: () => "в пабах почти не берут",
} as const;

function ProScene({ build, heroName }: { build: HeroBuildOverview; heroName: string }) {
  if (build.proItems.length === 0) return null;
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <PanelHeader title="Как собирают про-игроки" note={`Последние турнирные игры на ${heroName} (OpenDota, все позиции). Выделено то, что в пабах этой роли почти не берут.`} />
      <ul className="grid gap-x-6 gap-y-1 md:grid-cols-2">
        {build.proItems.map((item) => {
          const status = pubStatus(build, item.itemKey);
          const differs = status.kind === "none" || status.kind === "other";
          return (
            <li key={item.itemKey} className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2">
              <ItemIcon itemKey={item.itemKey} size={30} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-ink truncate">{item.itemName}</span>
                <span className={`block text-[11px] ${differs ? "text-accent" : "text-ink-muted"}`}>{PUB_STATUS_LABEL[status.kind](pct(status.share))}</span>
              </span>
              <span className="text-xs font-mono text-ink-muted tabular-nums">
                {item.games} {gamesWord(item.games)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Every item decision of the role by game phase: start and lane (boots
 * included - they're a laning choice), the core with its timing benchmarks
 * and the real orders from parsed games, items by situation with what the
 * enemy had when they were bought, and the pro scene. The AI coach's notes
 * sit on the items they're about; without them it's the data alone.
 */
export function HeroItemsSection({
  build,
  heroName,
  earlyTips,
  itemTips,
  lateNotes,
}: {
  build: HeroBuildOverview;
  heroName: string;
  earlyTips: HeroGuideEarlyItem[];
  itemTips: HeroGuideItemTip[];
  lateNotes: HeroGuideLateItem[];
}) {
  return (
    <div className="space-y-4">
      <StartAndLane build={build} tips={earlyTips} />
      <Core build={build} tips={itemTips} />
      <BySituation build={build} notes={lateNotes} />
      <ProScene build={build} heroName={heroName} />
      {/* STRATZ currently returns no neutral item stats at all; the block only shows when it does. */}
      {build.neutralTiers.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <PanelHeader title="Нейтральные предметы" note="По тирам, отсортированы по винрейту. Обведён лучший в тире." />
          <NeutralItemTiers tiers={build.neutralTiers} />
        </div>
      )}
    </div>
  );
}
