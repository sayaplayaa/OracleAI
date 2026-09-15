import { getAllHeroes } from "@/lib/constants";
import { DraftExplorer } from "@/components/DraftExplorer";
import { MetaTierList } from "@/components/MetaTierList";
import { MatchTabs } from "@/components/MatchTabs";
import { PageContainer } from "@/components/PageContainer";

export default function DraftsPage() {
  const heroes = getAllHeroes();

  return (
    <PageContainer>
      <div className="space-y-2 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          High-MMR Hero Explorer
        </p>
        <h1 className="text-2xl font-bold text-ink">Heroes</h1>
        <p className="text-sm text-ink-secondary max-w-2xl">
          Current-week meta by role, real counter-picks and lane synergy, and
          a per-hero build inspector - items, talents, and role win rates -
          all from OpenDota/STRATZ data.
        </p>
      </div>

      <MatchTabs
        tabs={[
          { id: "meta", label: "Meta", content: <MetaTierList /> },
          {
            id: "explorer",
            label: "Hero Explorer",
            content: <DraftExplorer heroes={heroes} />,
          },
        ]}
      />
    </PageContainer>
  );
}
