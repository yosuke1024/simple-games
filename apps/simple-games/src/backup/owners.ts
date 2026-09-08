/**
 * Who is allowed to say whether a stored record is valid — the record's own
 * schema, never this layer (issue #160).
 *
 * WHY THE BACKUP LAYER DOES NOT PARSE SAVES
 *
 * A backup that understood thirty save formats would be a thirty-first copy of
 * them, and the copy would rot: a game changes its schema, its own migration
 * follows, and the backup's private idea of that game silently does not. Every
 * record already has a `SchemaDef` that validates and migrates it, written by
 * the layer that owns the data — so restore asks that, and a game whose save
 * format moves on takes its backup handling with it for free.
 *
 * HOW A GAME'S SCHEMAS ARE FOUND
 *
 * Through the registry, like everything else the shell knows about a game
 * (docs/ARCHITECTURE.md「ゲームレジストリの契約」). `loadStorageSchemas` is a
 * REQUIRED field, so a thirty-first game cannot be added without naming its
 * schemas — the omission this whole layer would otherwise fail silently on is
 * a compile error instead. `keys.test.ts` closes the loop from the other side,
 * asserting that every key the registry declares actually resolves to a schema
 * through that loader.
 *
 * The loaders are lazy, and only the games a file actually mentions are used.
 * A game's schemas ride in that game's chunk (vite.config.ts), so eager
 * imports here would chain the collection home to all thirty chunks — the one
 * thing the size gate forbids. Somebody who has played four games loads four
 * chunks to restore, on a screen where a moment's work is expected and where
 * nothing is on the network.
 */
import { GAMES } from '../app/registry';
import {
  favoriteGamesSchema,
  recentGamesSchema,
  settingsSchema,
  type SchemaDef,
} from '../storage/schemas';

/**
 * Validates one record's parsed JSON, returning null when it is unusable.
 * The `SchemaDef` contract exactly (docs/ARCHITECTURE.md「ストレージキーの規約」):
 * it never throws, and for older versions it migrates.
 */
export type RecordValidator = (raw: unknown) => unknown;

const SHELL_VALIDATORS: readonly SchemaDef<unknown>[] = [
  settingsSchema,
  favoriteGamesSchema,
  recentGamesSchema,
];

function isSchemaDef(value: unknown): value is SchemaDef<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SchemaDef<unknown>>;
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.validate === 'function' &&
    typeof candidate.defaultValue === 'function'
  );
}

/**
 * A game's schemas are plain module exports, so they are read as such: every
 * export that has the `SchemaDef` shape is one, whether it was written as a
 * literal or produced by a factory (the per-slot save schemas are — see
 * `games/sudoku/storage/schemas.ts`). Nothing here relies on export names.
 */
function schemasIn(module: Readonly<Record<string, unknown>>): SchemaDef<unknown>[] {
  return Object.values(module).filter(isSchemaDef);
}

/**
 * The validators for `keys`, loading only the game chunks those keys belong to.
 *
 * A key with no owner is simply absent from the result. Callers treat that as
 * "this build does not know this record" — which is a rejection, never a shrug
 * (backup/restore.ts).
 */
export async function loadValidators(
  keys: Iterable<string>,
): Promise<ReadonlyMap<string, RecordValidator>> {
  const wanted = new Set(keys);
  const validators = new Map<string, RecordValidator>();

  for (const schema of SHELL_VALIDATORS) {
    if (wanted.has(schema.key)) validators.set(schema.key, schema.validate);
  }

  const owning = GAMES.filter((game) => game.storageKeys.some((key) => wanted.has(key)));

  await Promise.all(
    owning.map(async (game) => {
      // A chunk that will not load leaves its keys unvalidated rather than
      // half-validated: they stay out of the map, and restore refuses.
      let module: Readonly<Record<string, unknown>>;
      try {
        module = await game.loadStorageSchemas();
      } catch {
        return;
      }
      for (const schema of schemasIn(module)) {
        if (wanted.has(schema.key)) validators.set(schema.key, schema.validate);
      }
    }),
  );

  return validators;
}
