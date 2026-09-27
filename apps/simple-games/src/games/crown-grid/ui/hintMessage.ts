/**
 * Maps a hint to the one i18n key that explains it in plain words
 * (docs/CROWN_GRID_RULES.md §6). Technique names never reach the screen —
 * this mapping, keyed on a step's technique and the kind of house(s) it was
 * read off, is the only place in the UI that reads either.
 *
 * The three visual terms a sentence refers to (§13): *highlighted* is the
 * house (or houses) the reasoning was read off, *tinted* is the candidate
 * cells that carry the proof (`step.support`), and *outlined* is the cells
 * the step settles (`step.cells`).
 */
import { rowOf, type Hint, type House, type Size } from '../game';

export type HintMessageKey =
  | 'crownGridHintViolation'
  | 'crownGridHintWrong'
  | 'crownGridHintSingle_row'
  | 'crownGridHintSingle_col'
  | 'crownGridHintSingle_region'
  | 'crownGridHintConfine_regionRow'
  | 'crownGridHintConfine_regionCol'
  | 'crownGridHintConfine_rowRegion'
  | 'crownGridHintConfine_colRegion'
  | 'crownGridHintAttack_row'
  | 'crownGridHintAttack_col'
  | 'crownGridHintAttack_region'
  | 'crownGridHintPair_regionsRows'
  | 'crownGridHintPair_regionsCols'
  | 'crownGridHintPair_rowsRegions'
  | 'crownGridHintPair_colsRegions'
  | 'crownGridHintHypothesis_row'
  | 'crownGridHintHypothesis_col'
  | 'crownGridHintHypothesis_region';

/** `single` and `attack` and `hypothesis` each name one house kind (§6). */
const byKind = (
  prefix: 'crownGridHintSingle' | 'crownGridHintAttack' | 'crownGridHintHypothesis',
  house: House,
): HintMessageKey => `${prefix}_${house.kind}` as HintMessageKey;

/**
 * `confinement`'s houses (solver.ts) are `[confined house, the line/region it
 * is confined to]`: a region confined to a row or column, or the dual — a
 * row or column confined to a region.
 */
function confinementKey(first: House, second: House): HintMessageKey {
  if (first.kind === 'region' && second.kind === 'row') return 'crownGridHintConfine_regionRow';
  if (first.kind === 'region' && second.kind === 'col') return 'crownGridHintConfine_regionCol';
  if (first.kind === 'row' && second.kind === 'region') return 'crownGridHintConfine_rowRegion';
  return 'crownGridHintConfine_colRegion';
}

/**
 * `pair`'s houses are the two confined houses, always the same kind as each
 * other: two regions (confined to two rows or two columns — told apart by
 * counting the distinct rows the support falls in, the same order the
 * solver tries them in, §7 T4), or two rows / two columns (confined to two
 * regions).
 */
function pairKey(houses: readonly House[], support: readonly number[], size: Size): HintMessageKey {
  const [first] = houses;
  if (first!.kind === 'region') {
    const rows = new Set(support.map((index) => rowOf(index, size)));
    return rows.size === 2 ? 'crownGridHintPair_regionsRows' : 'crownGridHintPair_regionsCols';
  }
  return first!.kind === 'row' ? 'crownGridHintPair_rowsRegions' : 'crownGridHintPair_colsRegions';
}

/** The one sentence each kind of hint gets (§6) — never a technique name. */
export function hintMessageKey(hint: Hint, size: Size): HintMessageKey {
  if (hint.kind === 'violation') return 'crownGridHintViolation';
  if (hint.kind === 'wrong') return 'crownGridHintWrong';

  const { step } = hint;
  const [first, second] = step.houses;

  switch (step.technique) {
    case 'single':
      return byKind('crownGridHintSingle', first!);
    case 'confinement':
      return confinementKey(first!, second!);
    case 'attack':
      return byKind('crownGridHintAttack', first!);
    case 'pair':
      return pairKey(step.houses, step.support, size);
    case 'hypothesis':
      return byKind('crownGridHintHypothesis', first!);
  }
}
