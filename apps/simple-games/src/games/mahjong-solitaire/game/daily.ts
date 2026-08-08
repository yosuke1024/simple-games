/**
 * Daily Challenge — implements docs/MAHJONG_SOLITAIRE_RULES.md §6.
 * Uses the device's local date only; no server time, no network.
 *
 * Every day is the same shape: the full 144-tile turtle with the standard
 * set. A weekday curve would turn the calendar into lucky and unlucky days,
 * which is pressure the brand refuses. There is no streak: the record kept
 * is which days were cleared, not a chain to protect
 * (docs/PRODUCT_PRINCIPLES.md).
 */

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The canonical daily seed — derived from the date, never stored (§10). */
export function dailySeed(dateString: string): string {
  return `mj-daily-${dateString}`;
}

/** Shifts a local YYYY-MM-DD string by whole days. */
export function addDays(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  return localDateString(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta));
}
