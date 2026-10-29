/**
 * The board and the keys as a physical object (docs/SNAKE_RULES.md §13「見た目」
 * 「操作」, decided 2026-10-29): a tray with a rounded wall and a shade under
 * its top and left, beads with a thin edge, a printed grid, keys with a lip.
 * None of it is visible to jsdom, so what can be pinned is pinned from the
 * stylesheet and the markup: the numbers that have to agree with each other
 * (the frame's radius and the wall's corner), the order of the frame's
 * shadows, and the promise that nothing here moves.
 *
 * The look itself was not seen in a browser when it was written; these tests
 * keep the pieces from drifting apart, not the picture from being right.
 */
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cellAt } from '../game';
import { SnakeBoard } from './components/SnakeBoard';

afterEach(cleanup);

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const css = readFileSync(resolve('src/games/snake/ui/snake.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** The declarations of the first rule with exactly this selector, whitespace collapsed. */
function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  return css
    .slice(open + 1, css.indexOf('}', open))
    .replace(/\s+/g, ' ')
    .trim();
}

function draw() {
  return render(
    <SnakeBoard
      body={[cellAt(6, 4), cellAt(6, 3), cellAt(5, 3), cellAt(5, 2)]}
      food={cellAt(2, 9)}
      direction="right"
      status="running"
      crash={null}
      pending={null}
    />,
  );
}

const num = (element: Element, name: string) => Number(element.getAttribute(name));

describe('the board is a tray (§13「見た目」)', () => {
  it('wears the collection frame, the lift first, on the board box', () => {
    const frame = rule('.sn-stage-wrap');
    expect(frame).toContain(
      'box-shadow: 0 3px 0 var(--line), 0 0 0 3px var(--paper), 0 0 0 4px var(--line), 0 8px 18px var(--accent-ring-soft);',
    );
  });

  it("turns the wall's corner: the frame's radius is the wall's outer radius over the box", () => {
    const { container } = draw();
    const wall = container.querySelector('.sn-wall')!;
    const floor = container.querySelector('.sn-floor')!;
    const [, , viewBoxWidth] = container.querySelector('svg')!.getAttribute('viewBox')!.split(' ');
    const stroke = num(wall, 'stroke-width');
    // The wall's centre line is rounded; its stroke reaches half a width either side.
    const outer = num(wall, 'rx') + stroke / 2;
    const inner = num(wall, 'rx') - stroke / 2;
    // The floor ends where the wall's inside begins, so the two corners meet.
    expect(num(floor, 'rx')).toBeCloseTo(inner, 5);
    const share = /border-radius:\s*([\d.]+)%/.exec(rule('.sn-stage-wrap'))?.[1];
    expect(share).toBeDefined();
    // 2.5% against 0.36 / 14.32 = 2.514%: the same corner to a hundredth of a percent.
    expect(Number(share) / 100).toBeCloseTo(outer / Number(viewBoxWidth), 3);
  });

  it('casts one static shade under the wall, between the floor and the grid', () => {
    const { container } = draw();
    const recess = container.querySelectorAll('.sn-recess');
    expect(recess).toHaveLength(1);
    const order = [...container.querySelector('svg')!.children].map((child) =>
      child.getAttribute('class'),
    );
    expect(order.indexOf('sn-floor')).toBeLessThan(order.indexOf('sn-recess'));
    expect(order.indexOf('sn-recess')).toBeLessThan(order.indexOf('sn-grid'));
    expect(order.indexOf('sn-grid')).toBeLessThan(order.indexOf('sn-wall'));
    expect(rule('.sn-recess')).toBe('fill: var(--sn-dent);');
  });

  it('prints the grid at 1px whatever the board measures', () => {
    const grid = rule('.sn-grid');
    expect(grid).toContain('stroke-width: 1px;');
    expect(grid).toContain('vector-effect: non-scaling-stroke;');
  });
});

describe('the snake is beads on a cord (§13「見た目」)', () => {
  it('names its shapes sn-flesh, apart from the screen’s sn-body column', () => {
    const { container } = draw();
    expect(container.querySelector('.sn-body')).toBeNull();
    // A neck and a bead per segment (the head is not a segment: it has its own shape).
    expect(container.querySelectorAll('.sn-flesh')).toHaveLength(2 * 3);
    expect(container.querySelectorAll('.sn-head-shape')).toHaveLength(1);
    const edged = rule('.sn-flesh,\n.sn-head-shape');
    expect(edged).toContain('stroke: var(--ink);');
    expect(edged).toContain('stroke-opacity: 0.3;');
    expect(edged).toContain('stroke-width: 0.045;');
    // The layout column keeps its own rule, with no fill or stroke of a shape.
    expect(rule('.sn-body')).not.toMatch(/fill|stroke/);
  });

  it('draws each shape smaller by the edge, so the gaps between shapes stay open', () => {
    const { container } = draw();
    const edge = Number(/stroke-width:\s*([\d.]+);/.exec(rule('.sn-flesh,\n.sn-head-shape'))?.[1]);
    expect(edge).toBeGreaterThan(0);
    const segment = container.querySelector('.sn-segment')!;
    const neck = segment.querySelector('rect:first-child')!;
    const bead = segment.querySelector('rect:last-child')!;
    const head = container.querySelector('.sn-head-shape')!;
    // A stroke is centred on the outline, so what the player sees is the shape plus the edge.
    const seen = (element: Element) => num(element, 'width') + edge;
    expect(seen(bead)).toBeCloseTo(0.78, 5);
    expect(seen(head)).toBeCloseTo(0.92, 5);
    expect(Math.min(num(neck, 'width'), num(neck, 'height')) + edge).toBeCloseTo(0.46, 5);
    // The gap between two segments that are not neighbours, and between the head and one.
    expect(1 - seen(bead)).toBeCloseTo(0.22, 5);
    expect((1 - seen(head)) / 2 + (1 - seen(bead)) / 2).toBeCloseTo(0.15, 5);
  });

  it('rounds the beads but never to a circle, which is the food’s alone', () => {
    const { container } = draw();
    const bead = container.querySelector('.sn-segment rect:last-child')!;
    const head = container.querySelector('.sn-head-shape')!;
    expect(num(bead, 'rx')).toBeLessThan(num(bead, 'width') / 2);
    expect(num(head, 'rx')).toBeLessThan(num(head, 'width') / 2);
    // Rounder than before (0.2 and 0.28), and the head stays the rounder.
    expect(num(bead, 'rx')).toBeGreaterThan(0.2);
    expect(num(head, 'rx')).toBeGreaterThan(0.28);
    expect(num(head, 'rx')).toBeGreaterThan(num(bead, 'rx'));
  });
});

describe('the keys have a lip (§13「操作」)', () => {
  it('raises a direction key like the shared one, and sinks it when pressed', () => {
    const key = rule('.sn-pad-btn');
    expect(key).toContain('background: linear-gradient(var(--surface), var(--paper));');
    expect(key).toContain('box-shadow: inset 0 1px 0 var(--surface), 0 2px 0 var(--line);');
    expect(rule('.sn-pad-btn:active')).toContain('box-shadow: inset 0 1px 2px var(--line);');
  });

  it('is painted after the board frame, so the frame’s soft shadow lies under the cross', () => {
    // Both are positioned boxes, which paint in document order; the cross comes after the board.
    expect(rule('.sn-stage-wrap')).toContain('position: relative;');
    expect(rule('.sn-pad')).toContain('position: relative;');
  });

  it('leaves a key that does nothing flat, pressed or not', () => {
    expect(rule('.sn-pad-off')).toContain('box-shadow: none;');
    expect(rule('.sn-pad-off:active')).toContain('box-shadow: none;');
    expect(rule('.sn-pad-toggle:disabled')).toContain('box-shadow: none;');
  });
});

describe('nothing here moves (§13「Reduced Motion」)', () => {
  it('has no transition, animation or keyframes, on the board or on a key', () => {
    expect(css).not.toMatch(/\btransition\b|\banimation\b|@keyframes/);
  });
});
