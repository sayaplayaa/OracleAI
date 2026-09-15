import { ChallengesBoard } from "@/components/ChallengesBoard";
import { PageContainer } from "@/components/PageContainer";

export default function ChallengesPage() {
  return (
    <PageContainer>
      <div className="space-y-2 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Training Challenges
        </p>
        <h1 className="text-2xl font-bold text-ink">Challenges</h1>
        <p className="text-sm text-ink-secondary max-w-2xl">
          Goals generated from your own recent games - deaths, KDA, and farm
          on your most-played hero - tracked against your real matches until
          you actually clear them.
        </p>
      </div>

      <ChallengesBoard />
    </PageContainer>
  );
}
