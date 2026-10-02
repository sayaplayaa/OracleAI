import { getHeroImage } from "@/lib/constants";
import { pluralRu } from "@/lib/format";
import { TiltCard } from "./TiltCard";
import { AICoachPanel } from "./AICoachPanel";

export function SignatureHeroCard({
  accountId,
  heroId,
  heroName,
  games,
  winRate,
}: {
  accountId: number;
  heroId: number;
  heroName: string;
  games: number;
  winRate: number;
}) {
  const image = getHeroImage(heroId);

  return (
    <div className="space-y-3">
      <TiltCard className="relative rounded-xl overflow-hidden border border-border aspect-square">
        <div
          className="absolute inset-0 bg-cover bg-center scale-125"
          style={{ backgroundImage: image ? `url(${image})` : undefined }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,11,13,0.1) 0%, rgba(10,11,13,0.6) 65%, var(--color-page) 100%)",
          }}
        />
        <div className="relative h-full flex flex-col justify-end p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">
            Сигнатурный герой
          </p>
          <h3 className="text-xl font-bold text-ink drop-shadow">{heroName}</h3>
          <p className="text-xs text-ink-secondary mt-1">
            {games.toLocaleString("ru-RU")} {pluralRu(games, ["игра", "игры", "игр"])} ·{" "}
            <span
              className="font-semibold"
              style={{
                color:
                  winRate >= 0.5
                    ? "var(--color-status-good)"
                    : "var(--color-status-critical)",
              }}
            >
              винрейт {Math.round(winRate * 100)}%
            </span>
          </p>
        </div>
      </TiltCard>
      <AICoachPanel
        endpoint="/api/coach/hero"
        body={{ accountId, heroId }}
        label={`Советы по игре на ${heroName}`}
      />
    </div>
  );
}
