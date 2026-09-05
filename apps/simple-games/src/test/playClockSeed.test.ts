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
 * The slot to read is whichever one THIS mount is pointed at — the one a
 * shortcut opened straight onto (issue #113) or the one the home screen starts
 * on. That is why the seed may not be gated on the resume, and why the active
 * mode and the seed have to read one shared expression: gate it and the
 * collection-launch path is back to zero; pin it to `INITIAL_MODE` and a
 * shortcut resuming a daily or free board seeds from an empty slot.
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

  it.each(restoring)('%s seeds its play clock from the game it mounts on', (game) => {
    const src = providerOf(game);
    // One baseline, named once, read by every ref that needs it.
    expect(src).toMatch(
      /^ {2}const mountedSeconds = (?:initialSessions\[mountedMode\]|initialSession)\?\.elapsedSeconds \?\? 0;$/m,
    );
    expect(src).toContain('const elapsedRef = useRef(mountedSeconds);');
    // number-match books its play time in one go at the end and keeps no
    // baseline; every other game's has to move with the clock.
    if (/^ {2}const bookedRef = /m.test(src)) {
      expect(src).toContain('const bookedRef = useRef(mountedSeconds);');
    }
    // Gating the baseline on the resume is the shape that left the
    // collection-launch path seeding from zero (issue #109).
    expect(src).not.toMatch(/const mountedSeconds = \w+ \?[^?]/);
  });

  it.each(multiSlot)('%s names the slot it mounts on, once', (game) => {
    const src = providerOf(game);
    // The active mode and the clock's baseline must read the SAME expression:
    // a mode taken from one slot and a clock from another is the whole trap.
    expect(src).toMatch(/^const INITIAL_MODE: GameMode = '[a-z]+';$/m);
    expect(src).toMatch(/^ {2}const mountedMode = resumeMode \?\? INITIAL_MODE;$/m);
    expect(src).toContain('useState<GameMode>(mountedMode)');
    expect(src).toContain('initialSessions[mountedMode]');
  });
});
