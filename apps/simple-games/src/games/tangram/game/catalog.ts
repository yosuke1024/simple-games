/**
 * The bundled silhouettes (docs/TANGRAM_RULES.md §2) and how a tier's list
 * and the daily pick from them (§6). Nothing is generated at play time:
 * every figure ships with its outline and one verified solution, and
 * catalog.test.ts checks every invariant of §2 on every figure.
 */
import { FIGURE_DATA } from './catalogData';
import { dayNumber } from './daily';
import type { PieceId, Pose } from './pieces';
import type { Pt } from './z2';

export type Tier = 'easy' | 'medium' | 'hard';
export const TIERS: readonly Tier[] = ['easy', 'medium', 'hard'];
export const isTier = (value: unknown): value is Tier =>
  value === 'easy' || value === 'medium' || value === 'hard';

export interface Figure {
  /** Stable across beta edits; never a number, never shown (§2). */
  readonly id: string;
  readonly tier: Tier;
  /** One simple polygon, clockwise on screen, its bounding box's top left at the origin. */
  readonly outline: readonly Pt[];
  /** One solution: what the tests verify and what Easy's inner lines come from (§3). */
  readonly solution: Readonly<Record<PieceId, Pose>>;
  /** Medium: the two pieces that start in place. Easy and Hard: none (§3). */
  readonly fixed: readonly PieceId[];
  /** Every v1 figure is the author's own (§2「由来」). */
  readonly origin: 'original';
}

export const FIGURES: readonly Figure[] = FIGURE_DATA;

const BY_ID = new Map<string, Figure>(FIGURES.map((figure) => [figure.id, figure]));

/** The figure with this id, or null — `'toString'` and every other stray name included. */
export function figureById(id: unknown): Figure | null {
  return typeof id === 'string' ? (BY_ID.get(id) ?? null) : null;
}

const BY_TIER: Readonly<Record<Tier, readonly Figure[]>> = {
  easy: FIGURES.filter((figure) => figure.tier === 'easy'),
  medium: FIGURES.filter((figure) => figure.tier === 'medium'),
  hard: FIGURES.filter((figure) => figure.tier === 'hard'),
};

/** A tier's list, in play order (§6). */
export const figuresOf = (tier: Tier): readonly Figure[] => BY_TIER[tier];

/** A figure's number on screen: its 1-based place in its tier's list (§2). */
export function figureNumber(figure: Figure): number {
  return BY_TIER[figure.tier].indexOf(figure) + 1;
}

/**
 * The next figure in a tier (§6 `next(tier, last)`): after `last`, the first
 * figure not yet solved, wrapping round and skipping `last` itself; with
 * nothing unsolved, the one right after `last` (§6 — not the head of the
 * list, which would pin the player there once everything is solved). With no
 * `last` in the list (a first visit, or a figure since removed), the first
 * unsolved from the head, else the head.
 */
export function nextFigure(
  tier: Tier,
  last: string | null | undefined,
  isSolved: (id: string) => boolean,
): Figure {
  const list = BY_TIER[tier];
  const k = list.findIndex((figure) => figure.id === last);
  if (k < 0) return list.find((figure) => !isSolved(figure.id)) ?? list[0]!;
  for (let step = 1; step < list.length; step++) {
    const figure = list[(k + step) % list.length]!;
    if (!isSolved(figure.id)) return figure;
  }
  return list[(k + 1) % list.length]!;
}

/**
 * The daily's step through the Medium list (§6): day d deals entry
 * (d × DAILY_STRIDE) mod N. The stride is a prime larger than N, so any N
 * days in a row deal N different figures (catalog.test.ts).
 */
export const DAILY_STRIDE = 7_919;

/**
 * The Medium figure for a local YYYY-MM-DD date (§6), or null when the
 * string is not a calendar date — the caller goes home rather than deal a
 * figure for a day that does not exist.
 */
export function dailyFigure(dateString: string): Figure | null {
  const day = dayNumber(dateString);
  if (day === null) return null;
  const list = BY_TIER.medium;
  const n = list.length;
  const index = (((day * DAILY_STRIDE) % n) + n) % n;
  return list[index]!;
}
