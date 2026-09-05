/**
 * Offline is a normal state, never an error (docs/OFFLINE_POLICY.md). This
 * pins that initNetwork() swallows every way the Capacitor Network plugin
 * can misbehave — missing entirely, or refusing to register a listener —
 * rather than letting a rejected promise escape and crash whatever awaited
 * it (issue #120 contract: offline / ad failure でゲームを止めない). A device
 * that is simply offline, or a WebView with no Network plugin at all, must
 * end up with a normal, readable isOnline() value, never a thrown error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { networkPlugin } = vi.hoisted(() => ({
  networkPlugin: { getStatus: vi.fn(), addListener: vi.fn() },
}));

vi.mock('@capacitor/network', () => ({ Network: networkPlugin }));

import { initNetwork, isOnline, setOnlineForTesting } from './network';

beforeEach(() => {
  networkPlugin.getStatus.mockReset();
  networkPlugin.addListener.mockReset();
});

afterEach(() => {
  setOnlineForTesting(true);
});

describe('when the plugin is unavailable', () => {
  // A plain-browser test host, or a WebView build without the plugin, has no
  // Network.getStatus at all. initNetwork() must not throw out of that —
  // whatever isOnline() already held (from navigator.onLine at module load)
  // is left exactly as it was.
  it('resolves and keeps a prior true reading when getStatus rejects', async () => {
    setOnlineForTesting(true);
    networkPlugin.getStatus.mockRejectedValue(new Error('plugin not implemented'));

    await expect(initNetwork()).resolves.toBeUndefined();

    expect(isOnline()).toBe(true);
  });

  it('resolves and keeps a prior false reading when getStatus rejects', async () => {
    setOnlineForTesting(false);
    networkPlugin.getStatus.mockRejectedValue(new Error('plugin not implemented'));

    await expect(initNetwork()).resolves.toBeUndefined();

    expect(isOnline()).toBe(false);
  });
});

describe('when addListener fails after a successful read', () => {
  // getStatus already ran and set the real status before addListener has
  // any say — a device that cannot register a change listener still knows
  // whether it is online right now. The catch around initNetwork() must not
  // discard that read on its way to swallowing the listener failure.
  it('keeps the status just read from getStatus, not the value from before initNetwork()', async () => {
    setOnlineForTesting(true); // deliberately the opposite of what getStatus reports below
    networkPlugin.getStatus.mockResolvedValue({ connected: false });
    networkPlugin.addListener.mockRejectedValue(new Error('addListener not supported'));

    await expect(initNetwork()).resolves.toBeUndefined();

    expect(isOnline()).toBe(false);
  });
});

describe('tracking live status changes', () => {
  it('reflects the initial read, then follows the networkStatusChange listener both ways', async () => {
    networkPlugin.getStatus.mockResolvedValue({ connected: false });
    networkPlugin.addListener.mockResolvedValue({ remove: vi.fn() });

    await initNetwork();
    expect(isOnline()).toBe(false);

    expect(networkPlugin.addListener).toHaveBeenCalledWith(
      'networkStatusChange',
      expect.any(Function),
    );
    const [, onStatusChange] = networkPlugin.addListener.mock.calls[0]!;

    onStatusChange({ connected: true });
    expect(isOnline()).toBe(true);

    onStatusChange({ connected: false });
    expect(isOnline()).toBe(false);
  });
});
