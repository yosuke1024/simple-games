/**
 * ResultAdSlot outside the web-mode build: renders nothing AND counts
 * nothing — the native app's result screens carry no ad state at all. The
 * web-mode rendering is covered by AdUnit's tests plus the cadence tests;
 * the bundling gate itself is verified by check-dist-ads-separation.sh.
 */
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setWebAdsConfigForTesting } from '../../services/ads/web/config';
import {
  recordResultView,
  resetResultCadenceForTesting,
} from '../../services/ads/web/resultCadence';
import { ResultAdSlot } from './ResultAdSlot';

afterEach(() => {
  setWebAdsConfigForTesting(null);
  resetResultCadenceForTesting();
});

describe('ResultAdSlot in a non-web-mode bundle', () => {
  it('renders nothing and leaves the cadence untouched', () => {
    setWebAdsConfigForTesting({ testMode: true, client: 'test-client', slotResult: 'test-slot' });
    const { container } = render(<ResultAdSlot />);
    render(<ResultAdSlot />);
    expect(container).toBeEmptyDOMElement();
    // Had those two mounts been counted, this third view would carry the ad.
    expect(recordResultView()).toBe(false);
  });
});
