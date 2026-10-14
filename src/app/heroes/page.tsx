import type { Metadata } from "next";
import Link from "next/link";
import { getAllHeroes, getHeroImage } from "@/lib/constants";
import { HeroBrowser } from "@/components/HeroBrowser";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";
import { secondaryButton } from "@/components/buttonStyles";

export const metadata: Metadata = {
  title: "Гайды по героям - Dota Coach AI",
};

export default function HeroesGuidesPage() {
  const heroes = getAllHeroes().map((h) => ({ ...h, image: getHeroImage(h.id) }));

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        eyebrow="Гайды по героям"
        title={
          <>
            Выбери <span className="text-accent">героя</span>
          </>
        }
        description="Сборка предметов и таланты для каждой позиции, способности, сильные и слабые матчапы и ИИ-гайд - всё на одной странице героя. Данные OpenDota и STRATZ за эту неделю."
        aside={
          <Link href="/drafts" className={secondaryButton}>
            Мета патча →
          </Link>
        }
      />
      <HeroBrowser heroes={heroes} />
    </PageContainer>
  );
}
