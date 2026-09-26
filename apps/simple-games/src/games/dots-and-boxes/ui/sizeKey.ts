/**
 * The catalog key of each board size's name, referenced statically so the
 * strings stay greppable (docs/I18N_POLICY.md warns that a key assembled at
 * runtime looks unused). One table, read by the home, the result card and
 * the statistics.
 */
import type { BoardSize } from '../game';

export const SIZE_KEY = {
  small: 'dotsAndBoxesSize_small',
  medium: 'dotsAndBoxesSize_medium',
  large: 'dotsAndBoxesSize_large',
} as const satisfies Record<BoardSize, string>;
