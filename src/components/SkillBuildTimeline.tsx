import Image from "next/image";
import type { SkillBuildEntry } from "@/lib/types";

function formatMatchTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SkillBuildTimeline({ skillBuild }: { skillBuild: SkillBuildEntry[] }) {
  if (skillBuild.length === 0) {
    return <p className="text-sm text-ink-muted">No parsed skill build for this player.</p>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {skillBuild.map((entry, i) => (
        <div key={i} className="flex flex-col items-center gap-1 w-16">
          <div className="relative">
            {entry.iconUrl ? (
              <Image
                src={entry.iconUrl}
                alt={entry.abilityName}
                width={32}
                height={32}
                className="rounded"
                unoptimized
              />
            ) : (
              <div className="w-8 h-8 rounded bg-surface-raised" />
            )}
            <span className="absolute -bottom-1 -right-1 text-[10px] font-bold bg-accent text-page rounded-full w-4 h-4 flex items-center justify-center">
              {entry.level}
            </span>
          </div>
          <span className="text-[11px] text-ink-muted font-mono">
            {entry.approxTimeSeconds !== null ? `~${formatMatchTime(entry.approxTimeSeconds)}` : "-"}
          </span>
          <span className="text-[10px] text-ink-secondary text-center leading-tight line-clamp-2">
            {entry.abilityName}
          </span>
        </div>
      ))}
    </div>
  );
}
