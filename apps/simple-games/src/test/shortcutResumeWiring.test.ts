/**
 * What a game does with the one fact the shell tells it about itself: which
 * door this launch came through (`entry`, app/registry.ts, issue #113).
 *
 * Two halves, and the second is the one that is easy to lose. A game that
 * keeps a suspended game of its own must answer a home-screen shortcut by
 * opening straight onto it when — and only when — there is exactly one; a
 * game that keeps none must not take the prop at all, because for a title
 * with nothing to resume the only thing "open the board directly" could mean
 * is starting a fresh run nobody asked for, which spends a play and writes
 * it to the statistics (docs/ARCHITECTURE.md「ホーム画面ショートカット」).
 *
 * Static, like test/homeActionsWiring.test.ts and test/savedGameSlots.test.ts,
 * because that is what makes it a gate on the next game rather than on the
 * thirty that exist: a title added tomorrow meets this the moment its folder
 * appears, without anyone remembering to add a case. It reads the filesystem
 * and imports nothing from `src/games/`, so the layering rule holds — the
 * behaviour itself is proven in each game's own Root test, which is the last
 * assertion below.
 *
 * WHICH KIND A GAME IS, IT SAYS TWICE
 *
 * Everything here turns on that classification, and getting it wrong is the
 * one failure this gate cannot report: a game read as save-less is excused
 * from the requirement AND held to the abstention, so a real implementation
 * would be failed and a missing one would pass. One convention deciding that
 * alone is too thin — the first draft keyed on a property literally named
 * `game`, which a title whose only slot is the daily would not have. So two
 * independent signals are read and required to agree: the shape of the
 * persisted KEYS (a slot's value is `<prefix>.save…`, where stats, progress,
 * flags and prefs are not), and whether the game has a `storage/gamePersistence.ts`
 * at all — the module that exists only to convert a session to and from its
 * record. A game that changes one convention without the other fails here
 * rather than being quietly reclassified.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../app/registry';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(SRC, 'games');

const read = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '');

/**
 * The prop, written the same way everywhere. Games declare it rather than
 * importing `GameRootProps` — `onExit` has always been duplicated that way,
 * and the registry's own type is what checks the two agree — so the literal
 * union is what there is to match on.
 *
 * Matched as a DECLARATION, at the head of its own line: a file may say in
 * prose that it deliberately has no such prop, and in a codebase where every
 * abstention is explained at length, a gate that forbade the sentence would
 * be forbidding the explanation.
 */
const ENTRY_PROP = "entry?: 'collection' | 'shortcut';";
const DECLARES_ENTRY = /^[ \t]*entry\?: 'collection' \| 'shortcut';/m;

const games = readdirSync(GAMES_DIR, { withFileTypes: true })
  .filter((dir) => dir.isDirectory())
  .map((dir) => dir.name);

/** Every source file of one game, tests included. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/** The game's root component — the one file the shell mounts. */
function rootFile(game: string): string {
  const ui = join(GAMES_DIR, game, 'ui');
  const roots = readdirSync(ui).filter((name) => /Root\.tsx$/.test(name));
  return join(ui, roots[0] ?? 'missing');
}

/** A saved-game slot, by the shape of its key: `sd.saveGame`, `fc.saveDaily`. */
const keepsASession = (game: string): boolean =>
  /:\s*'[^']*\.save[A-Za-z]*'/.test(read(join(GAMES_DIR, game, 'storage', 'keys.ts')));

/** The module that converts a session to and from its record. */
const hasPersistence = (game: string): boolean =>
  existsSync(join(GAMES_DIR, game, 'storage', 'gamePersistence.ts'));

const withSaves = games.filter(keepsASession);
const withoutSaves = games.filter((game) => !keepsASession(game));

describe('a home-screen shortcut, answered by the game (issue #113)', () => {
  it('is looking at the collection the registry ships', () => {
    // Not `readdirSync` alone: a folder the registry does not carry is not a
    // game, and a game the registry carries without a folder is a broken
    // build. The sibling gates cross-check the same way.
    expect([...games].sort()).toEqual(GAMES.map((game) => game.id).sort());
  });

  it('agrees with itself about which games keep a session', () => {
    // The two conventions must name the same set. If they ever disagree, the
    // disagreement is the bug — not something to pick a winner from.
    const disagree = games
      .filter((game) => keepsASession(game) !== hasPersistence(game))
      .map(
        (game) =>
          `${game}: keys say ${keepsASession(game)}, gamePersistence.ts says ${hasPersistence(game)}`,
      );
    expect(disagree, disagree.join('\n')).toEqual([]);
    // And a scan that has stopped matching anything must fail loudly rather
    // than excusing all thirty games at once.
    expect(withSaves.length).toBeGreaterThanOrEqual(20);
    expect(withoutSaves.length).toBeGreaterThanOrEqual(5);
  });

  it.each(withSaves)('%s takes the door it was opened by', (game) => {
    const root = read(rootFile(game));
    expect(DECLARES_ENTRY.test(root), `${game}'s root does not declare ${ENTRY_PROP}`).toBe(true);
    // And hands it on rather than swallowing it: the decision belongs to the
    // provider, which is where the loaded records and the clocks are.
    expect(root, `${game}'s root does not pass entry on`).toContain('entry={entry}');
  });

  it.each(withSaves)('%s decides for itself, and only for a shortcut', (game) => {
    const context = read(join(GAMES_DIR, game, 'state', 'GameContext.tsx'));
    expect(DECLARES_ENTRY.test(context), `${game}'s provider does not declare ${ENTRY_PROP}`).toBe(
      true,
    );
    // The ordinary door opens the game's home, as it always did. A provider
    // that read the prop without this comparison would resume on every launch.
    expect(context, `${game}'s provider does not gate on the shortcut`).toContain(
      "entry === 'shortcut'",
    );
  });

  it.each(withSaves)('%s proves it, in its own tests', (game) => {
    const covered = sourceFiles(join(GAMES_DIR, game))
      .filter((file) => /\.test\.tsx?$/.test(file))
      .some((file) => readFileSync(file, 'utf8').includes('entry="shortcut"'));
    expect(covered, `no test launches ${game} through a shortcut`).toBe(true);
  });

  it.each(withoutSaves)('%s keeps out of it: there is nothing to resume', (game) => {
    const offenders = sourceFiles(join(GAMES_DIR, game))
      .filter((file) => DECLARES_ENTRY.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(SRC.length + 1));
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
