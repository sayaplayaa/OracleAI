// The full breakdown of one game: every aspect with its own table, strengths
// and mistakes, every death and every teamfight reviewed one by one, and the
// game's timeline - all worked out in code from the replay, so nothing in it
// depends on what the model remembers or invents.

import type { GameFlow, MatchBreakdown, PhaseAnalysis, PhaseId } from "../../types";
import type { Cause } from "../cause";
import type { Ctx } from "../matchAnalysis";
import { buildAspects } from "./aspects";
import { reviewDeaths } from "./deaths";
import { reviewFights } from "./fights";
import { buildTimeline } from "./timeline";

export function buildBreakdown(args: {
  ctx: Ctx;
  phases: PhaseAnalysis[];
  causes: { cause: Cause; phase: PhaseId }[];
  flow: GameFlow | null;
  // Fight starts where the player was the team's closest hero to the enemy.
  frontAt: Set<number>;
  youLeft: boolean;
}): MatchBreakdown {
  const deaths = reviewDeaths(args.ctx);
  const fights = reviewFights(args.ctx, args.frontAt);
  return {
    aspects: buildAspects({ ctx: args.ctx, phases: args.phases, causes: args.causes, deaths, fights, youLeft: args.youLeft }),
    deaths,
    fights,
    timeline: buildTimeline(args.ctx, deaths, fights),
  };
}
