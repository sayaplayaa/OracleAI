import Link from "next/link";
import { getSessionAccountId } from "@/lib/session";
import { PageContainer } from "@/components/PageContainer";

const TOOLS = [
  {
    href: "/drafts",
    title: "Герои и мета",
    text: "Мета по ролям, контрпики, синергия на линии, сборки предметов и таланты (OpenDota и STRATZ).",
  },
  {
    href: "/heroes",
    title: "Гайды по героям",
    text: "Способности героя, сильные и слабые матчапы и AI-гайд по конкретному герою.",
  },
  {
    href: "/tournaments",
    title: "Турниры",
    text: "Результаты последних матчей профессионалов и турнирные игры, идущие прямо сейчас.",
  },
  {
    href: "/challenges",
    title: "Испытания",
    text: "Тренировочные цели, составленные по твоим последним играм. Засчитываются только реальными матчами.",
  },
  {
    href: "/riddles",
    title: "Загадки",
    text: "Вопросы на понимание карты, вижена и тайминга, плюс карта с подсказками по фазам игры.",
  },
];

export default async function AdvancedPage() {
  const accountId = await getSessionAccountId();
  const tools = accountId
    ? [
        {
          href: `/player/${accountId}`,
          title: "Мой профиль - подробно",
          text: "Полная статистика, тренды, история матчей и AI-отчёт по всем твоим играм.",
        },
        ...TOOLS,
      ]
    : TOOLS;

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink">Расширенный режим</h1>
          <p className="text-ink-secondary mt-2 max-w-2xl leading-relaxed">
            Здесь - все данные OpenDota и STRATZ без упрощений. Если ты новичок, начни с разбора
            своей игры: он уже переварил всю эту статистику за тебя.
          </p>
          <Link
            href={accountId ? "/games" : "/"}
            className="inline-block mt-3 text-sm font-medium text-accent hover:brightness-110 transition"
          >
            ← К разбору моих игр
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="block bg-surface border border-border hover:border-accent/60 hover:bg-surface-raised rounded-2xl p-5 transition"
            >
              <h2 className="font-display font-bold text-ink">{tool.title}</h2>
              <p className="text-sm text-ink-secondary mt-1 leading-relaxed">{tool.text}</p>
            </Link>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
