/**
 * Helpers for Tangram's tests only (nothing in ui/, state/ or storage/ uses
 * them; index.ts does not export them).
 */
import { LOCAL_SHAPES, orient, PIECE_IDS, poseVertices, type PieceId, type Pose } from './pieces';
import type { BoardPieces, Placement } from './snap';
import { ptKey, ptSub, type Pt } from './z2';

/** A point written in √2 units: (a·√2, b·√2). */
export const r2 = (a: number, b: number): Pt => [0, a, 0, b];
/** A point with rational coordinates only. */
export const ip = (x: number, y: number): Pt => [x, 0, y, 0];

/** The pose (if any) that puts piece `id` exactly on these vertices, in any order. */
export function poseFromVertices(id: PieceId, vertices: readonly Pt[]): Pose | null {
  const target = new Set(vertices.map(ptKey));
  if (target.size !== LOCAL_SHAPES[id].length) return null;
  for (const f of id === 'P' ? ([0, 1] as const) : ([0] as const)) {
    for (let r = 0; r < 8; r++) {
      for (const v of vertices) {
        const at = ptSub(v, orient(LOCAL_SHAPES[id][0]!, { r, f }));
        const pose: Pose = { r, f, at };
        const got = poseVertices(id, pose).map(ptKey);
        if (got.every((key) => target.has(key))) return pose;
      }
    }
  }
  return null;
}

/** A placement whose pivot is its vertex 0 — always a lawful pivot. */
export const atVertex0 = (pose: Pose): Placement => ({ ...pose, pv: pose.at });

/** A full board from a solution, every pivot on vertex 0. */
export function boardOf(solution: Readonly<Record<PieceId, Pose>>): BoardPieces {
  return Object.fromEntries(PIECE_IDS.map((id) => [id, atVertex0(solution[id])]));
}
