/**
 * Convert a database DATE value into its stable YYYY-MM-DD form.
 * postgres.js returns DATE columns as Date objects, while tests and some
 * adapters may return strings. This helper accepts both and never throws.
 */
export function toIsoDate(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : "";
  }

  const text = String(value).trim();
  const direct = /^(\d{4}-\d{2}-\d{2})/.exec(text)?.[1];
  if (direct && isIsoCalendarDate(direct)) return direct;

  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
}

export function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
