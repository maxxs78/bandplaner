export const bandFileCategoryLabels: Record<string, string> = {
  NOTES: "Noten",
  CONTRACTS: "Verträge",
  PHOTOS: "Fotos",
  RECORDINGS: "Aufnahmen",
  VIDEOS: "Video",
  OTHER: "Sonstiges",
};

export const bandFileCategoryOptions = Object.entries(bandFileCategoryLabels).map(([value, label]) => ({
  value,
  label,
}));

export const bandFileVisibilityOptions = [
  { value: "INTERNAL", label: "Bandintern" },
  { value: "PUBLIC", label: "Öffentlich (per Link teilbar)" },
];

export const songFileVisibilityOptions = [
  { value: "BAND", label: "Für die Band sichtbar" },
  { value: "PRIVATE", label: "Privat (nur ich)" },
];
