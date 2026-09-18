// JSON schema for the forced tool-use call that produces a CoachReport.
// Every finding must carry the specific metric value that grounds it, so the
// model can't hand-wave a claim without pointing at real match/profile data.

export const findingSchema = {
  type: "object",
  properties: {
    point: {
      type: "string",
      description: "The coaching observation or advice, in plain language.",
    },
    metric: {
      type: "string",
      description:
        "The exact metric name and value from the provided data that grounds this point (e.g. 'GPM 412, 35th percentile for Pudge').",
    },
  },
  required: ["point", "metric"],
  additionalProperties: false,
};

export const coachReportTool = {
  name: "submit_coaching_report",
  description:
    "Submit the structured Dota 2 coaching report. Every strength, weakness, and tip must cite a specific metric from the supplied data.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "2-3 sentence overview of the performance, grounded in the data.",
      },
      strengths: {
        type: "array",
        items: findingSchema,
        description: "What the player did well, each grounded in a metric.",
      },
      weaknesses: {
        type: "array",
        items: findingSchema,
        description: "What held the player back, each grounded in a metric.",
      },
      tips: {
        type: "array",
        items: findingSchema,
        description: "Concrete, actionable advice tied to the weaknesses found.",
      },
    },
    required: ["summary", "strengths", "weaknesses", "tips"],
    additionalProperties: false,
  },
};

export const heroGuideTool = {
  name: "submit_hero_guide",
  description:
    "Submit a structured Dota 2 hero guide. Every tip must cite a real ability name/effect or a real stat from the supplied data - never invented hero knowledge.",
  input_schema: {
    type: "object" as const,
    properties: {
      identity: {
        type: "string",
        description:
          "2-3 sentences on this hero's fantasy/role, grounded in its actual ability kit.",
      },
      laningTips: {
        type: "array",
        items: findingSchema,
        description: "How to play this hero's laning stage, each grounded in a real ability or starting-item stat.",
      },
      powerSpikeTips: {
        type: "array",
        items: findingSchema,
        description: "Real item/level power spikes to play around, each citing the specific item/timing data.",
      },
      teamfightTips: {
        type: "array",
        items: findingSchema,
        description: "How to use this hero's kit in teamfights, each citing a specific ability effect.",
      },
      matchupTips: {
        type: "array",
        items: findingSchema,
        description: "What to do against real tough/favorable matchups, each citing the matchup win rate.",
      },
    },
    required: ["identity", "laningTips", "powerSpikeTips", "teamfightTips", "matchupTips"],
    additionalProperties: false,
  },
};

const powerSpikeMomentSchema = {
  type: "object",
  properties: {
    trigger: {
      type: "string",
      description:
        "The real item, level, or timing that creates this power spike, exactly as it appears in the supplied data (e.g. 'Battle Fury completed' or 'Level 6').",
    },
    timing: {
      type: "string",
      description:
        "The real (or '~' interpolated) in-game time this happened in this match, exactly as supplied (e.g. '14:32' or '~9:40').",
    },
    why: {
      ...findingSchema,
      description:
        "Why this specific trigger is a power spike, citing the item/ability's real effect from the supplied data.",
    },
    whatToDo: {
      ...findingSchema,
      description:
        "Concrete tactical advice for this exact window - where to go, what objective/camp/rune to take, what fight to look for.",
    },
  },
  required: ["trigger", "timing", "why", "whatToDo"],
  additionalProperties: false,
};

export const powerSpikeTool = {
  name: "submit_power_spike_report",
  description:
    "Submit 3-5 real power-spike moments for this player's real item purchases and level-ups in this exact match - never an invented item, level, or timing.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "1-2 sentences on this hero's overall power curve in this match.",
      },
      moments: {
        type: "array",
        items: powerSpikeMomentSchema,
        minItems: 3,
        maxItems: 5,
        description: "3-5 real power-spike moments, in chronological order.",
      },
    },
    required: ["summary", "moments"],
    additionalProperties: false,
  },
};
