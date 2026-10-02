"use client";

import { useSyncExternalStore } from "react";
import { hasCachedReport } from "@/lib/analysisStore";

const subscribeNothing = () => () => {};

/** Marks a game whose analysis is already saved on this device. */
export function AnalyzedBadge({ accountId, matchId }: { accountId: number; matchId: number }) {
  const analyzed = useSyncExternalStore(
    subscribeNothing,
    () => hasCachedReport(accountId, matchId),
    () => false
  );
  if (!analyzed) return null;
  return (
    <span className="text-[11px] font-medium text-accent border border-accent/40 bg-page/85 backdrop-blur rounded-full px-2 py-0.5">
      Разбор готов
    </span>
  );
}
