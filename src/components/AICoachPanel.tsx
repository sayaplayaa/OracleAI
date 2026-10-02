"use client";

import type { CoachReport as CoachReportType } from "@/lib/types";
import { AiActionCard, useCoachRequest } from "./AiActionCard";
import { CoachReport } from "./CoachReport";

export function AICoachPanel({
  endpoint,
  body,
  label = "Получить разбор",
  title,
  description = "Сильные и слабые стороны и конкретные советы по точным цифрам выше - у каждого вывода есть цифра, на которой он основан.",
}: {
  endpoint: string;
  body: Record<string, unknown>;
  label?: string;
  title?: string;
  description?: string;
}) {
  const request = useCoachRequest<CoachReportType>(endpoint, "ИИ-тренер не смог сделать разбор");

  if (request.data) return <CoachReport report={request.data} />;

  return (
    <AiActionCard
      title={title ?? label}
      description={description}
      actionLabel={label}
      startedAt={request.startedAt}
      error={request.error}
      onRun={() => request.run(body)}
    />
  );
}
