"use client";

import { useSyncExternalStore } from "react";

function subscribeToTick(callback: () => void): () => void {
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

/** Whole seconds since `startedAt` (ms), re-rendering once a second; 0 when null. */
export function useElapsedSeconds(startedAt: number | null): number {
  return useSyncExternalStore(
    subscribeToTick,
    () => (startedAt === null ? 0 : Math.max(0, Math.floor((Date.now() - startedAt) / 1000))),
    () => 0
  );
}
