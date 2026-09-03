import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { adMob } = vi.hoisted(() => ({
  adMob: {
    requestConsentInfo: vi.fn(),
    showConsentForm: vi.fn(),
    showPrivacyOptionsForm: vi.fn(),
  },
}));

vi.mock('@capacitor-community/admob', () => ({
  AdMob: adMob,
  AdmobConsentStatus: {
    NOT_REQUIRED: 'NOT_REQUIRED',
    OBTAINED: 'OBTAINED',
    REQUIRED: 'REQUIRED',
    UNKNOWN: 'UNKNOWN',
  },
}));

import { setOnlineForTesting } from '../network';
import {
  canRequestAds,
  isPrivacyOptionsRequired,
  resetConsentForTesting,
  showPrivacyOptions,
  subscribeConsent,
} from './consent';

/** A consent answer with the fields this module actually reads. */
function info(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    status: 'NOT_REQUIRED',
    isConsentFormAvailable: false,
    canRequestAds: true,
    privacyOptionsRequirementStatus: 'NOT_REQUIRED',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setOnlineForTesting(true);
});

afterEach(() => {
  resetConsentForTesting();
  setOnlineForTesting(true);
});

describe('canRequestAds', () => {
  it('allows ads once UMP says so', async () => {
    adMob.requestConsentInfo.mockResolvedValue(info());
    expect(await canRequestAds()).toBe(true);
  });

  it('refuses ads when UMP says consent is still missing', async () => {
    adMob.requestConsentInfo.mockResolvedValue(info({ canRequestAds: false }));
    expect(await canRequestAds()).toBe(false);
  });

  it('shows the consent form when one is required and available', async () => {
    adMob.requestConsentInfo.mockResolvedValue(
      info({ status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false }),
    );
    adMob.showConsentForm.mockResolvedValue(info({ status: 'OBTAINED', canRequestAds: true }));
    expect(await canRequestAds()).toBe(true);
    expect(adMob.showConsentForm).toHaveBeenCalledTimes(1);
  });

  it('refuses ads when the form cannot be shown, even if UMP would allow them', async () => {
    // UMP can answer REQUIRED and canRequestAds = true at once. A form the
    // player never saw is not an answer, so this launch gets no ads.
    adMob.requestConsentInfo.mockResolvedValue(
      info({ status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: true }),
    );
    adMob.showConsentForm.mockRejectedValue(new Error('form failed to load'));
    expect(await canRequestAds()).toBe(false);
  });

  it('does not show a form that UMP has not made available', async () => {
    adMob.requestConsentInfo.mockResolvedValue(
      info({ status: 'REQUIRED', isConsentFormAvailable: false, canRequestAds: false }),
    );
    expect(await canRequestAds()).toBe(false);
    expect(adMob.showConsentForm).not.toHaveBeenCalled();
  });

  it('refuses ads and asks nothing at all while offline', async () => {
    setOnlineForTesting(false);
    expect(await canRequestAds()).toBe(false);
    expect(adMob.requestConsentInfo).not.toHaveBeenCalled();
  });

  it('spends no attempt while offline, so going online still works', async () => {
    setOnlineForTesting(false);
    expect(await canRequestAds()).toBe(false);
    expect(await canRequestAds()).toBe(false);
    setOnlineForTesting(true);
    adMob.requestConsentInfo.mockResolvedValue(info());
    expect(await canRequestAds()).toBe(true);
    expect(adMob.requestConsentInfo).toHaveBeenCalledTimes(1);
  });

  it('refuses ads when the consent request fails', async () => {
    adMob.requestConsentInfo.mockRejectedValue(new Error('no UMP config'));
    expect(await canRequestAds()).toBe(false);
  });

  it('stops retrying after two failures (no retry loop)', async () => {
    adMob.requestConsentInfo.mockRejectedValue(new Error('offline'));
    expect(await canRequestAds()).toBe(false);
    expect(await canRequestAds()).toBe(false);
    expect(await canRequestAds()).toBe(false);
    expect(adMob.requestConsentInfo).toHaveBeenCalledTimes(2);
  });

  it('asks once for concurrent callers', async () => {
    adMob.requestConsentInfo.mockResolvedValue(info());
    const [a, b] = await Promise.all([canRequestAds(), canRequestAds()]);
    expect([a, b]).toEqual([true, true]);
    expect(adMob.requestConsentInfo).toHaveBeenCalledTimes(1);
  });

  it('asks nothing more once ads are allowed', async () => {
    adMob.requestConsentInfo.mockResolvedValue(info());
    expect(await canRequestAds()).toBe(true);
    expect(await canRequestAds()).toBe(true);
    expect(adMob.requestConsentInfo).toHaveBeenCalledTimes(1);
  });
});

describe('privacy options', () => {
  it('is not required by default', () => {
    expect(isPrivacyOptionsRequired()).toBe(false);
  });

  it('becomes required when UMP says so, and notifies subscribers', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeConsent(listener);
    adMob.requestConsentInfo.mockResolvedValue(
      info({ privacyOptionsRequirementStatus: 'REQUIRED' }),
    );
    await canRequestAds();
    expect(isPrivacyOptionsRequired()).toBe(true);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('stays required when the consent form could not be shown', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeConsent(listener);
    adMob.requestConsentInfo.mockResolvedValue(
      info({
        status: 'REQUIRED',
        isConsentFormAvailable: true,
        canRequestAds: false,
        privacyOptionsRequirementStatus: 'REQUIRED',
      }),
    );
    adMob.showConsentForm.mockRejectedValue(new Error('no view controller'));
    expect(await canRequestAds()).toBe(false);
    // The pre-form answer already knew this, and Settings needs it: without
    // the row there is no way to withdraw consent (issue #95).
    expect(isPrivacyOptionsRequired()).toBe(true);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('re-reads consent after the form closes (it may have been withdrawn)', async () => {
    adMob.requestConsentInfo.mockResolvedValue(
      info({ privacyOptionsRequirementStatus: 'REQUIRED' }),
    );
    await canRequestAds();
    adMob.showPrivacyOptionsForm.mockResolvedValue(undefined);
    adMob.requestConsentInfo.mockResolvedValue(
      info({ canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' }),
    );
    await showPrivacyOptions();
    expect(await canRequestAds()).toBe(false);
  });

  it('stays quiet when the form cannot be shown', async () => {
    adMob.showPrivacyOptionsForm.mockRejectedValue(new Error('no form'));
    await expect(showPrivacyOptions()).resolves.toBeUndefined();
  });
});
