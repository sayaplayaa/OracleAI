import Image from "next/image";
import { formatMatchTime } from "@/lib/format";
import type { SkillBuildEntry } from "@/lib/types";

export function SkillBuildTimeline({ skillBuild }: { skillBuild: SkillBuildEntry[] }) {
  if (skillBuild.length === 0) {
    return <p className="text-sm text-ink-muted">Нет разобранной прокачки способностей для этого игрока.</p>;
  }

  return (
    <ol className="flex flex-wrap gap-2.5">
      {skillBuild.map((entry, i) => (
        <li key={i} className="flex flex-col items-center gap-1 w-[60px]" title={entry.abilityName}>
          <span className="relative">
            {entry.iconUrl ? (
              <Image
                src={entry.iconUrl}
                alt={entry.abilityName}
                width={36}
                height={36}
                className="rounded-md border border-border"
                unoptimized
              />
            ) : (
              <span className="block w-9 h-9 rounded-md bg-surface-raised" />
            )}
            <span className="absolute -bottom-1.5 -right-1.5 text-[10px] font-mono font-bold bg-accent text-page rounded-full w-[18px] h-[18px] flex items-center justify-center ring-2 ring-surface">
              {entry.level}
            </span>
          </span>
          <span className="text-[11px] text-ink-muted font-mono tabular-nums">
            {entry.approxTimeSeconds !== null ? `~${formatMatchTime(entry.approxTimeSeconds)}` : "-"}
          </span>
          <span className="text-[10px] text-ink-secondary text-center leading-tight line-clamp-2 w-full [overflow-wrap:anywhere]">{entry.abilityName}</span>
        </li>
      ))}
    </ol>
  );
}
