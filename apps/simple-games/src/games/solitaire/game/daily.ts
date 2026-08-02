/**
 * Daily deal — implements docs/SOLITAIRE_RULES.md §6.
 * Uses the device's local date only; no server time, no network.
 *
 * One deal per date, the same for every player. It is not screened for
 * winnability — neither is any other deal (§5) — and there is no streak: the
 * record kept is which days were won, not a chain to protect
 * (docs/PRODUCT_PRINCIPLES.md).
 */

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(dateString: string): string {
  return `sol-daily-${dateString}`;
}

/** Shifts a local YYYY-MM-DD string by whole days. */
export function addDays(dateString: string, delta: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  return localDateString(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta));
}
