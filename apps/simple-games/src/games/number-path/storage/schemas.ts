/**
 * This game's own persisted records, under the `np.` prefix declared
 * in ./keys. Isolated from the shared records and from every other game:
 * corruption here can never take the shell or another game down
 * (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults.
 *
 * Scaffolded by scripts/new-game.mjs — a starting point. Add the game's real
 * fields here, and once there is something worth resuming, a `game` key plus
 * a saved-game schema (src/test/savedGameSlots.test.ts explains the two-slot
 * rule this needs if a daily mode is added later).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';

import { NP_STORAGE_KEYS } from './keys';

export { NP_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: NP_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- statistics ----------

export interface Stats {
  schemaVersion: 1;
  played: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: NP_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, played: 0 }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    return played === null ? null : { schemaVersion: 1, played };
  },
};
