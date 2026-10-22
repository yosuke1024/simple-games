/**
 * Daily Challenge — docs/ECHO_PADS_RULES.md §7.
 * Uses the device's local date only; no server time, no network.
 *
 * Six pads and a target of ten every day: a weekday curve would turn the
 * calendar into lucky and unlucky days. There is no streak and no way back
 * to an earlier day (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」).
 */
import type { PadCount } from './types';

export const DAILY_PAD_COUNT: PadCount = 6;
export const DAILY_TARGET = 10;

/** Formats a date as local YYYY-MM-DD. */
export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether a value is a YYYY-MM-DD string naming a real calendar day. */
export function isLocalDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = LOCAL_DATE.exec(value);
  if (match === null) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * The attempt is in the seed for the same reason it is on a level (§3, §7):
 * after a failure the sequence can be replayed freely, so a retry inside the
 * same day has to be a different sequence.
 */
export function dailySeed(dateString: string, attempt: number): string {
  return `echo-daily-${dateString}-r${attempt}`;
}
