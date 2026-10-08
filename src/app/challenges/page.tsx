import type { Metadata } from "next";
import { getSessionAccountId } from "@/lib/session";
import { REWARDS, SEASON } from "@/lib/battlePass/season";
import type { RewardView } from "@/lib/battlePass/types";
import { BattlePassBoard } from "@/components/battlePass/BattlePassBoard";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Боевой пропуск - Dota Coach AI",
};

const STEPS = [
  ["Получи пропуск", "Он открывает награды сезона - скины, предметы и Dota Plus."],
  ["Выполняй испытания", "Каждую неделю - новые цели по твоим играм. Засчитывает реальный матч."],
  ["Забирай награды", "Каждые 1 000 очков - новый уровень, на ключевых уровнях - награда."],
];

export default async function ChallengesPage() {
  const accountId = await getSessionAccountId();
  const preview: RewardView[] = REWARDS.map((r) => ({ ...r, state: "locked" }));

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        eyebrow={`Испытания · ${SEASON.name}`}
        title={
          <>
            Боевой <span className="text-accent">пропуск</span>
          </>
        }
        description="Выполняй испытания, построенные по твоим реальным играм, поднимай уровень пропуска и получай скины, предметы и Dota Plus. Каждое испытание засчитывается только настоящим матчем."
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
      <BattlePassBoard signedIn={accountId !== null} accountId={accountId} preview={preview} />
    </PageContainer>
  );
}
