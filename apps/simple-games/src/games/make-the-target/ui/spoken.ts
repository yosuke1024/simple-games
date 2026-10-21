/**
 * The words a screen reader hears where a sighted player reads signs
 * (docs/MAKE_THE_TARGET_RULES.md §12): the operator buttons' names, and an
 * expression line spoken as one sentence — "7 minus 3 equals 4", the left
 * term first. The board itself draws only digits and + − × ÷ (§1).
 */
import type { useSettings } from '@/state/SettingsContext';
import { OPERATOR_SYMBOLS, type Expression, type Operator } from '../game';

type Translate = ReturnType<typeof useSettings>['t'];

/** Each stored operator's name in the catalog's keys. */
export const OPERATOR_NAMES = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
} as const satisfies Record<Operator, string>;

/** The operator button's accessible name: "Add", "Subtract", … */
export const operatorLabel = (t: Translate, op: Operator): string =>
  t(`makeTheTargetOp_${OPERATOR_NAMES[op]}`);

/**
 * One expression line, read aloud: "7 minus 3 equals 4". One whole sentence
 * per operator, never an operator word dropped into a shared sentence, so a
 * language can word each one its own way (docs/I18N_POLICY.md「全文をキー側で
 * 管理」, §13's "divide" versus "be divided by").
 */
export const spokenLine = (t: Translate, line: Expression): string =>
  t(`makeTheTargetSpokenLine_${OPERATOR_NAMES[line.op]}`, {
    left: line.left,
    right: line.right,
    result: line.result,
  });

/** One expression line as the board draws it: `7 − 3 = 4` (§4). */
export const writtenLine = (line: Expression): string =>
  `${line.left} ${OPERATOR_SYMBOLS[line.op]} ${line.right} = ${line.result}`;
