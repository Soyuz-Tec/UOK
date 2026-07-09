export function formatLabel(value?: string | null) {
  if (!value) return "-";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function apiErrorMessage(error: unknown, fallback: string) {
  const detail = (error as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "error" in detail) return String((detail as { error: unknown }).error);
  return fallback;
}
