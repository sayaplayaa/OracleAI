import { RiddleQuiz } from "@/components/RiddleQuiz";
import { MapGuidePanel } from "@/components/MapGuidePanel";
import { PageContainer } from "@/components/PageContainer";

export default function RiddlesPage() {
  return (
    <PageContainer>
      <div className="space-y-2 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Тренировка понимания игры
        </p>
        <h1 className="text-2xl font-bold text-ink">Загадки по Dota</h1>
        <p className="text-sm text-ink-secondary max-w-2xl">
          Игровые ситуации на чтение карты, обзор, тайминги и принятие
          решений - то, что не видно ни в одной цифре статистики, но решает
          игры. К каждой загадке есть подробное объяснение, а не просто
          правильный ответ.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <RiddleQuiz />
        <MapGuidePanel />
      </div>
    </PageContainer>
  );
}
