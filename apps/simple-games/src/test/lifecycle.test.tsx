/**
 * The resource-release contract, enforced (docs/GAME_LIFECYCLE.md): every game
 * in the registry mounts alone, settles, unmounts — and afterwards no timer,
 * animation frame, or window/document listener registered while it lived may
 * still be alive. The arcade boards' running game loops get the same check at
 * their play screens, next to their own Root tests (they need the game's kv
 * seam, which lives behind the registry's narrow prop type).
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GAMES } from '@/app/registry';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { stubAnimationFrames, stubCanvas2d, stubMatchMedia, trackResources } from './lifecycle';

afterEach(cleanup);

const noop = () => undefined;

type RootComponent = Awaited<ReturnType<(typeof GAMES)[number]['loadRoot']>>['default'];

async function mountSettleUnmount(Root: RootComponent) {
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Root onExit={noop} />
    </SettingsProvider>,
  );
  // Let the async record loads land and the first real screen render.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
  view.unmount();
}

describe('the harness itself', () => {
  // A leak detector that cannot fail detects nothing: prove both verdicts.
  it('flags a resource that survives, passes one that is released', () => {
    const tracker = trackResources();
    try {
      const kept = window.setInterval(() => undefined, 60_000);
      const released = window.setInterval(() => undefined, 60_000);
      window.clearInterval(released);
      expect(() => tracker.assertReleased()).toThrowError(/setInterval/);
      window.clearInterval(kept);
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  });

  /**
   * The stubs' restore discipline (lifecycle.ts, the comment above `install`),
   * proved against the sequence a timed-out test actually produces: vitest
   * abandons the test mid-await, the next test installs its own stub on the
   * same global, and only then does the first test's `finally` run — so the
   * restores arrive A, B in install order, not B, A in nesting order. The
   * same global is read back as a tuple so requestAnimationFrame and
   * cancelAnimationFrame are checked as the pair they are swapped as.
   */
  const STUBS = [
    {
      name: 'stubCanvas2d',
      install: stubCanvas2d,
      read: (): readonly unknown[] => [HTMLCanvasElement.prototype.getContext],
    },
    {
      name: 'stubMatchMedia',
      install: stubMatchMedia,
      read: (): readonly unknown[] => [window.matchMedia],
    },
    {
      name: 'stubAnimationFrames',
      install: stubAnimationFrames,
      read: (): readonly unknown[] => [window.requestAnimationFrame, window.cancelAnimationFrame],
    },
  ];
  const same = (a: readonly unknown[], b: readonly unknown[]) =>
    a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

  for (const { name, install, read } of STUBS) {
    it(`${name}: a restore that arrives after the next test stubbed the same global neither strips that stub nor outlives it`, () => {
      const real = read();
      const restoreA = install();
      const stubA = read();
      expect(same(stubA, real), 'the first install changed nothing').toBe(false);
      // Test B installs over A's stub while A is still "running" its timeout.
      const restoreB = install();
      const stubB = read();
      expect(same(stubB, stubA), 'the second install changed nothing').toBe(false);

      // A's finally, late: B's stub must stay exactly as B installed it.
      restoreA();
      expect(same(read(), stubB), "A's late restore stripped B's stub").toBe(true);

      // B's finally: back to the real thing, not to the stubA B found on install.
      restoreB();
      expect(same(read(), real), "B's restore left a stub behind").toBe(true);

      // Restoring again is a no-op, whichever order the two arrived in.
      restoreA();
      restoreB();
      expect(same(read(), real)).toBe(true);
    });

    it(`${name}: nested installs restore in nesting order too`, () => {
      const real = read();
      const restoreA = install();
      const stubA = read();
      const restoreB = install();

      restoreB();
      expect(same(read(), stubA), "B's restore did not hand the global back to A").toBe(true);
      restoreA();
      expect(same(read(), real), "A's restore left a stub behind").toBe(true);
    });
  }
});

describe('a closed game leaves nothing running', () => {
  for (const game of GAMES) {
    it(`${game.id} releases timers, frames and listeners on unmount`, async () => {
      // Through the registry's own loader, so every loader is exercised in CI
      // and a broken lazy chunk fails here, not on a player's device.
      const Root = (await game.loadRoot()).default;

      // Warm-up pass: module singletons (sound service, Capacitor web shims)
      // register process-wide handlers on first use. Those belong to the
      // shell's lifetime and must not be charged to the game under test.
      await mountSettleUnmount(Root);

      const tracker = trackResources();
      try {
        await mountSettleUnmount(Root);
        tracker.assertReleased();
      } finally {
        tracker.restore();
      }
    });
  }
});
