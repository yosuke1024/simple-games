/**
 * The catalog key of each box's name, referenced statically so the strings
 * stay greppable (docs/I18N_POLICY.md warns that a key assembled at runtime
 * looks unused). One table, read by the sheet and its labels.
 */
import type { Category } from '../game';

export const CATEGORY_KEY = {
  ones: 'yachtCategory_ones',
  twos: 'yachtCategory_twos',
  threes: 'yachtCategory_threes',
  fours: 'yachtCategory_fours',
  fives: 'yachtCategory_fives',
  sixes: 'yachtCategory_sixes',
  fullHouse: 'yachtCategory_fullHouse',
  fourOfAKind: 'yachtCategory_fourOfAKind',
  littleStraight: 'yachtCategory_littleStraight',
  bigStraight: 'yachtCategory_bigStraight',
  choice: 'yachtCategory_choice',
  yacht: 'yachtCategory_yacht',
} as const satisfies Record<Category, string>;
