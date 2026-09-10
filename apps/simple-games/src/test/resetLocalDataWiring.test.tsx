/**
 * "Reset Local Data", from the button to the last key on the device.
 *
 * Three tests already guard pieces of this path, and none of them is this one:
 * `app/gameKeys.test.ts` pins the key list every game declares,
 * `storage/storage.test.ts` proves `clearLocalData` removes exactly the keys it
 * is handed and cannot be outlived by a save still in flight, and
 * `ui/screens/SettingsScreen.test.tsx` walks the button, the confirmation, and
 * the shared records the shell itself holds. What none of them does is put a
 * played device's records on disk — every game's progress, suspended boards,
 * statistics, settings and flags — press the button, and read all of it back.
 *
 * Parts being right and their composition being right are different claims
 * (issue #168, #156 §2 item 10). The composition is the key expression inside
 * `runReset` — `STORAGE_KEYS` plus `GAMES.flatMap(game => game.storageKeys)` —
 * so the screen is rendered and clicked rather than `clearLocalData` called
 * directly: a game left out of that expression is invisible to every other
 * test and visible here.
 *
 * The screen deletes through the default store, so the fixture writes through
 * it too. The point is that the delete reaches the same place the games save
 * to, not a store this test handed it.
 *
 * The loop is over `GAMES`. There is no game list in this file, so the
 * thirty-first game is covered the day it joins the registry.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock } = vi.hoisted(() => ({ capacitorMock: { native: false } }));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => capacitorMock.native,
    getPlatform: () => (capacitorMock.native ? 'android' : 'web'),
  },
}));
vi.mock('../ui/openExternal', () => ({ openExternal: vi.fn() }));

import { resetFavoriteGamesForTesting } from '../app/favoriteGames';
import { resetRecentGamesForTesting } from '../app/recentGames';
import { GAMES } from '../app/registry';
import { resetAdRemovalForTesting } from '../monetization/adRemoval';
import { resetReviewForTesting } from '../services/review';
import { SettingsProvider } from '../state/SettingsContext';
import { loadRaw, loadRecord, saveRaw } from '../storage/repo';
import {
  favoriteGamesSchema,
  iapSchema,
  recentGamesSchema,
  reviewSchema,
  settingsSchema,
  STORAGE_KEYS,
  type SchemaDef,
} from '../storage/schemas';
import { SettingsScreen } from '../ui/screens/SettingsScreen';

/** The shell's own records, read here the same way a game's records are. */
const SHELL_SCHEMAS: readonly SchemaDef<unknown>[] = [
  settingsSchema,
  iapSchema,
  reviewSchema,
  recentGamesSchema,
  favoriteGamesSchema,
];

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSchemaDef = (value: unknown): value is SchemaDef<unknown> =>
  isRecordValue(value) &&
  typeof value.key === 'string' &&
  typeof value.defaultValue === 'function' &&
  typeof value.validate === 'function';

/**
 * The keys the button deletes, written the way the screen writes them so the
 * fixture cannot drift from the thing under test. Duplicates collapse: two
 * games never share a key (gameKeys.test.ts), but one game may export the same
 * schema twice.
 */
const declaredKeys = (): readonly string[] => [
  ...new Set([...Object.values(STORAGE_KEYS), ...GAMES.flatMap((game) => game.storageKeys)]),
];

/**
 * The schema behind each key, found the way the shell finds a game it has not
 * opened: through `loadStorageSchemas`, filtered by the keys the registry
 * declares, so a schema a game exports but never registers stays out.
 */
async function declaredSchemas(): Promise<Map<string, SchemaDef<unknown>>> {
  const byKey = new Map<string, SchemaDef<unknown>>();
  for (const schema of SHELL_SCHEMAS) byKey.set(schema.key, schema);
  for (const game of GAMES) {
    const module = await game.loadStorageSchemas();
    for (const value of Object.values(module)) {
      if (isSchemaDef(value) && game.storageKeys.includes(value.key)) byKey.set(value.key, value);
    }
  }
  return byKey;
}

/**
 * The default record with every counter, flag and toggle moved off its
 * fresh-install value — a device somebody has played on, not one just set up.
 * `schemaVersion` is left alone: it is the record's identity, and a validator
 * that refused an unknown version would hand back the default and quietly make
 * the assertions vacuous.
 */
function played(value: unknown): unknown {
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value + 1;
  if (Array.isArray(value)) return value.map(played);
  if (isRecordValue(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        key === 'schemaVersion' ? inner : played(inner),
      ]),
    );
  }
  return value;
}

/**
 * Text standing in for a record this test cannot build a real value for: a
 * suspended board, whose default is `null` — "no saved game" — and which only
 * the game itself can deal; a record holding nothing but a version and one
 * enum (which difficulty, which tier), where there is no second value to guess;
 * and one holding an empty list (the home's shortcut row, the pinned shelf).
 *
 * Storage sees what it sees: a key with something under it, which is all a
 * delete has to reckon with, and the read-back below is at that level for
 * every key. What those particular records mean on screen belongs to
 * SettingsScreen.test.tsx, not here.
 */
const standIn = (key: string) => JSON.stringify({ suspended: key });

interface Fixture {
  readonly text: string;
  /** True when the text is a record this key's own validator accepts. */
  readonly real: boolean;
}

function fixtureFor(key: string, def: SchemaDef<unknown> | undefined): Fixture {
  const value = def?.defaultValue();
  if (def === undefined || value === null || value === undefined)
    return { text: standIn(key), real: false };
  const text = JSON.stringify(played(value));
  const accepted = def.validate(JSON.parse(text) as unknown);
  const tellsThemApart =
    accepted !== null && JSON.stringify(accepted) !== JSON.stringify(def.defaultValue());
  return tellsThemApart ? { text, real: true } : { text: standIn(key), real: false };
}

async function playedDevice(): Promise<{
  fixtures: Map<string, Fixture>;
  schemas: Map<string, SchemaDef<unknown>>;
}> {
  const schemas = await declaredSchemas();
  const fixtures = new Map(
    declaredKeys().map((key) => [key, fixtureFor(key, schemas.get(key))] as const),
  );
  return { fixtures, schemas };
}

function renderSettings() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SettingsScreen onBack={() => undefined} />
    </SettingsProvider>,
  );
}

/** Presses the button and answers the one destructive question. */
async function pressResetLocalData() {
  const user = userEvent.setup();
  renderSettings();
  await user.click(screen.getByRole('button', { name: /Reset Local Data/ }));
  await user.click(screen.getByRole('button', { name: 'Delete' }));
}

beforeEach(() => {
  capacitorMock.native = false;
  localStorage.clear();
  resetRecentGamesForTesting();
  resetFavoriteGamesForTesting();
  resetReviewForTesting();
  resetAdRemovalForTesting();
});

afterEach(() => {
  cleanup();
  resetAdRemovalForTesting();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Reset Local Data on a played device', () => {
  /**
   * The delete below is worth exactly what this fixture covers, so what it
   * covers is stated first. Every declared key has a schema behind it — a
   * persisted record without one could be neither validated nor migrated — and
   * most of what is written is a record the game's own validator accepts,
   * rather than a stand-in. A change to `played` that stopped producing valid
   * records would leave the delete comparing defaults with defaults, passing
   * without having removed anything.
   */
  it('has a real record ready for most of the keys the button will delete', async () => {
    const { fixtures, schemas } = await playedDevice();

    for (const game of GAMES) {
      expect(game.storageKeys.length, `${game.id} declares no storage keys`).toBeGreaterThan(0);
      for (const key of game.storageKeys)
        expect(schemas.has(key), `${key} is persisted with no schema`).toBe(true);
    }

    const real = [...fixtures.values()].filter((fixture) => fixture.real);
    expect(real.length).toBeGreaterThan(80);
  });

  /**
   * The gate. Every declared key holds a record, the player presses the
   * button, and nothing is left anywhere — not a board, not a best time, not a
   * per-game toggle. Read back at both levels, because they fail differently:
   * a key still holding text is data the delete missed, and a record that
   * still reads as played is what the player would be looking at.
   */
  it('leaves nothing behind, and every game reads as a fresh install', async () => {
    const { fixtures, schemas } = await playedDevice();

    for (const [key, fixture] of fixtures) await saveRaw(key, fixture.text);
    for (const [key, fixture] of fixtures) {
      expect(await loadRaw(key), `${key} was not written`).toBe(fixture.text);
      const def = schemas.get(key);
      if (!fixture.real || def === undefined) continue;
      expect(
        await loadRecord(def),
        `${key} reads as a fresh install before the delete`,
      ).not.toEqual(def.defaultValue());
    }

    await pressResetLocalData();

    await waitFor(async () => {
      const survivors: string[] = [];
      for (const key of fixtures.keys()) if ((await loadRaw(key)) !== null) survivors.push(key);
      expect(survivors).toEqual([]);
    });

    for (const [key, def] of schemas) {
      expect(await loadRecord(def), `${key} still reads as a played device`).toEqual(
        def.defaultValue(),
      );
    }
  });
});
