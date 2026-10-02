import Link from "next/link";
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
  const color = winRate >= 0.5 ? "var(--color-status-good)" : "var(--color-status-critical)";

  return (
    <div className="space-y-3">
      <TiltCard maxTilt={6} className="relative rounded-2xl overflow-hidden border border-border aspect-[16/10]">
        <div
          className="absolute inset-0 bg-cover bg-center scale-110"
          style={{ backgroundImage: image ? `url(${image})` : undefined }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-page via-page/50 to-transparent" />
        <div className="relative h-full flex flex-col justify-end p-5">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-1">Сигнатурный герой</p>
          <h3 className="font-display font-bold text-2xl text-ink drop-shadow">{heroName}</h3>
          <div className="flex items-center gap-3 mt-2 text-sm">
            <span className="font-mono tabular-nums text-ink-secondary">
              {games.toLocaleString("ru-RU")} {pluralRu(games, ["игра", "игры", "игр"])}
            </span>
            <span className="font-mono font-semibold tabular-nums" style={{ color }}>
              {Math.round(winRate * 100)}% побед
            </span>
            <Link href={`/heroes/${heroId}`} className="ml-auto text-xs text-accent hover:underline underline-offset-4">
              Гайд →
            </Link>
          </div>
        </div>
      </TiltCard>
      <AICoachPanel
        endpoint="/api/coach/hero"
        body={{ accountId, heroId }}
        label="Получить советы"
        title={`Как играть на ${heroName} лучше`}
        description={`Сильные и слабые стороны твоей игры на ${heroName} по твоим матчам на нём и конкретные советы.`}
      />
    </div>
  );
}
