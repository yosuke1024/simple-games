/**
 * The play-clock seeding rule, enforced structurally so the next game cannot
 * inherit the hole twenty-one of them had.
 *
 * `syncActiveGame` runs on `visibilitychange` / `pause` from whichever screen
 * is showing, and `withElapsed` writes the provider's `elapsedRef` straight
 * into the session it saves. A ref seeded only by `activate` — the Resume path
 * — is still zero for a game the player opened and left from its own home, and
 * that zero lands on the suspended board's `elapsedSeconds`: the board comes
 * back, the minutes on it do not (issue #109). `bookedRef` has to carry the
 * same baseline, or those restored seconds are booked into the statistics a
 * second time. The two are one invariant, so they are checked together.
 *
 * Like the saved-game-slot and import-boundary gates, this lives in a test
 * rather than a script: a check anyone can skip is not a gate. It reads the
 * filesystem and imports nothing from `src/games/`, so the layering rule holds.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const GAMES = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'games');

const read = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const providerOf = (game: string) => read(join(GAMES, game, 'state', 'GameContext.tsx'));

/**
 * The games whose provider mounts with a session restored from disk. The
 * arcade four keep no session, and number-recall / schulte-table never persist
 * a round (§11, §12) — none of them has a clock to lose.
 */
const restoring = readdirSync(GAMES).filter((game) =>
  /^ {2}initialSessions?: /m.test(providerOf(game)),
);

/** Of those, the ones with a slot per mode, which must name the slot they mount on. */
const multiSlot = restoring.filter((game) =>
  providerOf(game).includes('initialSessions: SavedGames'),
);

describe('play clock seeding (docs/ARCHITECTURE.md「状態と ref」)', () => {
  it('found the games that restore a session', () => {
    // A refactor that breaks the scan must fail loudly, not pass emptily.
    expect(restoring.length).toBeGreaterThanOrEqual(21);
    expect(multiSlot.length).toBeGreaterThanOrEqual(12);
  });

  it.each(restoring)('%s seeds its play clock from the restored game', (game) => {
    const src = providerOf(game);
    const seed = String.raw`\(\s*(?:initialSessions\[INITIAL_MODE\]|initialSession)\?\.elapsedSeconds \?\? 0,?\s*\)`;
    expect(src).toMatch(new RegExp(String.raw`const elapsedRef = useRef${seed};`));
    // number-match books its play time in one go at the end and keeps no
    // baseline; every other game's has to move with the clock.
    if (src.includes('bookedRef')) {
      expect(src).toMatch(new RegExp(String.raw`const bookedRef = useRef${seed};`));
    }
  });

  it.each(multiSlot)('%s names the slot it mounts on', (game) => {
    const src = providerOf(game);
    // The mode is a name rather than a literal in two places, because the
    // clock's baseline has to come from the slot `activeMode` actually starts
    // on — the two drift apart the moment someone changes only one of them.
    expect(src).toMatch(/^const INITIAL_MODE: GameMode = '[a-z]+';$/m);
    expect(src).toContain('useState<GameMode>(INITIAL_MODE)');
  });
});
