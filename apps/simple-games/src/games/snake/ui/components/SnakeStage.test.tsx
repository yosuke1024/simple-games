/**
 * The board on the game screen (docs/SNAKE_RULES.md §13): redrawn only when
 * what it shows changes, and the swipe recognised on the move that crosses
 * the threshold, for one finger at a time.
 *
 * The drawing is counted by standing a plain (unmemoised) wrapper in for
 * SnakeBoard: the wrapper runs exactly when SnakeStage renders, so a count
 * that does not move is a stage that did not redraw.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSession, start, tick, turn, type Direction, type SnakeSession } from '../../game';
import { SnakeStage, SWIPE_THRESHOLD_PX } from './SnakeStage';

const drawn = vi.hoisted(() => ({ count: 0 }));

vi.mock('./SnakeBoard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./SnakeBoard')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    SnakeBoard: (props: Parameters<typeof actual.SnakeBoard>[0]) => {
      drawn.count += 1;
      return createElement(actual.SnakeBoard, props);
    },
  };
});

afterEach(cleanup);

const harness: { set: (session: SnakeSession) => void } = { set: () => undefined };

/** The game screen's own shape: the session in state, the stage handed only what it draws. */
function Harness({ initial, onSwipe }: { initial: SnakeSession; onSwipe: (d: Direction) => void }) {
  const [session, setSession] = useState(initial);
  harness.set = setSession;
  return (
    <SnakeStage
      body={session.body}
      food={session.food}
      direction={session.direction}
      status={session.status}
      crash={session.crash}
      pending={null}
      label="Snake board"
      onSwipe={onSwipe}
    />
  );
}

describe('redrawn only for what it shows (§13「描画とループ」)', () => {
  it('a queued turn makes a new session but no new drawing; a move does', () => {
    const onSwipe = vi.fn();
    const running = start(createSession('snake-stage-memo'));
    render(<Harness initial={running} onSwipe={onSwipe} />);
    const before = drawn.count;

    const queued = turn(running, 'up');
    expect(queued).not.toBe(running);
    expect(queued.body).toBe(running.body);
    act(() => harness.set(queued));
    act(() => harness.set(turn(queued, 'left')));
    expect(drawn.count).toBe(before);

    act(() => harness.set(tick(queued).session));
    expect(drawn.count).toBe(before + 1);
  });
});

describe('the swipe (§13「操作」)', () => {
  function mount() {
    const onSwipe = vi.fn();
    render(<Harness initial={start(createSession('snake-stage-swipe'))} onSwipe={onSwipe} />);
    return { onSwipe, stage: screen.getByRole('img', { name: 'Snake board' }) };
  }

  it('fires on the move that reaches the threshold, by the longer axis, and re-anchors there', () => {
    const { onSwipe, stage } = mount();
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(stage, {
      pointerId: 1,
      clientX: 50 + SWIPE_THRESHOLD_PX - 1,
      clientY: 60,
    });
    expect(onSwipe).not.toHaveBeenCalled();
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 50 + SWIPE_THRESHOLD_PX, clientY: 60 });
    expect(onSwipe).toHaveBeenLastCalledWith('right');
    // Measured from where the last one fired: another 24px down is a second turn.
    fireEvent.pointerMove(stage, {
      pointerId: 1,
      clientX: 50 + SWIPE_THRESHOLD_PX + 3,
      clientY: 60 + SWIPE_THRESHOLD_PX,
    });
    expect(onSwipe).toHaveBeenLastCalledWith('down');
    // And left, and up, for completeness of the four directions.
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 40, clientY: 84 });
    expect(onSwipe).toHaveBeenLastCalledWith('left');
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 40, clientY: 50 });
    expect(onSwipe).toHaveBeenLastCalledWith('up');
    expect(onSwipe).toHaveBeenCalledTimes(4);
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 40, clientY: 50 });
    // After the release, the same pointer's stray moves are nothing.
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 200, clientY: 50 });
    expect(onSwipe).toHaveBeenCalledTimes(4);
  });

  it('a cancel ends the swipe without entering anything', () => {
    const { onSwipe, stage } = mount();
    fireEvent.pointerDown(stage, { pointerId: 3, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(stage, { pointerId: 3, clientX: 60, clientY: 50 });
    fireEvent.pointerCancel(stage, { pointerId: 3 });
    fireEvent.pointerMove(stage, { pointerId: 3, clientX: 120, clientY: 50 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('a right-button mouse drag is not a swipe', () => {
    const { onSwipe, stage } = mount();
    fireEvent.pointerDown(stage, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 2,
      clientX: 50,
      clientY: 50,
    });
    fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'mouse', clientX: 120, clientY: 50 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('is named for a screen reader and does not let the page scroll under it', () => {
    mount();
    const stage = screen.getByRole('img', { name: 'Snake board' });
    expect(stage).toHaveClass('sn-stage');
    // `touch-action: none` lives in snake.css on .sn-stage (jsdom does not load it).
    expect(stage.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
