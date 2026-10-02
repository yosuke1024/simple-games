/**
 * The Club result action reaches exactly the games that have a challenge
 * contract, and always names the game it is on (docs/architecture/club.md
 * §3, §9).
 *
 * Same shape as shareWiring.test.ts, and for the same reason: a result
 * screen that names the wrong game would post a player's result to a
 * leaderboard for a board they did not play. Static, so a game that gains a
 * `challenge` entry in the registry fails here until its overlay carries the
 * action — and a game that carries the action without a contract fails too.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../app/registry';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(SRC, 'games');

/** The games whose daily is one board for everyone (club.md §14 判断 40). */
const SHARED_DAILY_GAMES = [
  'sudoku',
  'nonogram',
  'takuzu',
  'futoshiki',
  'kakuro',
  'crown-grid',
  'number-path',
  'shape-regions',
  'binary-balance',
  'sudoku-6x6',
  'box-regions',
  'solitaire',
  'spider-solitaire',
  'freecell',
  'mahjong-solitaire',
  'memory-match',
  'sliding-puzzle',
  'number-match',
  'quick-math',
  'schulte-table',
  'water-sort',
] as const;

/** Attributes the Club layer needs on every usage (club.md §9). */
const REQUIRED_ATTRIBUTES = ['facts', 'details', 'boardDigest', 'seed', 'params'] as const;

interface Usage {
  /** The folder the file lives in — the game id, by convention. */
  game: string;
  file: string;
  /** The id the tag actually passes. */
  gameId: string | null;
  attributes: string;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path));
    else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) out.push(path);
  }
  return out;
}

const usages: Usage[] = [];
for (const file of sourceFiles(GAMES_DIR)) {
  const source = readFileSync(file, 'utf8');
  // `=>` inside an attribute (an arrow function) holds a `>`, so the tag is
  // read up to its closing `/>` rather than the first `>`.
  for (const match of source.matchAll(/<ClubResultAction\s(.*?)\/>/gs)) {
    const attributes = match[1] ?? '';
    usages.push({
      game: file.slice(GAMES_DIR.length + 1).split('/')[0]!,
      file: file.slice(SRC.length + 1),
      gameId: /gameId="([^"]+)"/.exec(attributes)?.[1] ?? null,
      attributes,
    });
  }
}

describe('the Club result action', () => {
  it('is on exactly the games that have a challenge contract', () => {
    const withContract = GAMES.filter((game) => game.challenge !== undefined)
      .map((game) => game.id)
      .sort();
    const withAction = [...new Set(usages.map((usage) => usage.game))].sort();
    expect(withAction).toEqual(withContract);
  });

  it('names its own game, never a neighbour', () => {
    const wrong = usages
      .filter((usage) => usage.gameId !== usage.game)
      .map((usage) => `${usage.file} posts to "${usage.gameId ?? '(none)'}"`);
    expect(wrong, wrong.join('\n')).toEqual([]);
  });

  it('lives on a result overlay and nowhere else', () => {
    const stray = usages
      .filter((usage) => !/Result\w*Overlay\.tsx$/.test(usage.file))
      .map((usage) => usage.file);
    expect(stray, stray.join('\n')).toEqual([]);
  });

  it('passes the facts, the details and the board identity', () => {
    const lacking = usages.flatMap((usage) =>
      REQUIRED_ATTRIBUTES.filter(
        (name) => !new RegExp(`(^|\\s)${name}=`).test(usage.attributes),
      ).map((name) => `${usage.file} has no ${name}=`),
    );
    expect(lacking, lacking.join('\n')).toEqual([]);
  });

  it('sends every shared-board daily to the day’s challenge, never to a ranking (club.md §14 判断 40)', () => {
    // These dailies are one board for everyone on a date, so the overlay must
    // tag them with the date and a board digest: without both the bridge
    // routes the result into the game × mode ranking, which decision 29 forbids.
    // Minesweeper (the first tap moves the mines) and Number Recall (a retry
    // deals a new layout) are not on the list on purpose.
    const lacking = SHARED_DAILY_GAMES.flatMap((game) => {
      const mine = usages.filter((usage) => usage.game === game);
      if (mine.length === 0) return [`${game} has no ClubResultAction`];
      return mine.flatMap((usage) => [
        ...(/(^|\s)daily=\{(?!null\})/.test(usage.attributes)
          ? []
          : [`${usage.file} passes no daily date`]),
        ...(/(^|\s)boardDigest=\{(?!null\})/.test(usage.attributes)
          ? []
          : [`${usage.file} passes no board digest`]),
      ]);
    });
    expect(lacking, lacking.join('\n')).toEqual([]);
  });

  it('found something to check', () => {
    // A scanner that reads nothing passes everything.
    expect(usages.length).toBeGreaterThanOrEqual(3);
  });
});
