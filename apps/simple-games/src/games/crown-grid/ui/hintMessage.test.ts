/**
 * hintMessageKey (docs/CROWN_GRID_RULES.md §6): every branch, from hand-built
 * SolveStep objects rather than a generated board, so each technique × house
 * kind combination is exercised directly instead of hoping a puzzle happens
 * to produce it.
 */
import { describe, expect, it } from 'vitest';
import type { Hint, House, SolveStep } from '../game';
import { hintMessageKey } from './hintMessage';

const SIZE = 6;

const step = (
  partial: Partial<SolveStep> & Pick<SolveStep, 'technique' | 'houses'>,
): SolveStep => ({
  kind: 'eliminate',
  cells: [0],
  support: [0],
  ...partial,
});

const stepHint = (s: SolveStep): Hint => ({ kind: 'step', step: s });

const row = (index: number): House => ({ kind: 'row', index });
const col = (index: number): House => ({ kind: 'col', index });
const region = (index: number): House => ({ kind: 'region', index });

describe('hintMessageKey (§6)', () => {
  it('violation and wrong never look at a step', () => {
    expect(hintMessageKey({ kind: 'violation', cells: [0, 1] }, SIZE)).toBe(
      'crownGridHintViolation',
    );
    expect(hintMessageKey({ kind: 'wrong', index: 0 }, SIZE)).toBe('crownGridHintWrong');
  });

  it('single names the one house with a candidate left (§7 T1)', () => {
    expect(hintMessageKey(stepHint(step({ technique: 'single', houses: [row(0)] })), SIZE)).toBe(
      'crownGridHintSingle_row',
    );
    expect(hintMessageKey(stepHint(step({ technique: 'single', houses: [col(0)] })), SIZE)).toBe(
      'crownGridHintSingle_col',
    );
    expect(hintMessageKey(stepHint(step({ technique: 'single', houses: [region(0)] })), SIZE)).toBe(
      'crownGridHintSingle_region',
    );
  });

  it('confinement reads [confined house, the line/region it is confined to] (§7 T2)', () => {
    expect(
      hintMessageKey(
        stepHint(step({ technique: 'confinement', houses: [region(0), row(0)] })),
        SIZE,
      ),
    ).toBe('crownGridHintConfine_regionRow');
    expect(
      hintMessageKey(
        stepHint(step({ technique: 'confinement', houses: [region(0), col(0)] })),
        SIZE,
      ),
    ).toBe('crownGridHintConfine_regionCol');
    expect(
      hintMessageKey(
        stepHint(step({ technique: 'confinement', houses: [row(0), region(0)] })),
        SIZE,
      ),
    ).toBe('crownGridHintConfine_rowRegion');
    expect(
      hintMessageKey(
        stepHint(step({ technique: 'confinement', houses: [col(0), region(0)] })),
        SIZE,
      ),
    ).toBe('crownGridHintConfine_colRegion');
  });

  it('attack names the house a candidate would leave empty (§7 T3)', () => {
    expect(hintMessageKey(stepHint(step({ technique: 'attack', houses: [row(0)] })), SIZE)).toBe(
      'crownGridHintAttack_row',
    );
    expect(hintMessageKey(stepHint(step({ technique: 'attack', houses: [col(0)] })), SIZE)).toBe(
      'crownGridHintAttack_col',
    );
    expect(hintMessageKey(stepHint(step({ technique: 'attack', houses: [region(0)] })), SIZE)).toBe(
      'crownGridHintAttack_region',
    );
  });

  it('pair of two regions splits on the support falling in two rows or two columns (§7 T4)', () => {
    // rowOf(0, 6) = 0, rowOf(7, 6) = 1 — two distinct rows.
    expect(
      hintMessageKey(
        stepHint(step({ technique: 'pair', houses: [region(0), region(1)], support: [0, 7] })),
        SIZE,
      ),
    ).toBe('crownGridHintPair_regionsRows');
    // rowOf(0, 6) = rowOf(1, 6) = 0 — one row, so it must be the column case
    // (mirrors the solver, which tries rows before columns — solver.ts pair()).
    expect(
      hintMessageKey(
        stepHint(step({ technique: 'pair', houses: [region(0), region(1)], support: [0, 1] })),
        SIZE,
      ),
    ).toBe('crownGridHintPair_regionsCols');
  });

  it('pair of two rows or two columns names which, regardless of the support (§7 T4 dual)', () => {
    expect(
      hintMessageKey(
        stepHint(step({ technique: 'pair', houses: [row(0), row(1)], support: [0, 7] })),
        SIZE,
      ),
    ).toBe('crownGridHintPair_rowsRegions');
    expect(
      hintMessageKey(
        stepHint(step({ technique: 'pair', houses: [col(0), col(1)], support: [0, 7] })),
        SIZE,
      ),
    ).toBe('crownGridHintPair_colsRegions');
  });

  it('hypothesis names the house the trial crown contradicted (§7 T5)', () => {
    expect(
      hintMessageKey(stepHint(step({ technique: 'hypothesis', houses: [row(0)] })), SIZE),
    ).toBe('crownGridHintHypothesis_row');
    expect(
      hintMessageKey(stepHint(step({ technique: 'hypothesis', houses: [col(0)] })), SIZE),
    ).toBe('crownGridHintHypothesis_col');
    expect(
      hintMessageKey(stepHint(step({ technique: 'hypothesis', houses: [region(0)] })), SIZE),
    ).toBe('crownGridHintHypothesis_region');
  });
});
