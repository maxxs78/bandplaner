export const EQUIPMENT_CATEGORIES = [
  "INSTRUMENTS",
  "INSTRUMENT_ACCESSORIES",
  "AMPS_PEDALBOARD",
  "STAGE_EQUIPMENT",
  "PA",
  "MONITORING",
  "PERSONAL",
  "OTHER",
] as const;

export function getEquipmentCategoryLabels(t: (key: string) => string): Record<string, string> {
  return Object.fromEntries(EQUIPMENT_CATEGORIES.map((category) => [category, t(`categories.${category}`)]));
}

export function getEquipmentCategoryOptions(t: (key: string) => string) {
  const labels = getEquipmentCategoryLabels(t);
  return EQUIPMENT_CATEGORIES.map((value) => ({ value, label: labels[value] }));
}
