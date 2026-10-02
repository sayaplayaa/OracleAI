import Link from "next/link";
import { getAllHeroes } from "@/lib/constants";
import { HeroIcon } from "@/components/HeroIcon";
import { PageContainer } from "@/components/PageContainer";

export default function HeroesGuidesPage() {
  const heroes = getAllHeroes();

  return (
    <PageContainer>
      <div className="space-y-2 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Гайды по героям
        </p>
        <h1 className="text-2xl font-bold text-ink">Гайды</h1>
        <p className="text-sm text-ink-secondary max-w-2xl">
          Реальные способности каждого героя, текущий винрейт по ролям,
          матчапы и ИИ-гайд, написанный на основе этих данных. Выбери
          героя, чтобы начать.
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1.5">
        {heroes.map((hero) => (
          <Link
            key={hero.id}
            href={`/heroes/${hero.id}`}
            title={hero.name}
            className="flex flex-col items-center gap-1 rounded-md p-1.5 transition hover:bg-surface-raised"
          >
            <HeroIcon heroId={hero.id} size={36} />
            <span className="text-[10px] text-ink-secondary text-center leading-tight line-clamp-1 w-full">
              {hero.name}
            </span>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
