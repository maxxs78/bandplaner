export const BAND_FILE_CATEGORIES = ["NOTES", "CONTRACTS", "PHOTOS", "RECORDINGS", "VIDEOS", "OTHER"] as const;

export function getBandFileCategoryLabels(t: (key: string) => string): Record<string, string> {
  return Object.fromEntries(BAND_FILE_CATEGORIES.map((c) => [c, t(`categories.${c}`)]));
}

export function getBandFileCategoryOptions(t: (key: string) => string) {
  const labels = getBandFileCategoryLabels(t);
  return BAND_FILE_CATEGORIES.map((value) => ({ value, label: labels[value] }));
}

export function getBandFileVisibilityOptions(t: (key: string) => string) {
  return [
    { value: "INTERNAL", label: t("visibility.internal") },
    { value: "PUBLIC", label: t("visibility.public") },
  ];
}

export function getSongFileVisibilityOptions(t: (key: string) => string) {
  return [
    { value: "BAND", label: t("visibleToBand") },
    { value: "PRIVATE", label: t("privateOnlyMe") },
  ];
}
