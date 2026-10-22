/**
 * Core Echo Pads types. See docs/ECHO_PADS_RULES.md — the single source of
 * truth for the rules these shapes serve.
 *
 * A pad is a number: its index in reading order (left to right, top to
 * bottom). Pads are told apart by a mark and a position, never by colour
 * alone (§11), so the mark belongs to the index and not to a palette.
 */

/** The two pad counts this release ships (§1, §2). Nine is refused (§2). */
export type PadCount = 4 | 6;
export const PAD_COUNTS: readonly PadCount[] = [4, 6];

export const isPadCount = (value: unknown): value is PadCount => value === 4 || value === 6;

/** Rows × columns. 4 pads are 2 × 2; 6 pads are 2 rows × 3 columns (§11). */
export const PAD_GRID: Readonly<
  Record<PadCount, { readonly rows: number; readonly cols: number }>
> = {
  4: { rows: 2, cols: 2 },
  6: { rows: 2, cols: 3 },
};

/**
 * Every pad of both layouts sits on the outer edge, so the edge is a ring the
 * finger can trace. Listed clockwise from the top-left pad (§3's table).
 */
export const PAD_RING: Readonly<Record<PadCount, readonly number[]>> = {
  4: [0, 1, 3, 2],
  6: [0, 1, 2, 5, 4, 3],
};

/**
 * One mark per pad in reading order (§11, initial values). Four pads use the
 * first four. The UI draws them as inline SVG; these ids are not text.
 */
export const PAD_MARKS = ['circle', 'triangle', 'square', 'star', 'diamond', 'cross'] as const;
export type PadMark = (typeof PAD_MARKS)[number];

export type GameMode = 'level' | 'daily';

/** §4's three paces. */
export type Pace = 'calm' | 'normal' | 'quick';
export const PACES: readonly Pace[] = ['calm', 'normal', 'quick'];
export const DEFAULT_PACE: Pace = 'normal';

export const isPace = (value: unknown): value is Pace =>
  value === 'calm' || value === 'normal' || value === 'quick';

/**
 * §1's states. `reviewing` is the playback of a failed round's sequence after
 * the run ended (§6); it returns to `failed`, never to input.
 */
export type EchoStatus =
  'idle' | 'playing-back' | 'awaiting-input' | 'failed' | 'reviewing' | 'cleared';
