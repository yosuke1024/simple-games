/**
 * The session: operations, Undo, completion and the record
 * (docs/TANGRAM_RULES.md §1, §3, §5「完成」, §8, §13).
 */
import { describe, expect, it } from 'vitest';
import { dailyFigure, figureById, figuresOf, type Figure } from './catalog';
import { keyboardSnap, outlineCenter, stepPoint, centroidOf, type FloatPoint } from './keyboard';
import { PIECE_IDS, poseVertices, turn, type PieceId, type Pose } from './pieces';
import {
  canUndo,
  createDailySession,
  createSession,
  flipPiece,
  isCompleteBoard,
  placePiece,
  restartSession,
  restoreSession,
  returnToTray,
  rotatePiece,
  toRecord,
  trayPieces,
  undo,
  UNDO_HISTORY_LIMIT,
  withElapsedSeconds,
  type TangramSession,
} from './session';
import type { Placement } from './snap';
import { atVertex0, ip, poseFromVertices, r2 } from './test-helpers';
import { ptAdd, ptSub, type Pt } from './z2';

const square = figureById('square')!;
const triangle = figureById('triangle')!;
const medium = figuresOf('medium')[0]!;

const sol = (figure: Figure, id: PieceId): Placement => atVertex0(figure.solution[id]);

function placeAll(
  figure: Figure,
  order: readonly PieceId[],
  poses = figure.solution,
): TangramSession {
  let session = createSession(figure);
  for (const id of order) {
    const next = placePiece(session, id, atVertex0(poses[id]));
    if (!next) throw new Error(`could not place ${id}`);
    session = next;
  }
  return session;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) {
      out.push([item, ...rest]);
    }
  });
  return out;
}

/** The solution mapped by an isometry of the plane, as poses found from the mapped vertices. */
function mapSolution(figure: Figure, map: (p: Pt) => Pt): Record<PieceId, Pose> {
  const out = {} as Record<PieceId, Pose>;
  for (const id of PIECE_IDS) {
    const pose = poseFromVertices(id, poseVertices(id, figure.solution[id]).map(map));
    if (!pose) throw new Error(`no pose for ${id}`);
    out[id] = pose;
  }
  return out;
}

describe('a fresh session (§3)', () => {
  it('starts with every piece in the tray, unturned, and no history', () => {
    const session = createSession(square);
    expect(trayPieces(session)).toEqual(PIECE_IDS);
    expect(session.status).toBe('playing');
    expect(canUndo(session)).toBe(false);
    for (const id of PIECE_IDS) expect(session.tray[id]).toEqual({ r: 0, f: 0 });
  });

  it('puts Medium’s two fixed pieces in place from the start', () => {
    const session = createSession(medium);
    expect(medium.fixed).toEqual(['L1', 'P']);
    expect(session.board.L1).toEqual(sol(medium, 'L1'));
    expect(session.board.P).toEqual(sol(medium, 'P'));
    expect(trayPieces(session)).toEqual(['L2', 'M', 'SQ', 'S1', 'S2']);
  });

  it('deals the daily its date’s Medium figure', () => {
    const session = createDailySession('2026-10-21')!;
    expect(session.mode).toBe('daily');
    expect(session.dailyDate).toBe('2026-10-21');
    expect(session.figure).toBe(dailyFigure('2026-10-21'));
    expect(session.figure.tier).toBe('medium');
  });

  it('starts no daily for a string that is not a calendar date (fail closed)', () => {
    for (const bad of ['garbage', '', '2026-02-30'])
      expect(createDailySession(bad), bad).toBeNull();
  });
});

describe('one operation each (§3)', () => {
  it('places from the tray, and Undo sends the piece back with its tray turn', () => {
    let session = rotatePiece(createSession(square), 'S1')!; // tray turn r=1
    expect(session.tray.S1).toEqual({ r: 1, f: 0 });
    session = placePiece(session, 'S1', sol(square, 'S1'))!;
    expect(session.board.S1).toEqual(sol(square, 'S1'));
    expect(session.history).toHaveLength(2);
    const back = undo(session)!;
    expect(back.board.S1).toBeUndefined();
    expect(back.tray.S1).toEqual({ r: 1, f: 0 });
  });

  it('moves a board piece elsewhere in one step; Undo puts it back with its pivot', () => {
    const start = placePiece(createSession(square), 'S1', sol(square, 'S1'))!;
    const elsewhere: Placement = { r: 0, f: 0, at: ip(0, 0), pv: ip(0, 0) };
    const moved = placePiece(start, 'S1', elsewhere)!;
    expect(moved.board.S1).toEqual(elsewhere);
    expect(moved.history).toHaveLength(2);
    expect(undo(moved)!.board.S1).toEqual(sol(square, 'S1'));
  });

  it('does not count a re-drop onto the same pose, and keeps the old pivot', () => {
    const start = placePiece(createSession(square), 'L1', sol(square, 'L1'))!;
    const placed = start.board.L1!;
    const otherPivot: Placement = { ...placed, pv: poseVertices('L1', placed)[1]! };
    expect(placePiece(start, 'L1', otherPivot)).toBeNull();
    expect(start.board.L1!.pv).toEqual(placed.pv);
  });

  it('turns a tray piece always, and a board piece about its pivot when there is room', () => {
    const tray = rotatePiece(createSession(square), 'L1')!;
    expect(tray.tray.L1).toEqual({ r: 1, f: 0 });
    // S1 at the square's top-left corner, pivot on that corner: a turn fits.
    const placed = placePiece(createSession(square), 'S1', {
      r: 0,
      f: 0,
      at: ip(0, 0),
      pv: ip(0, 0),
    })!;
    const turned = rotatePiece(placed, 'S1');
    // r=1 about (0, 0) puts the triangle's legs at ±45°: it pokes out of the square.
    expect(turned).toBeNull();
    // About its right-angle corner placed mid-square, it turns.
    const mid = placePiece(createSession(square), 'S1', {
      r: 0,
      f: 0,
      at: ip(2, 2),
      pv: ip(2, 2),
    })!;
    const midTurned = rotatePiece(mid, 'S1')!;
    expect(midTurned.board.S1!.pv).toEqual(ip(2, 2));
    expect(midTurned.board.S1!.r).toBe(1);
    expect(undo(midTurned)!.board.S1).toEqual(mid.board.S1);
  });

  it('turns a board piece eight times back where it was', () => {
    // A corner on the square's centre: every turn about it stays inside.
    let session = placePiece(createSession(square), 'SQ', {
      r: 0,
      f: 0,
      at: r2(2, 2),
      pv: r2(2, 2),
    })!;
    const before = session.board.SQ;
    for (let k = 0; k < 8; k++) session = rotatePiece(session, 'SQ')!;
    expect(session.board.SQ).toEqual(before);
    expect(session.history).toHaveLength(9);
  });

  it('flips only the parallelogram — in the tray, or on the board about its pivot', () => {
    expect(flipPiece(createSession(square), 'L1')).toBeNull();
    const tray = flipPiece(createSession(square), 'P')!;
    expect(tray.tray.P).toEqual({ r: 0, f: 1 });
    // On the 8 × 4 rectangle, pivot on corner 1: the mirror image fits beside it.
    const onBoard = placePiece(createSession(figureById('rectangle')!), 'P', {
      r: 0,
      f: 0,
      at: ip(2, 0),
      pv: ip(4, 0),
    })!;
    const flipped = flipPiece(onBoard, 'P')!;
    expect(flipped.board.P!.f).toBe(1);
    expect(flipped.board.P!.pv).toEqual(ip(4, 0));
    expect(flipped.board.P!.at).toEqual(ip(6, 0));
    expect(flipPiece(flipped, 'P')!.board.P).toEqual(onBoard.board.P);
  });

  it('returns a board piece to the tray keeping its turn and side; Undo restores both', () => {
    const placed = placePiece(createSession(square), 'P', sol(square, 'P'))!;
    const back = returnToTray(placed, 'P')!;
    expect(back.board.P).toBeUndefined();
    expect(back.tray.P).toEqual({ r: square.solution.P.r, f: square.solution.P.f });
    const undone = undo(back)!;
    expect(undone.board.P).toEqual(placed.board.P);
    expect(undone.tray.P).toEqual({ r: 0, f: 0 });
    expect(returnToTray(createSession(square), 'P')).toBeNull();
  });

  it('records nothing for a drop that cannot be placed', () => {
    const session = createSession(square);
    const outside: Placement = { r: 0, f: 0, at: ip(-2, 0), pv: ip(-2, 0) };
    expect(placePiece(session, 'S1', outside)).toBeNull();
    const withSq = placePiece(session, 'SQ', { r: 0, f: 0, at: ip(0, 0), pv: ip(0, 0) })!;
    expect(placePiece(withSq, 'S1', { r: 0, f: 0, at: ip(0, 0), pv: ip(0, 0) })).toBeNull();
  });

  it('refuses a placement the rules cannot hold: odd rational parts, a pivot off the ticks', () => {
    const session = createSession(figureById('rectangle')!);
    expect(placePiece(session, 'S1', { r: 0, f: 0, at: ip(1, 0), pv: ip(1, 0) })).toBeNull();
    expect(placePiece(session, 'S1', { r: 0, f: 0, at: ip(0, 0), pv: ip(1, 0) })).toBeNull();
    expect(placePiece(session, 'S1', { r: 0, f: 0, at: ip(0, 0), pv: ip(2, 0) })).not.toBeNull();
    expect(placePiece(session, 'S1', { r: 0, f: 1, at: ip(0, 0), pv: ip(0, 0) })).toBeNull();
  });

  it('never moves a fixed piece, by any operation', () => {
    const session = createSession(medium);
    expect(rotatePiece(session, 'L1')).toBeNull();
    expect(flipPiece(session, 'P')).toBeNull();
    expect(returnToTray(session, 'L1')).toBeNull();
    expect(
      placePiece(session, 'P', { ...sol(medium, 'P'), at: ip(0, 0), pv: ip(0, 0) }),
    ).toBeNull();
    // Undo never takes them back either: they are not in any history entry's change.
    const placed = placePiece(session, 'S1', atVertex0(medium.solution.S1))!;
    expect(undo(placed)!.board.L1).toEqual(sol(medium, 'L1'));
    // ↻ keeps them, and empties the rest.
    const restarted = restartSession(withElapsedSeconds(placed, 30));
    expect(restarted.board).toEqual(session.board);
    expect(restarted.history).toEqual([]);
    expect(restarted.elapsedSeconds).toBe(0);
  });

  it('keeps at most UNDO_HISTORY_LIMIT steps, dropping the oldest', () => {
    let session = createSession(square);
    for (let k = 0; k < UNDO_HISTORY_LIMIT + 5; k++) session = rotatePiece(session, 'S2')!;
    expect(session.tray.S2.r).toBe((UNDO_HISTORY_LIMIT + 5) % 8); // 2005 turns: r = 5
    expect(session.history).toHaveLength(UNDO_HISTORY_LIMIT);
    expect(UNDO_HISTORY_LIMIT).toBe(2000);
    // Undo all 2,000: the five oldest turns were dropped, so five remain (r = 5, not 0).
    // Dropping the newest instead would leave r = 0 after the same Undos.
    for (let k = 0; k < UNDO_HISTORY_LIMIT; k++) session = undo(session)!;
    expect(canUndo(session)).toBe(false);
    expect(session.tray.S2.r).toBe(5);
  });
});

describe('completion (§1, §5「完成」)', () => {
  it('ends the figure when the seventh piece lands, with no Undo after', () => {
    const order = PIECE_IDS.slice(0, 6);
    const six = placeAll(square, order);
    expect(six.status).toBe('playing');
    const done = placePiece(six, 'S2', sol(square, 'S2'))!;
    expect(done.status).toBe('complete');
    expect(canUndo(done)).toBe(false);
    expect(undo(done)).toBeNull();
    expect(rotatePiece(done, 'S2')).toBeNull();
    expect(returnToTray(done, 'S2')).toBeNull();
  });

  // 5,040 orders, one case per first piece (720 each), so no case needs a wider timeout.
  it.each(PIECE_IDS)('completes the square in all 720 orders that start with %s', (first) => {
    let complete = 0;
    const rest = PIECE_IDS.filter((id) => id !== first);
    for (const order of permutations(rest)) {
      if (placeAll(square, [first, ...order]).status === 'complete') complete++;
    }
    expect(complete).toBe(720);
  });

  it('completes with the two large and the two small triangles swapped', () => {
    const s = square.solution;
    const swapped = { ...s, L1: s.L2, L2: s.L1, S1: s.S2, S2: s.S1 };
    expect(placeAll(square, PIECE_IDS, swapped).status).toBe('complete');
  });

  it('completes with the solution turned a quarter about the centre, and mirrored', () => {
    const centre = r2(2, 2);
    const quarter = mapSolution(square, (p) => ptAdd(centre, turn(ptSub(p, centre), 2)));
    expect(placeAll(square, PIECE_IDS, quarter).status).toBe('complete');
    const mirrored = mapSolution(square, (p) => [0 - p[0], 4 - p[1], p[2], p[3]]);
    expect(mirrored.P.f).toBe(1 - square.solution.P.f);
    expect(placeAll(square, PIECE_IDS, mirrored).status).toBe('complete');
  });

  it('completes the triangle with a dissection not congruent to the catalog’s (§1「別解」)', () => {
    // §13's other dissection of `triangle`, (a, b) meaning (a√2, b√2).
    const v = (...ab: number[]) => {
      const out: Pt[] = [];
      for (let i = 0; i < ab.length; i += 2) out.push(r2(ab[i]!, ab[i + 1]!));
      return out;
    };
    const other: Record<PieceId, readonly Pt[]> = {
      L1: v(4, 0, 4, 4, 6, 2),
      L2: v(4, 4, 6, 2, 8, 4),
      M: v(2, 4, 4, 2, 4, 4),
      P: v(3, 1, 3, 3, 4, 0, 4, 2),
      SQ: v(1, 3, 2, 2, 2, 4, 3, 3),
      S1: v(0, 4, 1, 3, 2, 4),
      S2: v(2, 2, 3, 1, 3, 3),
    };
    const poses = {} as Record<PieceId, Pose>;
    for (const id of PIECE_IDS) {
      const pose = poseFromVertices(id, other[id]);
      expect(pose, id).not.toBeNull();
      poses[id] = pose!;
    }
    const board = Object.fromEntries(PIECE_IDS.map((id) => [id, atVertex0(poses[id])]));
    expect(isCompleteBoard(triangle, board)).toBe(true);
    expect(placeAll(triangle, PIECE_IDS, poses).status).toBe('complete');
    // Not the catalog's dissection under any congruence: a congruence that maps the
    // outline onto itself is the identity or the mirror about x = 4√2, and the set of
    // piece polygons differs from the catalog's under both.
    const pieceSet = (all: Record<PieceId, Pose>, map: (p: Pt) => Pt = (p) => p) =>
      PIECE_IDS.map((id) =>
        poseVertices(id, all[id])
          .map(map)
          .map((p) => p.join())
          .sort()
          .join(' '),
      )
        .sort()
        .join(' | ');
    const mirror = (p: Pt): Pt => [0 - p[0], 8 - p[1], p[2], p[3]];
    const catalog = { ...triangle.solution };
    expect(pieceSet(poses)).not.toBe(pieceSet(catalog));
    expect(pieceSet(poses)).not.toBe(pieceSet(catalog, mirror));
    // (The mirror really is a symmetry of the outline.)
    expect(
      triangle.outline
        .map(mirror)
        .map((p) => p.join())
        .sort(),
    ).toEqual(triangle.outline.map((p) => p.join()).sort());
  });
});

describe('the keyboard alone (§4「キーボード」)', () => {
  /** Presses arrows from the tray lift point until the snap is the target pose; returns the presses. */
  function arrowsTo(session: TangramSession, id: PieceId, target: Pose): FloatPoint | null {
    const goal = centroidOf(id, target);
    const start = outlineCenter(session.figure.outline);
    const dx0 = Math.round(goal[0] - start[0]);
    const dy0 = Math.round(goal[1] - start[1]);
    for (let ex = -1; ex <= 1; ex++) {
      for (let ey = -1; ey <= 1; ey++) {
        let point = start;
        const nx = dx0 + ex;
        const ny = dy0 + ey;
        for (let k = 0; k < Math.abs(nx); k++) point = stepPoint(point, Math.sign(nx), 0);
        for (let k = 0; k < Math.abs(ny); k++) point = stepPoint(point, 0, Math.sign(ny));
        const out = keyboardSnap(session.figure.outline, session.board, id, target, point);
        if (
          out.placement &&
          poseVertices(id, out.placement).join() === poseVertices(id, target).join()
        ) {
          return point;
        }
      }
    }
    return null;
  }

  it('completes the square with arrows, turns and Enter only', () => {
    let session = createSession(square);
    const left = [...PIECE_IDS];
    let presses = 0;
    while (left.length > 0) {
      const index = left.findIndex((id) => arrowsTo(session, id, square.solution[id]) !== null);
      expect(index, `stuck with ${left.join(' ')}`).toBeGreaterThanOrEqual(0);
      const id = left.splice(index, 1)[0]!;
      const target = square.solution[id];
      // R presses to the target turn, F for the parallelogram's side, in the tray.
      for (let k = 0; k < target.r; k++) session = rotatePiece(session, id)!;
      if (target.f === 1) session = flipPiece(session, id)!;
      const point = arrowsTo(session, id, target)!;
      const out = keyboardSnap(session.figure.outline, session.board, id, target, point);
      session = placePiece(session, id, out.placement!)!; // Enter
      presses++;
    }
    expect(presses).toBe(7);
    expect(session.status).toBe('complete');
  });

  it('reaches a corner √2 away with one arrow and the snap', () => {
    // S1 lifted with its corner 0 at (√2, 0): the silhouette corner (0, 0) is √2 ≈ 1.41
    // away, which no whole number of 1-unit presses lands on exactly, and beyond the
    // 1-unit reach. One press left brings it within √2 − 1 ≈ 0.41, and the snap does the rest.
    const session = createSession(square);
    const o = { r: 0, f: 0 as const };
    const offset = centroidOf('S1', { ...o, at: ip(0, 0) });
    const lifted: FloatPoint = [offset[0] + Math.SQRT2, offset[1]];
    const before = keyboardSnap(square.outline, session.board, 'S1', o, lifted);
    expect(before.placement?.at).not.toEqual(ip(0, 0));
    const after = keyboardSnap(square.outline, session.board, 'S1', o, stepPoint(lifted, -1, 0));
    expect(after.via).toBe('vertex');
    expect(after.placement?.at).toEqual(ip(0, 0));
  });

  it('never pulls the provisional point to the snapped pose, so the arrows can leave it', () => {
    const rectangle = figureById('rectangle')!;
    const o = { r: 0, f: 0 as const };
    const snapAt = (point: FloatPoint) => keyboardSnap(rectangle.outline, {}, 'S1', o, point);
    // Independent: the point moves 1 unit a press; one press later the corner is
    // exactly 1 unit away (still within reach), two presses later it is free and the
    // edge snap takes it to the next tick along the edge (§4).
    let point = centroidOf('S1', { ...o, at: ip(0, 0) });
    const independent: string[] = [];
    for (let k = 0; k < 3; k++) {
      const out = snapAt(point);
      independent.push(`${out.via}/${out.target}/${out.placement?.at.join() ?? 'none'}`);
      point = stepPoint(point, 1, 0);
    }
    expect(independent).toEqual([
      'vertex/outline-vertex/0,0,0,0',
      'vertex/outline-vertex/0,0,0,0',
      'edge/outline-edge/2,0,0,0',
    ]);
    // Pulled back to the snapped pose after every press, it would never get away.
    let pulled = centroidOf('S1', { ...o, at: ip(0, 0) });
    for (let k = 0; k < 5; k++) {
      const placement = snapAt(stepPoint(pulled, 1, 0)).placement!;
      expect(placement.at).toEqual(ip(0, 0));
      pulled = centroidOf('S1', placement);
    }
  });
});

// Only that the snap query is pure (it never sees the session). §8「手にある駒」 itself —
// a save mid-drag or mid-lift is the pose before lifting — is UI state, and Phase 3's
// Root test checks it.
describe('the snap query is pure (for §8「手にある駒」)', () => {
  it('asks the snap without changing the session or its record', () => {
    const session = placePiece(createSession(square), 'L1', sol(square, 'L1'))!;
    const record = JSON.stringify(toRecord(session));
    keyboardSnap(square.outline, session.board, 'L1', { r: 3, f: 0 }, [2, 2]);
    expect(JSON.stringify(toRecord(session))).toBe(record);
    expect(session.history).toHaveLength(1);
  });
});

describe('the record (§8)', () => {
  const base = () => {
    const session = withElapsedSeconds(
      placePiece(
        placePiece(createSession(square), 'L1', sol(square, 'L1'))!,
        'S1',
        sol(square, 'S1'),
      )!,
      42.7,
    );
    return JSON.parse(JSON.stringify(toRecord(session))) as Record<string, unknown>;
  };

  it('round-trips through JSON to the same board and clock', () => {
    const session = withElapsedSeconds(placeAll(medium, ['S1', 'S2']), 12);
    const restored = restoreSession(JSON.parse(JSON.stringify(toRecord(session))));
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.session.board).toEqual(session.board);
    expect(restored.session.elapsedSeconds).toBe(12);
    expect(restored.session.history).toEqual([]);
    expect(restored.session.tray).toEqual(createSession(medium).tray);
    // Medium's fixed pieces are not written.
    expect(Object.keys(toRecord(session).pieces)).toEqual(['S1', 'S2']);
  });

  it('round-trips a daily', () => {
    const session = placePiece(createDailySession('2026-10-21')!, 'S1', {
      ...sol(dailyFigure('2026-10-21')!, 'S1'),
    })!;
    const restored = restoreSession(JSON.parse(JSON.stringify(toRecord(session))));
    expect(restored.ok && restored.session.dailyDate).toBe('2026-10-21');
  });

  const reject = (mutate: (r: Record<string, unknown>) => unknown) => {
    const record = base();
    const value = mutate(record) ?? record;
    const out = restoreSession(value);
    return out.ok ? 'accepted' : out.reason;
  };
  const piece = (r: Record<string, unknown>) =>
    (r.pieces as Record<string, Record<string, unknown>>).L1!;
  const stored = (r: Record<string, unknown>, id: string) =>
    (r.pieces as Record<string, { at: number[] }>)[id]!;
  const restoreOk = (value: unknown): TangramSession => {
    const out = restoreSession(value);
    if (!out.ok) throw new Error(`refused: ${out.reason}`);
    return out.session;
  };

  it('accepts the unmodified record', () => {
    expect(reject(() => undefined)).toBe('accepted');
  });

  it('refuses what is not a record', () => {
    for (const value of [null, 3, 'x', [], undefined]) {
      const out = restoreSession(value);
      expect(out.ok ? 'accepted' : out.reason).toBe('not-a-record');
    }
  });

  it('ignores fields it does not know, in the record and in a piece', () => {
    const record = base();
    record.extra = { anything: [1, 2, 3] };
    piece(record).note = 'kept nowhere';
    const session = restoreOk(record);
    expect(Object.keys(session.board.L1!).sort()).toEqual(['at', 'f', 'pv', 'r']);
    expect(JSON.stringify(toRecord(session))).toBe(JSON.stringify(toRecord(restoreOk(base()))));
  });

  it('reads a coordinate stored as −0 as 0', () => {
    // JSON.parse('-0') is −0; the decoder turns it into 0 so equality and keys agree.
    const record = JSON.parse(
      '{"mode":"free","tier":"easy","figure":"square","dailyDate":null,' +
        '"pieces":{"S1":{"r":7,"f":0,"at":[-0,3,-0,1],"pv":[-0,4,-0,0]}},"elapsedSeconds":-0}',
    ) as Record<string, unknown>;
    expect(Object.is(stored(record, 'S1').at[0], -0)).toBe(true);
    const session = restoreOk(record);
    const s1 = session.board.S1!;
    for (const v of [...s1.at, ...s1.pv]) expect(Object.is(v, -0)).toBe(false);
    expect(Object.is(s1.at[0], 0)).toBe(true);
    expect(Object.is(session.elapsedSeconds, 0)).toBe(true);
  });

  it('turns an exception inside the check into not-a-record, never a throw', () => {
    const getter = base();
    Object.defineProperty(getter, 'pieces', {
      get() {
        throw new Error('broken getter');
      },
    });
    const proxy = base();
    proxy.pieces = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('broken proxy');
        },
      },
    );
    for (const value of [getter, proxy]) {
      expect(() => restoreSession(value)).not.toThrow();
      expect(restoreSession(value)).toEqual({ ok: false, reason: 'not-a-record' });
    }
  });

  it('refuses bad modes, tiers and dates (bad-mode)', () => {
    expect(reject((r) => void (r.mode = 'zen'))).toBe('bad-mode');
    expect(reject((r) => void (r.tier = 'expert'))).toBe('bad-mode');
    expect(reject((r) => void (r.dailyDate = '2026-10-21'))).toBe('bad-mode');
    expect(reject((r) => void ((r.mode = 'daily'), (r.dailyDate = null)))).toBe('bad-mode');
    expect(reject((r) => void ((r.mode = 'daily'), (r.dailyDate = '2026-10-21')))).toBe('bad-mode'); // tier easy
    expect(
      reject((r) => void ((r.mode = 'daily'), (r.tier = 'medium'), (r.dailyDate = '2026-02-30'))),
    ).toBe('bad-mode');
  });

  it('refuses unknown figures and a tier that is not the figure’s (unknown-figure)', () => {
    expect(reject((r) => void (r.figure = 'toString'))).toBe('unknown-figure');
    expect(reject((r) => void (r.figure = 'gone'))).toBe('unknown-figure');
    expect(reject((r) => void (r.tier = 'hard'))).toBe('unknown-figure');
  });

  it('refuses a daily on a figure that is not its date’s (wrong-daily-figure)', () => {
    const date = '2026-10-21';
    const wrong = figuresOf('medium').find((f) => f !== dailyFigure(date))!;
    const out = restoreSession({
      mode: 'daily',
      tier: 'medium',
      figure: wrong.id,
      dailyDate: date,
      pieces: {},
      elapsedSeconds: 0,
    });
    expect(out.ok ? 'accepted' : out.reason).toBe('wrong-daily-figure');
  });

  it('refuses malformed pieces (bad-piece)', () => {
    expect(reject((r) => void (r.pieces = []))).toBe('bad-piece');
    expect(reject((r) => void ((r.pieces as Record<string, unknown>).X = piece(r)))).toBe(
      'bad-piece',
    );
    expect(reject((r) => void (piece(r).r = 8))).toBe('bad-piece');
    expect(reject((r) => void (piece(r).r = 1.5))).toBe('bad-piece');
    expect(reject((r) => void (piece(r).f = 1))).toBe('bad-piece'); // L1 cannot flip
    expect(reject((r) => void (piece(r).at = [0, 2, 0]))).toBe('bad-piece');
    expect(reject((r) => void (piece(r).at = [0, 2, 0, '2']))).toBe('bad-piece');
    expect(reject((r) => void (piece(r).at = [258, 2, 0, 2]))).toBe('bad-piece');
    // `at` with an odd rational part: no snap produces it.
    expect(
      reject((r) => {
        piece(r).at = [1, 2, 0, 2];
        piece(r).pv = [1, 2, 0, 2];
      }),
    ).toBe('bad-piece');
    // A pivot 1 unit along an axis edge: on the boundary, but not a tick (SQ r=0 at
    // (0, 2√2), its top edge running right from there).
    expect(
      reject((r) => {
        delete (r.pieces as Record<string, unknown>).S1;
        (r.pieces as Record<string, unknown>).SQ = {
          r: 0,
          f: 0,
          at: [0, 0, 0, 2],
          pv: [1, 0, 0, 2],
        };
      }),
    ).toBe('bad-piece');
    // The same square with a lawful pivot is accepted.
    expect(
      reject((r) => {
        delete (r.pieces as Record<string, unknown>).S1;
        (r.pieces as Record<string, unknown>).SQ = {
          r: 0,
          f: 0,
          at: [0, 0, 0, 2],
          pv: [2, 0, 0, 2],
        };
      }),
    ).toBe('accepted');
  });

  it('refuses a fixed piece in the record (fixed-piece)', () => {
    const session = placeAll(medium, ['S1']);
    const record = JSON.parse(JSON.stringify(toRecord(session))) as Record<string, unknown>;
    (record.pieces as Record<string, unknown>).L1 = {
      ...sol(medium, 'L1'),
      at: [...sol(medium, 'L1').at],
      pv: [...sol(medium, 'L1').pv],
    };
    const out = restoreSession(record);
    expect(out.ok ? 'accepted' : out.reason).toBe('fixed-piece');
  });

  it('refuses a piece outside the silhouette (outside) and two that overlap (overlap)', () => {
    expect(
      reject((r) => {
        piece(r).at = [-2, 2, 0, 2];
        piece(r).pv = [-2, 2, 0, 2];
      }),
    ).toBe('outside');
    expect(
      reject((r) => {
        (r.pieces as Record<string, unknown>).L2 = { ...piece(r) };
      }),
    ).toBe('overlap');
  });

  it('refuses a finished board (finished) and a bad clock (bad-elapsed)', () => {
    const six = placeAll(square, PIECE_IDS.slice(0, 6));
    const record = JSON.parse(JSON.stringify(toRecord(six))) as Record<string, unknown>;
    (record.pieces as Record<string, unknown>).S2 = {
      ...square.solution.S2,
      at: [...square.solution.S2.at],
      pv: [...square.solution.S2.at],
    };
    const out = restoreSession(record);
    expect(out.ok ? 'accepted' : out.reason).toBe('finished');
    expect(reject((r) => void (r.elapsedSeconds = -1))).toBe('bad-elapsed');
    expect(reject((r) => void (r.elapsedSeconds = 1.5))).toBe('bad-elapsed');
    expect(reject((r) => void (r.elapsedSeconds = 1e9 + 1))).toBe('bad-elapsed');
    expect(reject((r) => void (r.elapsedSeconds = '3'))).toBe('bad-elapsed');
  });

  it('writes the clock as whole seconds within range', () => {
    expect(base().elapsedSeconds).toBe(42);
    expect(toRecord(withElapsedSeconds(createSession(square), -3)).elapsedSeconds).toBe(0);
    expect(toRecord(withElapsedSeconds(createSession(square), Number.NaN)).elapsedSeconds).toBe(0);
    expect(toRecord(withElapsedSeconds(createSession(square), 5e9)).elapsedSeconds).toBe(1e9);
  });
});
