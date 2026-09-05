/**
 * ResultAdSlot's own decision, in both bundles.
 *
 * Outside the web-mode build: renders nothing AND counts nothing — the
 * native app's result screens carry no ad state at all.
 *
 * In the web-mode build (issue #120): whether a result view carries the ad
 * is layered on top of two independent signals — resultCadence.ts's "every
 * 3rd result, never the first" and the viewport being tall enough that the
 * ad does not squeeze the result dialog (MIN_VIEWPORT_HEIGHT). AdUnit itself
 * is mocked out below so those cases are about ResultAdSlot's own call, not
 * about the ad unit's own rendering — that is AdUnit's tests' subject. The
 * bundling gate itself is verified by check-dist-ads-separation.sh.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setWebAdsConfigForTesting } from '../../services/ads/web/config';
import {
  recordResultView,
  resetResultCadenceForTesting,
} from '../../services/ads/web/resultCadence';
import { ResultAdSlot } from './ResultAdSlot';

vi.mock('../../services/ads/web/AdUnit', () => ({ default: () => <div data-testid="ad" /> }));

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

describe('ResultAdSlot in the web-mode bundle: the ad never squeezes the result', () => {
  function setViewportHeight(height: number) {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  }

  afterEach(() => {
    cleanup();
    setViewportHeight(768);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /**
   * ResultAdSlot decides which AdUnit to lazy-import from
   * `import.meta.env.MODE` at module load, so each case needs its own fresh
   * copy of that module — and of config.ts and resultCadence.ts alongside
   * it, so the bindings this test calls (`setWebAdsConfigForTesting`,
   * `recordResultView`) reach the exact module instances the freshly loaded
   * ResultAdSlot itself reads from.
   */
  async function loadWebResultAdSlot() {
    vi.resetModules();
    vi.stubEnv('MODE', 'web');
    const config = await import('../../services/ads/web/config');
    const cadence = await import('../../services/ads/web/resultCadence');
    const { ResultAdSlot: WebResultAdSlot } = await import('./ResultAdSlot');
    return { config, cadence, WebResultAdSlot };
  }

  it('stays empty on a short viewport, and leaves the cadence for the next real view', async () => {
    const { config, cadence, WebResultAdSlot } = await loadWebResultAdSlot();
    config.setWebAdsConfigForTesting({
      testMode: true,
      client: 'test-client',
      slotResult: 'test-slot',
    });
    // Two results already viewed this session: on a tall screen the third
    // view would be the one that carries the ad (resultCadence.ts's "every
    // 3rd result, never the first").
    cadence.recordResultView();
    cadence.recordResultView();
    setViewportHeight(480); // below MIN_VIEWPORT_HEIGHT (560)

    const { container } = render(<WebResultAdSlot />);

    expect(container).toBeEmptyDOMElement();
    // Not consumed: the next honest view is still the session's 3rd, so it
    // still carries the ad. A short-viewport mount must be invisible to the
    // cadence, not merely invisible on screen — otherwise the very next
    // (tall-enough) result would silently skip the ad it was owed.
    expect(cadence.recordResultView()).toBe(true);
  });

  it('renders the ad and reserves its wrapper on a tall enough viewport', async () => {
    const { config, cadence, WebResultAdSlot } = await loadWebResultAdSlot();
    config.setWebAdsConfigForTesting({
      testMode: true,
      client: 'test-client',
      slotResult: 'test-slot',
    });
    cadence.recordResultView();
    cadence.recordResultView();
    setViewportHeight(700);

    const { container, findByTestId } = render(<WebResultAdSlot />);

    expect(await findByTestId('ad')).toBeInTheDocument();
    // The reserved box, not just the ad inside it — this is what keeps the
    // overlay from growing once the lazy chunk resolves.
    expect(container.firstChild).toHaveClass('web-ad-slot', 'web-ad-slot-result');
  });

  it('stays empty on the session’s first result, even on a tall viewport', async () => {
    const { config, WebResultAdSlot } = await loadWebResultAdSlot();
    config.setWebAdsConfigForTesting({
      testMode: true,
      client: 'test-client',
      slotResult: 'test-slot',
    });
    setViewportHeight(700);

    const { container } = render(<WebResultAdSlot />);

    expect(container).toBeEmptyDOMElement();
  });
});
