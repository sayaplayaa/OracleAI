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
