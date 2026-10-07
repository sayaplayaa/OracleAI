// The whole game minute by minute from the player's side: kills, deaths,
// items, levels, fights, buildings, Roshan, runes and buybacks.

import { getHeroName, getItemCostByKey, getItemNameByKey, isAssembledItem } from "../../constants";
import { pluralRu } from "../../format";
import type { DeathReview, FightReview, TimelineEvent } from "../../types";
import type { Ctx } from "../matchAnalysis";
import { interpolateTime, xpForLevel } from "../skillBuild";

// Finished items worth a line; components and cheap items are noise here.
const MIN_ITEM_COST = 1000;
const RUNE_NAMES: Record<string, string> = {
  "0": "Double Damage",
  "1": "Haste",
  "2": "Illusion",
  "3": "Invisibility",
  "4": "Regeneration",
  "6": "Arcane",
  "8": "Wisdom",
  "9": "Shield",
};

export function runeName(key: string): string | null {
  return RUNE_NAMES[key] ?? null;
}

function buildingName(key: string): string {
  const tier = key.match(/tower(\d)/)?.[1];
  const lane = key.includes("_bot") ? "бот" : key.includes("_mid") ? "мид" : key.includes("_top") ? "топ" : null;
  if (tier) return `башня T${tier}${lane ? ` (${lane})` : ""}`;
  if (key.includes("melee_rax")) return `казарма ближнего боя${lane ? ` (${lane})` : ""}`;
  if (key.includes("range_rax")) return `казарма дальнего боя${lane ? ` (${lane})` : ""}`;
  if (key.includes("fort")) return "трон";
  return "постройка";
}

export function buildTimeline(ctx: Ctx, deaths: DeathReview[], fights: FightReview[]): TimelineEvent[] {
  const { match, you } = ctx;
  const events: TimelineEvent[] = [];
  const add = (time: number, kind: TimelineEvent["kind"], text: string, tone: TimelineEvent["tone"]) => {
    if (time > ctx.end + 1) return;
    events.push({ time, timeLabel: ctx.time(Math.max(0, time)), kind, text, tone });
  };

  for (const k of ctx.heroKills) add(k.time, "kill", `Ты убил ${k.victim}`, "good");
  for (const d of deaths) {
    const verdict = d.verdict === "mistake" ? " - ошибка" : d.verdict === "trade" ? " - размен" : "";
    add(d.time, "death", `Ты погиб: ${d.title}${verdict}`, d.verdict === "trade" ? "neutral" : "bad");
  }

  for (const p of you.purchase_log ?? []) {
    if (p.time < 0 || !isAssembledItem(p.key) || getItemCostByKey(p.key) < MIN_ITEM_COST) continue;
    add(p.time, "item", `Собран ${getItemNameByKey(p.key)}`, "neutral");
  }

  for (const level of [6, 12, 18]) {
    const xp = xpForLevel(level);
    const t = xp !== null && you.xp_t ? interpolateTime(you.xp_t, xp) : null;
    if (t !== null) add(t, "level", `~${level} уровень`, "neutral");
  }

  for (const f of fights) {
    const result = f.result === "won" ? "выиграна" : f.result === "lost" ? "проиграна" : "вничью";
    add(
      f.time,
      "fight",
      `Драка${f.place ? ` · ${f.place}` : ""} · ${result}: вы потеряли ${f.yourTeamDeaths}, враг - ${f.enemyDeaths}. Ты: ${f.you}`,
      f.tone === "bad" ? "bad" : f.result === "won" ? "good" : f.result === "lost" ? "bad" : "neutral"
    );
  }

  const yourTeam = you.isRadiant ? 2 : 3;
  for (const o of match.objectives ?? []) {
    if (o.type === "building_kill" && o.key) {
      const ours = o.key.includes("goodguys") === you.isRadiant;
      add(o.time, "building", `${ours ? "Твоя команда потеряла" : "Твоя команда снесла"}: ${buildingName(o.key)}`, ours ? "bad" : "good");
    } else if (o.type === "CHAT_MESSAGE_ROSHAN_KILL") {
      const ours = o.team === yourTeam;
      add(o.time, "roshan", `${ours ? "Твоя" : "Вражеская"} команда убила Roshan`, ours ? "good" : "bad");
    } else if (o.type === "CHAT_MESSAGE_AEGIS") {
      const holder = match.players.find((p) => p.player_slot === o.player_slot);
      if (holder) add(o.time, "roshan", `Aegis у ${getHeroName(holder.hero_id)}`, holder.isRadiant === you.isRadiant ? "good" : "bad");
    } else if (o.type === "CHAT_MESSAGE_FIRSTBLOOD") {
      if (o.player_slot === you.player_slot) add(o.time, "firstblood", "Первая кровь - твоя", "good");
      else if ((o as { victim_player_slot?: number }).victim_player_slot === you.player_slot) add(o.time, "firstblood", "Первая кровь - на тебе", "bad");
    }
  }

  for (const b of you.buyback_log ?? []) add(b.time, "buyback", "Ты выкупился", "neutral");

  for (const r of you.runes_log ?? []) {
    const name = runeName(String(r.key));
    if (name) add(r.time, "rune", `Руна ${name}`, "neutral");
  }

  return events.sort((a, b) => a.time - b.time);
}

/** "3 руны" etc. for summaries. */
export function runesRu(n: number): string {
  return `${n} ${pluralRu(n, ["руна", "руны", "рун"])}`;
}
