/**
 * Daily Challenge seed — implements docs/NUMBER_MATCH_RULES.md §10.
 * Uses the device's local date only; no server time, no network.
 */

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The deterministic seed for a given local date string. */
export function dailySeed(dateString: string): string {
  return `daily-${dateString}`;
}

/**
 * Difference in calendar days between two local YYYY-MM-DD strings (b - a).
 * Used for streak calculation; treats strings as local dates at noon to
 * avoid DST edge cases.
 */
/** Shifts a local YYYY-MM-DD string by whole days. */
export function addDays(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const shifted = new Date((y ?? 1970), (m ?? 1) - 1, (d ?? 1) + delta);
  return localDateString(shifted);
}

export function dayDifference(a: string, b: string): number {
  const parse = (s: string): number => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12);
  };
  return Math.round((parse(b) - parse(a)) / 86_400_000);
}
