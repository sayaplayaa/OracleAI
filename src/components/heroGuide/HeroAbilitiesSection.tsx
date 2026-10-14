"use client";

import Image from "next/image";
import { useState } from "react";
import type { HeroAbility, HeroGuideTrick } from "@/lib/types";
import { ItemIcon } from "../ItemIcon";

// Some abilities (innate ones, mostly) have no icon on Valve's CDN.
function AbilityIcon({ ability, size }: { ability: HeroAbility | undefined; size: number }) {
  const [broken, setBroken] = useState(false);
  if (!ability?.iconUrl || broken) {
    return <span className="rounded-lg bg-surface-raised border border-border shrink-0" style={{ width: size, height: size }} aria-hidden />;
  }
  return (
    <Image
      src={ability.iconUrl}
      alt={ability.name}
      width={size}
      height={size}
      className="rounded-lg border border-border shrink-0"
      style={{ width: size, height: size }}
      onError={() => setBroken(true)}
      unoptimized
    />
  );
}

function Tricks({ tricks, abilities }: { tricks: HeroGuideTrick[]; abilities: HeroAbility[] }) {
  if (tricks.length === 0) return null;
  return (
    <div className="bg-surface border border-border rounded-2xl p-5" style={{ boxShadow: "inset 0 3px 0 0 var(--color-accent)" }}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-3">Фишки героя - от ИИ-тренера</h3>
      <ul className="grid gap-3 md:grid-cols-2">
        {tricks.map((t, i) => (
          <li key={i} className="flex gap-3 rounded-xl bg-page/50 border border-border p-3.5">
            <AbilityIcon ability={abilities.find((a) => a.name === t.abilityName)} size={36} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-accent">{t.abilityName}</p>
              <p className="text-sm text-ink leading-relaxed mt-0.5">{t.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Upgrade({ itemKey, label, text }: { itemKey: string; label: string; text: string }) {
  return (
    <div className="flex gap-2.5 items-start">
      <span className="shrink-0 leading-none mt-0.5">
        <ItemIcon itemKey={itemKey} size={22} />
      </span>
      <p className="text-xs text-ink-secondary leading-relaxed">
        <span className="font-semibold text-ink">{label}:</span> {text}
      </p>
    </div>
  );
}

function AbilityCard({ ability }: { ability: HeroAbility }) {
  // A value of 0 is an internal one ("reflected damage: 0" until a talent adds it).
  const values = ability.attributes.filter((a) => a.localized && !/^[0\s/.]*$/.test(a.value));
  return (
    <article
      className="bg-surface border border-border hover:border-accent/40 rounded-2xl p-5 flex gap-4 transition"
      style={ability.isInnate ? { boxShadow: "inset 0 3px 0 0 var(--color-accent)" } : undefined}
    >
      <AbilityIcon ability={ability} size={56} />
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-ink">{ability.name}</h3>
            {ability.isInnate && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-accent bg-accent/12 px-2 py-0.5 rounded-full">
                Врождённая
              </span>
            )}
          </div>
          {ability.description && <p className="text-sm text-ink-secondary mt-1.5 leading-relaxed">{ability.description}</p>}
        </div>
        {values.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-page/50 border border-border px-3 py-2">
            {values.map((attr) => (
              <div key={attr.header} className="contents">
                <dt className="text-[11px] text-ink-muted">{attr.header}</dt>
                <dd className="text-xs font-mono text-ink tabular-nums">{attr.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {ability.notes.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mb-1">Механика</p>
            <ul className="space-y-1">
              {ability.notes.map((note) => (
                <li key={note} className="text-xs text-ink-secondary leading-relaxed flex gap-2">
                  <span className="text-accent shrink-0" aria-hidden>
                    •
                  </span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(ability.scepter || ability.shard) && (
          <div className="space-y-1.5">
            {ability.scepter && <Upgrade itemKey="ultimate_scepter" label="Aghanim's Scepter" text={ability.scepter} />}
            {ability.shard && <Upgrade itemKey="aghanims_shard" label="Aghanim's Shard" text={ability.shard} />}
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * The kit with what a coach would point out about it: the game client's own
 * mechanics notes and Aghanim's upgrades under every ability, and - once the
 * AI guide is written - its tricks for the hero on top.
 */
export function HeroAbilitiesSection({ abilities, tricks }: { abilities: HeroAbility[]; tricks: HeroGuideTrick[] }) {
  if (abilities.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6">
        <p className="text-sm text-ink-muted">Для этого героя нет данных о способностях.</p>
      </div>
    );
  }
  // Invoker's two "Invoked Spell" slots are the same empty placeholder.
  const distinct = abilities.filter((a, i) => abilities.findIndex((b) => b.name === a.name) === i);
  return (
    <div className="space-y-4">
      <Tricks tricks={tricks} abilities={abilities} />
      <div className="grid md:grid-cols-2 gap-4 items-start">
        {distinct.map((ability) => (
          <AbilityCard key={ability.key} ability={ability} />
        ))}
      </div>
    </div>
  );
}
