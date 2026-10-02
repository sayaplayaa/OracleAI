"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  /** Small count or marker shown next to the label. */
  badge?: ReactNode;
}

/**
 * Segmented tabs in the site's style. The active tab is mirrored into the
 * URL (`?tab=`) so a refresh or a shared link opens the same tab; pages read
 * it back from searchParams and pass it as `initial`.
 */
export function Tabs({
  tabs,
  initial,
  param = "tab",
  right,
}: {
  tabs: TabItem[];
  initial?: string;
  /** Query parameter to sync with; null keeps the tab out of the URL. */
  param?: string | null;
  right?: ReactNode;
}) {
  const [active, setActive] = useState(() =>
    initial && tabs.some((t) => t.id === initial) ? initial : tabs[0]?.id
  );
  const baseId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function select(id: string) {
    setActive(id);
    if (!param) return;
    const url = new URL(window.location.href);
    if (id === tabs[0]?.id) url.searchParams.delete(param);
    else url.searchParams.set(param, id);
    window.history.replaceState(null, "", url);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    select(tabs[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div
          role="tablist"
          className="flex gap-1 bg-surface border border-border rounded-xl p-1 overflow-x-auto scrollbar-none max-w-full"
        >
          {tabs.map((tab, i) => {
            const selected = active === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(tab.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  selected ? "bg-accent text-page" : "text-ink-secondary hover:text-ink hover:bg-surface-raised"
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && (
                  <span
                    className={`text-[11px] font-mono tabular-nums px-1.5 rounded-md ${
                      selected ? "bg-page/20 text-page" : "bg-page/60 text-ink-muted"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {right}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={active !== tab.id}
          className="space-y-6 rise-in"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
