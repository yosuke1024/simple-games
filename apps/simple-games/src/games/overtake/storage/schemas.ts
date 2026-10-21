/**
 * Overtake's own persisted records, under the `ot.` prefix declared in
 * ./keys (docs/OVERTAKE_RULES.md §9). Isolated from the shared records and
 * from every other game: corruption here can never take the shell or another
 * game down (docs/ARCHITECTURE.md).
 *
 * There is deliberately no saved race: a real-time board has no honest
 * resume, so leaving the screen ends the race and the retry is free (§2, §9).
 * With no daily either, the two-slot rule (src/test/savedGameSlots.test.ts)
 * has nothing to apply to.
 *
 * Every validator fails closed and never throws: a record of another
 * version, of the wrong shape or out of range is null, and `loadRecord`
 * falls back to the default — the whole record, never a field patched in.
 * The field checks themselves are game/progress.ts's pure decoders, so the
 * logic and the storage cannot disagree about what a valid value is.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, isRecord } from '../../../storage/validate';
// The narrow modules, not '../game': the registry loads this file for "Reset
// Local Data", and the course generator and the pace table have no business
// riding along.
import type { Controls } from '../game/input';
import {
  DEFAULT_CONTROLS,
  decodeControls,
  decodeHighestUnlocked,
  decodeStats,
} from '../game/progress';

import { OT_STORAGE_KEYS } from './keys';

export { OT_STORAGE_KEYS };

// ---------- unlock frontier ----------

export interface Progress {
  schemaVersion: 1;
  /**
   * The level Play opens (1..100), or 101 once Lv100 has been won — the
   * value then says "all cleared" rather than naming a level (§7).
   */
  highestUnlocked: number;
}

export const progressSchema: SchemaDef<Progress> = {
  key: OT_STORAGE_KEYS.progress,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, highestUnlocked: 1 }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const highestUnlocked = decodeHighestUnlocked(raw.highestUnlocked);
    return highestUnlocked === null ? null : { schemaVersion: 1, highestUnlocked };
  },
};

// ---------- statistics ----------

/** Counts and a total only: no place, time or bumps per level, no streak (§9). */
export interface Stats {
  schemaVersion: 1;
  played: number;
  totalPlaySeconds: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: OT_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, played: 0, totalPlaySeconds: 0 }),
  validate: (raw) => {
    // decodeStats reads the two counts only; the version is this schema's to
    // check (game/progress.ts), so a record of any other version is refused.
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const counts = decodeStats(raw);
    return counts === null ? null : { schemaVersion: 1, ...counts };
  },
};

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: OT_STORAGE_KEYS.flags,
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
 * Drag or Buttons, and nothing more (§3, §9): the drag mapping (mode A or B)
 * is one constant, never the player's choice.
 */
export interface Prefs {
  schemaVersion: 1;
  controls: Controls;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: OT_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, controls: DEFAULT_CONTROLS }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const controls = decodeControls(raw.controls);
    return controls === null ? null : { schemaVersion: 1, controls };
  },
};
