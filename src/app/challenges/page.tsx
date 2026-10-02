import type { Metadata } from "next";
import { getSessionAccountId } from "@/lib/session";
import { ChallengesBoard } from "@/components/ChallengesBoard";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Испытания - Dota Coach AI",
};

const STEPS = [
  ["Цели из твоих игр", "Смерти, KDA и фарм на основном герое - от твоего реального среднего."],
  ["Прими вызов", "Выбери испытание, которое хочешь закрыть в ближайших играх."],
  ["Засчитывает матч", "Каждая новая игра проверяется автоматически - без ручных отметок."],
];

export default async function ChallengesPage() {
  const accountId = await getSessionAccountId();

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        eyebrow="Тренировка · по твоим реальным матчам"
        title={
          <>
            Испытания <span className="text-accent">на рост</span>
          </>
        }
        description="Конкретные цели чуть выше твоего текущего уровня. Мы проверяем их по реальным матчам, пока ты действительно их не выполнишь."
        aside={
          <ol className="grid sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-2 lg:w-[300px] xl:w-[560px]">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="rounded-xl border border-border bg-surface px-3.5 py-3 flex gap-3">
                <span className="font-display font-extrabold text-lg text-accent/70 leading-none">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{title}</span>
                  <span className="block text-[11px] text-ink-muted mt-0.5 leading-snug">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        }
      />
      <ChallengesBoard sessionAccountId={accountId} />
    </PageContainer>
  );
}
