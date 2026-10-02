import { ChallengesBoard } from "@/components/ChallengesBoard";
import { PageContainer } from "@/components/PageContainer";

export default function ChallengesPage() {
  return (
    <PageContainer>
      <div className="space-y-2 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Тренировочные испытания
        </p>
        <h1 className="text-2xl font-bold text-ink">Испытания</h1>
        <p className="text-sm text-ink-secondary max-w-2xl">
          Цели, составленные по твоим последним играм: смерти, KDA и фарм на
          самом частом герое. Мы проверяем их по твоим реальным матчам, пока
          ты действительно их не выполнишь.
        </p>
      </div>

      <ChallengesBoard />
    </PageContainer>
  );
}
