/**
 * The shell's header controls reach every game's home screen, and always
 * name the game whose header they sit in: the favourite star (issue #109)
 * and, on Android, "Add to Home Screen" (issue #110), together as
 * `GameHomeActions`.
 *
 * Both halves matter. A title whose home forgot the group can only be pinned
 * — to the collection or to the OS home screen — by somebody who knows the
 * collection's long press exists, which is the doorway these controls were
 * added to stop relying on. A group that names the *wrong* game pins a game
 * the player was not looking at — and, worse, reads as if it had worked,
 * because the tile it adds is somewhere else entirely.
 *
 * Static, like test/shareWiring.test.ts, because that is what makes it a gate
 * on new games rather than on the thirty that exist: a title added tomorrow
 * fails this the moment its folder appears, without anyone remembering to add
 * a case.
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
const strays: string[] = [];
for (const file of sourceFiles(GAMES_DIR)) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<GameHomeActions\s([^>]*?)\/>/gs)) {
    const attributes = match[1] ?? '';
    usages.push({
      game: file.slice(GAMES_DIR.length + 1).split('/')[0]!,
      file: file.slice(SRC.length + 1),
      gameId: /gameId="([^"]+)"/.exec(attributes)?.[1] ?? null,
    });
  }
  // The two controls are placed as one group and never on their own: a game
  // that reached for the star alone would drop the shortcut from its header
  // on Android, and one that reached for the shortcut alone would drop the
  // star everywhere.
  if (/<(FavoriteAction|HomeShortcutAction)\b/.test(source))
    strays.push(file.slice(SRC.length + 1));
}

describe('the header controls on a game home', () => {
  it('are on every game in the collection', () => {
    const covered = new Set(usages.map((usage) => usage.game));
    const missing = GAMES.map((game) => game.id).filter((id) => !covered.has(id));
    expect(missing, `no header controls on: ${missing.join(', ')}`).toEqual([]);
  });

  it('name their own game, never a neighbour', () => {
    const wrong = usages
      .filter((usage) => usage.gameId !== usage.game)
      .map((usage) => `${usage.file} names "${usage.gameId ?? '(none)'}"`);
    expect(wrong, wrong.join('\n')).toEqual([]);
  });

  it('live on the game home and nowhere else', () => {
    // Never on a board, never on a result screen, never on a level list:
    // pinning — to the collection or to the home screen — is a decision about
    // the collection, taken at the door of a game
    // (docs/ARCHITECTURE.md「コレクションホーム」). A control on a result screen
    // would be asking for a commitment at the moment somebody just won, which
    // is the shape of every mechanic docs/PRODUCT_PRINCIPLES.md rules out.
    const stray = usages
      .filter((usage) => !/ui\/screens\/HomeScreen\.tsx$/.test(usage.file))
      .map((usage) => usage.file);
    expect(stray, stray.join('\n')).toEqual([]);
  });

  it('are offered exactly once per game', () => {
    const twice = [...new Set(usages.map((u) => u.game))].filter(
      (game) => usages.filter((u) => u.game === game).length > 1,
    );
    expect(twice, `more than one group on: ${twice.join(', ')}`).toEqual([]);
  });

  it('are placed as the group, never as one control on its own', () => {
    expect(strays, strays.join('\n')).toEqual([]);
  });

  it('found something to check', () => {
    // A scanner that reads nothing passes everything.
    expect(usages.length).toBe(GAMES.length);
  });
});
