/**
 * Leaving a game by a door it never hears still books its play time
 * (docs/GAME_LIFECYCLE.md「アンマウントで計上する」).
 *
 * The browser's Back and Forward (app/App.tsx, `popstate`) and a home-screen
 * shortcut to another game (`appUrlOpen`) take a game off screen by
 * unmounting its Root — no goHome, no exitToCollection, no visibilitychange.
 * A provider that books its clock only on those loses every second played
 * since its last sync, from the board's clock and from `totalPlaySeconds`
 * alike. That was the web build's Back for most games until 2026-10-18.
 * Unmounting is the one thing every way out has in common, so that is where
 * the sync has to run — the same sync, so `bookedRef` keeps it to once.
 *
 * Static, like playClockSeed.test.ts and refLeading.test.ts, because that is
 * what makes it a gate on the next game rather than on the ones that exist.
 * The behaviour itself — play, unmount, booked once, not again on remount —
 * is proven in each game's own Root test. This file reads the filesystem and
 * imports nothing from `src/games/`, so the layering rule holds.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const GAMES = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'games');

const read = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const games = readdirSync(GAMES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const providerOf = (game: string) => read(join(GAMES, game, 'state', 'GameContext.tsx'));

/**
 * The callback a provider already leaves through: `syncActiveGame` (save the
 * board, book the clock) for the games that keep a session, and
 * `abandonActiveRound` for the two that never persist a round (Number Recall
 * §12, Schulte Table §11) and book it as they drop it.
 */
function seamOf(src: string): 'syncActiveGame' | 'abandonActiveRound' | null {
  if (/const syncActiveGame = useCallback/.test(src)) return 'syncActiveGame';
  if (/const abandonActiveRound = useCallback/.test(src)) return 'abandonActiveRound';
  return null;
}

const withSeam = games.filter((game) => seamOf(providerOf(game)) !== null);

/**
 * The arcade titles keep their run in the board component's refs, not in the
 * provider (docs/architecture/state-and-refs.md), and the board books its own
 * seconds: `flushSeconds()` in the cleanup of the loop's effect.
 */
const boardsOf = (game: string): string[] => {
  const dir = join(GAMES, game, 'ui', 'components');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.tsx') && !name.includes('.test.'))
    .map((name) => read(join(dir, name)))
    .filter((src) => /const flushSeconds = useCallback/.test(src));
};

const boardBooked = games.filter((game) => !withSeam.includes(game));

describe('booking play time on unmount (docs/GAME_LIFECYCLE.md「アンマウントで計上する」)', () => {
  it('found the games', () => {
    // A refactor that breaks the scan must fail loudly, not pass emptily.
    expect(games.length).toBeGreaterThanOrEqual(41);
    expect(withSeam.length).toBeGreaterThanOrEqual(37);
  });

  it.each(withSeam)('%s runs its leave sync when the provider unmounts', (game) => {
    const src = providerOf(game);
    const seam = seamOf(src)!;
    // Exactly the seam its own exits and the background already run: a
    // second, unmount-only booking path is how a second count gets in.
    expect(src.split(`useOnUnmount(${seam});`).length - 1).toBe(1);
    expect(src).toContain("import { useOnUnmount } from '../../../ui/useOnUnmount';");
    // The effect form re-runs its cleanup whenever the callback changes
    // identity, while the game is still on screen (ui/useOnUnmount.ts).
    expect(src).not.toMatch(new RegExp(`useEffect\\(\\(\\) => \\(\\) => ${seam}\\(\\)`));
  });

  it.each(boardBooked)('%s books from its board when the board unmounts', (game) => {
    const boards = boardsOf(game);
    // A game with neither a leave seam nor a board that books has nowhere for
    // an unmount to put its seconds. Pick one of the two shapes.
    expect(boards.length, `${game} has no leave seam and no board that books`).toBe(1);
    // The loop effect's cleanup: stop the loop, then book what it ran.
    expect(boards[0]).toMatch(/return \(\) => \{\n(?:[^\n]*\n){0,3}? +flushSeconds\(\);\n/);
  });
});
