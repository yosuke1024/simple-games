/**
 * What must never change silently (docs/TANGRAM_RULES.md §2, §5, §6, §8).
 *
 * A save names figures by id and stores exact poses, so the piece shapes,
 * the vertex order a pose is measured from, the turn's direction and the
 * catalog's coordinates are all part of every saved game. The tier lists'
 * order is what the numbers on screen and the daily's walk rest on. The
 * snap's order decides where a drop lands. This pins all of it; do not edit
 * these strings to go green. During the web beta an intended change may
 * reset saves only with the notice WEB_VERSION.md「先行公開」requires (§8);
 * say so in the commit message.
 */
import { describe, expect, it } from 'vitest';
import { DAILY_STRIDE, dailyFigure, figureById, figuresOf } from './catalog';
import { KEYBOARD_STEP, KEYBOARD_TOLERANCE } from './keyboard';
import { LOCAL_SHAPES, PIECE_IDS, poseVertices, type PieceId } from './pieces';
import {
  createSession,
  flipPiece,
  placePiece,
  returnToTray,
  rotatePiece,
  toRecord,
  undo,
  UNDO_HISTORY_LIMIT,
  withElapsedSeconds,
  type TangramSession,
} from './session';
import { COORD_LIMIT, localPivot, SNAP_CHECK_LIMIT, SNAP_EPS, snapPose } from './snap';
import { ptEq, type Pt } from './z2';

/** A point as the rules' tables write it: (a, b) for whole a, b; (ar, br) for a√2, b√2. */
const show = (p: Pt): string => {
  const part = (a: number, b: number) =>
    b === 0 ? `${a}` : a === 0 ? `${b === 1 ? '' : b}r` : `${a}${b > 0 ? '+' : ''}${b}r`;
  return `(${part(p[0], p[1])}, ${part(p[2], p[3])})`;
};

describe('pieces and constants that must never change (§4, §5)', () => {
  it('keeps the seven local shapes and their order', () => {
    expect(
      PIECE_IDS.map((id) => `${id}: ${LOCAL_SHAPES[id].map(show).join(' ')}`).join(' / '),
    ).toBe(
      'L1: (0, 0) (4, 0) (0, 4) / L2: (0, 0) (4, 0) (0, 4) / M: (0, 0) (2r, 0) (0, 2r) / ' +
        'P: (0, 0) (2, 0) (4, 2) (2, 2) / SQ: (0, 0) (2, 0) (2, 2) (0, 2) / ' +
        'S1: (0, 0) (2, 0) (0, 2) / S2: (0, 0) (2, 0) (0, 2)',
    );
  });

  it('keeps the limits', () => {
    expect({
      SNAP_CHECK_LIMIT,
      SNAP_EPS,
      COORD_LIMIT,
      DAILY_STRIDE,
      UNDO_HISTORY_LIMIT,
      KEYBOARD_STEP,
      KEYBOARD_TOLERANCE,
    }).toEqual({
      SNAP_CHECK_LIMIT: 32,
      SNAP_EPS: 1e-9,
      COORD_LIMIT: 256,
      DAILY_STRIDE: 7919,
      UNDO_HISTORY_LIMIT: 2000,
      KEYBOARD_STEP: 1,
      KEYBOARD_TOLERANCE: 1,
    });
  });
});

describe('the catalog that must never change silently (§2)', () => {
  it('keeps each tier’s list in order', () => {
    expect(
      figuresOf('easy')
        .map((f) => f.id)
        .join(' '),
    ).toBe(
      'square triangle parallelogram rectangle trapezoid right-trapezoid wide-trapezoid ' +
        'house pentagon hexagon hexagon-b hexagon-c hexagon-d',
    );
    expect(
      figuresOf('medium')
        .map((f) => f.id)
        .join(' '),
    ).toBe('corner arrow crown pencil fish tree boat cup signpost tub shirt fork');
    expect(
      figuresOf('hard')
        .map((f) => f.id)
        .join(' '),
    ).toBe('mushroom ship heron goose lamp rabbit candle bird fox');
  });

  it('keeps the square’s solution as §2’s table writes it', () => {
    const square = figureById('square')!;
    expect(square.outline.map(show).join(' ')).toBe('(0, 0) (4r, 0) (4r, 4r) (0, 4r)');
    const table: Record<PieceId, string> = {
      L1: '(0, 0) (4r, 0) (2r, 2r)',
      L2: '(0, 0) (2r, 2r) (0, 4r)',
      M: '(4r, 4r) (4r, 2r) (2r, 4r)',
      SQ: '(2r, 2r) (3r, r) (4r, 2r) (3r, 3r)',
      S1: '(3r, r) (4r, 0) (4r, 2r)',
      S2: '(r, 3r) (2r, 2r) (3r, 3r)',
      P: '(0, 4r) (r, 3r) (3r, 3r) (2r, 4r)',
    };
    for (const id of PIECE_IDS) {
      const got = poseVertices(id, square.solution[id]).map(show).sort();
      expect(got, id).toEqual(table[id].match(/\([^)]*\)/g)!.sort());
    }
  });

  it('keeps the Phase 0 triangle and parallelogram outlines (§2 の表)', () => {
    expect(figureById('triangle')!.outline.map(show).join(' ')).toBe('(4r, 0) (8r, 4r) (0, 4r)');
    expect(figureById('parallelogram')!.outline.map(show).join(' ')).toBe(
      '(4r, 0) (8r, 0) (4r, 4r) (0, 4r)',
    );
  });

  it('keeps every figure’s coordinates (a fingerprint of the whole catalog)', () => {
    let h = 0;
    const text = figuresOf('easy')
      .concat(figuresOf('medium'), figuresOf('hard'))
      .map(
        (f) =>
          `${f.id}:${f.outline.map((p) => p.join(',')).join(';')}:` +
          PIECE_IDS.map(
            (id) => `${f.solution[id].r}${f.solution[id].f}${f.solution[id].at.join(',')}`,
          ).join(';'),
      )
      .join('|');
    for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
    expect({ length: text.length, hash: h >>> 0 }).toEqual(CATALOG_FINGERPRINT);
  });
});

describe('dailies that must never change silently (§6)', () => {
  it('deals these figures on these dates', () => {
    const dates = [
      '1970-01-01',
      '2026-10-21',
      '2026-10-22',
      '2026-12-31',
      '2027-01-01',
      '2030-06-15',
    ];
    expect(dates.map((d) => `${d} ${dailyFigure(d)?.id}`)).toEqual([
      '1970-01-01 corner',
      '2026-10-21 arrow',
      '2026-10-22 corner',
      '2026-12-31 crown',
      '2027-01-01 arrow',
      '2030-06-15 corner',
    ]);
  });
});

describe('a fixed input sequence gives a fixed board (§3, §5)', () => {
  it('snaps, turns, flips, returns and undoes to the same record', () => {
    const square = figureById('square')!;
    let session: TangramSession = createSession(square);
    const drop = (id: PieceId, r: number, f: 0 | 1, x: number, y: number) => {
      const out = snapPose(session.figure.outline, session.board, {
        id,
        orientation: { r, f },
        at: [x, y],
        tolerance: 0.6,
      });
      const next = out.placement ? placePiece(session, id, out.placement) : null;
      if (next) session = next;
      return out.placement ? `${id}@${out.via}` : `${id}:none`;
    };
    const log = [
      drop('L1', 5, 0, 3.0, 2.7),
      drop('L2', 3, 0, 2.6, 3.0),
      drop('S1', 7, 0, 4.1, 1.5),
      drop('SQ', 1, 0, 4.4, 1.3),
      drop('M', 4, 0, 5.5, 5.5),
      drop('P', 3, 0, 4.2, 4.1),
      drop('S2', 6, 0, 9, 9), // nowhere near: no snap
    ];
    const s1 = rotatePiece(session, 'S1');
    if (s1) session = s1;
    const p = flipPiece(session, 'P');
    if (p) session = p;
    const back = returnToTray(session, 'M');
    if (back) session = back;
    session = undo(session) ?? session;
    session = withElapsedSeconds(session, 61);
    expect(log.join(' ')).toBe(FIXED_SEQUENCE_LOG);
    expect(JSON.stringify(toRecord(session))).toBe(FIXED_SEQUENCE_RECORD);
  });

  it('snaps to edge ticks the same way every time, and a turn with no room leaves the piece', () => {
    const rectangle = figureById('rectangle')!;
    let session: TangramSession = createSession(rectangle);
    const steps: string[] = [];
    const drop = (id: PieceId, r: number, x: number, y: number, tolerance: number) => {
      const out = snapPose(session.figure.outline, session.board, {
        id,
        orientation: { r, f: 0 },
        at: [x, y],
        tolerance,
      });
      if (out.placement) session = placePiece(session, id, out.placement) ?? session;
      steps.push(out.placement ? `${id}@${out.via}:${out.placement.at.join(',')}` : `${id}:none`);
    };
    drop('S1', 0, 1, 0.1, 0.9);
    drop('SQ', 0, 3.2, 0.2, 0.9);
    drop('M', 2, 7.6, 0.3, 0.9);
    const turned = rotatePiece(session, 'S1');
    steps.push(turned ? 'S1 turned' : 'S1 stays');
    if (turned) session = turned;
    expect(steps.join(' ')).toBe(EDGE_SEQUENCE_LOG);
    expect(JSON.stringify(toRecord(session))).toBe(EDGE_SEQUENCE_RECORD);
  });

  it('turns and flips about a tick of the piece’s own edge (edge snap (b)) the same way every time', () => {
    // Found by a search and pinned: on `mushroom`, P wished here is taken by edge snap (b)
    // — the silhouette corner onto the tick 2 units along P's edge from corner 0 — so the
    // pivot is that tick, not a corner of P. A turn and a flip both have room.
    const mushroom = figureById('mushroom')!;
    let session: TangramSession = createSession(mushroom);
    const out = snapPose(mushroom.outline, session.board, {
      id: 'P',
      orientation: { r: 0, f: 0 },
      at: [1.5, 1.5],
      tolerance: 0.9,
    });
    const placement = out.placement!;
    const local = localPivot(placement)!;
    expect(LOCAL_SHAPES.P.some((v) => ptEq(v, local))).toBe(false);
    const steps = [
      `P@${out.via}/${out.target}:${placement.at.join(',')} pv ${placement.pv.join(',')}`,
    ];
    session = placePiece(session, 'P', placement)!;
    const turned = rotatePiece(session, 'P');
    steps.push(turned ? `turned:${turned.board.P!.at.join(',')}` : 'stays');
    if (turned) session = turned;
    const flipped = flipPiece(session, 'P');
    steps.push(flipped ? `flipped:${flipped.board.P!.at.join(',')}` : 'stays');
    if (flipped) session = flipped;
    expect(session.board.P!.pv).toEqual(placement.pv);
    expect(steps.join(' ')).toBe(PIVOT_TICK_LOG);
    expect(JSON.stringify(toRecord(session))).toBe(PIVOT_TICK_RECORD);
  });
});

describe('the record that must never change silently (§8)', () => {
  it('writes §8’s example exactly (square, L1 and S1 placed, 42 s)', () => {
    const square = figureById('square')!;
    let session = createSession(square);
    session = placePiece(session, 'L1', { ...square.solution.L1, pv: [0, 0, 0, 0] })!;
    session = placePiece(session, 'S1', { ...square.solution.S1, pv: [0, 4, 0, 0] })!;
    session = withElapsedSeconds(session, 42);
    expect(JSON.stringify(toRecord(session))).toBe(
      '{"mode":"free","tier":"easy","figure":"square","dailyDate":null,' +
        '"pieces":{"L1":{"r":5,"f":0,"at":[0,2,0,2],"pv":[0,0,0,0]},' +
        '"S1":{"r":7,"f":0,"at":[0,3,0,1],"pv":[0,4,0,0]}},"elapsedSeconds":42}',
    );
  });
});

const CATALOG_FINGERPRINT = { length: 4710, hash: 2452439328 };
const FIXED_SEQUENCE_LOG = 'L1@vertex L2@vertex S1@vertex SQ@vertex M@vertex P@vertex S2:none';
const FIXED_SEQUENCE_RECORD =
  '{"mode":"free","tier":"easy","figure":"square","dailyDate":null,"pieces":{"L1":{"r":5,"f":0,"at":[0,2,0,2],"pv":[0,0,0,0]},"L2":{"r":3,"f":0,"at":[0,2,0,2],"pv":[0,2,0,2]},"M":{"r":4,"f":0,"at":[0,4,0,4],"pv":[0,4,0,4]},"P":{"r":3,"f":0,"at":[0,3,0,3],"pv":[0,3,0,3]},"SQ":{"r":1,"f":0,"at":[0,3,0,1],"pv":[0,3,0,1]},"S1":{"r":7,"f":0,"at":[0,3,0,1],"pv":[0,4,0,0]}},"elapsedSeconds":61}';
const EDGE_SEQUENCE_LOG = 'S1@edge:4,-2,0,0 SQ@vertex:6,-2,0,0 M@vertex:8,0,0,0 S1 stays';
const EDGE_SEQUENCE_RECORD =
  '{"mode":"free","tier":"easy","figure":"rectangle","dailyDate":null,"pieces":{"M":{"r":2,"f":0,"at":[8,0,0,0],"pv":[8,0,0,0]},"SQ":{"r":0,"f":0,"at":[6,-2,0,0],"pv":[6,-2,0,0]},"S1":{"r":0,"f":0,"at":[4,-2,0,0],"pv":[4,-2,0,0]}},"elapsedSeconds":0}';
const PIVOT_TICK_LOG =
  'P@edge/outline-vertex:-2,3,0,1 pv -2,4,0,2 turned:-2,4,-2,2 flipped:0,4,0,2';
const PIVOT_TICK_RECORD =
  '{"mode":"free","tier":"hard","figure":"mushroom","dailyDate":null,"pieces":{"P":{"r":1,"f":1,"at":[0,4,0,2],"pv":[-2,4,0,2]}},"elapsedSeconds":0}';
