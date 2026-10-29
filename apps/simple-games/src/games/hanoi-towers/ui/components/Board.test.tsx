import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { createSession, encodeMove, move, undo, type Session } from '../../game';
import { Board } from './Board';

afterEach(cleanup);

const wrap = (children: ReactNode) => (
  <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language: 'en' }}>
    {children}
  </SettingsProvider>
);

function after(session: Session, ...actions: number[]): Session {
  return actions.reduce((current, action) => move(current, action)!, session);
}

const towers = (root: ParentNode) => [...root.querySelectorAll('.hn-tower')];

/** The disk groups of one tower, by class (docs/HANOI_TOWERS_RULES.md "Visual presentation"). */
const arrivedIn = (root: ParentNode) =>
  towers(root).map((tower) => tower.querySelectorAll('.hn-arrived').length);
const liftedIn = (root: ParentNode) =>
  towers(root).map((tower) => tower.querySelectorAll('.hn-lifted-disk').length);

describe('the lift and the settle on the board', () => {
  it('lifts only the top disk of the selected peg, by class, with the disk drawn where it rests', () => {
    const start = createSession(3, 5);
    const view = render(wrap(<Board session={start} selected={null} onPeg={vi.fn()} />));
    const rests = [...view.container.querySelectorAll('.hn-disk')].map((disk) =>
      disk.getAttribute('y'),
    );
    expect(liftedIn(view.container)).toEqual([0, 0, 0]);
    view.rerender(wrap(<Board session={start} selected={0} onPeg={vi.fn()} />));
    expect(liftedIn(view.container)).toEqual([1, 0, 0]);
    // The lift is a CSS transform of the group; the rect's own y does not move.
    expect(
      [...view.container.querySelectorAll('.hn-disk')].map((d) => d.getAttribute('y')),
    ).toEqual(rests);
    // Every other disk is an ordinary group, so it can ease back down.
    expect(view.container.querySelectorAll('.hn-disk-group')).toHaveLength(2);
  });

  it('settles the disk a move carried, once, and not on the first render', () => {
    const start = createSession(3, 5);
    const view = render(wrap(<Board session={start} selected={null} onPeg={vi.fn()} />));
    expect(arrivedIn(view.container)).toEqual([0, 0, 0]);
    view.rerender(wrap(<Board session={start} selected={0} onPeg={vi.fn()} />));
    const moved = after(start, encodeMove(0, 2));
    view.rerender(wrap(<Board session={moved} selected={null} onPeg={vi.fn()} />));
    expect(arrivedIn(view.container)).toEqual([0, 0, 1]);
    expect(liftedIn(view.container)).toEqual([0, 0, 0]);
    // Once: another render of the same board and selection leaves the very same
    // element carrying the class, so a CSS animation is not started again
    // (jsdom runs no animation, so the class and the node are what can be pinned).
    const settling = view.container.querySelector('.hn-arrived');
    expect(settling).not.toBeNull();
    view.rerender(
      wrap(
        <Board session={{ ...moved, board: [...moved.board] }} selected={null} onPeg={vi.fn()} />,
      ),
    );
    expect(arrivedIn(view.container)).toEqual([0, 0, 1]);
    expect(view.container.querySelector('.hn-arrived')).toBe(settling);
    expect(settling!.getAttribute('class')).toBe('hn-disk-group hn-arrived');
    // Selecting again ends the settle, and cancelling is not an arrival.
    view.rerender(wrap(<Board session={moved} selected={2} onPeg={vi.fn()} />));
    expect(arrivedIn(view.container)).toEqual([0, 0, 0]);
    expect(liftedIn(view.container)).toEqual([0, 0, 1]);
    view.rerender(wrap(<Board session={moved} selected={null} onPeg={vi.fn()} />));
    expect(arrivedIn(view.container)).toEqual([0, 0, 0]);
    expect(liftedIn(view.container)).toEqual([0, 0, 0]);
  });

  it('compares boards by value, so a fresh array of the same board settles nothing', () => {
    const start = createSession(3, 5);
    const view = render(wrap(<Board session={start} selected={null} onPeg={vi.fn()} />));
    view.rerender(
      wrap(
        <Board session={{ ...start, board: [...start.board] }} selected={null} onPeg={vi.fn()} />,
      ),
    );
    expect(arrivedIn(view.container)).toEqual([0, 0, 0]);
  });

  it('settles the disk an Undo carried back, and no disk after a restart', () => {
    const start = createSession(3, 5);
    const moved = after(start, encodeMove(0, 1), encodeMove(0, 2));
    const view = render(wrap(<Board session={moved} selected={null} onPeg={vi.fn()} />));
    // The undone move had carried the second disk to the right peg; it goes back.
    view.rerender(wrap(<Board session={undo(moved)!} selected={null} onPeg={vi.fn()} />));
    expect(arrivedIn(view.container)).toEqual([1, 0, 0]);
    // After three moves two disks are off the left peg: a restart moves both
    // back at once, so none of them settles.
    const further = after(moved, encodeMove(1, 2));
    view.rerender(wrap(<Board session={further} selected={null} onPeg={vi.fn()} />));
    view.rerender(wrap(<Board session={start} selected={null} onPeg={vi.fn()} />));
    expect(arrivedIn(view.container)).toEqual([0, 0, 0]);
  });

  it('draws one shade line per disk and per peg, and one under the base', () => {
    const start = createSession(4, 5);
    const view = render(wrap(<Board session={start} selected={null} onPeg={vi.fn()} />));
    expect(view.container.querySelectorAll('.hn-disk-shade')).toHaveLength(4);
    expect(view.container.querySelectorAll('.hn-wood-shade')).toHaveLength(3);
    expect(view.container.querySelectorAll('.hn-base-shade')).toHaveLength(3);
  });
});
