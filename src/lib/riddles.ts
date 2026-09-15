export interface Riddle {
  id: string;
  category: string;
  scenario: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

// Hand-authored game-sense scenarios - not tied to any specific match, meant
// to train map awareness and decision-making in general, the way a coach
// would quiz a student. Not generated from live match data.
export const RIDDLES: Riddle[] = [
  {
    id: "missing-lane",
    category: "Map Awareness",
    scenario:
      "It's minute 6. The enemy offlaner has been missing from their lane for 20 seconds, and your mid laner just used their spell to shove the wave. What's the correct read?",
    options: [
      "Nothing - keep farming, they probably just went to base",
      "Ping your mid and safe lane support - the offlaner is likely rotating to gank one of them",
      "Immediately buy a Smoke of Deceit to counter-gank",
      "Pull the jungle camp to be safe",
    ],
    correctIndex: 1,
    explanation:
      "A missing offlaner this early, right after your mid shoves a wave, is a classic gank setup - the wave state gives them a reason to be near mid or your safe lane. A quick ping costs nothing and can save a support or your mid from an avoidable death.",
  },
  {
    id: "roshan-vision",
    category: "Vision",
    scenario:
      "Your team is about to take Roshan at 24 minutes. Where is the single most valuable place to place your last observer ward before starting?",
    options: [
      "Directly on top of the Roshan pit",
      "In the river near your own base, to watch for ganks",
      "At the entrance the enemy team is most likely to approach from",
      "In the enemy jungle, far from Roshan",
    ],
    correctIndex: 2,
    explanation:
      "A ward on the pit itself gets easily contested/killed and doesn't give you reaction time. Warding the likely approach angle gives your team early warning to disengage or reposition before the enemy even reaches the pit - vision that buys decision time is worth more than vision that confirms what you already assumed.",
  },
  {
    id: "rune-timing",
    category: "Timing",
    scenario:
      "It's the 2-minute mark. As a mid laner with no vision on the river, what should you be doing right before the rune spawns?",
    options: [
      "Push the wave as far as possible, runes don't matter early",
      "Start moving toward the river bushes/high ground to check the rune safely before committing",
      "Ping your support to come mid immediately",
      "Ignore it and hero the tower",
    ],
    correctIndex: 1,
    explanation:
      "Checking the rune from a safe vantage point (river high ground/bush) before walking in the open lets you see if the enemy mid or a roaming support is already there, instead of blindly walking into a 2v1. Free information costs you almost nothing.",
  },
  {
    id: "split-push",
    category: "Decision Making",
    scenario:
      "Your team just lost a teamfight but you (a split-pushing carry) were farming a different lane and survived. The rest of your team is regrouping to defend the base. What should you do?",
    options: [
      "Rush in to try to save your team, even without vision",
      "Keep split-pushing a different lane to force the enemy to choose between defending and pushing your base",
      "Go join the defense but buy nothing first",
      "Disconnect and farm jungle instead",
    ],
    correctIndex: 1,
    explanation:
      "After a lost fight, your team is at a numbers disadvantage - joining them doesn't fix that and risks losing you too. Continuing to apply pressure elsewhere forces the enemy to split their attention, buying your team time to regroup and forcing a decision that favors you either way.",
  },
  {
    id: "buyback-decision",
    category: "Resource Management",
    scenario:
      "You die in a teamfight at minute 34 with 2100 gold and buyback available (cost ~2400). Your team is about to fight again for a critical objective in 15 seconds. What's the right call?",
    options: [
      "Always buyback the instant you have enough gold banked, regardless of the situation",
      "Never buyback - saving for items is always correct",
      "Buyback only if being present for the next fight meaningfully changes its outcome, and you can't afford it here - so don't",
      "Buyback and immediately recall to base to hide",
    ],
    correctIndex: 2,
    explanation:
      "Buyback is a resource, not a reflex - the question is always 'does my presence in the next 15-30 seconds change the outcome enough to justify the gold?' If you don't have the gold, forcing it isn't an option anyway; the discipline is in recognizing when it actually matters versus habitually buying back.",
  },
  {
    id: "deward-timing",
    category: "Vision",
    scenario:
      "You're a support with a Sentry Ward and see an enemy Observer Ward on the map (revealed by a Truesight rune or another sentry). When is it generally most valuable to destroy it?",
    options: [
      "Immediately, the moment you see it, no matter what you're doing",
      "Right before your team wants to move through or fight in that area, so the enemy loses vision exactly when it matters",
      "Never - wards expire on their own eventually",
      "Only at night time for visibility reasons",
    ],
    correctIndex: 1,
    explanation:
      "Deleting a ward early just tells the enemy support to go re-ward the same spot. Timing the deward right before you need that area to be dark denies them vision at the moment it actually costs them something, and by the time they notice, your play is already happening.",
  },
  {
    id: "smoke-usage",
    category: "Coordination",
    scenario:
      "Your team wants to gank the enemy mid laner, but the enemy has wards near the river on both sides. What's the best use of a Smoke of Deceit here?",
    options: [
      "Don't bother, smoke doesn't help against wards",
      "Smoke your whole group and take a longer, unwarded path (like through the jungle) to approach from an unexpected angle",
      "Smoke only the carry and send them alone",
      "Use the smoke on your own base for defense instead",
    ],
    correctIndex: 1,
    explanation:
      "Smoke doesn't remove enemy vision, but it hides you from wards you do walk past and lets you take unconventional routes without being seen on the minimap. Combined with an unwarded path, it can get your team into position undetected even with enemy wards up on the 'obvious' routes.",
  },
  {
    id: "glyph-usage",
    category: "Resource Management",
    scenario:
      "The enemy team dives your tier 3 tower with a Blink Dagger initiator at minute 20. Your team is scattered and can't group in time. What's the highest-value use of your Glyph of Fortification right now?",
    options: [
      "Save it for a big teamfight later, towers aren't that important",
      "Use it immediately to save the tower and buy time for your team to regroup and respond",
      "Use it on your barracks instead, even though they're not under attack",
      "Wait until the tower is almost dead before deciding",
    ],
    correctIndex: 1,
    explanation:
      "Glyph is specifically strong as a defensive panic button - a dive your team can't otherwise answer is exactly the scenario it's for. Waiting until the tower is 'almost dead' often means waiting until it's too late to matter; the value is in preventing the loss, not delaying it.",
  },
  {
    id: "high-ground-def",
    category: "Decision Making",
    scenario:
      "Your team is defending high ground at minute 38 with a clear net worth disadvantage. The enemy is slowly sieging with a Naga Siege illusions push. What should your team generally prioritize?",
    options: [
      "Push out to fight them in the open immediately to 'get it over with'",
      "Split up to save individual lanes/buildings",
      "Group up, use the high ground's vision advantage, and look for a pick-off or a chance to punish an overextension rather than engaging into their full siege",
      "All go for Roshan immediately regardless of the siege",
    ],
    correctIndex: 2,
    explanation:
      "High ground gives the defender a real vision and positioning advantage against an illusion-based siege - illusions are individually weak, and a grouped defense can often pick off the real heroes if they overextend. Splitting up or engaging into their full siege throws that advantage away.",
  },
  {
    id: "lane-freeze",
    category: "Laning",
    scenario:
      "As a safelane carry at minute 4, the wave is naturally pushing toward the enemy tower and you're safe from ganks (wards up, support nearby). What should you generally do with the creep wave?",
    options: [
      "Let it push to the enemy tower and farm there, ignoring positioning",
      "Freeze the wave near your own tower to deny the enemy safe last hits and control the pull",
      "It doesn't matter, wave position has no effect on laning",
      "Pull every single creep wave into the jungle immediately",
    ],
    correctIndex: 1,
    explanation:
      "A frozen lane near your own tower forces the enemy support/core to either give up last hits or walk into your tower's range - it's a laning fundamental that maximizes your farm and denies theirs, as long as you actually have the safety (wards, support) to hold that position.",
  },
  {
    id: "aegis-timing",
    category: "Resource Management",
    scenario:
      "Your carry picks up Aegis of the Immortal after a Roshan kill. The Aegis has a limited duration before it expires. What's the smartest general approach?",
    options: [
      "Immediately go pick a risky fight just to 'use' the extra life",
      "Play a bit more aggressively than usual within its duration, since a 'free' second life lowers the risk of contesting objectives or fights",
      "Hide in base until it expires to avoid any risk",
      "Give it to a support instead, it's always better on a squishy hero",
    ],
    correctIndex: 1,
    explanation:
      "The Aegis is a timed resource - its value comes from taking calculated risks you wouldn't normally take (contesting a fight, pushing a tower) while you have it, not from hiding (wasting it) or from reckless all-ins that would be bad plays even with a spare life.",
  },
  {
    id: "courier-snipe",
    category: "Map Awareness",
    scenario:
      "You notice the enemy courier is about to fly through the middle of the map carrying a large item (like a Black King Bar) to their carry. You have a hero with reliable burst damage nearby. What's the correct read?",
    options: [
      "Ignore it - killing couriers isn't worth the time",
      "Kill the courier to deny/delay that key item, since the carry loses tempo and the enemy team loses gold on a new courier",
      "Let it through and hope to kill the carry with the item instead",
      "Only kill couriers that are carrying wards",
    ],
    correctIndex: 1,
    explanation:
      "A courier snipe on a key item (especially something game-changing like a BKB) is a high-value, low-risk play - it costs the enemy real gold for a new courier and delays their power spike, which can be the difference in a close game, especially if you're already near the flight path.",
  },
];
