import { RiddleQuiz } from "@/components/RiddleQuiz";
import { MapGuidePanel } from "@/components/MapGuidePanel";
import { PageContainer } from "@/components/PageContainer";

export default function RiddlesPage() {
  return (
    <PageContainer>
      <div className="space-y-2 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Game Sense Training
        </p>
        <h1 className="text-2xl font-bold text-ink">Dota Riddles</h1>
        <p className="text-sm text-ink-secondary max-w-2xl">
          Scenario-based questions on map awareness, vision, timing, and
          decision-making - the judgment calls that don&apos;t show up in a
          single stat, but decide games. Each one comes with a real
          explanation, not just a right answer.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <RiddleQuiz />
        <MapGuidePanel />
      </div>
    </PageContainer>
  );
}
