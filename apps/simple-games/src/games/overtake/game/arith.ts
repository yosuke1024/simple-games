/**
 * The one bare division game/ allows outside `Math.floor` / `Math.ceil`
 * (docs/OVERTAKE_RULES.md §1「数の規則」): a quotient the constants make
 * exact — a lane width, a half width, a triangular number. It throws instead
 * of returning a fraction, so a future constant that stops dividing evenly
 * (a 7-lane road, an odd car width) fails loudly at the first call rather
 * than slipping a non-integer into the state.
 */
export function exactDiv(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || b === 0 || a % b !== 0) {
    throw new RangeError(`exactDiv: ${a} / ${b} is not a whole number`);
  }
  return a / b;
}
