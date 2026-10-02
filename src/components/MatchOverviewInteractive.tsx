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
  radiantWin,
  playerDetails,
  matchId,
  focusedAccountId,
  focusLabel,
  goldAdvantage,
  xpAdvantage,
}: {
  radiantPlayers: FullMatchPlayer[];
  direPlayers: FullMatchPlayer[];
  radiantWin: boolean;
  playerDetails: Record<number, PlayerDetail>;
  matchId: number;
  focusedAccountId: number | null;
  focusLabel?: string;
  // Per-minute Radiant lead; empty when the replay isn't parsed.
  goldAdvantage: number[];
  xpAdvantage: number[];
}) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(focusedAccountId);

  const selectedPlayer =
    selectedAccountId !== null
      ? [...radiantPlayers, ...direPlayers].find((p) => p.accountId === selectedAccountId)
      : undefined;
  const selectedDetail = selectedAccountId !== null ? playerDetails[selectedAccountId] : undefined;

  const hasTimeline =
    goldAdvantage.length > 1 || [...radiantPlayers, ...direPlayers].some((p) => p.series.netWorth.length > 1);

  return (
    <div className="space-y-6">
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
        radiantWin={radiantWin}
        focusedAccountId={focusedAccountId}
        focusLabel={focusLabel}
        selectedAccountId={selectedAccountId}
        onSelectPlayer={setSelectedAccountId}
      />
      {selectedPlayer && selectedDetail && (
        <PlayerDetailPanel
          key={selectedPlayer.accountId}
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
