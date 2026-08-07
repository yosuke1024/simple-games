/**
 * The drawing and the hitbox have to be the same object.
 *
 * They are declared apart — sizes in `game/obstacles.ts`, shapes here — and
 * that gap is where a real bug lived: the cluster offsets were written in art
 * cells and applied as board pixels, so a row of three bushes was drawn 62px
 * wide inside a 106px hitbox, and the runner crashed into visibly empty
 * meadow. Nothing failed, because nothing was looking.
 *
 * These tests look. §7's promise — "a hit has to look like a hit" — is only
 * worth anything if the two sides are checked against each other.
 */
import { describe, expect, it } from 'vitest';
import { HIT_INSET, RUNNER_HEIGHT, RUNNER_WIDTH } from '../../game/constants';
import { OBSTACLE_KINDS } from '../../game/obstacles';
import type { ObstacleKindId } from '../../game/types';
import {
  BIRD_DRAW_OFFSET_X,
  BIRD_DRAW_OFFSET_Y,
  BIRD_FRAMES,
  OBSTACLE_SHAPES,
  RUNNER_BODY,
  RUNNER_LEGS,
  RUNNER_LEGS_AIR,
  type Rect,
} from './sprites';

interface Extent {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function extentOf(rects: readonly Rect[]): Extent {
  return rects.reduce<Extent>(
    (box, [x, y, w, h]) => ({
      left: Math.min(box.left, x),
      top: Math.min(box.top, y),
      right: Math.max(box.right, x + w),
      bottom: Math.max(box.bottom, y + h),
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  );
}

/** Whether any rectangle covers this point. */
const paints = (rects: readonly Rect[], px: number, py: number): boolean =>
  rects.some(([x, y, w, h]) => px >= x && px < x + w && py >= y && py < y + h);

describe('the runner', () => {
  it('is drawn over its whole collision box, in every pose', () => {
    // The box is the drawn rabbit inset on each side (§7), so the drawing has
    // to reach at least the inset edges and never past the declared size.
    // Mid-hop the feet tuck up, which is why this is a range and not equality.
    for (const legs of [...RUNNER_LEGS, RUNNER_LEGS_AIR]) {
      const box = extentOf([...RUNNER_BODY, ...legs]);
      expect(box.left).toBe(0);
      expect(box.top).toBe(0);
      expect(box.right).toBeLessThanOrEqual(RUNNER_WIDTH);
      expect(box.right).toBeGreaterThanOrEqual(RUNNER_WIDTH - HIT_INSET);
      expect(box.bottom).toBeLessThanOrEqual(RUNNER_HEIGHT);
      expect(box.bottom).toBeGreaterThanOrEqual(RUNNER_HEIGHT - HIT_INSET);
    }
  });
});

describe('what stands in the way', () => {
  const standing = Object.values(OBSTACLE_KINDS).filter((kind) => !kind.flying);

  for (const kind of standing) {
    it(`${kind.id} fills its hitbox exactly`, () => {
      const box = extentOf(OBSTACLE_SHAPES[kind.id]);
      expect(box.left).toBe(0);
      expect(box.top).toBe(0);
      // A drawing narrower than the box is an invisible wall; a wider one is
      // a shape the runner passes through. Both are the same bug.
      expect(box.right).toBe(kind.width);
      expect(box.bottom).toBe(kind.height);
    });
  }

  it('draws every cluster as its parts, evenly spaced', () => {
    // Cheap proof that a cluster is n copies and not one stretched shape.
    expect(OBSTACLE_SHAPES['bush-pair'].length).toBe(OBSTACLE_SHAPES.bush.length * 2);
    expect(OBSTACLE_SHAPES['bush-trio'].length).toBe(OBSTACLE_SHAPES.bush.length * 3);
    expect(OBSTACLE_SHAPES['hedge-pair'].length).toBe(OBSTACLE_SHAPES.hedge.length * 2);
  });
});

describe('the birds', () => {
  const flying: ObstacleKindId[] = ['bird-low', 'bird-high'];

  it('paint their whole hitbox in both frames', () => {
    // The box is the body, and the body is what both frames always draw — a
    // wing that is up in one frame and down in the other must never be the
    // thing that ends a run.
    for (const id of flying) {
      const kind = OBSTACLE_KINDS[id];
      const originX = -BIRD_DRAW_OFFSET_X;
      const originY = -BIRD_DRAW_OFFSET_Y;
      for (const [frame, rects] of BIRD_FRAMES.entries()) {
        for (let px = originX; px < originX + kind.width; px += 2) {
          for (let py = originY; py < originY + kind.height; py += 2) {
            expect(paints(rects, px, py), `${id} frame ${frame} at ${px},${py}`).toBe(true);
          }
        }
      }
    }
  });

  it('keep the whole hitbox inside the picture', () => {
    // The picture may be bigger than the box — a wing hangs above it, a beak
    // past it, and the runner passes harmlessly through both. What must never
    // happen is the reverse: box outside picture is an invisible wall.
    const kind = OBSTACLE_KINDS['bird-low'];
    for (const rects of BIRD_FRAMES) {
      const box = extentOf(rects);
      expect(box.left).toBeLessThanOrEqual(-BIRD_DRAW_OFFSET_X);
      expect(box.right).toBeGreaterThanOrEqual(-BIRD_DRAW_OFFSET_X + kind.width);
      expect(box.top).toBeLessThanOrEqual(-BIRD_DRAW_OFFSET_Y);
      expect(box.bottom).toBeGreaterThanOrEqual(-BIRD_DRAW_OFFSET_Y + kind.height);
    }
  });
});
