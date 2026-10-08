"use client";

import { useState } from "react";
import type { RewardKind, RewardState, RewardView } from "@/lib/battlePass/types";
import { inputField, primaryButton, secondaryButton } from "../buttonStyles";

const GOOD = "var(--color-status-good)";
const ACCENT = "var(--color-accent)";
const MUTED = "var(--color-ink-muted)";
const WARN = "var(--color-highlight-text)";

// Simple glyphs per kind of reward, drawn on a 24x24 grid.
const ICONS: Record<RewardKind, React.ReactNode> = {
  wards: <path d="M12 3v4M9 7h6l-1 4h-4l-1-4ZM10 11l-1 10h6l-1-10M7 21h10" />,
  hero_set: <path d="M8 4l4 2 4-2 4 4-3 2v10H7V10L4 8l4-4Z" />,
  taunt: <path d="M4 5h16v10H9l-5 4V5ZM9 10h.01M12 10h.01M15 10h.01" />,
  dota_plus: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3ZM12 8v8M8 12h8" />,
  rare_set: <path d="M6 3h12l3 6-9 12L3 9l3-6ZM3 9h18M9 3l3 6 3-6M12 9v12" />,
  courier: <path d="M3 7l9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10" />,
  immortal: <path d="M12 2l3 6 6 1-4.5 4.5 1 6.5L12 17l-5.5 3 1-6.5L3 9l6-1 3-6Z" />,
  arcana: <path d="M3 8l4.5 4L12 4l4.5 8L21 8l-2 11H5L3 8ZM5 19h14" />,
};

const STATE: Record<RewardState, { label: string; color: string }> = {
  locked: { label: "Закрыто", color: MUTED },
  need_pass: { label: "Нужен пропуск", color: WARN },
  available: { label: "Можно забрать", color: ACCENT },
  pending: { label: "Заявка принята", color: GOOD },
  sent: { label: "Отправлено", color: GOOD },
};

export function RewardIcon({ kind, size = 22, color = ACCENT }: { kind: RewardKind; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[kind]}
    </svg>
  );
}

/** Every level of the season in one strip, filled up to the player's level, rewards marked. */
export function LevelLadder({ level, maxLevel, rewards }: { level: number; maxLevel: number; rewards: RewardView[] }) {
  const byLevel = new Map(rewards.map((r) => [r.level, r]));
  return (
    <div className="overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
      <ol className="flex gap-1 min-w-max" aria-label={`Уровни сезона: ты на ${level} из ${maxLevel}`}>
        {Array.from({ length: maxLevel }, (_, i) => i + 1).map((l) => {
          const reward = byLevel.get(l);
          const reached = l <= level;
          const current = l === level;
          return (
            <li
              key={l}
              className={`relative flex flex-col items-center justify-end rounded-lg border transition ${reward ? "w-12 h-16" : "w-7 h-16"}`}
              style={{
                borderColor: current ? ACCENT : "var(--color-border)",
                background: reached ? "color-mix(in srgb, var(--color-accent) 16%, transparent)" : "color-mix(in srgb, var(--color-page) 50%, transparent)",
              }}
              title={reward ? `${l} уровень: ${reward.title}` : `${l} уровень`}
            >
              {reward && (
                <span className="absolute top-1.5">
                  <RewardIcon kind={reward.kind} size={18} color={reached ? ACCENT : MUTED} />
                </span>
              )}
              <span className={`text-[10px] font-mono tabular-nums pb-1 ${current ? "text-accent font-bold" : reached ? "text-ink-secondary" : "text-ink-muted"}`}>{l}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const TRADE_HELP = "https://steamcommunity.com/my/tradeoffers/privacy#trade_offer_access_url";

function ClaimForm({ reward, onClaim, onCancel }: { reward: RewardView; onClaim: (input: { choice?: string; tradeUrl?: string }) => Promise<void>; onCancel: () => void }) {
  const [choice, setChoice] = useState("");
  const [tradeUrl, setTradeUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onClaim({ ...(reward.needsChoice ? { choice } : {}), ...(reward.needsTradeUrl ? { tradeUrl } : {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не получилось отправить заявку");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-accent/30 bg-accent/8 p-3">
      {reward.needsChoice && (
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">Какой предмет или на какого героя</span>
          <input value={choice} onChange={(e) => setChoice(e.target.value)} maxLength={120} required className={inputField} placeholder="Например: сет на Juggernaut" />
        </label>
      )}
      {reward.needsTradeUrl && (
        <label className="block">
          <span className="block text-xs text-ink-secondary mb-1">
            Ссылка на обмен Steam ·{" "}
            <a href={TRADE_HELP} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
              где её взять
            </a>
          </span>
          <input
            value={tradeUrl}
            onChange={(e) => setTradeUrl(e.target.value)}
            required
            inputMode="url"
            className={inputField}
            placeholder="https://steamcommunity.com/tradeoffer/new/?partner=…&token=…"
          />
        </label>
      )}
      {!reward.needsTradeUrl && <p className="text-xs text-ink-secondary">Награда придёт подарком в Steam на этот аккаунт.</p>}
      {error && (
        <p role="alert" className="text-xs text-status-critical">
          {error}
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? "Отправляю…" : "Получить награду"}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          Отмена
        </button>
      </div>
    </form>
  );
}

function RewardCard({
  reward,
  level,
  pointsToLevel,
  onClaim,
}: {
  reward: RewardView;
  level: number;
  pointsToLevel: number;
  onClaim?: (input: { choice?: string; tradeUrl?: string }) => Promise<void>;
}) {
  const [claiming, setClaiming] = useState(false);
  const state = STATE[reward.state];
  const reached = level >= reward.level;
  return (
    <li
      className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-3"
      style={{ boxShadow: `inset 0 3px 0 0 ${state.color}` }}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${reached ? ACCENT : MUTED} 14%, transparent)` }}
        >
          <RewardIcon kind={reward.kind} color={reached ? ACCENT : MUTED} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono text-ink-muted">Уровень {reward.level}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border" style={{ color: state.color, borderColor: state.color }}>
              {state.label}
            </span>
          </div>
          <h3 className="font-display font-bold text-ink mt-1">{reward.title}</h3>
          <p className="text-sm text-ink-secondary mt-0.5 leading-relaxed">{reward.description}</p>
        </div>
      </div>
      <div className="mt-auto">
        {reward.state === "locked" && (
          <p className="text-xs text-ink-muted">
            Ещё {pointsToLevel.toLocaleString("ru-RU")} очков до {reward.level} уровня.
          </p>
        )}
        {reward.state === "need_pass" && <p className="text-xs text-highlight-text">Уровень уже набран - награда станет доступна с пропуском.</p>}
        {(reward.state === "pending" || reward.state === "sent") && (
          <p className="text-xs text-status-good">
            {reward.state === "pending" ? "Заявка принята - награду отправят в Steam." : "Награда отправлена в Steam."}
            {reward.choice ? ` Выбор: ${reward.choice}.` : ""}
          </p>
        )}
        {reward.state === "available" && onClaim && (claiming ? (
          <ClaimForm reward={reward} onClaim={onClaim} onCancel={() => setClaiming(false)} />
        ) : (
          <button type="button" onClick={() => setClaiming(true)} className={primaryButton}>
            Забрать награду
          </button>
        ))}
      </div>
    </li>
  );
}

export function RewardGrid({
  rewards,
  level,
  points,
  pointsPerLevel,
  onClaim,
}: {
  rewards: RewardView[];
  level: number;
  points: number;
  pointsPerLevel: number;
  onClaim?: (level: number, input: { choice?: string; tradeUrl?: string }) => Promise<void>;
}) {
  return (
    <ol className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {rewards.map((r) => (
        <RewardCard
          key={r.level}
          reward={r}
          level={level}
          pointsToLevel={Math.max(0, (r.level - 1) * pointsPerLevel - points)}
          onClaim={onClaim ? (input) => onClaim(r.level, input) : undefined}
        />
      ))}
    </ol>
  );
}
