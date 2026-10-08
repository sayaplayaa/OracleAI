import type { Metadata } from "next";
import Link from "next/link";
import { getSessionAccountId } from "@/lib/session";
import { PageContainer } from "@/components/PageContainer";
import { IconBadge, PageHeader } from "@/components/PageHeader";
import { primaryButton } from "@/components/buttonStyles";

export const metadata: Metadata = {
  title: "Расширенный режим - Dota Coach AI",
};

const TOOLS: { href: string; title: string; text: string; icon: React.ReactNode }[] = [
  {
    href: "/drafts",
    title: "Мета этой недели",
    text: "Лучшие герои на каждой позиции на ранге Легенда и выше - с поправкой на размер выборки (STRATZ).",
    icon: <path d="M3 17l5-5 4 4 8-9M14 7h6v6" />,
  },
  {
    href: "/heroes",
    title: "Гайды по героям",
    text: "Сборка и таланты под каждую позицию, способности, матчапы, напарники по линии и ИИ-гайд.",
    icon: <path d="M4 5h16v14H4zM4 10h16M9 10v9" />,
  },
  {
    href: "/tournaments",
    title: "Турниры",
    text: "Результаты последних про-матчей по лигам и турнирные игры, идущие прямо сейчас.",
    icon: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />,
  },
  {
    href: "/challenges",
    title: "Боевой пропуск",
    text: "Еженедельные испытания по твоим играм поднимают уровень пропуска - за уровни выдаются скины, предметы и Dota Plus.",
    icon: <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9L12 3Z" />,
  },
  {
    href: "/riddles",
    title: "Загадки",
    text: "Вопросы на карту, обзор и тайминги с разбором ответа, плюс гид по карте для каждой фазы.",
    icon: <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  },
];

export default async function AdvancedPage() {
  const accountId = await getSessionAccountId();
  const tools = accountId
    ? [
        {
          href: `/player/${accountId}`,
          title: "Мой профиль - подробно",
          text: "Ранг и MMR, сигнатурный герой, про-игрок на нём, тренды и вся история матчей.",
          icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" />,
        },
        ...TOOLS,
      ]
    : TOOLS;

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        eyebrow="Все данные без упрощений"
        title={
          <>
            Расширенный <span className="text-accent">режим</span>
          </>
        }
        description="Здесь собраны все данные OpenDota и STRATZ. Если ты только начинаешь - сначала разбери свою игру: тренер уже переварил всю эту статистику за тебя."
        aside={
          <Link href={accountId ? "/games" : "/"} className={primaryButton}>
            Разобрать мою игру →
          </Link>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group bg-surface border border-border hover:border-accent/60 hover:bg-surface-raised rounded-2xl p-5 flex gap-4 transition"
          >
            <IconBadge>{tool.icon}</IconBadge>
            <div className="min-w-0">
              <h2 className="font-semibold text-ink flex items-center gap-2">
                {tool.title}
                <span className="text-accent transition group-hover:translate-x-0.5" aria-hidden>
                  →
                </span>
              </h2>
              <p className="text-sm text-ink-secondary mt-1 leading-relaxed">{tool.text}</p>
            </div>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
