import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MetaTierList, MetaTierListSkeleton } from "@/components/MetaTierList";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";
import { secondaryButton } from "@/components/buttonStyles";

export const metadata: Metadata = {
  title: "Мета - Dota Coach AI",
};

export default async function DraftsPage({ searchParams }: PageProps<"/drafts">) {
  // The hero explorer that used to live here is now each hero's own page;
  // old ?hero= links still land on the right build.
  const { hero } = await searchParams;
  const heroId = Number(hero);
  if (Number.isInteger(heroId) && heroId > 0) redirect(`/heroes/${heroId}`);

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        eyebrow="Живые данные · STRATZ · Легенда и выше"
        title={
          <>
            Мета <span className="text-accent">этой недели</span>
          </>
        }
        description="Кто сейчас реально выигрывает на каждой позиции. Нажми на героя - откроется его сборка, таланты и матчапы для этой роли."
        aside={
          <Link href="/heroes" className={secondaryButton}>
            Все герои и гайды →
          </Link>
        }
      />

      <Suspense fallback={<MetaTierListSkeleton />}>
        <MetaTierList />
      </Suspense>
    </PageContainer>
  );
}
