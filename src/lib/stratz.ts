import { cached } from "./cache";

const STRATZ_URL = "https://api.stratz.com/graphql";
const HOUR = 60 * 60 * 1000;

export interface StratzLaneOutcome {
  heroId1: number;
  heroId2: number;
  matchCount: number;
  // matchWinCount = actually won the game; winCount is STRATZ's own
  // lane-phase-only outcome formula, which is a different (noisier, ~1/3
  // win/draw/loss) metric we don't want for a "win rate" the user reads as
  // "did the team win the match".
  matchWinCount: number;
  position: string;
}

export class StratzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StratzError";
  }
}

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const key = process.env.STRATZ_API_KEY;
  if (!key) {
    throw new StratzError("STRATZ_API_KEY is not set.");
  }

  const res = await fetch(STRATZ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      // STRATZ blocks requests without an identifying User-Agent behind its
      // Cloudflare bot challenge, even with a valid token.
      "User-Agent": "STRATZ_API",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new StratzError(`STRATZ request failed (${res.status})`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new StratzError(json.errors[0]?.message ?? "STRATZ GraphQL error");
  }
  return json.data as T;
}

/** Real teammate lane-pairing outcomes for a hero (isWith: true = same-team lane partner). */
export function getLaneSynergy(heroId: number) {
  return cached(`stratz:lane-with:${heroId}`, 6 * HOUR, async () => {
    const data = await graphql<{
      heroStats: { laneOutcome: StratzLaneOutcome[] };
    }>(
      `query LaneSynergy($heroId: Short!) {
        heroStats {
          laneOutcome(heroId: $heroId, isWith: true) {
            heroId1
            heroId2
            matchCount
            matchWinCount
            position
          }
        }
      }`,
      { heroId }
    );
    return data.heroStats.laneOutcome;
  });
}
