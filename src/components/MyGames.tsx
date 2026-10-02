import Image from "next/image";
import Link from "next/link";
import { getProfile, getRecentMatches } from "@/lib/opendota";
import { getHeroImage, getHeroName } from "@/lib/constants";
import { formatMatchTime, pluralRu, timeAgoRu } from "@/lib/format";
import type { OpenDotaRecentMatch } from "@/lib/types";
import { HeroIcon } from "./HeroIcon";
import { AnalyzedBadge } from "./AnalyzedBadge";

export type GamesFilter = "all" | "wins" | "losses";

const FILTERS: { id: GamesFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "wins", label: "Победы" },
  { id: "losses", label: "Поражения" },
];

function isWin(game: OpenDotaRecentMatch): boolean {
  return (game.player_slot < 128) === game.radiant_win;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-8 text-center max-w-2xl mx-auto">
      <h2 className="font-display font-bold text-ink mb-2">{title}</h2>
      <div className="text-sm text-ink-secondary leading-relaxed">{children}</div>
    </div>
  );
}

export function GameCard({ accountId, game }: { accountId: number; game: OpenDotaRecentMatch }) {
  const won = isWin(game);
  const color = won ? "var(--color-status-good)" : "var(--color-status-critical)";
  const image = getHeroImage(game.hero_id);

  return (
    <Link
      href={`/analysis/${game.match_id}`}
      className="group flex flex-col bg-surface border border-border hover:border-accent/60 rounded-2xl overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]"
    >
      <div className="relative aspect-[16/8] bg-surface-raised overflow-hidden">
        {image && (
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-300 group-hover:scale-105"
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />
        <span
          className="absolute left-3 top-3 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-page/85 backdrop-blur"
          style={{ color }}
        >
          {won ? "Победа" : "Поражение"}
        </span>
        <span className="absolute right-3 top-3">
          <AnalyzedBadge accountId={accountId} matchId={game.match_id} />
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-2 px-4 pb-4 -mt-5 relative">
        <div className="flex items-end gap-2">
          <h3 className="font-semibold text-ink truncate">{getHeroName(game.hero_id)}</h3>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-ink-secondary">
          <span>
            <span className="text-ink">{game.kills}</span>/<span style={{ color: "var(--color-status-critical)" }}>{game.deaths}</span>/
            <span className="text-ink">{game.assists}</span>
          </span>
          <span className="text-ink-muted">·</span>
          <span>{formatMatchTime(game.duration)}</span>
          <span className="text-ink-muted">·</span>
          <span className="text-ink-muted">{timeAgoRu(game.start_time)}</span>
        </div>
        <span className="mt-auto pt-1 text-sm font-medium text-accent flex items-center gap-1.5">
          Разобрать игру
          <span className="transition group-hover:translate-x-1" aria-hidden>
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

function SummaryTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 min-w-[120px]">
      <p className="text-[11px] text-ink-muted uppercase tracking-wide">{label}</p>
      <p className="font-mono text-xl text-ink tabular-nums mt-1 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-ink-muted mt-1.5">{sub}</p>}
    </div>
  );
}

export async function MyGames({ accountId, filter = "all" }: { accountId: number; filter?: GamesFilter }) {
  const [profile, matches] = await Promise.all([
    getProfile(accountId).catch(() => null),
    getRecentMatches(accountId, 20).catch(() => null),
  ]);
  const name = profile?.profile.personaname ?? "игрок";
  const avatar = profile?.profile.avatarfull ?? null;
  const wins = matches?.filter(isWin).length ?? 0;
  const total = matches?.length ?? 0;
  const avgKda =
    matches && total > 0
      ? matches.reduce((s, m) => s + (m.kills + m.assists) / Math.max(1, m.deaths), 0) / total
      : null;
  const heroCounts = new Map<number, number>();
  for (const m of matches ?? []) heroCounts.set(m.hero_id, (heroCounts.get(m.hero_id) ?? 0) + 1);
  const favorite = [...heroCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const shown = (matches ?? []).filter((m) => (filter === "wins" ? isWin(m) : filter === "losses" ? !isWin(m) : true));

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="flex flex-col xl:flex-row xl:items-center gap-6 mb-8">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {avatar && (
            <Image src={avatar} alt="" width={64} height={64} className="rounded-xl border border-border" unoptimized />
          )}
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-ink truncate">Привет, {name}!</h1>
            <p className="text-ink-secondary mt-1">Выбери игру - ИИ-тренер разберёт её по фазам и покажет каждую смерть на карте.</p>
          </div>
        </div>
        {total > 0 && (
          <div className="flex gap-3 flex-wrap">
            <SummaryTile
              label={`Последние ${total}`}
              value={
                <>
                  <span style={{ color: "var(--color-status-good)" }}>{wins}</span>
                  <span className="text-ink-muted"> - </span>
                  <span style={{ color: "var(--color-status-critical)" }}>{total - wins}</span>
                </>
              }
              sub={`${Math.round((wins / total) * 100)}% побед`}
            />
            {avgKda !== null && <SummaryTile label="Средний KDA" value={avgKda.toFixed(1)} sub="(K + A) / D" />}
            {favorite && (
              <div className="bg-surface border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <HeroIcon heroId={favorite[0]} size={36} />
                <div>
                  <p className="text-[11px] text-ink-muted uppercase tracking-wide">Чаще всего</p>
                  <p className="text-sm text-ink font-medium mt-0.5">
                    {getHeroName(favorite[0])}{" "}
                    <span className="text-ink-muted font-normal">
                      · {favorite[1]} {pluralRu(favorite[1], ["игра", "игры", "игр"])}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {matches === null ? (
        <Notice title="Не удалось загрузить список игр">
          OpenDota сейчас не отвечает. Обнови страницу через минуту.
        </Notice>
      ) : matches.length === 0 ? (
        <Notice title="Пока не видно ни одной игры">
          Включи в Dota 2 опцию «Expose Public Match Data» (Настройки → Опции → Социальное),
          сыграй одну игру - и она появится здесь. Данные обновляются не мгновенно.
        </Notice>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div className="flex gap-1.5 bg-surface border border-border rounded-xl p-1" role="tablist" aria-label="Фильтр игр">
              {FILTERS.map((f) => (
                <Link
                  key={f.id}
                  href={f.id === "all" ? "/games" : `/games?filter=${f.id}`}
                  role="tab"
                  aria-selected={filter === f.id}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                    filter === f.id ? "bg-accent text-page" : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  {f.label}
                </Link>
              ))}
            </div>
            <Link
              href={`/player/${accountId}`}
              className="text-sm text-ink-muted hover:text-accent underline-offset-4 hover:underline transition"
            >
              Подробная статистика профиля →
            </Link>
          </div>

          {shown.length === 0 ? (
            <Notice title="Таких игр среди последних нет">Попробуй другой фильтр.</Notice>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {shown.map((game) => (
                <GameCard key={game.match_id} accountId={accountId} game={game} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
