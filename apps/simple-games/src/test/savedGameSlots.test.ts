/**
 * The saved-game slot rule, enforced structurally so the next game cannot
 * inherit the hole the last ten did.
 *
 * A game with two slots keeps the same record shape in both, so the KEY is
 * what says which mode a record is. Every one of them used to take the
 * record's own `mode` field as the answer instead, which meant a `daily`
 * record sitting in the free slot loaded happily — and resuming it switched
 * the app to the other slot, showing the player a different game or a blank
 * screen. The pattern was copied game to game, so the fix had to be too.
 *
 * Like the import-boundary and i18n gates, this lives in a test rather than a
 * script: a check anyone can skip is not a gate. It reads the filesystem and
 * imports nothing from `src/games/`, so the layering rule still holds — the
 * per-game assertions themselves live in each game's own `storage/`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const GAMES = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'games');

const read = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');

/** The games that keep a separate slot for the daily, by their keys leaf. */
const twoSlotGames = readdirSync(GAMES).filter((game) =>
  read(join(GAMES, game, 'storage', 'keys.ts')).includes('dailyGame'),
);

describe('saved-game slots (docs/ARCHITECTURE.md)', () => {
  it('found the games that have two of them', () => {
    // A refactor that breaks the scan must fail loudly, not pass emptily.
    expect(twoSlotGames.length).toBeGreaterThanOrEqual(10);
  });

  it.each(twoSlotGames)('%s ties each slot to the mode it is for', (game) => {
    const schemas = read(join(GAMES, game, 'storage', 'schemas.ts'));
    // The slot factory takes the mode it is for and refuses anything else.
    expect(schemas).toContain('expectedMode');
    expect(schemas).toContain('parsed.mode === expectedMode');
    // And no call site may leave that argument off.
    expect(schemas).not.toMatch(/gameSlotSchema\([A-Z]+_STORAGE_KEYS\.\w+\)/);
  });

  it.each(twoSlotGames)('%s proves it, in its own tests', (game) => {
    expect(existsSync(join(GAMES, game, 'storage', 'slots.test.ts'))).toBe(true);
  });
});
