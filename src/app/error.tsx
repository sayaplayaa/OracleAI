"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/PageContainer";

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
      <div className="flex flex-col items-center text-center gap-4 py-24">
        <div className="w-14 h-14 rounded-full bg-status-critical/10 text-status-critical flex items-center justify-center text-2xl font-bold">
          !
        </div>
        <h1 className="text-xl font-bold text-ink">
          {isDataSourceIssue ? "Источник данных не отвечает" : "Что-то пошло не так"}
        </h1>
        <p className="text-sm text-ink-secondary max-w-md">
          {isDataSourceIssue
            ? "OpenDota или STRATZ - сервисы, откуда приложение берёт реальные данные матчей, - не ответили. Обычно это ненадолго, так что попробуй ещё раз через минуту."
            : "На этой странице произошла непредвиденная ошибка. Попробуй ещё раз или вернись на главную."}
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={reset}
            className="bg-accent hover:brightness-110 text-page text-sm font-medium px-4 py-2 rounded-md transition"
          >
            Попробовать ещё раз
          </button>
          <Link
            href="/"
            className="border border-border text-ink-secondary hover:text-ink text-sm font-medium px-4 py-2 rounded-md transition"
          >
            На главную
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
