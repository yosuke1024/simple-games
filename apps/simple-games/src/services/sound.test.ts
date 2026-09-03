/**
 * The pitch ladder (sound.ts): feedback that carries a "how much" says it
 * in pitch, and nothing else — not tempo, not loudness. What a test can pin
 * down is the frequency each call asks the oscillator for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSoundEnabled, SOUND_STEP_MAX, sounds } from './sound';

interface FakeOscillator {
  frequency: { value: number };
}

const started: number[] = [];

function installFakeAudio(): void {
  class FakeGain {
    gain = {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };
    connect = vi.fn();
  }
  class FakeAudioContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    resume = vi.fn(() => Promise.resolve());
    suspend = vi.fn(() => Promise.resolve());
    createGain() {
      return new FakeGain();
    }
    createOscillator(): FakeOscillator & Record<string, unknown> {
      const osc = {
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(function (this: FakeOscillator) {
          started.push(this.frequency.value);
        }),
        stop: vi.fn(),
      };
      return osc;
    }
  }
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: FakeAudioContext,
  });
}

beforeEach(() => {
  started.length = 0;
  installFakeAudio();
  setSoundEnabled(true);
});

afterEach(() => {
  Reflect.deleteProperty(window, 'AudioContext');
});

const ratio = (a: number, b: number) => a / b;

describe('the pitch ladder', () => {
  it('plays the base pair at step 0', () => {
    sounds.match();
    expect(started).toEqual([523, 659]);
  });

  it('lifts a step by whole rungs of a major pentatonic', () => {
    sounds.match(0);
    const base = [...started];
    started.length = 0;
    sounds.match(3);
    // Rung 3 is seven semitones — a perfect fifth — above the base.
    expect(ratio(started[0]!, base[0]!)).toBeCloseTo(2 ** (7 / 12), 6);
    expect(ratio(started[1]!, base[1]!)).toBeCloseTo(2 ** (7 / 12), 6);
  });

  it('never goes past the top rung', () => {
    sounds.match(SOUND_STEP_MAX);
    const top = [...started];
    started.length = 0;
    sounds.match(SOUND_STEP_MAX + 40);
    expect(started).toEqual(top);
    // Two octaves up, exactly.
    expect(ratio(top[0]!, 523)).toBeCloseTo(4, 6);
  });

  it('treats a negative or fractional step as the rung below it', () => {
    sounds.match(-2);
    expect(started).toEqual([523, 659]);
    started.length = 0;
    sounds.match(1.9);
    expect(ratio(started[0]!, 523)).toBeCloseTo(2 ** (2 / 12), 6);
  });
});

describe('clear', () => {
  it('is the plain three-note arpeggio for one line', () => {
    sounds.clear();
    expect(started).toEqual([523, 659, 784]);
  });

  it('adds a chord, one rung up per extra line, for two or more', () => {
    sounds.clear(2);
    // Arpeggio a rung up, then the root and third ring again under the fifth.
    expect(started).toHaveLength(5);
    expect(ratio(started[0]!, 523)).toBeCloseTo(2 ** (2 / 12), 6);
    expect(started[3]).toBeCloseTo(started[0]!, 6);
    expect(started[4]).toBeCloseTo(started[1]!, 6);
  });
});

describe('when sound is off', () => {
  it('asks the hardware for nothing', () => {
    setSoundEnabled(false);
    sounds.match(4);
    sounds.clear(3);
    expect(started).toEqual([]);
  });
});
