/**
 * Sequence generation — docs/ECHO_PADS_RULES.md §3.
 *
 * A run plays the first k items of one fixed sequence, so the sequence is the
 * whole question. Two local rules hold by construction, item by item:
 *
 * - no pad three times in a row (three of a kind is counted, not remembered);
 * - no three steps tracing the outer ring in one direction (a trace is
 *   followed with the finger, not remembered). Every pad of both layouts is on
 *   the ring, so tracing it is always available as a shortcut.
 *
 * Each rule bans at most one pad and they never fire together (a repeat needs
 * the last two equal, a trace needs them adjacent), so every item has
 * `padCount` or `padCount - 1` choices and nothing is ever redrawn for them.
 *
 * The bias cap is a property of the whole sequence and is met by drawing up
 * to `GEN_DRAW_LIMIT` candidates. If none passes, the last one is taken: the
 * work is bounded, and the pass rate is measured, not assumed (§17).
 */
import { createRng } from './rng';
import { PAD_RING, type PadCount } from './types';

/** At most this many candidates per sequence (§3, initial value). */
export const GEN_DRAW_LIMIT = 24;

export interface GeneratedSequence {
  readonly pads: readonly number[];
  /** Candidates drawn, 1..GEN_DRAW_LIMIT. */
  readonly draws: number;
  /** True when no candidate met the bias cap and the last one was taken. */
  readonly fallback: boolean;
}

/**
 * No pad may appear more often than twice its fair share, rounded up (§3):
 * a sequence leaning that hard on one pad is a different, easier question.
 */
export function biasCap(length: number, padCount: PadCount): number {
  return Math.ceil((2 * length) / padCount);
}

const ringPosition = (padCount: PadCount): readonly number[] => {
  const ring = PAD_RING[padCount];
  const position: number[] = [];
  ring.forEach((pad, index) => {
    position[pad] = index;
  });
  return position;
};

const RING_POSITION: Readonly<Record<PadCount, readonly number[]>> = {
  4: ringPosition(4),
  6: ringPosition(6),
};

/**
 * The one pad the local rules forbid after `seq`, or -1 when none is.
 * Exported so the tests can check the invariant with the same definition.
 */
export function bannedNext(seq: readonly number[], padCount: PadCount): number {
  const n = seq.length;
  if (n < 2) return -1;
  const a = seq[n - 2]!;
  const b = seq[n - 1]!;
  if (a === b) return b;
  const ring = PAD_RING[padCount];
  const pos = RING_POSITION[padCount];
  const pa = pos[a]!;
  const pb = pos[b]!;
  if ((pb - pa + padCount) % padCount === 1) return ring[(pb + 1) % padCount]!;
  if ((pa - pb + padCount) % padCount === 1) return ring[(pb - 1 + padCount) % padCount]!;
  return -1;
}

/** Whether a sequence breaks a local rule anywhere (it never should). */
export function breaksLocalRules(seq: readonly number[], padCount: PadCount): boolean {
  for (let i = 2; i < seq.length; i++) {
    if (seq[i] === bannedNext(seq.slice(0, i), padCount)) return true;
  }
  return false;
}

/** The largest number of times any one pad appears. */
export function maxPadCount(seq: readonly number[], padCount: PadCount): number {
  const counts = new Array<number>(padCount).fill(0);
  for (const pad of seq) counts[pad] = (counts[pad] ?? 0) + 1;
  return Math.max(...counts);
}

/**
 * One candidate: `length` items, each drawn uniformly from the pads the local
 * rules leave. Exported so the tests can rebuild the candidates a seed draws.
 */
export function drawCandidate(rng: () => number, padCount: PadCount, length: number): number[] {
  const seq: number[] = [];
  for (let i = 0; i < length; i++) {
    const banned = bannedNext(seq, padCount);
    const choices = banned < 0 ? padCount : padCount - 1;
    let pick = Math.floor(rng() * choices);
    if (banned >= 0 && pick >= banned) pick += 1;
    seq.push(pick);
  }
  return seq;
}

/**
 * The sequence for a seed. Deterministic: the same seed, pad count and length
 * always give the same pads, draws and fallback flag. `cap` is §3's bias cap;
 * it is a parameter only so the tests can force the fallback path.
 */
export function generateSequence(
  seed: string,
  padCount: PadCount,
  length: number,
  cap: number = biasCap(length, padCount),
): GeneratedSequence {
  const rng = createRng(seed);
  let candidate: number[] = [];
  for (let draw = 1; draw <= GEN_DRAW_LIMIT; draw++) {
    candidate = drawCandidate(rng, padCount, length);
    if (maxPadCount(candidate, padCount) <= cap) {
      return { pads: candidate, draws: draw, fallback: false };
    }
  }
  return { pads: candidate, draws: GEN_DRAW_LIMIT, fallback: true };
}
