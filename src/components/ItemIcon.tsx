import Image from "next/image";
import { getItemIconByKey, getItemNameByKey } from "@/lib/constants";

export function ItemIcon({
  itemKey,
  size = 28,
}: {
  itemKey: string;
  size?: number;
}) {
  const src = getItemIconByKey(itemKey);
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={getItemNameByKey(itemKey)}
      title={getItemNameByKey(itemKey)}
      width={size}
      height={size}
      className="rounded border border-border"
      unoptimized
    />
  );
}
