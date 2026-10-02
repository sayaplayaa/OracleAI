export function formatMatchTime(seconds: number): string {
  if (seconds < 0) return "до старта";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Russian convention: a space groups thousands ("22 967"); a comma would read
// as a decimal point to a Russian reader.
export function formatGold(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
}

export function formatSigned(value: number): string {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : "-"}${Math.abs(rounded).toLocaleString("ru-RU")}`;
}

/**
 * Every number written in a piece of text, as values: "22 967" (any kind of
 * space as the thousands separator, as ru-RU formatting and a model writing
 * Russian both produce), "22,967" (en-US style) and "22967" all read as 22967.
 * Clock times (12:34) are removed first so they don't read as two numbers.
 */
export function extractNumbers(text: string): number[] {
  const withoutTimes = text.replace(/\b\d{1,2}:\d{2}\b/g, " ");
  const joined = withoutTimes.replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, "$1");
  return (joined.match(/\d[\d,]*(?:\.\d+)?/g) ?? [])
    .map((n) => Number(n.replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));
}

/**
 * Russian plural form for a count: pluralRu(n, ["игра", "игры", "игр"]) gives
 * "игра" for 1, 21..., "игры" for 2-4, 22-24..., "игр" for 0, 5-20, 25...
 */
export function pluralRu(count: number, forms: [one: string, few: string, many: string]): string {
  const n = Math.abs(Math.trunc(count)) % 100;
  const last = n % 10;
  if (n >= 11 && n <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/** "5 дн. назад" style relative time for a unix timestamp in seconds. */
export function timeAgoRu(unixSeconds: number): string {
  const diffMs = Date.now() - unixSeconds * 1000;
  const days = Math.floor(diffMs / 86_400_000);
  if (days >= 30) return `${Math.floor(days / 30)} мес. назад`;
  if (days >= 1) return `${days} дн. назад`;
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours >= 1) return `${hours} ч. назад`;
  return `${Math.max(Math.floor(diffMs / 60_000), 1)} мин. назад`;
}
