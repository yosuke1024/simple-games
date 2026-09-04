/**
 * Every GameContext's session, statistics and progress are written through one
 * seam, and that seam advances the ref before it calls setState (issue #108).
 *
 * Why this needs a gate rather than a convention. Each GameContext mirrors its
 * state into refs in the render body (`const xRef = useRef(x); xRef.current =
 * x;`) so the callbacks can read the current value without being rebuilt on
 * every change. React batches the updates raised inside one task, and the
 * render that refreshes those refs has not run yet — so a *second* mutation in
 * the same task reads what the first one replaced, and the first is lost.
 *
 * That is not hypothetical. Nonogram's drag lost cells when two pointer moves
 * landed in one frame (issue #108), and finishing a run while starting the next
 * one from the same tap writes the statistics twice (2048, Block Puzzle and the
 * four arcade titles all do this). Both were found by playing, not by reading.
 *
 * Static, like test/shareWiring.test.ts, because that is what makes it a gate on
 * new games rather than on the thirty that exist: a title added tomorrow fails
 * this the moment its context appears, without anyone remembering to add a case.
 *
 * The rule is written up in docs/ARCHITECTURE.md「状態と ref」.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(SRC, 'games');

/**
 * The refs a mutator reads to build the next value. These are the ones a stale
 * read actually costs something: a lost move, or a lost booking.
 *
 * `flagsRef` / `prefsRef` / `activeModeRef` are mirrored the same way but are
 * left out on purpose — nothing writes them twice in a task, and the writes
 * that exist are whole-value replacements from a single toggle. Some contexts
 * lead them anyway (the CPU titles' `prefsRef`, where picking a side and
 * starting a match really is one tap); that is allowed, not required.
 */
const GUARDED = ['sessionRef', 'sessionsRef', 'statsRef', 'progressRef'];

/** How far above the setState call the ref may be advanced and still count. */
const LEAD_WINDOW = 10;

interface Seam {
  game: string;
  ref: string;
  setter: string;
  /** Every call site of the setter, 1-indexed, excluding its declaration. */
  callSites: number[];
  /** True when a call site has the ref advanced just above it. */
  leads: boolean;
}

const contexts = readdirSync(GAMES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    game: entry.name,
    path: join(GAMES_DIR, entry.name, 'state/GameContext.tsx'),
  }))
  .filter((entry) => {
    try {
      readFileSync(entry.path);
      return true;
    } catch {
      return false;
    }
  });

const seams: Seam[] = [];
for (const { game, path } of contexts) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const setters = new Map<string, string>();
  for (const line of lines) {
    const match = /const \[(\w+), (\w+)\] = useState/.exec(line);
    if (match) setters.set(match[1]!, match[2]!);
  }

  for (let i = 0; i < lines.length; i++) {
    // A render-body mirror: the useRef and the assignment that follows it.
    const mirror = /^ {2}const (\w+Ref) = useRef\((\w+)\);$/.exec(lines[i]!);
    if (!mirror) continue;
    const [, ref, value] = mirror as unknown as [string, string, string];
    if (lines[i + 1]?.trim() !== `${ref}.current = ${value};`) continue;
    if (!GUARDED.includes(ref)) continue;

    const setter = setters.get(value);
    if (!setter) continue;
    const callSites: number[] = [];
    for (let j = 0; j < lines.length; j++) {
      if (j === i || j === i + 1) continue;
      const line = lines[j]!;
      if (
        line.includes('useState') ||
        line.trim().startsWith('//') ||
        line.trim().startsWith('*')
      ) {
        continue;
      }
      if (new RegExp(`\\b${setter}\\(`).test(line)) callSites.push(j + 1);
    }

    const leads = callSites.some((site) =>
      lines.slice(Math.max(0, site - 1 - LEAD_WINDOW), site - 1).some((line, offset) => {
        const absolute = Math.max(0, site - 1 - LEAD_WINDOW) + offset;
        return absolute !== i + 1 && new RegExp(`^\\s+${ref}\\.current = `).test(line);
      }),
    );
    seams.push({ game, ref, setter, callSites, leads });
  }
}

describe('the state a mutator reads back', () => {
  it('is written through exactly one seam per context', () => {
    const scattered = seams
      .filter((seam) => seam.callSites.length !== 1)
      .map(
        (seam) =>
          `${seam.game}: ${seam.setter} called at ${seam.callSites.join(', ') || 'nowhere'}`,
      );
    expect(
      scattered,
      `each of these should go through one helper (putSession / persistStats / persistProgress), ` +
        `so the ref can be advanced in one place:\n${scattered.join('\n')}`,
    ).toEqual([]);
  });

  it('advances its ref before setState, in every context that mirrors one', () => {
    const stale = seams.filter((seam) => !seam.leads).map((seam) => `${seam.game}: ${seam.ref}`);
    expect(
      stale,
      `these mirror a ref into the render body but never advance it at the write. ` +
        `React batches one task's updates, so a second mutation in that task would read ` +
        `what the first one replaced (docs/ARCHITECTURE.md「状態と ref」):\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  it('covers every game that keeps a session, and both records', () => {
    // A guard that silently matched nothing would pass the two tests above
    // while checking nothing at all.
    const games = new Set(seams.map((seam) => seam.game));
    expect(games.size).toBe(contexts.length);
    const sessions = seams.filter((seam) => seam.ref.startsWith('session'));
    // The four arcade titles hold their world in an authoritative ref that is
    // never mirrored from state, so they have no session seam to guard.
    expect(sessions.length).toBe(contexts.length - 4);
    expect(seams.filter((seam) => seam.ref === 'statsRef').length).toBe(contexts.length);
  });
});
