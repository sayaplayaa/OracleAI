// OpenDota's hero role tags ("Carry", "Nuker", ...) in Russian, in the order
// the hero filter shows them.
export const HERO_ROLE_TAGS_RU: Record<string, string> = {
  Carry: "Керри",
  Support: "Саппорт",
  Nuker: "Нюкер",
  Disabler: "Контроль",
  Initiator: "Инициатор",
  Durable: "Живучесть",
  Escape: "Побег",
  Pusher: "Пушер",
  Jungler: "Лесник",
};

export function heroRoleTagRu(tag: string): string {
  return HERO_ROLE_TAGS_RU[tag] ?? tag;
}

// Primary attributes in Dota's own hero grid order.
export const ATTRIBUTE_ORDER = ["str", "agi", "int", "all"] as const;
