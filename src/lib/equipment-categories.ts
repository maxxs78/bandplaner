export const equipmentCategoryLabels: Record<string, string> = {
  INSTRUMENTS: "Instrumente",
  INSTRUMENT_ACCESSORIES: "Instrumentenzubehör",
  AMPS_PEDALBOARD: "Amps und Pedalboard",
  STAGE_EQUIPMENT: "Bühnenequipment",
  PA: "PA",
  MONITORING: "Monitoring",
  PERSONAL: "Persönliches",
  OTHER: "Sonstiges",
};

export const equipmentCategoryOptions = Object.entries(equipmentCategoryLabels).map(([value, label]) => ({
  value,
  label,
}));
