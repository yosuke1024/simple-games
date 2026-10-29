/**
 * The board's two added motions — the flattening after a bounce and the
 * stretch in flight — and the one switch that turns both off: Reduced Motion
 * (docs/BOUNCE_UP_RULES.md §7「重さ」). `draw.test.ts` pins the pure function
 * and `weightOf`; this runs the real board on a recording 2D context and reads
 * the body's eyes, whose gap is 10 px at rest and 10 × the width factor
 * otherwise, to see that the board really asks for REST when it should:
 *
 * - the in-app setting asks for less motion — REST on every frame;
 * - the OS preference asks for it (matchMedia) — the same;
 * - neither asks — the body is drawn at its weight (a launch is at JUMP_SPEED,
 *   so it is 8% tall and the eyes close up);
 * - the preference changing under a board that is not stepping repaints it at
 *   once, so a stopped board never keeps the weight it was last drawn with.
 *
 * jsdom has no 2D context and no matchMedia, so both are stood in for here.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubAnimationFrames } from '@/test/lifecycle';
import { BO_STORAGE_KEYS } from '../storage/schemas';
import { BounceUpRoot } from './BounceUpRoot';
import { Finger, hasBoard, holdEntropy, layOutCanvas, pump, runState } from './test-driver';

const { deviceStore } = vi.hoisted(() => ({ deviceStore: new Map<string, string>() }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) => Promise.resolve({ value: deviceStore.get(key) ?? null }),
    set: ({ key, value }: { key: string; value: string }) => {
      deviceStore.set(key, value);
      return Promise.resolve();
    },
    remove: ({ key }: { key: string }) => {
      deviceStore.delete(key);
      return Promise.resolve();
    },
  },
}));

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/** The `fillRect` calls of the eyes (4×5), in the order drawn, since the last `clear`. */
let eyes: number[][] = [];
let restores: Array<() => void> = [];
let setOsReduced: (next: boolean) => void = () => undefined;

/** A 2D context that absorbs every call and keeps the eyes' rectangles. */
function recordingContext(): CanvasRenderingContext2D {
  return new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        if (prop === 'fillRect') {
          return (...args: number[]) => {
            if (args[2] === 4 && args[3] === 5) eyes.push(args);
          };
        }
        return () => undefined;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
}

/** A matchMedia whose reduced-motion answer the test sets, telling the listeners as it changes. */
function stubOsPreference(initial: boolean): () => void {
  let reduced = initial;
  const listeners = new Map<string, Set<() => void>>();
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query === REDUCED_QUERY && reduced;
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => {
      const set = listeners.get(query) ?? new Set<() => void>();
      set.add(listener);
      listeners.set(query, set);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.get(query)?.delete(listener);
    },
  })) as unknown as typeof window.matchMedia;
  setOsReduced = (next) => {
    reduced = next;
    act(() => {
      listeners.get(REDUCED_QUERY)?.forEach((listener) => listener());
    });
  };
  return () => {
    window.matchMedia = original;
    setOsReduced = () => undefined;
  };
}

beforeEach(() => {
  eyes = [];
  restores = [
    stubAnimationFrames(),
    layOutCanvas(),
    holdEntropy(),
    (() => {
      const spy = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockImplementation(((kind: string) =>
          kind === '2d'
            ? recordingContext()
            : null) as typeof HTMLCanvasElement.prototype.getContext);
      return () => spy.mockRestore();
    })(),
  ];
});

afterEach(async () => {
  cleanup();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  for (const restore of restores.reverse()) restore();
  deviceStore.clear();
});

/** Home → a `ready` board → a finger down and one frame: the run is running. */
async function startRun(settingReduced: boolean): Promise<void> {
  deviceStore.set(
    BO_STORAGE_KEYS.flags,
    JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  );
  render(
    <SettingsProvider
      initialSettings={{ ...settingsSchema.defaultValue(), reducedMotion: settingReduced }}
    >
      <BounceUpRoot onExit={vi.fn()} />
    </SettingsProvider>,
  );
  for (let i = 0; i < 5; i++) await act(async () => undefined);
  fireEvent.click(screen.getByRole('button', { name: /^Start Climbing/ }));
  expect(hasBoard()).toBe(true);
  new Finger().down();
  pump(1);
  expect(runState().status).toBe('running');
}

/** The gap between the two eyes of each body drawn since the last `clear`: 10 at REST. */
function eyeGaps(): number[] {
  const gaps: number[] = [];
  for (let i = 0; i + 1 < eyes.length; i += 2) gaps.push(eyes[i + 1]![0]! - eyes[i]![0]!);
  return gaps;
}

/** Pumps `frames` frames one at a time and returns the eye gap drawn on each. */
function gapsOverFrames(frames: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < frames; i++) {
    eyes = [];
    pump(1);
    out.push(...eyeGaps());
  }
  return out;
}

describe('Reduced Motion and the body’s weight (§7)', () => {
  it('draws the body at its weight when nothing asks for less motion', async () => {
    restores.push(stubOsPreference(false));
    await startRun(false);
    const gaps = gapsOverFrames(30);
    expect(gaps.length).toBeGreaterThan(0);
    // The launch is at JUMP_SPEED: +8% tall, so the eyes close up to ~9.6.
    expect(Math.min(...gaps)).toBeLessThan(9.9);
  });

  it('draws REST on every frame when the in-app setting asks for less motion', async () => {
    restores.push(stubOsPreference(false));
    await startRun(true);
    const gaps = gapsOverFrames(30);
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) expect(gap).toBeCloseTo(10, 9);
  });

  it('draws REST on every frame when the OS asks for less motion', async () => {
    restores.push(stubOsPreference(true));
    await startRun(false);
    const gaps = gapsOverFrames(30);
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) expect(gap).toBeCloseTo(10, 9);
  });

  it('repaints at once, without a frame, when the OS preference changes', async () => {
    restores.push(stubOsPreference(false));
    await startRun(false);
    pump(3);
    eyes = [];
    pump(1);
    expect(Math.min(...eyeGaps())).toBeLessThan(9.9);

    eyes = [];
    setOsReduced(true);
    const gaps = eyeGaps();
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) expect(gap).toBeCloseTo(10, 9);
  });
});
