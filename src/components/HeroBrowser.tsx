"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ATTRIBUTE_ORDER, HERO_ROLE_TAGS_RU } from "@/lib/heroTags";
import { attributeColor, attributeGroupNameRu } from "./AttributeBadge";
import { inputField } from "./buttonStyles";

export interface BrowserHero {
  id: number;
  name: string;
  primaryAttr: string;
  roles: string[];
  image: string;
}

type AttrFilter = "any" | (typeof ATTRIBUTE_ORDER)[number];

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function HeroTile({ hero }: { hero: BrowserHero }) {
  return (
    <Link
      href={`/heroes/${hero.id}`}
      title={hero.name}
      className="group relative block aspect-[16/9] rounded-lg overflow-hidden border border-border bg-surface-raised hover:border-accent/70 hover:z-10 hover:scale-[1.06] hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.8)] transition duration-200"
    >
      {hero.image && (
        <Image
          src={hero.image}
          alt=""
          fill
          sizes="(min-width: 1280px) 10vw, (min-width: 768px) 16vw, 33vw"
          className="object-cover"
          unoptimized
        />
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-page/95 via-page/60 to-transparent px-2 pt-4 pb-1.5">
        <span className="block text-[11px] sm:text-xs font-semibold text-ink truncate group-hover:text-accent transition">
          {hero.name}
        </span>
      </span>
    </Link>
  );
}

/** All heroes grouped by primary attribute like Dota's own hero grid, with search and filters. */
export function HeroBrowser({ heroes }: { heroes: BrowserHero[] }) {
  const [query, setQuery] = useState("");
  const [attr, setAttr] = useState<AttrFilter>("any");
  const [role, setRole] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return heroes.filter(
      (h) =>
        (!q || h.name.toLowerCase().includes(q)) &&
        (attr === "any" || h.primaryAttr === attr) &&
        (!role || h.roles.includes(role))
    );
  }, [heroes, query, attr, role]);

  const groups = ATTRIBUTE_ORDER.map((a) => ({ attr: a, heroes: filtered.filter((h) => h.primaryAttr === a) })).filter(
    (g) => g.heroes.length > 0
  );
  const filtersActive = query !== "" || attr !== "any" || role !== null;

  return (
    <div className="space-y-8">
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-4 lg:sticky lg:top-[72px] z-20 backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <label className="relative flex-1 md:max-w-sm">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
              <SearchIcon />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти героя: Pudge, Invoker…"
              aria-label="Поиск героя"
              className={`${inputField} pl-10`}
            />
          </label>
          <div className="flex gap-1 bg-page/60 border border-border rounded-xl p-1 overflow-x-auto scrollbar-none" role="group" aria-label="Атрибут">
            {(["any", ...ATTRIBUTE_ORDER] as AttrFilter[]).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={attr === a}
                onClick={() => setAttr(a)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
                  attr === a ? "bg-accent text-page font-medium" : "text-ink-secondary hover:text-ink"
                }`}
              >
                {a !== "any" && (
                  <span className="w-2 h-2 rounded-full" style={{ background: attributeColor(a) }} aria-hidden />
                )}
                {a === "any" ? "Все" : attributeGroupNameRu(a)}
              </button>
            ))}
          </div>
          <p className="text-sm text-ink-muted md:ml-auto font-mono tabular-nums">
            {filtered.length} / {heroes.length}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Роль героя">
          {Object.entries(HERO_ROLE_TAGS_RU).map(([tag, label]) => (
            <button
              key={tag}
              type="button"
              aria-pressed={role === tag}
              onClick={() => setRole(role === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-full text-xs border transition ${
                role === tag
                  ? "border-accent bg-accent/15 text-ink"
                  : "border-border text-ink-secondary hover:text-ink hover:border-accent/40"
              }`}
            >
              {label}
            </button>
          ))}
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setAttr("any");
                setRole(null);
              }}
              className="px-2.5 py-1 text-xs text-ink-muted hover:text-accent transition"
            >
              Сбросить
            </button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-8 text-center text-sm text-ink-secondary">
          Таких героев нет. Попробуй другое имя или сними фильтры.
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.attr}>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-3 h-3 rounded-full" style={{ background: attributeColor(group.attr) }} aria-hidden />
              <h2 className="font-display font-bold text-lg text-ink">{attributeGroupNameRu(group.attr)}</h2>
              <span className="font-mono text-xs text-ink-muted">{group.heroes.length}</span>
              <span className="flex-1 h-px bg-border" aria-hidden />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
              {group.heroes.map((hero) => (
                <HeroTile key={hero.id} hero={hero} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
