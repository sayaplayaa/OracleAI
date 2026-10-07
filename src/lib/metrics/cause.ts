import type { Advice } from "../coach/advice";
import type { CauseCode } from "../coach/principles";

/**
 * A verified problem found in the replay. `text` is the short line the model
 * and the phase evidence get; the advice fields are the coach's full
 * explanation of it (coach/advice.ts), shown in the report as they are.
 */
export interface Cause extends Partial<Advice> {
  code: CauseCode;
  severity: number;
  text: string;
  // A measurable goal for the next game, from this game's real numbers.
  target?: string;
  // Seconds - the moment it belongs to, when the text has no time to anchor it.
  at?: number;
}
