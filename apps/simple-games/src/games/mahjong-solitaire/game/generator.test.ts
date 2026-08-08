/**
 * The generation guarantee (docs/MAHJONG_SOLITAIRE_RULES.md §5): every deal
 * is winnable by construction, the same seed always deals the same board,
 * and the search's workload stays inside a deterministic node budget with
 * the witness as the measured — not hoped-at — fallback.
 *
 * The workload gate counts NODES, never wall-clock (SUDOKU_RULES.md §7:
 * parallel test runs skew wall time by up to 41×; attempted removals do not
 * skew at all). If this test goes red, read the numbers — do not re-run it.
 */
import { describe, expect, it } from 'vitest';
import { isFreeTile, relationsOf } from './freeState';
import { generateBoard, NODE_BUDGET, stockFor } from './generator';
import { DAILY_PARAMS, LAYOUTS, LAYOUT_IDS, levelParams, MAX_LEVEL } from './layouts';
import { isValidBoard, matchUnit, ORDINARY_FACES, type TileFace } from './types';

const SWEEP_SEEDS = 30;

describe('workload (§5 — nodes, not wall-clock)', () => {
  it('stays inside the node budget across every layout × seed sweep, without the witness', () => {
    let worst = 0;
    let witnessFalls = 0;
    for (const id of LAYOUT_IDS) {
      const params = { layoutId: id, quads: 0, twins: 0, flowers: 0, seasons: 0 };
      for (let s = 0; s < SWEEP_SEEDS; s++) {
        const board = generateBoard({ ...params, ...mixFor(id) }, `sweep-${id}-${s}`);
        worst = Math.max(worst, board.nodes);
        if (board.usedWitness) witnessFalls++;
      }
    }
    // Measured worst over this sweep: double digits of nodes above the pair
    // count (see the assertion below). The budget is far above it, and the
    // witness was never needed — if either number moves, that is a finding
    // about the search, not noise.
    expect(worst).toBeLessThanOrEqual(NODE_BUDGET / 10);
    expect(witnessFalls).toBe(0);
  });

  it('spends about one node per pair in the common case', () => {
    const board = generateBoard(levelParams(1), 'mj-level-1');
    expect(board.nodes).toBeGreaterThanOrEqual(LAYOUTS.sprout.tiles.length / 2);
    expect(board.nodes).toBeLessThan(LAYOUTS.sprout.tiles.length * 4);
  });
});

/** The real mix for a layout id — same arithmetic the level table uses. */
function mixFor(id: (typeof LAYOUT_IDS)[number]) {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const params = levelParams(level);
    if (params.layoutId === id) return params;
  }
  return DAILY_PARAMS;
}

describe('determinism (§5)', () => {
  it('the same seed deals the same board; different seeds differ', () => {
    const a = generateBoard(levelParams(42), 'mj-level-42');
    const b = generateBoard(levelParams(42), 'mj-level-42');
    const c = generateBoard(levelParams(42), 'mj-level-42#other');
    expect(a.faces).toEqual(b.faces);
    expect(a.solvedOrder).toEqual(b.solvedOrder);
    expect(c.faces).not.toEqual(a.faces);
  });
});

describe('solvability by construction (§5)', () => {
  it.each(LAYOUT_IDS)('replaying the construction order wins on %s', (id) => {
    const params = mixFor(id);
    for (let s = 0; s < 5; s++) {
      const board = generateBoard(params, `replay-${id}-${s}`);
      const relations = relationsOf(board.layout);
      const removed: boolean[] = new Array<boolean>(board.layout.tiles.length).fill(false);
      for (let k = 0; k + 1 < board.solvedOrder.length; k += 2) {
        const a = board.solvedOrder[k]!;
        const b = board.solvedOrder[k + 1]!;
        expect(removed[a]).toBe(false);
        expect(removed[b]).toBe(false);
        expect(isFreeTile(a, removed, relations)).toBe(true);
        expect(isFreeTile(b, removed, relations)).toBe(true);
        expect(matchUnit(board.faces[a]!)).toBe(matchUnit(board.faces[b]!));
        removed[a] = true;
        removed[b] = true;
      }
      expect(removed.every(Boolean)).toBe(true);
    }
  });
});

describe('the dealt multiset (§1, §6)', () => {
  it('deals exactly the stock, across the whole level range', () => {
    for (const level of [1, 9, 17, 26, 36, 46, 57, 68, 79, 90, 100]) {
      const params = levelParams(level);
      const seed = `mj-level-${level}`;
      const board = generateBoard(params, seed);
      const stock = stockFor(params, seed);
      const dealt = new Map<TileFace, number>();
      for (const face of board.faces) dealt.set(face, (dealt.get(face) ?? 0) + 1);
      expect(dealt).toEqual(new Map([...stock].filter(([, n]) => n > 0)));
      // And the generated full board passes the validity check it defines.
      const remaining = board.faces.map(() => true);
      expect(isValidBoard(board.faces, remaining, stock)).toBe(true);
    }
  });

  it('deals the full standard set on the turtle: 34 faces × 4, bonus × 1', () => {
    const board = generateBoard(DAILY_PARAMS, 'mj-daily-2026-08-01');
    const dealt = new Map<TileFace, number>();
    for (const face of board.faces) dealt.set(face, (dealt.get(face) ?? 0) + 1);
    for (const face of ORDINARY_FACES) expect(dealt.get(face)).toBe(4);
    for (const face of ['f1', 'f2', 'f3', 'f4', 's1', 's2', 's3', 's4'] as const) {
      expect(dealt.get(face)).toBe(1);
    }
  });
});

describe('isValidBoard is two-stage, not parity alone (§1, §5)', () => {
  const params = DAILY_PARAMS;
  const seed = 'mj-daily-2026-08-01';
  const stock = stockFor(params, seed);
  const board = generateBoard(params, seed);

  it('accepts the standard 144 set — per-face parity would reject the bonus tiles', () => {
    expect(
      isValidBoard(
        board.faces,
        board.faces.map(() => true),
        stock,
      ),
    ).toBe(true);
  });

  it('rejects two copies of one flower even though parity holds', () => {
    const faces = [...board.faces];
    const flowers = faces
      .map((face, i) => [face, i] as const)
      .filter(([face]) => face.startsWith('f'));
    // Overwrite one flower with another: 'flower' unit still has 4 tiles
    // (even), but one face now exists twice against a stock of one.
    faces[flowers[0]![1]] = flowers[1]![0];
    expect(
      isValidBoard(
        faces,
        faces.map(() => true),
        stock,
      ),
    ).toBe(false);
  });

  it('rejects six copies of an ordinary face even though parity holds', () => {
    const faces = [...board.faces];
    const donors = faces
      .map((face, i) => [face, i] as const)
      .filter(([face]) => face === 'o2')
      .slice(0, 2);
    for (const [, i] of donors) faces[i] = 'o1';
    // o1: 6 copies (even), o2: 2 copies (even) — parity says fine, stock no.
    expect(
      isValidBoard(
        faces,
        faces.map(() => true),
        stock,
      ),
    ).toBe(false);
  });

  it('rejects an odd remainder inside one match unit', () => {
    const remaining = board.faces.map(() => true);
    remaining[board.faces.indexOf('o1')] = false;
    expect(isValidBoard(board.faces, remaining, stock)).toBe(false);
  });
});
