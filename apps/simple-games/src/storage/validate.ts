/**
 * Validation primitives shared by every record schema, in the shell and in
 * each game. Validators never throw: a value that fails returns null and the
 * caller falls back to a safe default (docs/NUMBER_MATCH_RULES.md §15.1).
 */

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const asInt = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && Math.floor(v) === v && v >= min && v <= max
    ? v
    : null;

export const asBool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

export const asString = (v: unknown, maxLen = 200): string | null =>
  typeof v === 'string' && v.length <= maxLen ? v : null;

export const asDateString = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
