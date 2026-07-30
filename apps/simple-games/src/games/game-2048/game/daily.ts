/**
 * Daily Challenge — implements docs/GAME_2048_RULES.md §6 and §7.
 * Uses the device's local date only; no server time, no network.
 *
 * The same date gives every player the same board and the same run of tiles.
 * There is no streak: the record kept is the best score of each day played,
 * not a chain to protect (§6, docs/PRODUCT_PRINCIPLES.md).
 */

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The seed of §7 — the date is the whole of it, so no two devices differ. */
export function dailySeed(dateString: string): string {
  return `2048-daily-${dateString}`;
}

/** Shifts a local YYYY-MM-DD string by whole days. */
export function addDays(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  return localDateString(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta));
}

/**
 * Difference in calendar days between two local YYYY-MM-DD strings (b - a).
 * Parsed at noon UTC so daylight-saving shifts cannot round a day away.
 */
export function dayDifference(a: string, b: string): number {
  const parse = (s: string): number => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12);
  };
  return Math.round((parse(b) - parse(a)) / 86_400_000);
}
