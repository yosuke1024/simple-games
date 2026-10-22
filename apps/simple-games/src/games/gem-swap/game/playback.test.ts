import { describe, expect, it } from 'vitest';
import { PLAYBACK_BEAT_MS, PLAYBACK_MIN_BEAT_MS, playbackIntervalMs } from './playback';
import { GEM_SHAPES, gemShape } from './gems';

describe('playback timing (§10)', () => {
  it('a short move plays at 160 ms a beat', () => {
    expect(PLAYBACK_BEAT_MS).toBe(160);
    expect(playbackIntervalMs(1)).toBe(160);
    expect(playbackIntervalMs(5)).toBe(160);
  });

  it('a longer move squeezes its beats to stay within about one second', () => {
    expect(playbackIntervalMs(6)).toBe(142);
    expect(playbackIntervalMs(9)).toBe(100);
    expect(playbackIntervalMs(15)).toBe(62);
    for (let stages = 1; stages <= 15; stages++) {
      const beat = playbackIntervalMs(stages)!;
      expect(beat * (stages + 1)).toBeLessThanOrEqual(1000);
    }
  });

  it('16 stages or more would need beats under 60 ms: no replay, the final board at once', () => {
    expect(PLAYBACK_MIN_BEAT_MS).toBe(60);
    expect(playbackIntervalMs(16)).toBeNull();
    expect(playbackIntervalMs(64)).toBeNull();
  });
});

describe('gem shapes (§10)', () => {
  it('six cuts, heart last, none of Bubble Pop’s six marks', () => {
    expect(GEM_SHAPES).toEqual(['hexagon', 'octagon', 'pear', 'marquise', 'shield', 'heart']);
    for (const mark of ['circle', 'triangle', 'square', 'diamond', 'star', 'crescent']) {
      expect(GEM_SHAPES).not.toContain(mark);
    }
    expect(gemShape(5)).toBe('heart');
    expect(gemShape(6)).toBeNull();
  });
});
