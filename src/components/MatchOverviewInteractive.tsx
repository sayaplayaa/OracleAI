"use client";

import { useState } from "react";
import { NetWorthChart } from "./NetWorthChart";
import { FullMatchScoreboard } from "./FullMatchScoreboard";
import { PlayerDetailPanel } from "./PlayerDetailPanel";
import type { FullMatchPlayer, MatchMetrics, SkillBuildEntry } from "@/lib/types";

export interface PlayerDetail {
  metrics: MatchMetrics;
  skillBuild: SkillBuildEntry[];
}

export function MatchOverviewInteractive({
  radiantPlayers,
  direPlayers,
  playerDetails,
  matchId,
  focusedAccountId,
}: {
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
  playerDetails: Record<number, PlayerDetail>;
  matchId: number;
  focusedAccountId: number | null;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(focusedAccountId);

  const selectedPlayer =
    selectedAccountId !== null
      ? [...radiantPlayers, ...direPlayers].find((p) => p.accountId === selectedAccountId)
      : undefined;
  const selectedDetail =
    selectedAccountId !== null ? playerDetails[selectedAccountId] : undefined;

  return (
    <div className="space-y-4">
      <NetWorthChart
        radiantPlayers={radiantPlayers}
        direPlayers={direPlayers}
        selectedAccountId={selectedAccountId}
        onSelect={setSelectedAccountId}
      />
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
        />
      )}
    </div>
  );
}
