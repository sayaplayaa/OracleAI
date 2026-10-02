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
          Герои на высоком MMR
        </p>
        <h1 className="text-2xl font-bold text-ink">Герои</h1>
        <p className="text-sm text-ink-secondary max-w-2xl">
          Мета этой недели по ролям, реальные контрпики и синергия на линии,
          а для каждого героя - сборка предметов, таланты и винрейт по
          позициям. Все данные из OpenDota и STRATZ.
        </p>
      </div>

      <MatchTabs
        tabs={[
          { id: "meta", label: "Мета", content: <MetaTierList /> },
          {
            id: "explorer",
            label: "Обзор героя",
            content: <DraftExplorer heroes={heroes} />,
          },
        ]}
      />
    </PageContainer>
  );
}
