/**
 * The board's drawing (docs/SNAKE_RULES.md §13「見た目」「描画とループ」): what
 * tells the head, the body, the food, a crash and a chosen heading apart by
 * shape, and that no text is drawn on it. That it is redrawn only for what
 * it shows is SnakeStage.test.tsx's.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cellAt } from '../../game';
import { SnakeBoard } from './SnakeBoard';

afterEach(cleanup);

const BODY = [cellAt(6, 4), cellAt(6, 3), cellAt(5, 3), cellAt(5, 2)];

function draw(props: Partial<Parameters<typeof SnakeBoard>[0]> = {}) {
  return render(
    <SnakeBoard
      body={BODY}
      food={cellAt(2, 9)}
      direction="right"
      status="running"
      crash={null}
      pending={null}
      {...props}
    />,
  );
}

describe('what is drawn (§13)', () => {
  it('one head with two eyes, a segment per body cell, one round food', () => {
    const { container } = draw();
    expect(container.querySelectorAll('.sn-head-shape')).toHaveLength(1);
    expect(container.querySelectorAll('.sn-eye')).toHaveLength(2);
    expect(container.querySelectorAll('.sn-segment')).toHaveLength(BODY.length - 1);
    const food = container.querySelectorAll('circle.sn-food');
    expect(food).toHaveLength(1);
    expect(food[0]).toHaveAttribute('cx', '9.5');
    expect(food[0]).toHaveAttribute('cy', '2.5');
    // The head sits on its cell; the head is drawn larger than a segment.
    const head = container.querySelector('.sn-head-shape')!;
    expect(Math.floor(Number(head.getAttribute('x')))).toBe(4);
    expect(Math.floor(Number(head.getAttribute('y')))).toBe(6);
    const segment = container.querySelector('.sn-segment rect:last-child')!;
    expect(Number(head.getAttribute('width'))).toBeGreaterThan(
      Number(segment.getAttribute('width')),
    );
  });

  it('puts the eyes on the side the head faces', () => {
    const right = draw({ direction: 'right' }).container;
    const eyesRight = [...right.querySelectorAll('.sn-eye')].map((e) =>
      Number(e.getAttribute('cx')),
    );
    cleanup();
    const up = draw({ direction: 'up' }).container;
    const eyesUp = [...up.querySelectorAll('.sn-eye')].map((e) => Number(e.getAttribute('cy')));
    // Facing right: both eyes in the right half of the head's cell.
    for (const cx of eyesRight) expect(cx - 4).toBeGreaterThan(0.5);
    // Facing up: both in the top half.
    for (const cy of eyesUp) expect(cy - 6).toBeLessThan(0.5);
  });

  it('joins consecutive segments with a neck, so a fold shows a gap between neighbours that are not', () => {
    const { container } = draw();
    // Every segment but the head draws a neck towards the head: one extra rect each.
    for (const segment of container.querySelectorAll('.sn-segment')) {
      expect(segment.querySelectorAll('rect')).toHaveLength(2);
    }
  });

  it('draws a × on a crashed head instead of its eyes', () => {
    const { container } = draw({ status: 'over', crash: 'wall' });
    expect(container.querySelector('.sn-crash')).not.toBeNull();
    expect(container.querySelectorAll('.sn-eye')).toHaveLength(0);
  });

  it('draws the heading chosen while paused as an arrow, apart from the eyes', () => {
    const { container } = draw({ status: 'paused', pending: 'up' });
    expect(container.querySelector('.sn-pending')).not.toBeNull();
    // The eyes still face the way the snake last moved.
    for (const eye of container.querySelectorAll('.sn-eye')) {
      expect(Number(eye.getAttribute('cx')) - 4).toBeGreaterThan(0.5);
    }
  });

  it('draws no food on a full board, and no text anywhere', () => {
    const { container } = draw({ food: -1, status: 'cleared' });
    expect(container.querySelector('.sn-food')).toBeNull();
    expect(container.querySelector('text')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('shows only a window of the board when given one (Quick Rules)', () => {
    const { container } = draw({ view: { row: 4, col: 2, size: 6 } });
    const viewBox = container.querySelector('svg')!.getAttribute('viewBox')!.split(' ').map(Number);
    expect(viewBox[0]).toBeCloseTo(2 - 0.16);
    expect(viewBox[1]).toBeCloseTo(4 - 0.16);
    expect(viewBox[2]).toBeCloseTo(6.32);
  });

  it('is hidden from assistive technology itself — the stage carries its name', () => {
    const { container } = draw();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
