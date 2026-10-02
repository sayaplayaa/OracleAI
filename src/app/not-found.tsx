import Link from "next/link";
import { PageContainer } from "@/components/PageContainer";
import { primaryButton, secondaryButton } from "@/components/buttonStyles";

export default function NotFound() {
  return (
    <PageContainer>
      <div className="max-w-xl mx-auto my-12 sm:my-20 text-center">
        <p className="font-display font-extrabold text-7xl sm:text-8xl text-accent/80 leading-none">404</p>
        <h1 className="font-display font-bold text-2xl text-ink mt-6">Такой страницы нет</h1>
        <p className="text-sm text-ink-secondary mt-3 leading-relaxed">
          Возможно, ссылка устарела, матч ещё не попал в OpenDota или у игрока закрыт профиль. Попробуй найти
          игрока или матч через поиск в шапке.
        </p>
        <div className="flex gap-3 justify-center flex-wrap mt-6">
          <Link href="/" className={primaryButton}>
            На главную
          </Link>
          <Link href="/heroes" className={secondaryButton}>
            Гайды по героям
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
