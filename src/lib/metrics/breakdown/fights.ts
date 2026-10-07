// Every teamfight of the game and what the player did in it: in it or not,
// dead before it, first to die, standing in front, how much damage, what it
// swung - and, where the player's part was a mistake, what the right play was.

import { getHeroName } from "../../constants";
import { formatGold, formatSigned, pluralRu } from "../../format";
import { secondsRu } from "../../coach/advice";
import { principleFor } from "../../coach/principles";
import type { FightReview } from "../../types";
import type { Ctx } from "../matchAnalysis";
import { deathTimesOf, fightPlace } from "../gameFlow";

const POSITION_OF = { carry: 1, mid: 2, offlane: 3, support: 5 } as const;
const JUST_BEFORE_SECONDS = 45;

function heroesRu(n: number): string {
  return `${n} ${pluralRu(n, ["героя", "героя", "героев"])}`;
}

export function reviewFights(ctx: Ctx, frontAt: Set<number>): FightReview[] {
  const { match, you, counterpart } = ctx;
  const youIndex = match.players.indexOf(you);
  const cpIndex = counterpart ? match.players.indexOf(counterpart) : -1;
  const cpName = counterpart ? getHeroName(counterpart.hero_id) : null;
  const position = POSITION_OF[ctx.group];
  const team = match.players.filter((p) => p.isRadiant === you.isRadiant && p !== you);
  const teamDeaths = team.map((p) => deathTimesOf(match, p));
  const lead = (minute: number) => {
    const adv = match.radiant_gold_adv?.[Math.max(0, minute)];
    return adv === undefined ? null : you.isRadiant ? adv : -adv;
  };

  return (match.teamfights ?? [])
    .filter((f) => f.start < ctx.end)
    .map((f): FightReview => {
      let ours = 0;
      let theirs = 0;
      match.players.forEach((p, i) => {
        const n = f.players[i]?.deaths ?? 0;
        if (p.isRadiant === you.isRadiant) ours += n;
        else theirs += n;
      });
      const result: FightReview["result"] = theirs > ours ? "won" : ours > theirs ? "lost" : "even";
      const fp = f.players[youIndex];
      const kills = Object.values(fp?.killed ?? {}).reduce((a, b) => a + b, 0);
      const died = (fp?.deaths ?? 0) > 0;
      const took = Boolean(fp && (fp.damage > 0 || died || kills > 0 || fp.healing > 0));
      const deadAtStart = ctx.deaths.find((d) => d.time <= f.start && f.start < d.time + Math.max(d.timeDead, 1));
      const justBefore = ctx.deaths.find(
        (d) => !d.inFight && d.time < f.start && f.start - d.time <= JUST_BEFORE_SECONDS && f.start < d.time + Math.max(d.timeDead, 1)
      );
      const inWindow = (t: number) => t >= f.start - 3 && t <= f.end + 3;
      const yourDeath = ctx.deaths.find((d) => inWindow(d.time))?.time ?? null;
      const diedFirst = died && yourDeath !== null && ours >= 2 && !teamDeaths.some((ts) => ts.some((t) => inWindow(t) && t < yourDeath));
      const front = frontAt.has(f.start);
      const where = ctx.whereDuringMissedFight.get(f.start) ?? null;
      const afterLane = f.start >= ctx.bounds.laneEnd;

      let part: string;
      let tone: FightReview["tone"] = "neutral";
      let correct: string | null = null;
      if (justBefore) {
        part = `погиб за ${secondsRu(f.start - justBefore.time)} до драки`;
        if (result !== "won") {
          tone = "bad";
          correct = principleFor("DIED_BEFORE_FIGHT", position);
        }
      } else if (deadAtStart && !took) {
        part = `был мёртв (погиб в ${ctx.time(deadAtStart.time)})`;
      } else if (!took) {
        part = where ? `не участвовал - был: ${where}` : "не участвовал";
        if (afterLane) {
          tone = "bad";
          correct = `${principleFor("ABSENT_FROM_FIGHTS", position) ?? ""}${where ? ` В этот момент ты был ${where} - правильный ход был идти или телепортироваться к команде, как только драка показалась на миникарте.` : ""}`;
        }
      } else if (diedFirst) {
        part = "погиб первым из команды";
        tone = "bad";
        correct = principleFor("DIED_FIRST", position) ?? principleFor("DYING_IN_FIGHTS", position);
      } else if (front && died && position !== 3) {
        part = "стоял ближе всех к врагу и погиб";
        tone = "bad";
        correct = principleFor("FRONT_POSITIONING", position);
      } else if (died) {
        part = kills > 0 ? `погиб, но успел убить ${heroesRu(kills)}` : "погиб в драке";
        // A core who died in a lost fight without doing anything in it.
        const cpDamage = cpIndex >= 0 ? (f.players[cpIndex]?.damage ?? 0) : 0;
        const nothing = ctx.isCore && kills === 0 && (fp?.damage ?? 0) < Math.max(300, cpDamage * 0.5);
        if (result === "lost" && nothing) {
          tone = "bad";
          correct = principleFor("DYING_IN_FIGHTS", position);
        }
      } else {
        part = kills > 0 ? `участвовал, убил ${heroesRu(kills)} и выжил` : "участвовал и выжил";
        tone = result === "lost" && kills === 0 ? "neutral" : "good";
      }

      const facts: string[] = [];
      if (took && fp) {
        const cp = cpIndex >= 0 ? f.players[cpIndex] : undefined;
        facts.push(
          `Твой урон по героям: ${formatGold(fp.damage)}${cp && cpName && (cp.damage > 0 || (cp.deaths ?? 0) > 0) ? ` (у ${cpName} - ${formatGold(cp.damage)})` : ""}.`
        );
        if (fp.healing > 0) facts.push(`Лечение: ${formatGold(fp.healing)}.`);
        if (fp.gold_delta) facts.push(`Золото за драку: ${formatSigned(fp.gold_delta)}.`);
        if ((fp.buybacks ?? 0) > 0) facts.push("Ты выкупился в этой драке.");
      }
      if (front && took) facts.push("В начале драки ты стоял ближе всех из команды к врагу.");
      const before = lead(Math.floor((f.start - 60) / 60));
      const after = lead(Math.floor((f.end + 60) / 60));
      if (before !== null && after !== null) {
        facts.push(`Перевес команды: ${formatSigned(before)} -> ${formatSigned(after)} (${formatSigned(after - before)}).`);
      }

      return {
        time: f.start,
        timeLabel: ctx.time(f.start),
        place: fightPlace(f, you.isRadiant).place,
        result,
        yourTeamDeaths: ours,
        enemyDeaths: theirs,
        leadBefore: before,
        leadAfter: after,
        you: part,
        tone,
        facts,
        correct: correct || null,
      };
    });
}
