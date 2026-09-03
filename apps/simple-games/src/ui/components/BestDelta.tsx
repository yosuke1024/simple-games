/**
 * How this run stands against the record it was measured against — `+0:18`
 * behind the fastest clear, `−0:05` under it, `+120` over the best score.
 *
 * This is the one number a result card adds beyond the facts of the run: a
 * comparison with the player's own record, already on the card as "best".
 * It is never a comparison with anyone else (no ranking exists to compare
 * against), never a countdown, and it says nothing on a first clear, when
 * there is no record yet. An exact tie says nothing either — "±0:00" is a
 * fact nobody needed.
 */
import { formatSignedCount, formatSignedDuration } from '../format';

export interface BestDeltaProps {
  /** This run's number: seconds, moves, or points. */
  value: number;
  /** The record before this run, or null when there was none. */
  previous: number | null;
  /** How the number reads: a clock, or a count. */
  kind: 'time' | 'count';
  /** Whether smaller is better (time, moves) — false for a score. */
  lowerIsBetter?: boolean;
}

export function BestDelta({ value, previous, kind, lowerIsBetter = true }: BestDeltaProps) {
  if (previous === null) return null;
  const delta = value - previous;
  if (delta === 0) return null;
  const better = lowerIsBetter ? delta < 0 : delta > 0;
  const text = kind === 'time' ? formatSignedDuration(delta) : formatSignedCount(delta);
  return <span className={`result-delta${better ? ' result-delta-better' : ''}`}>{text}</span>;
}
