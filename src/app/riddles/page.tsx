import type { Metadata } from "next";
import { RIDDLES } from "@/lib/riddles";
import { RiddleQuiz } from "@/components/RiddleQuiz";
import { MapGuidePanel } from "@/components/MapGuidePanel";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Загадки по Dota - Dota Coach AI",
};

export default function RiddlesPage() {
  const categories = [...new Set(RIDDLES.map((r) => r.category))];

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        eyebrow="Тренировка понимания игры"
        title={
          <>
            Загадки <span className="text-accent">по Dota</span>
          </>
        }
        description="Ситуации на чтение карты, обзор, тайминги и решения - то, что не видно ни в одной цифре статистики, но решает игры. После каждого ответа - подробный разбор, почему именно так."
      >
        <div className="flex gap-1.5 flex-wrap mt-5">
          {categories.map((c) => (
            <span key={c} className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-surface text-ink-secondary">
              {c}
            </span>
          ))}
        </div>
      </PageHeader>

      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 items-start">
        <RiddleQuiz />
        <MapGuidePanel />
      </div>
    </PageContainer>
  );
}
