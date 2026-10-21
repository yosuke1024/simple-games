/**
 * The snap's work, measured (docs/TANGRAM_RULES.md §5「仕事量の上限」「範囲と
 * 仕事量」, §13): on every figure, at every step of a vertex-snap build of its
 * solution, every remaining piece is wished near its solution place in every
 * orientation, at the keyboard's reach (1 unit — the largest any input uses)
 * and at the pointer's (SNAP_PX = 14 px on a 360-wide board). The counts are
 * the gate's subject: no query may reach SNAP_CHECK_LIMIT (snapPose stops at
 * the bound by construction, so the gate is "never exhausted", not "≤ the
 * bound"), and the totals the rules document quotes are pinned. Wall-clock is
 * printed only, never gated.
 *
 * "The keyboard's reach is the widest" holds only while the board's usable px
 * are at least SNAP_PX × the figure's size (about 175 px for `heron`): the
 * pointer case below assumes BOARD_USABLE_PX and checks that assumption. If
 * Phase 3's board is smaller (the web's ad reserve), repeat the pointer pass
 * at the measured size or clamp the pointer's reach at KEYBOARD_TOLERANCE.
 */
import { describe, expect, it } from 'vitest';
import { FIGURES, type Figure } from './catalog';
import { KEYBOARD_TOLERANCE } from './keyboard';
import { canFlip, PIECE_IDS, type PieceId } from './pieces';
import { SNAP_CHECK_LIMIT, snapPose, type BoardPieces, type Placement } from './snap';
import { ptToFloat, ptX, ptY, toFloat } from './z2';

/** §4 の表: the pointer's reach in px, and the 360-wide board's usable px (328 − 2 × 16). */
const SNAP_PX = 14;
const BOARD_USABLE_PX = 296;

function buildOrder(figure: Figure): PieceId[] {
  const board: Partial<Record<PieceId, Placement>> = {};
  for (const id of figure.fixed) board[id] = { ...figure.solution[id], pv: figure.solution[id].at };
  const order: PieceId[] = [];
  let left = PIECE_IDS.filter((id) => !figure.fixed.includes(id));
  while (left.length > 0) {
    const next = left.find((id) => {
      const pose = figure.solution[id];
      const out = snapPose(figure.outline, board, {
        id,
        orientation: pose,
        at: ptToFloat(pose.at),
        tolerance: 0,
      });
      return out.via === 'vertex';
    })!;
    board[next] = { ...figure.solution[next], pv: figure.solution[next].at };
    order.push(next);
    left = left.filter((id) => id !== next);
  }
  return order;
}

interface Tally {
  figures: number;
  queries: number;
  snapped: number;
  maxChecks: number;
  maxCandidates: number;
  pointerQueries: number;
  pointerMaxChecks: number;
  pointerMaxCandidates: number;
  exhausted: number;
  ms: number;
}
const total: Tally = {
  figures: 0,
  queries: 0,
  snapped: 0,
  maxChecks: 0,
  maxCandidates: 0,
  pointerQueries: 0,
  pointerMaxChecks: 0,
  pointerMaxCandidates: 0,
  exhausted: 0,
  ms: 0,
};

/** One figure's queries; the totals add up for the last case to print. */
function measure(figure: Figure): void {
  const started = performance.now();
  const size = Math.max(...figure.outline.map((p) => Math.max(toFloat(ptX(p)), toFloat(ptY(p)))));
  const pointerReach = SNAP_PX / (BOARD_USABLE_PX / size);
  // The assumption behind "the keyboard's 1 unit is the widest reach" (§5).
  expect(pointerReach).toBeLessThanOrEqual(KEYBOARD_TOLERANCE);
  const order = buildOrder(figure);
  const board: Partial<Record<PieceId, Placement>> = {};
  for (const id of figure.fixed) board[id] = { ...figure.solution[id], pv: figure.solution[id].at };
  let worst = 0;
  let exhausted = 0;
  for (let step = 0; step < order.length; step++) {
    for (const id of order.slice(step)) {
      const [x, y] = ptToFloat(figure.solution[id].at);
      for (const f of canFlip(id) ? ([0, 1] as const) : ([0] as const)) {
        for (let r = 0; r < 8; r++) {
          for (const [dx, dy] of [
            [0, 0],
            [0.5, 0.5],
            [-0.7, 0.3],
          ] as const) {
            const out = snapPose(figure.outline, board as BoardPieces, {
              id,
              orientation: { r, f },
              at: [x + dx, y + dy],
              tolerance: 1,
            });
            total.queries++;
            total.maxChecks = Math.max(total.maxChecks, out.checks);
            total.maxCandidates = Math.max(total.maxCandidates, out.candidates);
            worst = Math.max(worst, out.checks);
            if (out.exhausted) exhausted++;
            if (out.placement) total.snapped++;
          }
        }
      }
      const sol = figure.solution[id];
      for (const dx of [-0.5, 0, 0.5]) {
        for (const dy of [-0.5, 0, 0.5]) {
          const out = snapPose(figure.outline, board as BoardPieces, {
            id,
            orientation: sol,
            at: [x + dx, y + dy],
            tolerance: pointerReach,
          });
          total.pointerQueries++;
          total.pointerMaxChecks = Math.max(total.pointerMaxChecks, out.checks);
          total.pointerMaxCandidates = Math.max(total.pointerMaxCandidates, out.candidates);
          worst = Math.max(worst, out.checks);
          if (out.exhausted) exhausted++;
        }
      }
    }
    const id = order[step]!;
    board[id] = { ...figure.solution[id], pv: figure.solution[id].at };
  }
  total.ms += performance.now() - started;
  total.exhausted += exhausted;
  total.figures++;
  // No query may run into the bound: its "nothing" would be the bound's, not the board's.
  expect(exhausted).toBe(0);
  expect(worst).toBeLessThan(SNAP_CHECK_LIMIT);
}

describe('snap work over the whole catalog (§5)', () => {
  // One case per figure (docs/ARCHITECTURE.md「CI / リリース」: no wider timeout).
  it.each(FIGURES.map((figure) => [figure.id, figure] as const))(
    'never reaches SNAP_CHECK_LIMIT on %s',
    (_, figure) => measure(figure),
  );

  it('reports the counts over every figure, and pins the ones §5 quotes', () => {
    const t = total;
    // The totals are filled by the cases above; run alone (-t), this case has nothing to read.
    expect(t.figures, 'run the whole file: the per-figure cases fill the totals').toBe(
      FIGURES.length,
    );
    console.info(
      `snap work (keyboard reach 1): ${t.queries} queries, ${t.snapped} snapped, max checks ${t.maxChecks}, ` +
        `max candidates ${t.maxCandidates}; (pointer reach 14 px at 360 wide): ${t.pointerQueries} queries, ` +
        `max checks ${t.pointerMaxChecks}, max candidates ${t.pointerMaxCandidates}; ` +
        `queries that hit the bound: ${t.exhausted}; wall-clock ${t.ms.toFixed(0)} ms ` +
        `(${((t.ms * 1000) / (t.queries + t.pointerQueries)).toFixed(0)} µs a query, printed only)`,
    );
    expect(t.exhausted).toBe(0);
    expect({
      queries: t.queries,
      maxChecks: t.maxChecks,
      maxCandidates: t.maxCandidates,
      pointerQueries: t.pointerQueries,
      pointerMaxChecks: t.pointerMaxChecks,
      pointerMaxCandidates: t.pointerMaxCandidates,
    }).toEqual({
      queries: 21_216,
      maxChecks: 12,
      maxCandidates: 67,
      pointerQueries: 7_164,
      pointerMaxChecks: 4,
      pointerMaxCandidates: 15,
    });
  });
});
