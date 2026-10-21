/**
 * Seeded property tests (docs/TANGRAM_RULES.md §5, §3, §8, §13): random
 * wishes for the snap, random operation sequences for the session, random
 * damage for the record. Each run is fixed by its seed, so a failure replays.
 */
import { describe, expect, it } from 'vitest';
import { FIGURES, type Figure } from './catalog';
import { convexInside, convexOverlap } from './geometry';
import {
  canFlip,
  orientedShape,
  PIECE_IDS,
  poseVertices,
  type Orientation,
  type PieceId,
} from './pieces';
import { createRng } from './rng';
import {
  createSession,
  flipPiece,
  isLawfulPlacement,
  placePiece,
  restoreSession,
  returnToTray,
  rotatePiece,
  toRecord,
  undo,
  type RestoreRejection,
  type TangramSession,
} from './session';
import { isPlaceable, SNAP_EPS, snapPose, type BoardPieces, type Placement } from './snap';
import { ptSub, ptToFloat } from './z2';

const pick = <T>(rng: () => number, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)]!;

function randomBoard(rng: () => number, figure: Figure, exclude: PieceId): BoardPieces {
  const board: Partial<Record<PieceId, Placement>> = {};
  for (const id of PIECE_IDS) {
    if (id !== exclude && rng() < 0.5)
      board[id] = { ...figure.solution[id], pv: figure.solution[id].at };
  }
  return board;
}

function randomOrientation(rng: () => number, id: PieceId): Orientation {
  return { r: Math.floor(rng() * 8), f: canFlip(id) && rng() < 0.5 ? 1 : 0 };
}

function assertBoardValid(figure: Figure, board: BoardPieces) {
  const ids = PIECE_IDS.filter((id) => board[id]);
  const polygons = ids.map((id) => poseVertices(id, board[id]!));
  ids.forEach((id, i) => {
    expect(convexInside(polygons[i]!, figure.outline), id).toBe(true);
    expect(isLawfulPlacement(id, board[id]!), id).toBe(true);
  });
  for (let i = 0; i < polygons.length; i++) {
    for (let j = i + 1; j < polygons.length; j++) {
      expect(convexOverlap(polygons[i]!, polygons[j]!)).toBe(false);
    }
  }
}

/**
 * One case per seed — each is independent, deterministic and well under a
 * second — so no case leans on a wider timeout (docs/ARCHITECTURE.md「CI /
 * リリース」). The counts add up across the cases for the last one to check.
 */
const SNAP_SEEDS = ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => `tangram-snap-property-${s}`);
const WISHES_PER_SEED = 500;
let snapped = 0;
let viaEdge = 0;

describe('the snap, on random wishes (§5)', () => {
  it.each(SNAP_SEEDS)(
    'returns only lawful, placeable poses within reach, nearest vertex candidates first, deterministically (%s)',
    (seed) => {
      const rng = createRng(seed);
      for (let trial = 0; trial < WISHES_PER_SEED; trial++) {
        const figure = pick(rng, FIGURES);
        const id = pick(rng, PIECE_IDS);
        const board = randomBoard(rng, figure, id);
        const target = figure.solution[id];
        const orientation = rng() < 0.7 ? { r: target.r, f: target.f } : randomOrientation(rng, id);
        const [tx, ty] = ptToFloat(target.at);
        // Half the wishes near the solution, half anywhere over the silhouette's box.
        const at: [number, number] =
          rng() < 0.5
            ? [tx + (rng() - 0.5) * 3, ty + (rng() - 0.5) * 3]
            : [rng() * 14 - 1, rng() * 14 - 1];
        const tolerance = 0.2 + rng() * 0.8;
        const query = { id, orientation, at, tolerance };
        const out = snapPose(figure.outline, board, query, 10_000);
        expect(snapPose(figure.outline, board, query, 10_000)).toEqual(out);
        expect(out.exhausted).toBe(false);

        // An independent vertex phase: every corner-onto-corner pose within reach.
        const shape = orientedShape(id, orientation);
        const targets = [...figure.outline];
        for (const other of PIECE_IDS) {
          if (other !== id && board[other]) targets.push(...poseVertices(other, board[other]!));
        }
        let bestVertex = Infinity;
        for (const v of shape) {
          for (const t of targets) {
            const candidate = ptSub(t, v);
            const [cx, cy] = ptToFloat(candidate);
            const d2 = (cx - at[0]) ** 2 + (cy - at[1]) ** 2;
            if (d2 > tolerance * tolerance + SNAP_EPS) continue;
            if (isPlaceable(figure.outline, board, id, { ...orientation, at: candidate })) {
              bestVertex = Math.min(bestVertex, d2);
            }
          }
        }

        if (!out.placement) {
          expect(bestVertex).toBe(Infinity);
          continue;
        }
        snapped++;
        const p = out.placement;
        expect(p.r).toBe(orientation.r);
        expect(p.f).toBe(orientation.f);
        expect(isLawfulPlacement(id, p)).toBe(true);
        expect(isPlaceable(figure.outline, board, id, p)).toBe(true);
        const [px, py] = ptToFloat(p.at);
        const d2 = (px - at[0]) ** 2 + (py - at[1]) ** 2;
        expect(d2).toBeLessThanOrEqual(tolerance * tolerance + SNAP_EPS);
        if (bestVertex < Infinity) {
          expect(out.via).toBe('vertex');
          expect(d2).toBeLessThanOrEqual(bestVertex + SNAP_EPS);
        } else {
          expect(out.via).toBe('edge');
          viaEdge++;
        }
      }
    },
  );

  it('exercised both phases across the seeds', () => {
    console.info(
      `snap property: ${SNAP_SEEDS.length * WISHES_PER_SEED} wishes, ${snapped} snapped ` +
        `(${viaEdge} by the edge phase)`,
    );
    expect(snapped).toBeGreaterThan(200);
    expect(viaEdge).toBeGreaterThan(40);
  });
});

describe('the session, on random operation sequences (§3)', () => {
  it('keeps the board lawful, Undo exact, and every record restorable', () => {
    const rng = createRng('tangram-session-property');
    let operations = 0;
    let completions = 0;
    for (let game = 0; game < 60; game++) {
      const figure = pick(rng, FIGURES);
      let session: TangramSession = createSession(figure);
      const fixedBoard = session.board;
      const past: TangramSession[] = [];
      for (let step = 0; step < 40 && session.status === 'playing'; step++) {
        const id = pick(rng, PIECE_IDS);
        const roll = rng();
        let next: TangramSession | null = null;
        if (roll < 0.5) {
          // A drop: near the solution pose most of the time, so figures do get finished.
          const sol = figure.solution[id];
          const orientation = rng() < 0.7 ? { r: sol.r, f: sol.f } : randomOrientation(rng, id);
          const [tx, ty] = ptToFloat(sol.at);
          const out = snapPose(figure.outline, session.board, {
            id,
            orientation,
            at: [tx + (rng() - 0.5) * 1.2, ty + (rng() - 0.5) * 1.2],
            tolerance: 0.6,
          });
          if (out.placement) next = placePiece(session, id, out.placement);
        } else if (roll < 0.65) next = rotatePiece(session, id);
        else if (roll < 0.72) next = flipPiece(session, id);
        else if (roll < 0.85) next = returnToTray(session, id);
        else {
          next = undo(session);
          if (next) {
            const previous = past.pop()!;
            expect(next.board).toEqual(previous.board);
            expect(next.tray).toEqual(previous.tray);
            session = next;
            continue;
          }
        }
        if (!next) continue;
        operations++;
        past.push(session);
        session = next;
        assertBoardValid(figure, session.board);
        for (const fixed of figure.fixed) expect(session.board[fixed]).toEqual(fixedBoard[fixed]);
        if (session.status === 'complete') {
          completions++;
          break;
        }
        const restored = restoreSession(JSON.parse(JSON.stringify(toRecord(session))));
        expect(restored.ok).toBe(true);
        if (restored.ok) expect(restored.session.board).toEqual(session.board);
      }
    }
    console.info(`session property: 60 games, ${operations} operations, ${completions} completed`);
    expect(operations).toBeGreaterThan(300);
    expect(completions).toBeGreaterThan(0);
  });
});

describe('the record, under random damage (§8 fail-closed)', () => {
  const REASONS: readonly RestoreRejection[] = [
    'not-a-record',
    'bad-mode',
    'unknown-figure',
    'wrong-daily-figure',
    'bad-piece',
    'fixed-piece',
    'outside',
    'overlap',
    'finished',
    'bad-elapsed',
  ];
  const JUNK: readonly unknown[] = [
    null,
    undefined,
    0,
    -0,
    1.5,
    -1,
    257,
    'x',
    '',
    true,
    [],
    {},
    [0, 0, 0],
    [1, 0, 0, 0],
    [0, 0, 0, 0],
    'toString',
    '__proto__',
    Number.NaN,
  ];

  it('never throws, names a known reason, and restores only lawful boards', () => {
    const rng = createRng('tangram-record-damage');
    const counts = new Map<string, number>();
    for (let trial = 0; trial < 3000; trial++) {
      const figure = pick(rng, FIGURES);
      let session = createSession(figure);
      for (const id of PIECE_IDS) {
        if (rng() < 0.4 && !figure.fixed.includes(id)) {
          session =
            placePiece(session, id, { ...figure.solution[id], pv: figure.solution[id].at }) ??
            session;
        }
      }
      if (session.status === 'complete') continue;
      const record = JSON.parse(JSON.stringify(toRecord(session))) as Record<string, unknown>;
      // One to three random changes, anywhere in the record.
      for (let k = 1 + Math.floor(rng() * 3); k > 0; k--) {
        const pieces = record.pieces as Record<string, Record<string, unknown>> | undefined;
        const keys = Object.keys(record);
        const roll = rng();
        if (roll < 0.4 && pieces && typeof pieces === 'object' && Object.keys(pieces).length > 0) {
          const piece = pieces[pick(rng, Object.keys(pieces))];
          if (typeof piece !== 'object' || piece === null) continue;
          const field = pick(rng, ['r', 'f', 'at', 'pv']);
          if ((field === 'at' || field === 'pv') && Array.isArray(piece[field]) && rng() < 0.6) {
            const arr = [...(piece[field] as number[])];
            arr[Math.floor(rng() * 4)]! += pick(rng, [-2, -1, 1, 2, 64]);
            piece[field] = arr;
          } else piece[field] = pick(rng, JUNK);
        } else if (roll < 0.55 && pieces && typeof pieces === 'object') {
          pieces[pick(rng, [...PIECE_IDS, 'X'])] = {
            r: Math.floor(rng() * 9),
            f: pick(rng, [0, 1]),
            at: [
              2 * Math.floor(rng() * 6),
              Math.floor(rng() * 6),
              2 * Math.floor(rng() * 6),
              Math.floor(rng() * 6),
            ],
            pv: [0, 0, 0, 0],
          };
        } else {
          record[pick(rng, keys)] = pick(rng, JUNK);
        }
      }
      const out = restoreSession(record);
      const label = out.ok ? 'ok' : out.reason;
      counts.set(label, (counts.get(label) ?? 0) + 1);
      if (out.ok) {
        assertBoardValid(out.session.figure, out.session.board);
        expect(out.session.status).toBe('playing');
        expect(PIECE_IDS.every((id) => out.session.board[id])).toBe(false);
      } else {
        expect(REASONS).toContain(out.reason);
      }
    }
    console.info(
      `record damage: ${[...counts.entries()]
        .sort()
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')}`,
    );
    expect(restoreSession(Object.create(null))).toEqual({ ok: false, reason: 'bad-mode' });
  });
});
