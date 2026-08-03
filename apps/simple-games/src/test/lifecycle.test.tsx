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
import { trackResources } from './lifecycle';

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
