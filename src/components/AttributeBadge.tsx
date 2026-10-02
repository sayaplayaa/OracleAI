const ATTR_STYLES: Record<string, { label: string; name: string; color: string }> = {
  str: { label: "СИЛ", name: "Сила", color: "#d95926" },
  agi: { label: "ЛОВ", name: "Ловкость", color: "#199e70" },
  int: { label: "ИНТ", name: "Интеллект", color: "#3987e5" },
  all: { label: "УНИ", name: "Универсальный", color: "#d55181" },
  universal: { label: "УНИ", name: "Универсальный", color: "#d55181" },
};

/** Full Russian name of a hero's primary attribute ("agi" -> "Ловкость"). */
export function attributeNameRu(primaryAttr: string): string {
  return ATTR_STYLES[primaryAttr.toLowerCase()]?.name ?? primaryAttr;
}

export function AttributeBadge({ primaryAttr }: { primaryAttr: string }) {
  const style = ATTR_STYLES[primaryAttr.toLowerCase()] ?? {
    label: primaryAttr,
    name: primaryAttr,
    color: "#898781",
  };
  return (
    <span
      title={style.name}
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ color: style.color, background: `${style.color}1a` }}
    >
      {style.label}
    </span>
  );
}
