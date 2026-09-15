/**
 * Wilson score lower bound for a binomial proportion (95% confidence).
 * Ranking by raw win rate lets tiny samples (3 games at 100%) outrank huge,
 * reliable ones (5,000 games at 58%) - this is the standard fix: it
 * discounts a win rate by how little data backs it, so confident large
 * samples beat lucky small ones, without excluding small samples outright.
 */
export function wilsonScoreLowerBound(wins: number, total: number): number {
  if (total <= 0) return 0;
  const z = 1.96;
  const phat = wins / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = phat + z2 / (2 * total);
  const adjustment = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * total)) / total);
  return (center - adjustment) / denominator;
}

/**
 * Wilson score upper bound - the counterpart used to confidently rank
 * something as *bad* (low win rate) rather than good: a hero needs enough
 * losses that even the optimistic edge of its confidence interval is still
 * low, not just an unlucky handful of games.
 */
export function wilsonScoreUpperBound(wins: number, total: number): number {
  return 1 - wilsonScoreLowerBound(total - wins, total);
}
