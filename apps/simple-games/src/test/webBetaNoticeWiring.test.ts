/**
 * A title on the browser's early-release channel says so before anything is
 * saved: `WebBetaNotice` carries the BETA badge and, in English and Japanese,
 * the sentence that this game's saves may be reset while it is in early
 * release (docs/WEB_VERSION.md「先行公開(ベータ)」).
 *
 * That sentence is not decoration. It is the condition under which a beta
 * title may reset a save at all — "黙って消さない — 上記の説明文で先に告知した
 * 上で" (WEB_VERSION.md「保存データ」). A beta title without it would make the
 * next schema change a silent loss, and nothing else would notice: the
 * component decides for itself whether to draw (registry channel, platform),
 * so its absence renders exactly like a released title's.
 *
 * Two screens, because a first visit does not start on the home. It opens on
 * Quick Rules, whose last button starts a board — and writes the first save —
 * before the home has ever been shown; the home is where every later visit
 * starts. So the notice has to be on both: `ui/screens/HomeScreen.tsx` and
 * `ui/screens/TutorialScreen.tsx`, each naming its own game.
 *
 * Static, like test/homeActionsWiring.test.ts, so it is a gate on the next
 * beta title rather than on the ones that exist: a game registered with
 * `channel: 'web-beta'` — or `'in-development'`, the scaffold on its way
 * there — fails this until both screens carry the notice.
 * scripts/new-game.mjs `--channel web-beta` and `--channel in-development`
 * scaffold both.
 *
 * Released titles may keep the element (the eleven promoted on 2026-10-02
 * keep it on their homes): with no channel it renders nothing, and dropping
 * `channel` is the whole of graduating (docs/RELEASE_CHECKLIST.md §0).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../app/registry';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(SRC, 'games');
const HOME = join('ui', 'screens', 'HomeScreen.tsx');
const TUTORIAL = join('ui', 'screens', 'TutorialScreen.tsx');

/** Every screen a beta title must carry the notice on, by the name a failure uses. */
const SCREENS = [
  { name: 'home', file: HOME },
  { name: 'Quick Rules', file: TUTORIAL },
] as const;

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

/** Every file the scan read, relative to src/ — what "checked" means below. */
const scanned = new Set<string>();
const usages: Usage[] = [];
for (const file of sourceFiles(GAMES_DIR)) {
  scanned.add(file.slice(SRC.length + 1));
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<WebBetaNotice\s([^>]*?)\/>/gs)) {
    usages.push({
      game: file.slice(GAMES_DIR.length + 1).split('/')[0]!,
      file: file.slice(SRC.length + 1),
      gameId: /gameId="([^"]+)"/.exec(match[1] ?? '')?.[1] ?? null,
    });
  }
}

// A title in development (`channel: 'in-development'`) carries the notice from
// its scaffold on: it draws nothing until the title turns `'web-beta'`, and
// that turn must not be the moment both screens are found wanting.
const betaIds = GAMES.filter((game) => game.channel).map((game) => game.id);

describe('the early-release notice on a beta title', () => {
  for (const screen of SCREENS) {
    it(`is on the ${screen.name} of every title on the web-beta or in-development channel`, () => {
      const missing = betaIds.filter(
        (id) =>
          !usages.some(
            (usage) => usage.game === id && usage.gameId === id && usage.file.endsWith(screen.file),
          ),
      );
      expect(
        missing,
        `no <WebBetaNotice gameId="<id>" /> in games/<id>/${screen.file} for: ${missing.join(', ')}`,
      ).toEqual([]);
    });
  }

  it('names its own game, never a neighbour', () => {
    // The notice reads `channel` for the id it is given: naming a released
    // neighbour would draw nothing on a beta screen, and naming a beta
    // neighbour would put a caveat about someone else's saves on this one.
    const wrong = usages
      .filter((usage) => usage.gameId !== usage.game)
      .map((usage) => `${usage.file} names "${usage.gameId ?? '(none)'}"`);
    expect(wrong, wrong.join('\n')).toEqual([]);
  });

  it('reads every beta screen it checks', () => {
    // A path that drifted would make a case above vacuous for that title —
    // and so would a file the scan never opened (it reads `.tsx` only).
    for (const screen of SCREENS) {
      const unread = betaIds.filter(
        (id) =>
          !existsSync(join(GAMES_DIR, id, screen.file)) ||
          !scanned.has(join('games', id, screen.file)),
      );
      expect(unread, `${screen.file} not read for: ${unread.join(', ')}`).toEqual([]);
    }
  });

  it('found something to check', () => {
    // A scanner that reads nothing passes everything.
    expect(scanned.size).toBeGreaterThan(0);
    expect(usages.length).toBeGreaterThan(0);
  });
});
