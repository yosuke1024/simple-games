/**
 * WebAdSlot outside the web-mode build: always null, even when the ad config
 * says ads are on. This is what every native and test bundle sees — the
 * AdSense reference only exists behind the build-time `--mode web` gate, and
 * the two built artifacts are checked in CI
 * (.github/scripts/check-dist-ads-separation.sh). The web-mode rendering
 * itself is AdUnit's own test file plus a `pnpm dev:web` session.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setWebAdsConfigForTesting } from '../../services/ads/web/config';
import { WebAdSlot } from './WebAdSlot';

afterEach(() => {
  cleanup();
  setWebAdsConfigForTesting(null);
});

describe('WebAdSlot in a non-web-mode bundle', () => {
  it('renders nothing regardless of ad configuration', () => {
    setWebAdsConfigForTesting({ testMode: true, client: 'test-client', slotHome: 'test-slot' });
    const { container } = render(<WebAdSlot />);
    expect(container).toBeEmptyDOMElement();
  });
});

vi.mock('../../services/ads/web/AdUnit', () => ({ default: () => <div data-testid="ad" /> }));

/**
 * In the web-mode bundle, whether `.web-ad-slot` even exists is decided by
 * webAdsSlotEnabled('home') — a home display slot, not a result one — so this
 * mirrors ResultAdSlot.test.tsx's fresh-module harness rather than this
 * file's own describe above (which never reaches the `--mode web` branch at
 * all). AdUnit is mocked out here too: this block is about WebAdSlot's own
 * decision to reserve the wrapper, not about what AdUnit itself renders
 * inside it (AdUnit.test.tsx's subject).
 */
describe('WebAdSlot in the web-mode bundle', () => {
  afterEach(() => {
    cleanup();
    setWebAdsConfigForTesting(null);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadWebAdSlot() {
    vi.resetModules();
    vi.stubEnv('MODE', 'web');
    const config = await import('../../services/ads/web/config');
    const { WebAdSlot: WebModeAdSlot } = await import('./WebAdSlot');
    return { config, WebModeAdSlot };
  }

  it('reserves the wrapper and lets the ad arrive when the build carries a home slot', async () => {
    const { config, WebModeAdSlot } = await loadWebAdSlot();
    config.setWebAdsConfigForTesting({
      testMode: false,
      client: 'test-client',
      slotHome: 'test-slot',
      slotResult: null,
      frames: { anchor: false, home: false, result: false },
    });

    const { container, findByTestId } = render(<WebModeAdSlot />);

    const ad = await findByTestId('ad');
    expect(container.firstChild).toHaveClass('web-ad-slot');
    expect(container.firstChild).toContainElement(ad);
  });

  it('stays empty with no home slot — the reservation exists only when an ad can fill it', async () => {
    const { config, WebModeAdSlot } = await loadWebAdSlot();
    config.setWebAdsConfigForTesting({
      testMode: false,
      client: null,
      slotHome: null,
      slotResult: null,
      frames: { anchor: false, home: false, result: false },
    });

    const { container } = render(<WebModeAdSlot />);

    expect(container).toBeEmptyDOMElement();
  });
});
