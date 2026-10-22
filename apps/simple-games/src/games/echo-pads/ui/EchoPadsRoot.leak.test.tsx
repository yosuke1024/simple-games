/**
 * The resource-release contract at the playback itself (docs/GAME_LIFECYCLE.md,
 * docs/ECHO_PADS_RULES.md §4, §12; test ⑥): the registry-wide sweep in
 * src/test/lifecycle.test.tsx mounts this game on its Quick Rules and never
 * plays a round, so it never sees the timer chain. Here the playback really
 * runs — on jsdom's real timers, not faked ones, because the question is
 * whether every timer that was set got cleared — and the game is stopped or
 * unmounted in the middle of it. After each, nothing the game registered may
 * be alive: the playback chain, the press light, the play clock, the window
 * key and blur listeners, the document visibility listener.
 *
 * The audio is a fake AudioContext (the shape of src/services/sound.test.ts)
 * that counts the oscillators started: after a Stop, a background or an
 * unmount, no new tone may start (§4 — nothing queued on the audio clock).
 * The sound service's own idle-suspend timer belongs to the shell, which
 * calls `releaseSound()` whenever a game leaves (app/App.tsx `leaveGame`);
 * the tests make that same call after unmounting, as the shell does.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { releaseSound, setSoundEnabled } from '@/services/sound';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { trackResources } from '@/test/lifecycle';
import { createLevelSession, LEAD_IN_MS } from '../game';
import { EP_STORAGE_KEYS } from '../storage/schemas';
import { EchoPadsRoot } from './EchoPadsRoot';

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
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(() => {
          started.push(osc.frequency.value);
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
  cleanup();
  releaseSound();
  Reflect.deleteProperty(window, 'AudioContext');
});

const taught = {
  [EP_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  // Quick: the shortest playback, so the real waits stay short.
  [EP_STORAGE_KEYS.prefs]: JSON.stringify({ schemaVersion: 1, pace: 'quick' }),
};

function mount() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <EchoPadsRoot onExit={() => undefined} kv={createMemoryKV(taught)} />
    </SettingsProvider>,
  );
}

/**
 * Each case waits on real timers for about 3 s (two playbacks and a 1.5 s
 * look). vitest's 5 s default was overrun on a machine running several suites
 * at once (2026-10-22, load average 16 on 4 cores); the bound is for the
 * machine, not for the game.
 */
const REAL_TIME_LIMIT_MS = 30_000;

const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

const playButton = () => document.querySelector<HTMLButtonElement>('.ep-play')!;
const lit = () => document.querySelectorAll('.ep-pad-lit').length;

/**
 * Waits in small real steps until a pad is lit, at most `limitMs`. A single
 * wait of the lead-in alone was flaky on a loaded machine: a timer that
 * fired late landed in the dark gap after the first light (a full-suite run
 * on 2026-10-22, with a browser running beside it).
 */
async function untilLit(limitMs: number) {
  const deadline = performance.now() + limitMs;
  while (lit() === 0 && performance.now() < deadline) await wait(5);
}

/** Mount, start level 1 from the home, press ▶ and wait for the first light. */
async function startPlayback() {
  const view = mount();
  fireEvent.click(await screen.findByRole('button', { name: /^Level 1/ }));
  fireEvent.click(playButton());
  await untilLit(LEAD_IN_MS + 3_000);
  // Without a light and a tone this test would be checking an idle board.
  expect(lit()).toBe(1);
  expect(started.length).toBeGreaterThanOrEqual(1);
  return view;
}

async function warmUp() {
  // First-use module singletons (the sound service's visibilitychange,
  // Capacitor's web shims) are the shell's lifetime, not the game's.
  const view = await startPlayback();
  view.unmount();
  releaseSound();
}

it(
  'stops the chain and drops its listeners when unmounted mid-playback',
  async () => {
    await warmUp();
    const tracker = trackResources();
    try {
      const view = await startPlayback();
      const tones = started.length;
      view.unmount();
      releaseSound();
      tracker.assertReleased();
      await wait(1_500);
      expect(started.length).toBe(tones);
    } finally {
      tracker.restore();
    }
  },
  REAL_TIME_LIMIT_MS,
);

it(
  'sounds nothing after Stop, and leaves nothing behind',
  async () => {
    await warmUp();
    const tracker = trackResources();
    try {
      const view = await startPlayback();
      fireEvent.click(playButton());
      const tones = started.length;
      await wait(1_500);
      expect(started.length).toBe(tones);
      expect(lit()).toBe(0);
      view.unmount();
      releaseSound();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  },
  REAL_TIME_LIMIT_MS,
);

it(
  'sounds nothing after the page is hidden, and leaves nothing behind',
  async () => {
    await warmUp();
    const tracker = trackResources();
    try {
      const view = await startPlayback();
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      Reflect.deleteProperty(document, 'visibilityState');
      const tones = started.length;
      await wait(1_500);
      expect(started.length).toBe(tones);
      view.unmount();
      releaseSound();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  },
  REAL_TIME_LIMIT_MS,
);

it(
  'leaves nothing behind when unmounted right after a press, its light still on',
  async () => {
    await warmUp();
    const tracker = trackResources();
    try {
      const view = await startPlayback();
      await wait(1_500);
      const first = createLevelSession(1, 0)!.sequence[0]!;
      const pads = within(screen.getByRole('group', { name: 'Pads' })).getAllByRole('button');
      fireEvent.click(pads[first]!);
      view.unmount();
      releaseSound();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  },
  REAL_TIME_LIMIT_MS,
);
