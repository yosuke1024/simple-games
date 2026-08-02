/**
 * WebAdSlot outside the web-mode build: always null, even when the ad config
 * says ads are on. This is what every native and test bundle sees — the
 * AdSense reference only exists behind the build-time `--mode web` gate, and
 * the two built artifacts are checked in CI
 * (.github/scripts/check-dist-ads-separation.sh). The web-mode rendering
 * itself is AdUnit's own test file plus a `pnpm dev:web` session.
 */
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setWebAdsConfigForTesting } from '../../services/ads/web/config';
import { WebAdSlot } from './WebAdSlot';

afterEach(() => {
  setWebAdsConfigForTesting(null);
});

describe('WebAdSlot in a non-web-mode bundle', () => {
  it('renders nothing regardless of ad configuration', () => {
    setWebAdsConfigForTesting({ testMode: true, client: 'test-client', slotHome: 'test-slot' });
    const { container } = render(<WebAdSlot />);
    expect(container).toBeEmptyDOMElement();
  });
});
