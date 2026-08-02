/**
 * Daily Challenge — implements docs/WATER_SORT_RULES.md §7.
 * Uses the device's local date only; no server time, no network.
 *
 * The color count is fixed every day. A weekday curve would turn the calendar
 * into lucky and unlucky days, which is pressure the brand refuses. There is
 * no streak: the record kept is which days were solved, not a chain to
 * protect (§7, docs/PRODUCT_PRINCIPLES.md).
 */

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(dateString: string): string {
  return `water-daily-${dateString}`;
}

/** Every day is a six-color board (§7) — the middle of the level curve. */
export const DAILY_COLORS = 6;

/**
 * And every day starts equally jumbled — the middle of the range the levels
 * walk through (§6). Taking whichever deal came first instead would let the
 * calendar hand out an easy Tuesday and a hard Wednesday, which is the same
 * lucky-day pressure the fixed color count exists to refuse.
 */
export const DAILY_MIX = 0.5;

/** Shifts a local YYYY-MM-DD string by whole days. */
export function addDays(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  return localDateString(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta));
}
