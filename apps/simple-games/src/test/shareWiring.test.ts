/**
 * The share action reaches every game, and always names the game it is on
 * (issue #86).
 *
 * Both halves matter. A title whose result card forgot the button is a title
 * nobody can pass on, and the collection's only discovery path is players
 * telling each other. A button that names the *wrong* game is worse than a
 * missing one: it sends somebody a link to a game they were not shown, in a
 * message that says they were.
 *
 * Static, like test/gameI18nWiring.test.ts, because that is what makes it a
 * gate on new games rather than on the thirty that exist: a title added
 * tomorrow fails this the moment its folder appears, without anyone
 * remembering to add a case.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../app/registry';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(SRC, 'games');

interface Usage {
  /** The folder the file lives in — the game id, by convention. */
  game: string;
  file: string;
  /** The id the tag actually passes. */
  gameId: string | null;
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
  for (const match of source.matchAll(/<ShareAction\s([^>]*?)\/>/gs)) {
    const attributes = match[1] ?? '';
    usages.push({
      game: file.slice(GAMES_DIR.length + 1).split('/')[0]!,
      file: file.slice(SRC.length + 1),
      gameId: /gameId="([^"]+)"/.exec(attributes)?.[1] ?? null,
    });
  }
}

describe('the share action', () => {
  it('is on every game in the collection', () => {
    const covered = new Set(usages.map((usage) => usage.game));
    const missing = GAMES.map((game) => game.id).filter((id) => !covered.has(id));
    expect(missing, `no share action on: ${missing.join(', ')}`).toEqual([]);
  });

  it('names its own game, never a neighbour', () => {
    const wrong = usages
      .filter((usage) => usage.gameId !== usage.game)
      .map((usage) => `${usage.file} shares "${usage.gameId ?? '(none)'}"`);
    expect(wrong, wrong.join('\n')).toEqual([]);
  });

  it('lives on a result screen and nowhere else', () => {
    // Never on the board, never on a home screen, never on a level list: the
    // one place this may be offered is the natural stop after a game
    // (docs/ARCHITECTURE.md「結果画面の共有」).
    const stray = usages
      .filter(
        (usage) =>
          !/Result\w*Overlay\.tsx$|number-match\/ui\/components\/ResultOverlay\.tsx$/.test(
            usage.file,
          ),
      )
      .map((usage) => usage.file);
    expect(stray, stray.join('\n')).toEqual([]);
  });

  it('found something to check', () => {
    // A scanner that reads nothing passes everything.
    expect(usages.length).toBeGreaterThanOrEqual(GAMES.length);
  });
});
