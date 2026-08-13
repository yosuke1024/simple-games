/**
 * How a seat and a pawn's position are said out loud, shared by the board, the
 * seat strip and the result overlay.
 *
 * The seat digits are the same in every locale on purpose: a seat here is a
 * direction round the board rather than a name, so every reader finds the same
 * number in the same chair (docs/LUDO_RULES.md, and Hearts before it).
 *
 * A position is said as **one number folded back out into words** — the yard,
 * a ring square, a home column square, home — because `progress` is exactly
 * that fold (game/types.ts) and reading it out any other way would need a
 * second copy of the board's geometry.
 */
import type { MessageKey, TranslateVars } from '@/i18n';
import { globalSquareOf, isSafeSquare, HOME_PROGRESS, RING_SIZE, YOU, type Seat } from '../../game';

export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

/** What a seat is called on screen. The digits are the same in every locale. */
export const seatLabel = (t: Translate, seat: Seat): string =>
  seat === YOU ? t('ludoYou') : t('ludoCpu', { n: seat });

/**
 * Where a pawn is, in words. Ring squares are numbered from one so the spoken
 * board never starts at zero; the number is the global square, which is what
 * two seats sharing a square actually share.
 */
export function placeLabel(t: Translate, seat: Seat, progress: number): string {
  if (progress === 0) return t('ludoWhereYard');
  if (progress === HOME_PROGRESS) return t('ludoWhereHome');
  const square = globalSquareOf(seat, progress);
  if (square === null) return t('ludoWhereColumn', { n: progress - RING_SIZE });
  return isSafeSquare(square)
    ? t('ludoWhereSafe', { n: square + 1 })
    : t('ludoWhereSquare', { n: square + 1 });
}

/** A pawn, read out as the seat that owns it and the square it stands on. */
export const pawnLabel = (t: Translate, seat: Seat, progress: number): string =>
  t('ludoPawnAt', { seat: seatLabel(t, seat), where: placeLabel(t, seat, progress) });
