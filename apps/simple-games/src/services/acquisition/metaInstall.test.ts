/**
 * The Meta install measurement's JavaScript half (issue #204,
 * docs/META_ANDROID_ACQUISITION.md). What is pinned here is when the one
 * report may be requested and when the one question may be asked:
 *
 * - nothing at all off Android, or in a build without Meta;
 * - a report only after a yes, only online, at most once per launch, never
 *   after Meta acknowledged the install, and never after a no — including a
 *   no given while the report was waiting for the network;
 * - the question only for a new install, in English or Japanese, once, and
 *   booked as a no before it opens;
 * - every failure of the native side ends quietly, on the "off" side.
 *
 * The native half repeats the report's conditions before it starts the SDK;
 * that is exercised on a device (the runbook), not here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetaInstallState } from './plugin';

const { capacitorMock, pluginMock } = vi.hoisted(() => ({
  capacitorMock: { platform: 'android' },
  pluginMock: {
    getState: vi.fn<() => Promise<MetaInstallState>>(),
    setConsent: vi.fn<(options: { granted: boolean }) => Promise<MetaInstallState>>(),
    reportInstall: vi.fn<() => Promise<{ started: boolean }>>(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => capacitorMock.platform,
    isNativePlatform: () => capacitorMock.platform !== 'web',
  },
}));
vi.mock('@capacitor/network', () => ({
  Network: { getStatus: vi.fn(), addListener: vi.fn() },
}));
vi.mock('./plugin', () => ({ MetaInstall: pluginMock }));

import { setOnlineForTesting } from '../network';
import {
  META_ASK_WINDOW_MS,
  bookMetaInstallAsk,
  getMetaInstallState,
  initMetaInstall,
  resetMetaInstallForTesting,
  setMetaInstallAllowed,
  shouldAskMetaInstall,
  subscribeMetaInstall,
} from './metaInstall';

const NOW = Date.UTC(2026, 8, 27, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function nativeState(overrides: Partial<MetaInstallState> = {}): MetaInstallState {
  return {
    available: true,
    consent: 'unset',
    reported: false,
    installedAt: NOW - DAY,
    ...overrides,
  };
}

/** The native side as it answers setConsent: the state after the answer. */
function answerConsentLikeNative(base: MetaInstallState): void {
  pluginMock.setConsent.mockImplementation(({ granted }) =>
    Promise.resolve({ ...base, consent: granted ? 'granted' : 'declined' }),
  );
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  capacitorMock.platform = 'android';
  setOnlineForTesting(true);
  resetMetaInstallForTesting();
  pluginMock.getState.mockReset().mockResolvedValue(nativeState());
  pluginMock.setConsent.mockReset();
  answerConsentLikeNative(nativeState());
  pluginMock.reportInstall.mockReset().mockResolvedValue({ started: true });
});

afterEach(() => {
  setOnlineForTesting(true);
});

describe('builds and platforms without Meta', () => {
  it.each(['ios', 'web'])('never asks the native side anything on %s', async (platform) => {
    capacitorMock.platform = platform;
    await initMetaInstall();
    expect(pluginMock.getState).not.toHaveBeenCalled();
    expect(getMetaInstallState().available).toBe(false);
    expect(shouldAskMetaInstall('en', NOW)).toBe(false);
  });

  it('stays unavailable, asks nothing and sends nothing when the build has no Meta', async () => {
    pluginMock.getState.mockResolvedValue({ available: false });
    await initMetaInstall();
    expect(getMetaInstallState().available).toBe(false);
    expect(shouldAskMetaInstall('en', NOW)).toBe(false);

    await setMetaInstallAllowed(true);
    expect(pluginMock.setConsent).not.toHaveBeenCalled();
    expect(pluginMock.reportInstall).not.toHaveBeenCalled();
  });

  it('treats a native side that fails to answer as unavailable, without a throw', async () => {
    pluginMock.getState.mockRejectedValue(new Error('not implemented'));
    await expect(initMetaInstall()).resolves.toBeUndefined();
    expect(getMetaInstallState().available).toBe(false);
  });
});

describe('reading the native answer', () => {
  it('reads an unknown consent as a no, never as a question still to ask', async () => {
    pluginMock.getState.mockResolvedValue(
      nativeState({ consent: 'maybe' as MetaInstallState['consent'] }),
    );
    await initMetaInstall();
    expect(getMetaInstallState().consent).toBe('declined');
    expect(shouldAskMetaInstall('en', NOW)).toBe(false);
    expect(pluginMock.reportInstall).not.toHaveBeenCalled();
  });

  it('reads anything but a literal true as unavailable', async () => {
    pluginMock.getState.mockResolvedValue({
      ...nativeState(),
      available: 'yes' as unknown as boolean,
    });
    await initMetaInstall();
    expect(getMetaInstallState().available).toBe(false);
  });
});

describe('the one report', () => {
  it('is requested at boot after a yes, while online', async () => {
    pluginMock.getState.mockResolvedValue(nativeState({ consent: 'granted' }));
    await initMetaInstall();
    expect(pluginMock.reportInstall).toHaveBeenCalledTimes(1);
  });

  it('is never requested without a yes', async () => {
    for (const consent of ['unset', 'declined'] as const) {
      resetMetaInstallForTesting();
      pluginMock.getState.mockResolvedValue(nativeState({ consent }));
      await initMetaInstall();
    }
    expect(pluginMock.reportInstall).not.toHaveBeenCalled();
  });

  it('is never requested again once Meta acknowledged the install', async () => {
    pluginMock.getState.mockResolvedValue(nativeState({ consent: 'granted', reported: true }));
    await initMetaInstall();
    expect(pluginMock.reportInstall).not.toHaveBeenCalled();
  });

  it('waits offline for the way back online, then goes once — no retry loop', async () => {
    setOnlineForTesting(false);
    pluginMock.getState.mockResolvedValue(nativeState({ consent: 'granted' }));
    await initMetaInstall();
    expect(pluginMock.reportInstall).not.toHaveBeenCalled();

    setOnlineForTesting(true);
    expect(pluginMock.reportInstall).toHaveBeenCalledTimes(1);

    setOnlineForTesting(false);
    setOnlineForTesting(true);
    expect(pluginMock.reportInstall).toHaveBeenCalledTimes(1);
  });

  it('does not go when the player says no while it waits for the network', async () => {
    setOnlineForTesting(false);
    pluginMock.getState.mockResolvedValue(nativeState({ consent: 'granted' }));
    answerConsentLikeNative(nativeState({ consent: 'granted' }));
    await initMetaInstall();

    await setMetaInstallAllowed(false);
    setOnlineForTesting(true);
    await flush();

    expect(pluginMock.reportInstall).not.toHaveBeenCalled();
    expect(getMetaInstallState().consent).toBe('declined');
  });

  it('is requested at most once per launch, however often the switch is flipped', async () => {
    await initMetaInstall();
    await setMetaInstallAllowed(true);
    await setMetaInstallAllowed(false);
    await setMetaInstallAllowed(true);
    expect(pluginMock.reportInstall).toHaveBeenCalledTimes(1);
  });

  it('is not requested when the yes could not be recorded', async () => {
    await initMetaInstall();
    pluginMock.setConsent.mockRejectedValue(new Error('disk full'));
    await expect(setMetaInstallAllowed(true)).resolves.toBeUndefined();
    expect(pluginMock.reportInstall).not.toHaveBeenCalled();
    expect(getMetaInstallState().consent).toBe('declined');
  });

  it('swallows a native failure to start it', async () => {
    pluginMock.reportInstall.mockRejectedValue(new Error('boom'));
    pluginMock.getState.mockResolvedValue(nativeState({ consent: 'granted' }));
    await expect(initMetaInstall()).resolves.toBeUndefined();
    await flush();
    expect(pluginMock.reportInstall).toHaveBeenCalledTimes(1);
  });
});

describe('the one question', () => {
  it('is due for a new install, in English and Japanese', async () => {
    await initMetaInstall();
    expect(shouldAskMetaInstall('en', NOW)).toBe(true);
    expect(shouldAskMetaInstall('ja', NOW)).toBe(true);
  });

  it.each(['de', 'es', 'fr', 'hi', 'id', 'ko', 'pt-br', 'th', 'tr', 'vi', 'zh-hans', 'zh-hant'])(
    'is never asked in a machine-translated language (%s)',
    async (locale) => {
      await initMetaInstall();
      expect(shouldAskMetaInstall(locale, NOW)).toBe(false);
    },
  );

  it('is not asked of an install older than a week — an update is not a new install', async () => {
    pluginMock.getState.mockResolvedValue(nativeState({ installedAt: NOW - META_ASK_WINDOW_MS }));
    await initMetaInstall();
    expect(shouldAskMetaInstall('en', NOW)).toBe(false);
  });

  it('is not asked when the install time is unknown or in the future', async () => {
    for (const installedAt of [0, Number.NaN, NOW + DAY]) {
      resetMetaInstallForTesting();
      pluginMock.getState.mockResolvedValue(nativeState({ installedAt }));
      await initMetaInstall();
      expect(shouldAskMetaInstall('en', NOW)).toBe(false);
    }
  });

  it('is not asked once answered either way, or once Meta has the report', async () => {
    for (const overrides of [
      { consent: 'granted' as const },
      { consent: 'declined' as const },
      { reported: true },
    ]) {
      resetMetaInstallForTesting();
      pluginMock.getState.mockResolvedValue(nativeState(overrides));
      await initMetaInstall();
      expect(shouldAskMetaInstall('en', NOW)).toBe(false);
    }
  });

  it('is booked as a no before it opens, so closing it is an answer', async () => {
    await initMetaInstall();
    bookMetaInstallAsk();
    await flush();

    expect(pluginMock.setConsent).toHaveBeenCalledWith({ granted: false });
    expect(getMetaInstallState().consent).toBe('declined');
    expect(shouldAskMetaInstall('en', NOW)).toBe(false);
    expect(pluginMock.reportInstall).not.toHaveBeenCalled();
  });

  it('is not asked twice in one launch even if the booking could not be written', async () => {
    await initMetaInstall();
    pluginMock.setConsent.mockRejectedValue(new Error('disk full'));
    bookMetaInstallAsk();
    await flush();
    expect(shouldAskMetaInstall('en', NOW)).toBe(false);
  });

  it('turns into the report when the answer is yes', async () => {
    await initMetaInstall();
    bookMetaInstallAsk();
    await flush();
    await setMetaInstallAllowed(true);

    expect(pluginMock.setConsent).toHaveBeenLastCalledWith({ granted: true });
    expect(getMetaInstallState().consent).toBe('granted');
    expect(pluginMock.reportInstall).toHaveBeenCalledTimes(1);
  });
});

describe('subscription', () => {
  it('tells React when the answer changes', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMetaInstall(listener);
    await initMetaInstall();
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    unsubscribe();
    await setMetaInstallAllowed(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
