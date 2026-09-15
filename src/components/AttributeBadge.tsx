const ATTR_STYLES: Record<string, { label: string; color: string }> = {
  str: { label: "STR", color: "#d95926" },
  agi: { label: "AGI", color: "#199e70" },
  int: { label: "INT", color: "#3987e5" },
  all: { label: "ALL", color: "#d55181" },
  universal: { label: "ALL", color: "#d55181" },
};

export function AttributeBadge({ primaryAttr }: { primaryAttr: string }) {
  const style = ATTR_STYLES[primaryAttr.toLowerCase()] ?? { label: primaryAttr, color: "#898781" };
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ color: style.color, background: `${style.color}1a` }}
    >
      {style.label}
    </span>
  );
}
