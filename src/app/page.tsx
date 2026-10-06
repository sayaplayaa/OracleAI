import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSessionAccountId } from "@/lib/session";
import { getHeroImage, getHeroName } from "@/lib/constants";
import { ParallaxBackground } from "@/components/ParallaxBackground";
import { SteamIcon } from "@/components/SteamIcon";
import { AnalysisPreview } from "@/components/home/AnalysisPreview";
import { RecentGamesSkeleton, RecentGamesStrip } from "@/components/home/RecentGamesStrip";
import { MetaSnapshot, MetaSnapshotSkeleton } from "@/components/home/MetaSnapshot";

const CONTAINER = "max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8";

// Recognisable heroes for the decorative ribbon under the hero section.
const RIBBON_HEROES = [1, 8, 14, 74, 26, 5, 11, 70, 35, 18, 106, 44, 2, 86, 129, 135, 17, 39];

const STEPS = [
  {
    title: "Войди через Steam",
    text: "Мы видим только публичный Steam ID - пароль никому не передаётся.",
  },
  {
    title: "Выбери матч",
    text: "Последние 20 игр подтягиваются из OpenDota автоматически.",
  },
  {
    title: "Получи разбор",
    text: "Сильные стороны, ошибки по фазам и каждая смерть на карте - за 1-2 минуты.",
  },
];

const FEATURES: { title: string; text: string; icon: React.ReactNode }[] = [
  {
    title: "Плюсы слева, ошибки справа",
    text: "Сразу видно, что получилось, а что подтянуть, - с цифрами из реплея и измеримой целью на следующую игру.",
    icon: <path d="M4 5h7v14H4zM13 5h7v14h-7z" />,
  },
  {
    title: "Каждая смерть на карте",
    text: "Где умер, кто и чем убил, под чьим Observer Ward ты стоял - или тебя добили крипы.",
    icon: <path d="M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  },
  {
    title: "Только честное сравнение",
    text: "Ты сравниваешься с врагом на своей позиции: керри с керри, саппорт с саппортом.",
    icon: <path d="M6 18 18 6M8 6H6v2M16 18h2v-2M4 12h4M16 12h4" />,
  },
  {
    title: "Линия, мидгейм, лейт",
    text: "Вердикт по каждой фазе по нетворсу и конкретное «что делать иначе» для твоей роли.",
    icon: <path d="M3 17l5-5 4 4 8-9M14 7h6v6" />,
  },
  {
    title: "Тайминги предметов",
    text: "Твои ключевые предметы против типичного метового тайминга для этого героя и позиции.",
    icon: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  },
  {
    title: "ИИ работает у тебя",
    text: "Тренер запускается локально через Ollama, а каждое число в тексте сверяется с данными матча.",
    icon: <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M7 7h10v10H7z" />,
  },
];

const TOOLS = [
  { href: "/drafts", title: "Мета недели", text: "Лучшие герои на каждой позиции на Легенде и выше." },
  { href: "/heroes", title: "Гайды по героям", text: "Сборка под роль, таланты, матчапы и ИИ-гайд." },
  { href: "/tournaments", title: "Турниры", text: "Свежие про-матчи и игры, идущие прямо сейчас." },
  { href: "/challenges", title: "Испытания", text: "Цели на основе твоих игр, засчитываются реальными матчами." },
  { href: "/riddles", title: "Загадки", text: "Вопросы на карту, вижен и тайминги с разбором ответа." },
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-10 h-10 rounded-xl bg-accent/12 text-accent flex items-center justify-center shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </span>
  );
}

function HeroSection({ signedIn, loginFailed }: { signedIn: boolean; loginFailed: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <ParallaxBackground />
      <div className={`${CONTAINER} relative pt-14 pb-12 sm:pt-20 sm:pb-16 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center`}>
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase mb-4">
            ИИ-тренер по Dota 2 · реальные данные матча
          </p>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl xl:text-6xl text-ink leading-[1.05]">
            Разбери свою игру
            <br />
            <span className="text-accent">как профи</span>
          </h1>
          <p className="mt-5 text-lg text-ink-secondary leading-relaxed max-w-xl">
            Тренер покажет, что у тебя получилось, где проиграна линия, почему ты умирал - на какой
            точке карты и под чьим вардом - и что делать иначе в следующей игре.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {signedIn ? (
              <>
                <Link
                  href="/games"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-base font-bold text-page shadow-[0_0_40px_rgba(232,184,75,0.25)] hover:brightness-110 active:scale-[0.98] transition"
                >
                  Мои игры →
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center rounded-xl border border-border px-6 py-3.5 text-base font-medium text-ink-secondary hover:text-ink hover:border-accent/60 transition"
                >
                  Как это работает
                </a>
              </>
            ) : (
              <>
                <a
                  href="/api/auth/steam"
                  className="inline-flex items-center gap-3 rounded-xl bg-accent px-7 py-3.5 text-base font-bold text-page shadow-[0_0_40px_rgba(232,184,75,0.25)] hover:brightness-110 active:scale-[0.98] transition"
                >
                  <SteamIcon size={20} />
                  Войти через Steam
                </a>
                <a
                  href="#how"
                  className="inline-flex items-center rounded-xl border border-border px-6 py-3.5 text-base font-medium text-ink-secondary hover:text-ink hover:border-accent/60 transition"
                >
                  Как это работает
                </a>
              </>
            )}
          </div>
          {loginFailed && (
            <p role="alert" className="mt-4 text-sm text-status-critical">
              Не получилось войти через Steam. Попробуй ещё раз.
            </p>
          )}

          <dl className="mt-10 grid grid-cols-3 gap-3 max-w-lg">
            {[
              ["3 фазы", "линия, мидгейм, лейт"],
              ["1 соперник", "враг на твоей позиции"],
              ["каждая смерть", "место, причина, варды"],
            ].map(([value, label]) => (
              <div key={value} className="rounded-xl border border-border bg-surface/60 backdrop-blur px-3 py-3">
                <dt className="font-display font-bold text-ink text-sm sm:text-base">{value}</dt>
                <dd className="text-[11px] sm:text-xs text-ink-muted mt-0.5 leading-snug">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <AnalysisPreview />
      </div>
    </section>
  );
}

function HeroRibbon() {
  const heroes = [...RIBBON_HEROES, ...RIBBON_HEROES];
  return (
    <div className="relative overflow-hidden border-y border-border bg-surface/40 py-3" aria-hidden>
      <div className="flex gap-3 w-max marquee">
        {heroes.map((id, i) => (
          <div key={i} className="relative w-[120px] h-[68px] rounded-lg overflow-hidden shrink-0 opacity-70">
            <Image src={getHeroImage(id)} alt={getHeroName(id)} fill sizes="120px" className="object-cover" unoptimized />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-page to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-page to-transparent" />
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 space-y-6">
      <div>
        <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase mb-2">Три шага</p>
        <h2 className="font-display font-bold text-2xl text-ink">Как это работает</h2>
      </div>
      <ol className="grid md:grid-cols-3 gap-4 relative">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative bg-surface border border-border rounded-2xl p-5 flex gap-4">
            <span className="font-display font-extrabold text-3xl text-accent/70 leading-none">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3 className="font-semibold text-ink">{step.title}</h3>
              <p className="text-sm text-ink-secondary mt-1 leading-relaxed">{step.text}</p>
            </div>
            {i < STEPS.length - 1 && (
              <span className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-page border border-border text-accent text-xs items-center justify-center" aria-hidden>
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Features() {
  return (
    <section className="space-y-6">
      <div>
        <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase mb-2">Что внутри</p>
        <h2 className="font-display font-bold text-2xl text-ink">Что ты получишь в разборе</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-surface border border-border hover:border-accent/40 rounded-2xl p-5 flex gap-4 transition">
            <Icon>{f.icon}</Icon>
            <div>
              <h3 className="font-semibold text-ink">{f.title}</h3>
              <p className="text-sm text-ink-secondary mt-1 leading-relaxed">{f.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Tools({ accountId }: { accountId: number | null }) {
  const tools = accountId
    ? [{ href: `/player/${accountId}`, title: "Мой профиль", text: "Тренды, статистика по героям и вся история матчей." }, ...TOOLS]
    : TOOLS;
  return (
    <section className="space-y-6">
      <div>
        <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase mb-2">Ещё на сайте</p>
        <h2 className="font-display font-bold text-2xl text-ink">Инструменты</h2>
      </div>
      <div className={`grid sm:grid-cols-2 gap-3 ${tools.length > 5 ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group bg-surface border border-border hover:border-accent/60 hover:bg-surface-raised rounded-2xl p-4 transition flex flex-col"
          >
            <h3 className="font-semibold text-ink flex items-center justify-between gap-2">
              {tool.title}
              <span className="text-accent transition group-hover:translate-x-0.5" aria-hidden>
                →
              </span>
            </h3>
            <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">{tool.text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-accent/30 bg-surface px-6 py-10 sm:px-10 flex flex-col md:flex-row md:items-center gap-6">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(600px 200px at 85% 50%, rgba(232,184,75,0.14), transparent)" }}
        aria-hidden
      />
      <div className="relative flex-1">
        <h2 className="font-display font-bold text-2xl text-ink">Готов разобрать свою последнюю игру?</h2>
        <p className="text-ink-secondary mt-2">Вход через Steam занимает несколько секунд.</p>
      </div>
      <a
        href="/api/auth/steam"
        className="relative inline-flex items-center gap-3 rounded-xl bg-accent px-7 py-3.5 text-base font-bold text-page hover:brightness-110 transition self-start md:self-auto"
      >
        <SteamIcon size={20} />
        Войти через Steam
      </a>
    </section>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const accountId = await getSessionAccountId();
  const { error } = await searchParams;

  return (
    <div className="pb-16">
      <HeroSection signedIn={accountId !== null} loginFailed={Boolean(error)} />
      <HeroRibbon />
      <div className={`${CONTAINER} space-y-16 pt-12`}>
        {accountId !== null && (
          <Suspense fallback={<RecentGamesSkeleton />}>
            <RecentGamesStrip accountId={accountId} />
          </Suspense>
        )}
        <HowItWorks />
        <Features />
        <Suspense fallback={<MetaSnapshotSkeleton />}>
          <MetaSnapshot />
        </Suspense>
        <Tools accountId={accountId} />
        {accountId === null && <FinalCta />}
      </div>
    </div>
  );
}
