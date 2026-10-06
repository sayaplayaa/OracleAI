import { extractNumbers } from "../format";
import type { CoachFinding, CoachReport } from "../types";

// Below this a number is a count anyone can state ("2 игры", "6 уровень")
// or plain advice ("держи 2 TP"); only bigger ones must come from the data.
const MIN_CHECKED_NUMBER = 10;

/**
 * Keeps only the findings whose numbers come from the data the model was
 * given: each "metric" must quote at least one real number, and no number
 * in it may be made up. The prompt rules alone don't hold on a small local
 * model - it rounds, recomputes and invents averages.
 */
export function keepGroundedFindings(report: CoachReport, source: string): CoachReport {
  const known = extractNumbers(source);
  const isKnown = (n: number) => known.some((k) => Math.abs(k - n) <= Math.max(0.05, Math.abs(k) * 0.01));
  const grounded = (f: CoachFinding) => {
    const numbers = extractNumbers(f.metric);
    if (!numbers.some(isKnown)) return false;
    if (numbers.some((n) => n >= MIN_CHECKED_NUMBER && !isKnown(n))) return false;
    return extractNumbers(f.point).every((n) => n < 100 || isKnown(n));
  };
  return {
    ...report,
    strengths: report.strengths.filter(grounded),
    weaknesses: report.weaknesses.filter(grounded),
    tips: report.tips.filter(grounded),
  };
}
