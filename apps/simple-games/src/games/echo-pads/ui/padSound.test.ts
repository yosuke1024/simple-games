/**
 * The pad tones and the audio unlock this game added to services/sound.ts
 * (docs/ECHO_PADS_RULES.md §12): one tone per pad on the existing pentatonic
 * ladder — pads 0–3 for four pads, 0–5 for six, distinct pitches, pad 5 an
 * octave over pad 0 — and `primeSound()`, which creates or resumes the
 * context without a sound and does nothing at all with sound off. The
 * existing sounds keep their frequencies (src/services/sound.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  padTone,
  padToneFrequency,
  PAD_TONE_COUNT,
  primeSound,
  releaseSound,
  setSoundEnabled,
} from '@/services/sound';

const started: number[] = [];
let contexts = 0;
let resumes = 0;

function installFakeAudio(state: 'running' | 'suspended'): void {
  class FakeAudioContext {
    state: 'running' | 'suspended' = state;
    currentTime = 0;
    destination = {};
    constructor() {
      contexts += 1;
    }
    resume = vi.fn(() => {
      resumes += 1;
      this.state = 'running';
      return Promise.resolve();
    });
    suspend = vi.fn(() => {
      this.state = 'suspended';
      return Promise.resolve();
    });
    createGain() {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
    }
    createOscillator() {
      const osc = {
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(() => started.push(osc.frequency.value)),
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
  resumes = 0;
  setSoundEnabled(true);
});

afterEach(() => {
  releaseSound();
  Reflect.deleteProperty(window, 'AudioContext');
});

describe('pad tones (§12)', () => {
  it('gives each of the six pads its own pitch, rising, pad 5 an octave over pad 0', () => {
    const pitches = Array.from({ length: PAD_TONE_COUNT }, (_, pad) => padToneFrequency(pad));
    expect(new Set(pitches.map((f) => f.toFixed(3))).size).toBe(6);
    for (let i = 1; i < pitches.length; i++) expect(pitches[i]!).toBeGreaterThan(pitches[i - 1]!);
    expect(pitches[5]! / pitches[0]!).toBeCloseTo(2, 6);
    // Rungs 0..3 of the ladder: 0, 2, 4, 7 semitones.
    expect(pitches[3]! / pitches[0]!).toBeCloseTo(2 ** (7 / 12), 6);
  });

  it('sounds the pad asked for, and nothing for a pad that does not exist', () => {
    installFakeAudio('running');
    padTone(2, 450);
    expect(started).toEqual([padToneFrequency(2)]);
    padTone(6, 450);
    padTone(-1, 450);
    padTone(1.5, 450);
    expect(started).toHaveLength(1);
  });

  it('is silent with sound off', () => {
    installFakeAudio('running');
    setSoundEnabled(false);
    padTone(0, 450);
    expect(started).toEqual([]);
  });
});

describe('primeSound (§12)', () => {
  it('resumes a suspended context without a sound', () => {
    installFakeAudio('suspended');
    // The service keeps one context for the process; suspend it, as the
    // background or the idle timer would.
    primeSound();
    releaseSound();
    resumes = 0;
    primeSound();
    expect(resumes).toBeGreaterThanOrEqual(1);
    expect(started).toEqual([]);
  });

  it('does nothing at all with sound off', () => {
    installFakeAudio('suspended');
    setSoundEnabled(false);
    const before = contexts;
    primeSound();
    expect(resumes).toBe(0);
    expect(contexts).toBe(before);
  });
});
