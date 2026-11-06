import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import '../../i18n';
import { createSession, step, chooseCpuMove, cpuView, type Session } from '../../game';
import { moveCard, sortHand } from '../../game/handOrder';
import { project } from '../../game/view';
import { Table } from './Table';

afterEach(cleanup);

/** A deal where seat 0 is about to draw. */
function onSeatZero(seed: number): Session {
  for (let deal = seed; deal < seed + 50; deal++) {
    let s = createSession(deal);
    for (let i = 0; s.status === 'playing' && s.turn !== 0 && i < 100; i++)
      s = step(s, chooseCpuMove(cpuView(s)))!;
    if (s.status === 'playing' && s.turn === 0) return s;
  }
  throw new Error('No seat-zero turn');
}
const board = (s: Session) => (
  <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language: 'en' }}>
    <Table view={project(s, 0)} canAct act={vi.fn()} />
  </SettingsProvider>
);
const shownOrder = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.ir-hand.is-arrangeable [data-card]')).map(
    (b) => Number(b.dataset.card),
  );

describe('a Nearby table keeps the arrangement on the device', () => {
  it('follows the hand through a draw, and starts a new deal sorted', () => {
    const s = onSeatZero(3),
      sorted = sortHand(s.hands[0]!);
    const { rerender } = render(board(s));
    expect(shownOrder()).toEqual(sorted);
    const first = document.querySelector<HTMLElement>(`[data-card="${sorted[0]}"]`)!;
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight', shiftKey: true });
    const arranged = moveCard(sorted, sorted[0]!, 1);
    expect(shownOrder()).toEqual(arranged);

    const drawn = step(s, { kind: 'draw', source: 'stock' })!,
      taken = drawn.hands[0]!.find((card) => !s.hands[0]!.includes(card))!;
    rerender(board(drawn));
    expect(shownOrder()).toEqual([...arranged, taken]);
    const discarded = step(drawn, { kind: 'discard', card: arranged[0]! })!;
    rerender(board(discarded));
    expect(shownOrder()).toEqual([...arranged.slice(1), taken]);

    const next = onSeatZero(40);
    rerender(board(next));
    expect(shownOrder()).toEqual(sortHand(next.hands[0]!));
  });

  // The board stays mounted between Nearby rounds, so the table has to see the
  // deal boundary itself. Two deals can share most of their cards: the overlap
  // never makes the next one a continuation of the last.
  const arrangeFirst = () => {
    const first = document.querySelector<HTMLElement>('.ir-hand.is-arrangeable [data-card]')!;
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight', shiftKey: true });
  };

  it('starts a new deal sorted even when it shares most cards with the last', () => {
    const a = createSession(1),
      b = createSession(7235),
      shared = b.hands[0]!.filter((card) => a.hands[0]!.includes(card));
    expect(shared.length * 2).toBeGreaterThanOrEqual(b.hands[0]!.length);
    const { rerender } = render(board(a));
    arrangeFirst();
    expect(shownOrder()).not.toEqual(sortHand(a.hands[0]!));
    rerender(board(b));
    expect(shownOrder()).toEqual(sortHand(b.hands[0]!));
  });

  it('starts the deal after a finished one sorted, first seen after a move', () => {
    const a = createSession(1),
      { rerender } = render(board(a));
    arrangeFirst();
    rerender(board({ ...a, status: 'won', winners: [1], penalties: [0, 0, 0, 0] }));
    const b = step(createSession(7235), { kind: 'draw', source: 'stock' })!;
    rerender(board(b));
    expect(shownOrder()).toEqual(sortHand(b.hands[0]!));
  });
});
