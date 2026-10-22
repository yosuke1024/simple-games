/**
 * Bounce Up's own persisted records, under the `bo.` prefix declared in
 * ./keys (docs/BOUNCE_UP_RULES.md §5). Isolated from the shared records and
 * from every other game: corruption here can never take the shell or another
 * game down (docs/ARCHITECTURE.md).
 *
 * There is deliberately no saved run: a body in mid-air has no honest resume,
 * so leaving the screen ends the run (§4, §5). With no daily either, the
 * two-slot rule (src/test/savedGameSlots.test.ts) has nothing to apply to.
 *
 * Every validator fails closed and never throws: a record of another
 * version, of the wrong shape, out of range, or one play could not have
 * produced is null, and `loadRecord` falls back to the default — the whole
 * record, never a field patched in.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';
// Types only: the registry loads this file for "Reset Local Data", and the
// generator and the physics have no business riding along.
import type { PlatformWidth } from '../game/types';

import { BO_STORAGE_KEYS } from './keys';

export { BO_STORAGE_KEYS };

/** The two widths, in the order the home lists them (§4「幅」). */
export const WIDTHS: readonly PlatformWidth[] = ['normal', 'wide'];
export const DEFAULT_WIDTH: PlatformWidth = 'normal';

export function isWidth(value: unknown): value is PlatformWidth {
  return value === 'normal' || value === 'wide';
}

/** A ceiling no real count reaches, so a corrupt huge number is refused (§5). */
const MAX_COUNT = 1e9;
/** Totals are sums of scores: allowed far past one run's, still a safe integer. */
const MAX_TOTAL = 1e15;

// ---------- statistics ----------

/** One number per width (§5): the records are kept apart by width. */
export interface PerWidth {
  normal: number;
  wide: number;
}

/**
 * Counts and sums only — no streak, no per-run history (§5).
 * - `played`: runs that started moving (ready → running).
 * - `best`: the highest run score at each width.
 * - `total`: the sum of every run's score at each width.
 * - `totalPlaySeconds`: whole seconds spent `running`.
 */
export interface Stats {
  schemaVersion: 1;
  played: number;
  best: PerWidth;
  total: PerWidth;
  totalPlaySeconds: number;
}

function perWidth(raw: unknown, max: number): PerWidth | null {
  if (!isRecord(raw)) return null;
  const normal = asInt(raw.normal, 0, max);
  const wide = asInt(raw.wide, 0, max);
  return normal === null || wide === null ? null : { normal, wide };
}

export const statsSchema: SchemaDef<Stats> = {
  key: BO_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    played: 0,
    best: { normal: 0, wide: 0 },
    total: { normal: 0, wide: 0 },
    totalPlaySeconds: 0,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, MAX_COUNT);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, MAX_TOTAL);
    const best = perWidth(raw.best, MAX_COUNT);
    const total = perWidth(raw.total, MAX_TOTAL);
    if (played === null || totalPlaySeconds === null || best === null || total === null) {
      return null;
    }
    // What play cannot produce (§5): the best run is one of the runs the total
    // sums, and a score is only ever booked for a run that was counted.
    for (const width of WIDTHS) {
      if (best[width] > total[width]) return null;
      if (total[width] > 0 && played === 0) return null;
    }
    return { schemaVersion: 1, played, best, total, totalPlaySeconds };
  },
};

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: BO_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- preferences ----------

/**
 * The platform width last picked on the home (§4「幅」), and nothing else. It
 * reaches the next run only — a run keeps the width it was built with.
 * Normal until somebody picks.
 */
export interface Prefs {
  schemaVersion: 1;
  width: PlatformWidth;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: BO_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, width: DEFAULT_WIDTH }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    return isWidth(raw.width) ? { schemaVersion: 1, width: raw.width } : null;
  },
};
