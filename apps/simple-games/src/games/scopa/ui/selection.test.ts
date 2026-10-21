/**
 * The lift-and-take machine of docs/SCOPA_RULES.md §2.5 as pure functions
 * (ui/selection.ts), and the Quick Rules figures held to the rules they teach
 * (§10). The screen-level behaviour — marks, taps, keys — is in
 * ScopaRoot.test.tsx; this pins the arithmetic underneath it.
 */
import { describe, expect, it } from 'vitest';
import { captureOptions, primieraOf, sortedCards, valueOf } from '../game';
import { cards } from '../game/test-helpers';
import { liftOf, tapTable, tappableCards } from './selection';
import { FIGURE_PRIMIERA, FIGURE_SAME, FIGURE_SCOPA } from './tutorialFigures';

describe('lifting a card', () => {
  it('names how it can take: placed, one same value, or a sum', () => {
    // No two or more of 5 + 2 + 4 make ten, so the king takes nothing.
    const table = cards('5H 2S 4C');
    expect(liftOf(table, cards('KS')[0]!).kind).toBe('place');
    expect(liftOf(table, cards('5C')[0]!).kind).toBe('same');
    expect(liftOf(table, cards('6C')[0]!).kind).toBe('sum');
  });

  it('offers only the cards some capture contains', () => {
    // 7♣ over 5♥ 2♠ 3♦ 4♣: 5 + 2 and 3 + 4 — every card is in one of them.
    const table = cards('5H 2S 3D 4C');
    const lift = liftOf(table, cards('7C')[0]!);
    expect(lift.options).toHaveLength(2);
    expect(tappableCards(lift, [])).toEqual(new Set(table));
    // With 5♥ picked, only 2♠ completes a capture; 3♦ and 4♣ are not offered.
    expect(tappableCards(lift, cards('5H'))).toEqual(new Set(cards('5H 2S')));
  });

  it('offers nothing to a card that can only be placed', () => {
    const lift = liftOf(cards('5H 2S'), cards('KS')[0]!);
    expect(tappableCards(lift, [])).toEqual(new Set());
    expect(tapTable(lift, [], cards('5H')[0]!)).toEqual({ kind: 'none' });
  });
});

describe('a tap on the table', () => {
  it('takes one same-value card at once, whichever was chosen', () => {
    const table = cards('5H 5S 2D 3C');
    const five = cards('5C')[0]!;
    const lift = liftOf(table, five);
    expect(lift.options).toHaveLength(2);
    // 2♦ + 3♣ also make five, but the same value comes first (§2.2).
    expect(tappableCards(lift, [])).toEqual(new Set(cards('5H 5S')));
    expect(tapTable(lift, [], cards('5S')[0]!)).toEqual({
      kind: 'take',
      move: { card: five, captured: cards('5S') },
    });
  });

  it('takes the only capture there is from any of its cards', () => {
    const table = cards('2S 5C QH');
    const seven = cards('7H')[0]!;
    const lift = liftOf(table, seven);
    expect(tapTable(lift, [], cards('5C')[0]!)).toEqual({
      kind: 'take',
      move: { card: seven, captured: sortedCards(cards('2S 5C')) },
    });
  });

  it('builds a sum card by card, takes it when it reaches the value, and lets a card back out', () => {
    const table = cards('5H 2S 3D 4C');
    const seven = cards('7C')[0]!;
    const lift = liftOf(table, seven);
    const first = tapTable(lift, [], cards('3D')[0]!);
    expect(first).toEqual({ kind: 'group', picked: cards('3D') });
    // Tapping a picked card takes it back out.
    expect(tapTable(lift, cards('3D'), cards('3D')[0]!)).toEqual({ kind: 'group', picked: [] });
    // A card that would leave no capture is not offered, and a tap on it is nothing.
    expect(tapTable(lift, cards('3D'), cards('5H')[0]!)).toEqual({ kind: 'none' });
    const done = tapTable(lift, cards('3D'), cards('4C')[0]!);
    expect(done).toEqual({
      kind: 'take',
      move: { card: seven, captured: sortedCards(cards('3D 4C')) },
    });
    // Whatever was reached is one of the rules' own captures.
    if (done.kind === 'take') {
      expect(captureOptions(table, seven)).toContainEqual(done.move.captured);
    }
  });
});

describe('the Quick Rules figures obey the rules they teach (§10)', () => {
  it('step 1: the 5♣ marks the 5♥ only, though 2♠ + 3♦ make five', () => {
    const lift = liftOf(FIGURE_SAME.table, FIGURE_SAME.lifted);
    expect(lift.kind).toBe('same');
    expect([...tappableCards(lift, [])]).toEqual([...FIGURE_SAME.marked]);
    const [two, three] = [FIGURE_SAME.table[1]!, FIGURE_SAME.table[2]!];
    expect(valueOf(two) + valueOf(three)).toBe(valueOf(FIGURE_SAME.lifted));
  });

  it('step 2: the 7♥ takes 2♣ + 5♠, and that is the whole table', () => {
    expect(captureOptions(FIGURE_SCOPA.table, FIGURE_SCOPA.played)).toEqual([
      sortedCards(FIGURE_SCOPA.table),
    ]);
  });

  it('step 3: 7♠ 7♥ 7♦ 6♣ are a primiera of 81, and the 7♦ is among them', () => {
    const tally = primieraOf(FIGURE_PRIMIERA.best);
    expect(tally.total).toBe(81);
    expect(tally.suits).toBe(4);
    expect(FIGURE_PRIMIERA.best).toContain(FIGURE_PRIMIERA.settebello);
  });
});
