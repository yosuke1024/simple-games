/**
 * The positions the three Quick Rules figures draw (docs/SCOPA_RULES.md §10).
 * Kept apart from the screen so the tests can hold each figure to the rule it
 * teaches (ScopaRoot.test.tsx): a figure that contradicted the rules would be
 * teaching something false.
 */
import { cardOf, type Card } from '../game';

/** Step 1: 5♣ lifted over 5♥ 2♠ 3♦ — only 5♥ is marked; the same value comes first. */
export const FIGURE_SAME = {
  table: [cardOf(1, 5), cardOf(0, 2), cardOf(2, 3)] as readonly Card[],
  lifted: cardOf(3, 5),
  marked: [cardOf(1, 5)] as readonly Card[],
};

/** Step 2: 7♥ takes 2♣ + 5♠ (no 7 on the table), the table is empty — a scopa. */
export const FIGURE_SCOPA = {
  table: [cardOf(3, 2), cardOf(0, 5)] as readonly Card[],
  played: cardOf(1, 7),
};

/** Step 3: the 7♦, and a primiera of 7♠ 7♥ 7♦ 6♣ — 21 + 21 + 21 + 18 = 81. */
export const FIGURE_PRIMIERA = {
  settebello: cardOf(2, 7),
  best: [cardOf(0, 7), cardOf(1, 7), cardOf(2, 7), cardOf(3, 6)] as readonly Card[],
};
