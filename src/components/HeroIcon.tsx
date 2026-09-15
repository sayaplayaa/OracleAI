import Image from "next/image";
import { getHeroIcon, getHeroName } from "@/lib/constants";

export function HeroIcon({
  heroId,
  size = 32,
  className = "",
}: {
  heroId: number;
  size?: number;
  className?: string;
}) {
  const src = getHeroIcon(heroId);
  if (!src) {
    return (
      <div
        className={`bg-surface-raised rounded ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={getHeroName(heroId)}
      width={size}
      height={size}
      className={`rounded ${className}`}
      unoptimized
    />
  );
}
