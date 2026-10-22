/**
 * The one bare division game/ allows outside `Math.floor` / `Math.ceil`
 * (docs/BOUNCE_UP_RULES.md §2「単位と数の規則」): a quotient the constants make
 * exact — a per-step gravity, a half width. It throws instead
 * of returning a fraction, so a future constant that stops dividing evenly
 * (a gravity that is not a multiple of 120) fails loudly at the first call rather
 * than slipping a non-integer into the state.
 */
export function exactDiv(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || b === 0 || a % b !== 0) {
    throw new RangeError(`exactDiv: ${a} / ${b} is not a whole number`);
  }
  return a / b;
}
