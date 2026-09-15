import { getAllHeroes } from "@/lib/constants";
import { DraftExplorer } from "@/components/DraftExplorer";

export default function DraftsPage() {
  const heroes = getAllHeroes();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-2">
      <h1 className="text-xl font-bold text-ink">Draft Explorer</h1>
      <p className="text-sm text-ink-secondary max-w-2xl mb-6">
        Pick a hero to see its real counter-pick data from OpenDota (which
        heroes it historically struggles against and which it dominates) and
        its best lane partners from STRATZ (real teammate win rates for its
        most-played position) - both by win rate across public matches, with
        a minimum sample size per matchup.
      </p>
      <DraftExplorer heroes={heroes} />
    </div>
  );
}
