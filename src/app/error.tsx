"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/PageContainer";
import { primaryButton, secondaryButton } from "@/components/buttonStyles";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // In production Next.js strips the real message from server errors before
  // they reach the client, so this only ever narrows the copy - it never
  // needs to be the sole way a real failure gets surfaced.
  const isDataSourceIssue = /OpenDota|STRATZ/i.test(error.message ?? "");

  return (
    <PageContainer>
      <div
        className="max-w-xl mx-auto my-12 sm:my-20 bg-surface border border-border rounded-2xl p-8 text-center"
        style={{ boxShadow: "inset 0 3px 0 0 var(--color-status-critical)" }}
        role="alert"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-status-critical/12 text-status-critical flex items-center justify-center text-2xl font-display font-bold">
          !
        </div>
        <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase mt-6 mb-2">
          {isDataSourceIssue ? "Источник данных" : "Ошибка"}
        </p>
        <h1 className="font-display font-bold text-2xl text-ink">
          {isDataSourceIssue ? "OpenDota или STRATZ не отвечает" : "Что-то пошло не так"}
        </h1>
        <p className="text-sm text-ink-secondary mt-3 leading-relaxed">
          {isDataSourceIssue
            ? "Это сервисы, откуда приложение берёт реальные данные матчей. Обычно это ненадолго - попробуй ещё раз через минуту."
            : "На этой странице произошла непредвиденная ошибка. Попробуй ещё раз или вернись на главную."}
        </p>
        <div className="flex gap-3 justify-center flex-wrap mt-6">
          <button type="button" onClick={reset} className={primaryButton}>
            Попробовать ещё раз
          </button>
          <Link href="/" className={secondaryButton}>
            На главную
          </Link>
        </div>
        {error.digest && <p className="text-[11px] text-ink-muted font-mono mt-6">Код ошибки: {error.digest}</p>}
      </div>
    </PageContainer>
  );
}
