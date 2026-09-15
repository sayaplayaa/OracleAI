import type { BenchmarkBucket } from "../types";

/**
 * OpenDota's /benchmarks endpoint returns a handful of (percentile, value)
 * sample points per stat (e.g. 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99).
 * We linearly interpolate between the two nearest points to estimate where
 * a player's raw value falls, expressed as 0-100.
 */
export function estimatePercentile(
  buckets: BenchmarkBucket[] | undefined,
  value: number
): number | undefined {
  if (!buckets || buckets.length === 0) return undefined;
  const sorted = [...buckets].sort((a, b) => a.value - b.value);

  if (value <= sorted[0].value) {
    return Math.round(sorted[0].percentile * 100);
  }
  if (value >= sorted[sorted.length - 1].value) {
    return Math.round(sorted[sorted.length - 1].percentile * 100);
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (value >= a.value && value <= b.value) {
      const span = b.value - a.value || 1;
      const t = (value - a.value) / span;
      const pct = a.percentile + t * (b.percentile - a.percentile);
      return Math.round(pct * 100);
    }
  }
  return Math.round(sorted[sorted.length - 1].percentile * 100);
}

export function getMedianValue(
  buckets: BenchmarkBucket[] | undefined
): number | undefined {
  if (!buckets || buckets.length === 0) return undefined;
  const median = buckets.find((b) => Math.abs(b.percentile - 0.5) < 0.01);
  if (median) return median.value;
  const sorted = [...buckets].sort((a, b) => a.percentile - b.percentile);
  return sorted[Math.floor(sorted.length / 2)].value;
}
