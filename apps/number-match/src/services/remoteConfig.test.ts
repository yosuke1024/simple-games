import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryKV } from '../storage/kv';
import { STORAGE_KEYS } from '../storage/schemas';
import {
  applyFetchedValues,
  DEFAULT_REMOTE_CONFIG,
  getRemoteConfig,
  initRemoteConfig,
  resetRemoteConfigForTesting,
} from './remoteConfig';

afterEach(resetRemoteConfigForTesting);

describe('remote config', () => {
  it('uses bundled defaults when nothing is cached', async () => {
    await initRemoteConfig(createMemoryKV());
    expect(getRemoteConfig()).toEqual(DEFAULT_REMOTE_CONFIG);
  });

  it('merges cached overrides of the right type (kill switch works offline)', async () => {
    const kv = createMemoryKV();
    await applyFetchedValues({ interstitial_enabled: false, interstitial_daily_limit: 1 }, 42, kv);
    expect(getRemoteConfig().interstitial_enabled).toBe(false);
    expect(getRemoteConfig().interstitial_daily_limit).toBe(1);

    // A fresh boot re-reads the cache.
    resetRemoteConfigForTesting();
    await initRemoteConfig(kv);
    expect(getRemoteConfig().interstitial_enabled).toBe(false);
  });

  it('ignores wrong-typed and unknown values', async () => {
    const kv = createMemoryKV({
      [STORAGE_KEYS.rcCache]: JSON.stringify({
        schemaVersion: 1,
        values: { interstitial_enabled: 0, banner_enabled: 'nope', unknown_key: true },
        fetchedAt: 1,
      }),
    });
    await initRemoteConfig(kv);
    expect(getRemoteConfig()).toEqual(DEFAULT_REMOTE_CONFIG);
  });

  it('ignores out-of-range numbers so corrupt caches cannot disable frequency caps', async () => {
    const kv = createMemoryKV();
    await applyFetchedValues(
      {
        interstitial_daily_limit: 1e15,
        interstitial_min_interval_minutes: -1,
        interstitial_min_play_minutes: 5,
      },
      42,
      kv,
    );
    const config = getRemoteConfig();
    expect(config.interstitial_daily_limit).toBe(DEFAULT_REMOTE_CONFIG.interstitial_daily_limit);
    expect(config.interstitial_min_interval_minutes).toBe(
      DEFAULT_REMOTE_CONFIG.interstitial_min_interval_minutes,
    );
    expect(config.interstitial_min_play_minutes).toBe(5);
  });
});
