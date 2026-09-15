export type MapPoiType = "ward" | "farm" | "objective";

export interface MapPoi {
  x: number; // 0-100, position on the real minimap image (public/minimap.png)
  y: number;
  type: MapPoiType;
  label: string;
  detail: string;
}

export interface GamePhaseGuide {
  id: string;
  label: string;
  minuteRange: string;
  summary: string;
  pois: MapPoi[];
}

// Hand-authored strategic guidance, not tied to any specific match - the
// same kind of general game-sense coaching a human coach would give, keyed
// to a schematic (not pixel-accurate) map layout.
export const GAME_PHASE_GUIDES: GamePhaseGuide[] = [
  {
    id: "early",
    label: "Early Game",
    minuteRange: "0-10 min",
    summary:
      "Laning stage priorities: hold vision around your lane, don't overcommit to farm you can't defend.",
    pois: [
      {
        x: 22,
        y: 68,
        type: "ward",
        label: "Safe lane pull-camp ward",
        detail: "Watch the pull camp and the safe-lane approach so a gank doesn't catch your lane off guard.",
      },
      {
        x: 55,
        y: 28,
        type: "ward",
        label: "Off lane tree-line ward",
        detail: "Vision on the off lane's high ground gives your offlaner (or the enemy) warning of incoming rotations.",
      },
      {
        x: 60,
        y: 40,
        type: "objective",
        label: "River runes (0:00 bounty, 2:00 power)",
        detail: "Bounty runes at the match start and power runes every 2 minutes are free value - don't skip them if you're free.",
      },
      {
        x: 35,
        y: 78,
        type: "farm",
        label: "Lane last-hits first",
        detail: "In the laning stage, contested lane creeps are worth more than jungle camps - prioritize last hits over pulling unless you need to.",
      },
    ],
  },
  {
    id: "mid",
    label: "Mid Game",
    minuteRange: "10-25 min",
    summary:
      "Transition stage: efficient farming, smoke ganks, and contesting the map's high-value neutral spots.",
    pois: [
      {
        x: 28,
        y: 32,
        type: "ward",
        label: "Enemy jungle entrance",
        detail: "Vision here reveals rotations and lets your team punish greedy farming heroes.",
      },
      {
        x: 32,
        y: 37,
        type: "objective",
        label: "Roshan pit approach",
        detail: "Start wading vision near Roshan once your team can realistically contest a kill - don't wait until you're forced to.",
      },
      {
        x: 29,
        y: 53,
        type: "farm",
        label: "Stack and farm efficiently",
        detail: "Cores should be combining lane waves with stacked jungle camps to maximize gold per minute instead of farming either alone.",
      },
      {
        x: 70,
        y: 20,
        type: "objective",
        label: "Push towers with a numbers edge",
        detail: "Take towers when you have vision and a advantage in the fight, not just because the wave is there.",
      },
    ],
  },
  {
    id: "late",
    label: "Late Game",
    minuteRange: "25+ min",
    summary:
      "High-stakes stage: vision around Roshan and your own high ground matters more than any single camp.",
    pois: [
      {
        x: 32,
        y: 37,
        type: "objective",
        label: "Roshan pit - both approaches",
        detail: "Ward both entrances before taking Roshan; a contested Aegis fight without vision is one of the costliest mistakes late game.",
      },
      {
        x: 18,
        y: 76,
        type: "ward",
        label: "Own high ground",
        detail: "Defending high ground relies on seeing the siege coming - keep vision refreshed around your own base approaches.",
      },
      {
        x: 46,
        y: 67,
        type: "farm",
        label: "Highest-value camp only",
        detail: "Late game, only the biggest camps (ancients) are worth a core's time - and never alone without vision.",
      },
      {
        x: 40,
        y: 20,
        type: "ward",
        label: "Watch for split-push",
        detail: "Ward the lanes a split-pushing hero could take to farm/push uncontested while your team is grouped.",
      },
    ],
  },
];
