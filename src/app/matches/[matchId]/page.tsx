import { notFound, redirect } from "next/navigation";
import { getMatch, OpenDotaError } from "@/lib/opendota";

// Account-less entry point for a match: the real match viewer at
// /player/[accountId]/match/[matchId] requires an accountId that's an
// actual participant, so this resolves one from the match itself (any real
// player works - it's only used to anchor "your" row) and redirects there.
export default async function MatchRedirectPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId: matchIdParam } = await params;
  const matchId = Number(matchIdParam);
  if (!Number.isInteger(matchId) || matchId <= 0) notFound();

  let match;
  try {
    match = await getMatch(matchId);
  } catch (err) {
    if (err instanceof OpenDotaError && err.status === 404) notFound();
    throw err;
  }

  const accountId = match.players.find((p) => p.account_id)?.account_id;
  if (!accountId) notFound();

  redirect(`/player/${accountId}/match/${matchId}`);
}
