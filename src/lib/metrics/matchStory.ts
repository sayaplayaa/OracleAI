import { getHeroName } from "../constants";
import { pluralRu } from "../format";
import type { MatchStory, MatchStoryEvent, OpenDotaMatch, OpenDotaTeamfight } from "../types";

const MULTI_KILL_LABELS: Record<string, string> = {
  "3": "трипл-килл",
  "4": "ультра-килл",
  "5": "рампагу",
};

// Prepositional case for "на топе / на миде / на боте".
const LANE_LABELS: Record<string, string> = {
  top: "на топе",
  mid: "на миде",
  bot: "на боте",
};

function teamFromBuildingKey(key: string | undefined): "radiant" | "dire" | null {
  if (!key) return null;
  if (key.includes("goodguys")) return "radiant";
  if (key.includes("badguys")) return "dire";
  return null;
}

/** "Разрушена башня T1 Сил Света на миде" - the verb agrees with the building's gender/number. */
function buildingDestroyedText(key: string | undefined, team: "radiant" | "dire" | null): string {
  const teamLabel = team === "radiant" ? "Сил Света" : team === "dire" ? "Сил Тьмы" : "";
  const join = (...parts: string[]) => parts.join(" ").replace(/\s+/g, " ").trim();
  if (!key) return join("Разрушено здание", teamLabel);
  if (key.includes("tower")) {
    const tier = key.match(/tower(\d)/)?.[1] ?? "?";
    const lane = key.match(/tower\d_(top|mid|bot)/)?.[1] ?? "";
    return join(`Разрушена башня T${tier}`, teamLabel, LANE_LABELS[lane] ?? "");
  }
  if (key.includes("rax")) {
    const kind = key.includes("melee") ? "ближние" : "дальние";
    const lane = key.match(/(top|mid|bot)/)?.[1] ?? "";
    return join(`Разрушены ${kind} бараки`, teamLabel, LANE_LABELS[lane] ?? "");
  }
  if (key.includes("fort")) return join("Разрушен трон", teamLabel);
  return join("Разрушено здание", teamLabel);
}

function heroNameForSlot(match: OpenDotaMatch, playerSlot: number | undefined): string | null {
  if (playerSlot === undefined) return null;
  const player = match.players.find((p) => p.player_slot === playerSlot);
  return player ? getHeroName(player.hero_id) : null;
}

function objectiveEvents(match: OpenDotaMatch): MatchStoryEvent[] {
  const events: MatchStoryEvent[] = [];

  for (const obj of match.objectives ?? []) {
    const attackerSlot = obj.player_slot ?? obj.slot;
    const attackerTeam =
      attackerSlot !== undefined ? (attackerSlot < 128 ? "radiant" : "dire") : null;

    if (obj.type === "CHAT_MESSAGE_FIRSTBLOOD") {
      const hero = heroNameForSlot(match, attackerSlot);
      events.push({
        time: obj.time,
        type: "first_blood",
        team: attackerTeam,
        description: hero ? `Первая кровь: ${hero}` : "Первая кровь",
      });
    } else if (obj.type === "building_kill") {
      const defendingTeam = teamFromBuildingKey(obj.key);
      const destroyerTeam =
        defendingTeam === "radiant" ? "dire" : defendingTeam === "dire" ? "radiant" : attackerTeam;
      events.push({
        time: obj.time,
        type: obj.key?.includes("rax") ? "barracks" : "tower",
        team: destroyerTeam,
        description: buildingDestroyedText(obj.key, defendingTeam),
      });
    } else if (obj.type?.toUpperCase().includes("ROSHAN")) {
      const team = obj.team === 2 ? "radiant" : obj.team === 3 ? "dire" : attackerTeam;
      events.push({
        time: obj.time,
        type: "roshan",
        team,
        description: "Roshan убит",
      });
    }
  }

  return events;
}

function biggestTeamfightEvent(match: OpenDotaMatch): MatchStoryEvent | null {
  const fights = match.teamfights ?? [];
  let best: OpenDotaTeamfight | null = null;
  for (const fight of fights) {
    if (fight.deaths >= 2 && (!best || fight.deaths > best.deaths)) best = fight;
  }
  if (!best) return null;

  let radiantGold = 0;
  let direGold = 0;
  let radiantDeaths = 0;
  let direDeaths = 0;
  best.players.forEach((fp, i) => {
    const player = match.players[i];
    if (!player) return;
    if (player.isRadiant) {
      radiantGold += fp.gold_delta;
      radiantDeaths += fp.deaths;
    } else {
      direGold += fp.gold_delta;
      direDeaths += fp.deaths;
    }
  });

  const winningTeam = radiantGold >= direGold ? "radiant" : "dire";
  const netSwing = Math.abs(radiantGold - direGold);

  return {
    time: best.start,
    type: "teamfight",
    team: winningTeam,
    description: `Самый крупный тимфайт: ${best.deaths} ${pluralRu(best.deaths, ["смерть", "смерти", "смертей"])} (Силы Света - ${radiantDeaths}, Силы Тьмы - ${direDeaths})`,
    detail: `Итоговый перевес по золоту: ${netSwing.toLocaleString("ru-RU")} в пользу ${winningTeam === "radiant" ? "Сил Света" : "Сил Тьмы"}`,
  };
}

function computeSwings(goldAdvTrend: number[]): {
  swingEvent: MatchStoryEvent | null;
  biggestSwing: MatchStory["biggestSwing"];
  peakRadiantLead: MatchStory["peakRadiantLead"];
  peakDireLead: MatchStory["peakDireLead"];
} {
  if (goldAdvTrend.length < 2) {
    return { swingEvent: null, biggestSwing: null, peakRadiantLead: null, peakDireLead: null };
  }

  let biggestSwing = { minute: 0, delta: 0 };
  let peakRadiant = { minute: 0, value: 0 };
  let peakDire = { minute: 0, value: 0 };

  goldAdvTrend.forEach((value, minute) => {
    if (value > peakRadiant.value) peakRadiant = { minute, value };
    if (value < peakDire.value) peakDire = { minute, value };
    if (minute > 0) {
      const delta = value - goldAdvTrend[minute - 1];
      if (Math.abs(delta) > Math.abs(biggestSwing.delta)) biggestSwing = { minute, delta };
    }
  });

  const towardTeam = biggestSwing.delta >= 0 ? "radiant" : "dire";

  return {
    swingEvent:
      biggestSwing.delta === 0
        ? null
        : {
            time: biggestSwing.minute * 60,
            type: "swing",
            team: towardTeam,
            description: `Самый резкий перелом за минуту: ${Math.abs(biggestSwing.delta).toLocaleString("ru-RU")} золота в пользу ${towardTeam === "radiant" ? "Сил Света" : "Сил Тьмы"}`,
          },
    biggestSwing: { minute: biggestSwing.minute, delta: biggestSwing.delta, towardTeam },
    peakRadiantLead: peakRadiant.value > 0 ? peakRadiant : null,
    peakDireLead:
      peakDire.value < 0 ? { minute: peakDire.minute, value: Math.abs(peakDire.value) } : null,
  };
}

function multiKillHighlights(match: OpenDotaMatch): string[] {
  const highlights: string[] = [];
  for (const player of match.players) {
    for (const [countStr, occurrences] of Object.entries(player.multi_kills ?? {})) {
      const label = MULTI_KILL_LABELS[countStr];
      if (!label || occurrences < 1) continue;
      const heroName = getHeroName(player.hero_id);
      const team = player.isRadiant ? "Radiant" : "Dire";
      highlights.push(
        `${heroName} (${team}) сделал ${label}${occurrences > 1 ? ` x${occurrences}` : ""}`
      );
    }
  }
  return highlights;
}

export function computeMatchStory(match: OpenDotaMatch): MatchStory {
  const { swingEvent, biggestSwing, peakRadiantLead, peakDireLead } = computeSwings(
    match.radiant_gold_adv ?? []
  );

  const events = [...objectiveEvents(match), biggestTeamfightEvent(match), swingEvent]
    .filter((e): e is MatchStoryEvent => e !== null)
    .sort((a, b) => a.time - b.time);

  return {
    events,
    highlights: multiKillHighlights(match),
    biggestSwing,
    peakRadiantLead,
    peakDireLead,
  };
}
