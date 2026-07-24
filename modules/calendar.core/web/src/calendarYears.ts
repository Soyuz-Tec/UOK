export const YEAR_BROWSE_RADIUS = 100;
export const YEAR_PAGE_SIZE = 20;
export const YEAR_GRID_COLUMNS = 4;

export function yearPageStart(year: number) {
  return Math.floor(year / YEAR_PAGE_SIZE) * YEAR_PAGE_SIZE;
}

export function clampYear(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function parseLocalizedYear(value: string) {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const easternArabicDigits = "۰۱۲۳۴۵۶۷۸۹";
  const normalized = value.trim()
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(easternArabicDigits.indexOf(digit)));
  return /^\d{1,4}$/.test(normalized) ? Number(normalized) : null;
}
