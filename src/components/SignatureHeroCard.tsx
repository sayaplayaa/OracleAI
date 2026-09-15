import { HeroSplashHeader } from "./HeroSplashHeader";
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
  return (
    <div className="space-y-3">
      <HeroSplashHeader
        heroId={heroId}
        eyebrow="Signature hero"
        title={heroName}
        accent="var(--color-accent)"
        subtitle={
          <>
            {games.toLocaleString()} games ·{" "}
            <span
              style={{
                color:
                  winRate >= 0.5
                    ? "var(--color-status-good)"
                    : "var(--color-status-critical)",
              }}
            >
              {Math.round(winRate * 100)}% win rate
            </span>
          </>
        }
      />
      <AICoachPanel
        endpoint="/api/coach/hero"
        body={{ accountId, heroId }}
        label={`Get tips for ${heroName}`}
      />
    </div>
  );
}
