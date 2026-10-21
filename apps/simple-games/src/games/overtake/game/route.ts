/**
 * The route sweep (docs/OVERTAKE_RULES.md §5 "確かめる"): is there a lateral
 * path through the whole course at one constant speed v? Row by row, with
 * continuous x, real car widths and each row's window (u_k, u_k + L_k + 58),
 * on integer interval sets. The planner (§6) runs the same sweep over its
 * view window.
 */
import { exactDiv } from './arith';
import { CAR_LENGTH, FULL_SPEED, STEER_PER_STEP } from './constants';
import { rowFree, speedRange } from './geometry';
import { expandWithin, intersect, isEmpty, type Intervals } from './intervals';
import type { Course, Row } from './types';

export function windowStart(row: Row): number {
  return row.u;
}

export function windowEnd(row: Row): number {
  return row.u + row.length + CAR_LENGTH;
}

/** Lateral units reachable while covering `distance` units at constant v (§5). */
export function reachAt(distance: number, v: number): number {
  return Math.floor((STEER_PER_STEP * distance) / v);
}

export interface RowSweep {
  /** A_k: positions on entering row k's window. */
  readonly entry: Intervals;
  /** S_k: positions on leaving it. */
  readonly exit: Intervals;
}

export interface RouteResult {
  readonly ok: boolean;
  /** Index of the first row whose A_k is empty, or −1. */
  readonly failedRow: number;
  readonly rows: readonly RowSweep[];
  /** Interval operations performed — the sweep's work (§17). */
  readonly work: number;
}

/**
 * One row of the sweep: from S_{k−1} (positions at the previous window's end)
 * across the lead D_k and through window k.
 */
export function sweepRow(previousExit: Intervals, row: Row, v: number, first: boolean): RowSweep {
  const range = speedRange(v);
  const free = rowFree(row, v);
  const approach = first ? range : expandWithin(previousExit, reachAt(row.lead, v), range);
  const entry = intersect(approach, free);
  const exit = expandWithin(entry, reachAt(row.length + CAR_LENGTH, v), free);
  return { entry, exit };
}

export function verifyRoute(course: Course, v: number): RouteResult {
  let exit: Intervals = speedRange(v);
  const rows: RowSweep[] = [];
  let work = 0;
  for (let k = 0; k < course.rows.length; k++) {
    const sweep = sweepRow(exit, course.rows[k]!, v, k === 0);
    work += 1 + exactDiv(sweep.entry.length, 2);
    rows.push(sweep);
    if (isEmpty(sweep.entry)) return { ok: false, failedRow: k, rows, work };
    exit = sweep.exit;
  }
  return { ok: true, failedRow: -1, rows, work };
}

/**
 * Rows not passable at full speed (§5 "全開で通れない行"): starting from the
 * v_check sweep's S_{k−1} cut to R(420), A_k at v = 420 is empty.
 */
export function fullSpeedBlockedRows(course: Course, checkSpeed: number): number[] {
  const check = verifyRoute(course, checkSpeed);
  const blocked: number[] = [];
  const fast = speedRange(FULL_SPEED);
  for (let k = 0; k < check.rows.length; k++) {
    const start = k === 0 ? fast : intersect(check.rows[k - 1]!.exit, fast);
    const entry = sweepRow(start, course.rows[k]!, FULL_SPEED, k === 0).entry;
    if (isEmpty(entry)) blocked.push(k);
  }
  return blocked;
}
