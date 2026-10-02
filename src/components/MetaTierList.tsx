"use client";

import { useEffect, useState } from "react";
import { HeroIcon } from "./HeroIcon";
import { pluralRu } from "@/lib/format";
import type { MetaTierEntry } from "@/lib/types";

const POSITIONS: { value: string; label: string }[] = [
  { value: "POSITION_1", label: "Керри" },
  { value: "POSITION_2", label: "Мид" },
  { value: "POSITION_3", label: "Оффлейн" },
  { value: "POSITION_4", label: "Поддержка" },
  { value: "POSITION_5", label: "Хард-саппорт" },
];

function PositionColumn({ label, entries }: { label: string; entries: MetaTierEntry[] }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary border-b border-border">
        {label}
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-ink-muted px-3 py-3">
          На этой неделе мало игр на ранге Легенда и выше.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {entries.map((e, i) => (
            <div key={e.heroId} className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs font-mono text-ink-muted w-4 shrink-0">{i + 1}</span>
              <HeroIcon heroId={e.heroId} size={24} />
              <span className="text-sm text-ink truncate flex-1 min-w-0">{e.heroName}</span>
              <span
                className="text-[11px] font-mono text-ink-muted shrink-0"
                title={`${e.games.toLocaleString("ru-RU")} ${pluralRu(e.games, ["игра", "игры", "игр"])}`}
              >
                {e.games.toLocaleString("ru-RU")}
              </span>
              <span
                className="text-xs font-mono font-semibold text-right w-12 shrink-0"
                style={{
                  color:
                    e.winRate >= 0.5
                      ? "var(--color-status-good)"
                      : "var(--color-status-critical)",
                }}
              >
                {(e.winRate * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MetaTierList() {
  const [data, setData] = useState<Record<string, MetaTierEntry[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/meta")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Не удалось загрузить мету");
        setData(body as Record<string, MetaTierEntry[]>);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить мету"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">
        Лучшие герои на каждой позиции за эту неделю, только ранги Легенда и
        выше. Сортировка по винрейту с поправкой на размер выборки: нужен
        реальный минимум игр, так что случайные офф-мета пики в список не
        попадают.
      </p>

      {loading && <p className="text-sm text-ink-muted">Загружаю мету этой недели...</p>}
      {error && <p className="text-sm text-status-critical">{error}</p>}

      {data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {POSITIONS.map((p) => (
            <PositionColumn key={p.value} label={p.label} entries={data[p.value] ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}
