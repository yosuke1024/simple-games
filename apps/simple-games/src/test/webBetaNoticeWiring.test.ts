/**
 * A title on the browser's early-release channel says so on its own home,
 * before anything is saved: `WebBetaNotice` carries the BETA badge and, in
 * English and Japanese, the sentence that this game's saves may be reset
 * while it is in early release (docs/WEB_VERSION.md「先行公開(ベータ)」).
 *
 * That sentence is not decoration. It is the condition under which a beta
 * title may reset a save at all — "黙って消さない — 上記の説明文で先に告知した
 * 上で" (WEB_VERSION.md「保存データ」). A beta home without it would make the
 * next schema change a silent loss, and nothing else would notice: the
 * component decides for itself whether to draw (registry channel, platform),
 * so its absence renders exactly like a released title's.
 *
 * Static, like test/homeActionsWiring.test.ts, so it is a gate on the next
 * beta title rather than on the ones that exist: a game registered with
 * `channel: 'web-beta'` fails this until its home carries the notice.
 * scripts/new-game.mjs `--channel web-beta` scaffolds it in place.
 *
 * Released titles may keep the element (the eleven promoted on 2026-10-02
 * do): with no channel it renders nothing, and dropping `channel` is the
 * whole of graduating (docs/RELEASE_CHECKLIST.md §0).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../app/registry';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(SRC, 'games');
const HOME = join('ui', 'screens', 'HomeScreen.tsx');

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
  for (const match of source.matchAll(/<WebBetaNotice\s([^>]*?)\/>/gs)) {
    usages.push({
      game: file.slice(GAMES_DIR.length + 1).split('/')[0]!,
      file: file.slice(SRC.length + 1),
      gameId: /gameId="([^"]+)"/.exec(match[1] ?? '')?.[1] ?? null,
    });
  }
}

const betaIds = GAMES.filter((game) => game.channel === 'web-beta').map((game) => game.id);

describe('the early-release notice on a beta home', () => {
  it('is on the home of every title on the web-beta channel', () => {
    const missing = betaIds.filter(
      (id) =>
        !usages.some(
          (usage) => usage.game === id && usage.gameId === id && usage.file.endsWith(HOME),
        ),
    );
    expect(
      missing,
      `no <WebBetaNotice gameId="<id>" /> in games/<id>/${HOME} for: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('names its own game, never a neighbour', () => {
    // The notice reads `channel` for the id it is given: naming a released
    // neighbour would draw nothing on a beta home, and naming a beta neighbour
    // would put a caveat about someone else's saves on this one.
    const wrong = usages
      .filter((usage) => usage.gameId !== usage.game)
      .map((usage) => `${usage.file} names "${usage.gameId ?? '(none)'}"`);
    expect(wrong, wrong.join('\n')).toEqual([]);
  });

  it('reads every beta home it checks', () => {
    // A path that drifted would make the first case vacuous for that title.
    const unread = betaIds.filter((id) => !existsSync(join(GAMES_DIR, id, HOME)));
    expect(unread, `no ${HOME} for: ${unread.join(', ')}`).toEqual([]);
  });

  it('found something to check', () => {
    // A scanner that reads nothing passes everything.
    expect(usages.length).toBeGreaterThan(0);
  });
});
