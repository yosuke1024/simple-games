/**
 * The Quick Rules figures are positions the game can reach (§9): each is a
 * move list the engine accepts, and each shows what its step says.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CIRCLE,
  CROSS,
  isFreeMove,
  positionFromMoves,
  sendTarget,
  toMove,
  winningLine,
} from '../../game';
import { FIGURE_MOVES, figureOf, RulesFigure, type RulesFigureKind } from './RulesFigure';

afterEach(cleanup);

describe('Quick Rules figures (§9)', () => {
  it('replays every figure from the empty board under the rules', () => {
    for (const kind of Object.keys(FIGURE_MOVES) as RulesFigureKind[]) {
      expect(positionFromMoves(FIGURE_MOVES[kind]), kind).not.toBeNull();
    }
    expect(() => figureOf([0, 0])).toThrow();
  });

  it('send: one cross, and the bottom-right board framed for the reply', () => {
    const position = positionFromMoves(FIGURE_MOVES.send)!;
    expect(sendTarget(position)).toBe(8);
    expect(figureOf(FIGURE_MOVES.send)).toEqual({
      marks: [[8, CROSS]],
      taken: [],
      framed: [8],
      outlined: [],
    });
  });

  it('free: the circle took the board the cross is sent to, so every open board is framed', () => {
    const position = positionFromMoves(FIGURE_MOVES.free)!;
    expect(toMove(position)).toBe(CROSS);
    expect(isFreeMove(position)).toBe(true);
    const figure = figureOf(FIGURE_MOVES.free);
    expect(figure.taken).toEqual([[1, CIRCLE]]);
    expect(figure.framed).toEqual([0, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('win: three taken boards on the diagonal, outlined, the circle with none', () => {
    const position = positionFromMoves(FIGURE_MOVES.win)!;
    expect(winningLine(position)).toEqual([0, 4, 8]);
    const figure = figureOf(FIGURE_MOVES.win);
    expect(figure.taken).toEqual([
      [0, CROSS],
      [4, CROSS],
      [8, CROSS],
    ]);
    expect(figure.outlined).toEqual([0, 4, 8]);
    expect(figure.framed).toEqual([]);
  });

  it('draws what the figure holds, and nothing a screen reader reads', () => {
    const { container } = render(<RulesFigure kind="free" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.nt-figure-frame')).toHaveLength(8);
    expect(container.querySelectorAll('.nt-figure-big')).toHaveLength(1);
    expect(container.querySelectorAll('.nt-figure-faint')).toHaveLength(3);
    expect(container.textContent).toBe('');
  });
});
