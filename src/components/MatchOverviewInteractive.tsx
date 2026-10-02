"use client";

import { useState } from "react";
import { NetWorthChart } from "./NetWorthChart";
import { MatchGraphs } from "./MatchGraphs";
import { FullMatchScoreboard } from "./FullMatchScoreboard";
import { PlayerDetailPanel } from "./PlayerDetailPanel";
import type { FullMatchPlayer, MatchMetrics, SkillBuildEntry } from "@/lib/types";

export interface PlayerDetail {
  metrics: MatchMetrics;
  skillBuild: SkillBuildEntry[];
  coreItemKeys: string[];
}

export function MatchOverviewInteractive({
  radiantPlayers,
  direPlayers,
  playerDetails,
  matchId,
  focusedAccountId,
  goldAdvantage,
  xpAdvantage,
}: {
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
  playerDetails: Record<number, PlayerDetail>;
  matchId: number;
  focusedAccountId: number | null;
  // Per-minute Radiant lead; empty when the replay isn't parsed.
  goldAdvantage: number[];
  xpAdvantage: number[];
}) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(focusedAccountId);

  const selectedPlayer =
    selectedAccountId !== null
      ? [...radiantPlayers, ...direPlayers].find((p) => p.accountId === selectedAccountId)
      : undefined;
  const selectedDetail =
    selectedAccountId !== null ? playerDetails[selectedAccountId] : undefined;

  const hasTimeline =
    goldAdvantage.length > 1 || [...radiantPlayers, ...direPlayers].some((p) => p.series.netWorth.length > 1);

  return (
    <div className="space-y-4">
      {hasTimeline ? (
        <MatchGraphs
          goldAdvantage={goldAdvantage}
          xpAdvantage={xpAdvantage}
          radiantPlayers={radiantPlayers}
          direPlayers={direPlayers}
          selectedAccountId={selectedAccountId}
          onSelect={setSelectedAccountId}
        />
      ) : (
        // Unparsed match: only end-of-game numbers exist, so the bars stay.
        <NetWorthChart
          radiantPlayers={radiantPlayers}
          direPlayers={direPlayers}
          selectedAccountId={selectedAccountId}
          onSelect={setSelectedAccountId}
        />
      )}
      <FullMatchScoreboard
        radiantPlayers={radiantPlayers}
        direPlayers={direPlayers}
        focusedAccountId={focusedAccountId}
        selectedAccountId={selectedAccountId}
        onSelectPlayer={setSelectedAccountId}
      />
      {selectedPlayer && selectedDetail && (
        <PlayerDetailPanel
          player={selectedPlayer}
          matchId={matchId}
          metrics={selectedDetail.metrics}
          skillBuild={selectedDetail.skillBuild}
          coreItemKeys={selectedDetail.coreItemKeys}
        />
      )}
    </div>
  );
}
