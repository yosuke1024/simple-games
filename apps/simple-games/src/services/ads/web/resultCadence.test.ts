import { afterEach, describe, expect, it } from 'vitest';
import { recordResultView, resetResultCadenceForTesting } from './resultCadence';

afterEach(resetResultCadenceForTesting);

describe('result-ad cadence (docs/ADS_POLICY.md「Web 版」)', () => {
  it('carries the ad on every 3rd result and never on a session opener', () => {
    expect([recordResultView(), recordResultView(), recordResultView()]).toEqual([
      false,
      false,
      true,
    ]);
    expect([recordResultView(), recordResultView(), recordResultView()]).toEqual([
      false,
      false,
      true,
    ]);
  });
});
