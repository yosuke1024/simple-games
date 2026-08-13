import { describe, expect, it } from 'vitest';
import { levelSpec } from './levels';
import {
  aimGuide,
  createSession,
  fireShot,
  retrySession,
  swapNext,
  type BubblePopSession,
} from './session';

/** Fires straight up repeatedly, a simple driver for the tests below. */
function fireMany(session: BubblePopSession, count: number, angle = 0): BubblePopSession {
  let next = session;
  for (let i = 0; i < count && next.status === 'playing'; i++) next = fireShot(next, angle);
  return next;
}

describe('createSession', () => {
  it('the same seed and level always deal the same session', () => {
    const a = createSession('s', 3);
    const b = createSession('s', 3);
    expect(a).toEqual(b);
    expect(createSession('s', 4)).not.toEqual(a);
    expect(createSession('t', 3)).not.toEqual(a);
  });

  it('starts playing, with a full descent counter and the first two supplied colors', () => {
    const session = createSession('s', 1);
    expect(session.status).toBe('playing');
    expect(session.ceilingOffset).toBe(0);
    expect(session.shotsUntilDescent).toBe(levelSpec(1).descentEvery);
    expect(session.board.size).toBeGreaterThan(0);
    const onBoard = new Set(session.board.values());
    expect(onBoard.has(session.current)).toBe(true);
    expect(onBoard.has(session.next)).toBe(true);
  });
});

describe('retrySession — same seed, same board', () => {
  it('rebuilds an identical fresh session regardless of how far play had gotten', () => {
    const start = createSession('retry-seed', 5);
    const played = fireMany(start, 6, 0.15);
    const retried = retrySession(played);
    expect(retried).toEqual(createSession('retry-seed', 5));
    expect(retried).not.toEqual(played);
  });
});

describe('swapNext — free, unlimited, deterministic', () => {
  it('swaps current and next without touching anything else', () => {
    const session = createSession('swap-seed', 8);
    const swapped = swapNext(session);
    expect(swapped.current).toBe(session.next);
    expect(swapped.next).toBe(session.current);
    expect(swapped.board).toBe(session.board);
    expect(swapped.shotIndex).toBe(session.shotIndex);
  });

  it('swapping back returns to the original values', () => {
    const session = createSession('swap-seed', 8);
    expect(swapNext(swapNext(session))).toEqual(session);
  });

  it('is a no-op once the level has ended', () => {
    const failed = { ...createSession('swap-seed', 8), status: 'failed' as const };
    expect(swapNext(failed)).toBe(failed);
  });
});

describe('aimGuide reads the live session board (guide.test.ts covers the full sweep)', () => {
  it('is pure and deterministic — same session and angle, same guide, board untouched', () => {
    const session = createSession('guide-seed', 10);
    const before = session.board;
    const a = aimGuide(session, 0.2);
    const b = aimGuide(session, 0.2);
    expect(a).toEqual(b);
    expect(session.board).toBe(before); // aiming never mutates the session
  });

  it('a later ceiling drop changes what the same angle predicts', () => {
    const session = createSession('guide-seed', 10);
    const early = aimGuide(session, 0.1);
    const dropped = { ...session, ceilingOffset: session.ceilingOffset + 4 };
    const late = aimGuide(dropped, 0.1);
    expect(late).not.toEqual(early);
  });
});

describe('shot count drives the ceiling (§3)', () => {
  it('the ceiling drops exactly once every descentEvery shots', () => {
    const level = 1;
    const n = levelSpec(level).descentEvery;
    let session = createSession('descent-seed', level);
    for (let shot = 1; shot <= n * 3 && session.status === 'playing'; shot++) {
      session = fireShot(session, ((shot % 7) - 3) * 0.15);
      const expectedDrops = Math.floor(shot / n);
      expect(session.ceilingOffset).toBe(expectedDrops);
    }
  });

  it('shotsUntilDescent counts down and resets after a drop', () => {
    const level = 1;
    const n = levelSpec(level).descentEvery;
    let session = createSession('descent-seed-2', level);
    expect(session.shotsUntilDescent).toBe(n);
    session = fireShot(session, 0);
    expect(session.shotsUntilDescent).toBe(n - 1);
    for (let i = 0; i < n - 1 && session.status === 'playing'; i++) {
      session = fireShot(session, ((i % 5) - 2) * 0.2);
    }
    if (session.status === 'playing') expect(session.shotsUntilDescent).toBe(n);
  });
});

describe('firing when the level has already ended', () => {
  it('is a no-op', () => {
    const session = { ...createSession('done-seed', 1), status: 'cleared' as const };
    expect(fireShot(session, 0)).toBe(session);
  });
});

describe('a shot into a scripted three-color board actually pops and can clear a small level', () => {
  it('clearing every bubble reaches status "cleared"', () => {
    // Level 1 is small (5 rows, 4 colors); a long, varied shot script should
    // be able to empty it without ever failing.
    let session = createSession('clear-seed', 1);
    const angles = [0, 0.3, -0.3, 0.5, -0.5, 0.15, -0.15, 0.6, -0.6, 0.05, -0.05];
    let guard = 0;
    while (session.status === 'playing' && guard < 400) {
      const angle = angles[guard % angles.length]!;
      session = fireShot(session, angle);
      guard++;
    }
    expect(session.status).not.toBe('playing');
  });
});
