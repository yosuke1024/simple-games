/**
 * The 忍者AdMax plumbing (docs/ADS_POLICY.md「Web 版」): frame lookup is exact
 * per placement×size (no near-miss serving), a frame that arrives after t.js
 * already ran still gets requested, and a loader failure is final.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  adMaxAnchorChoice,
  adMaxFrameId,
  adMaxScriptFailed,
  adMaxUnitRendered,
  onAdMaxScriptError,
  requestAdMaxFrame,
  resetAdMaxLoaderForTesting,
  setAdMaxIdsForTesting,
} from './admax';

type AdMaxWindow = Window & { admaxads?: unknown[]; __admax_tag__?: unknown };

const admaxScripts = () => document.head.querySelectorAll('script[data-sg-admax]');
const admaxScript = () => document.head.querySelector('script[data-sg-admax]');
const lastAdmaxScript = () => document.head.querySelector('script[data-sg-admax]:last-of-type');

afterEach(() => {
  setAdMaxIdsForTesting(null);
  resetAdMaxLoaderForTesting();
  admaxScripts().forEach((script) => script.remove());
  delete (window as AdMaxWindow).admaxads;
  delete (window as AdMaxWindow).__admax_tag__;
});

describe('adMaxFrameId', () => {
  it('matches a frame only for its exact placement and size', () => {
    setAdMaxIdsForTesting({
      slotHome728x90: 'home-wide',
      slotHome320x100: 'home-mobile',
      slotResult320x100: 'result-mobile',
    });
    expect(adMaxFrameId('home', { width: 728, height: 90 })).toBe('home-wide');
    expect(adMaxFrameId('home', { width: 320, height: 100 })).toBe('home-mobile');
    expect(adMaxFrameId('result', { width: 320, height: 100 })).toBe('result-mobile');
    // AdMax has no 234×60 — that size has no fallback, in either placement.
    expect(adMaxFrameId('home', { width: 234, height: 60 })).toBeNull();
    expect(adMaxFrameId('result', { width: 234, height: 60 })).toBeNull();
    // The result placement never uses the wide size (compact rule).
    expect(adMaxFrameId('result', { width: 728, height: 90 })).toBeNull();
  });

  it('returns null when the frame for a size is not configured', () => {
    setAdMaxIdsForTesting({ slotHome728x90: 'home-wide' });
    expect(adMaxFrameId('home', { width: 320, height: 100 })).toBeNull();
  });
});

describe('adMaxAnchorChoice', () => {
  it('picks the widest configured frame that fits the viewport', () => {
    setAdMaxIdsForTesting({ anchor728x90: 'anchor-wide', anchor320x100: 'anchor-mobile' });
    expect(adMaxAnchorChoice(1280)).toEqual({ id: 'anchor-wide', width: 728, height: 90 });
    expect(adMaxAnchorChoice(360)).toEqual({ id: 'anchor-mobile', width: 320, height: 100 });
  });

  it('falls through to the mobile frame when the wide one is absent', () => {
    setAdMaxIdsForTesting({ anchor728x90: null, anchor320x100: 'anchor-mobile' });
    expect(adMaxAnchorChoice(1280)).toEqual({ id: 'anchor-mobile', width: 320, height: 100 });
  });

  it('renders no bar rather than an overflowing or unconfigured one', () => {
    setAdMaxIdsForTesting({ anchor728x90: 'anchor-wide', anchor320x100: 'anchor-mobile' });
    expect(adMaxAnchorChoice(319)).toBeNull();
    setAdMaxIdsForTesting({ anchor728x90: null, anchor320x100: null });
    expect(adMaxAnchorChoice(1280)).toBeNull();
  });
});

describe('requestAdMaxFrame', () => {
  it('loads for the first frame at once, and lets the rest ride the next load together', () => {
    requestAdMaxFrame('anchor');
    requestAdMaxFrame('home-slot');
    requestAdMaxFrame('result-slot');

    // The anchor does not wait for company — it is on screen from boot.
    expect(admaxScripts()).toHaveLength(1);
    expect((window as AdMaxWindow).admaxads).toEqual([{ admax_id: 'anchor', type: 'banner' }]);

    admaxScript()?.dispatchEvent(new Event('load'));

    // The two that asked mid-load share the next one rather than taking a
    // load each.
    expect(admaxScripts()).toHaveLength(2);
    expect((window as AdMaxWindow).admaxads).toEqual([
      { admax_id: 'home-slot', type: 'banner' },
      { admax_id: 'result-slot', type: 'banner' },
    ]);
  });

  /**
   * The regression this module exists for. t.js ends in
   * `if (void 0 !== window.__admax_tag__) ; else { …scan… }`, so it reads the
   * DOM and drains the queue exactly ONCE per page: the anchor mounts at boot
   * and spends that pass, and the display slots — which arrive with a lazily
   * imported chunk — used to push into a queue nothing would read again. In
   * production that meant only the anchor was ever served.
   */
  it('serves a frame that arrives after the loader already ran', () => {
    requestAdMaxFrame('anchor');
    const first = admaxScript();
    // t.js sets its own guard when it executes; a later load is a no-op while
    // that guard stands.
    (window as AdMaxWindow).__admax_tag__ = {};
    first?.dispatchEvent(new Event('load'));

    requestAdMaxFrame('home-slot');

    expect(admaxScripts()).toHaveLength(2);
    // The guard is cleared, so the new load actually scans...
    expect((window as AdMaxWindow).__admax_tag__).toBeUndefined();
    // ...and the queue holds only the new frame, so the anchor that the first
    // pass already filled is not requested a second time.
    expect((window as AdMaxWindow).admaxads).toEqual([{ admax_id: 'home-slot', type: 'banner' }]);
  });

  it('loads nothing extra when no frame is waiting', () => {
    requestAdMaxFrame('anchor');
    admaxScript()?.dispatchEvent(new Event('load'));
    expect(admaxScripts()).toHaveLength(1);
  });

  it('records a loader failure as final and notifies subscribers, past and future', () => {
    requestAdMaxFrame('frame-a');
    expect(adMaxScriptFailed()).toBe(false);

    let calls = 0;
    const unsubscribe = onAdMaxScriptError(() => {
      calls += 1;
    });
    lastAdmaxScript()?.dispatchEvent(new Event('error'));
    expect(adMaxScriptFailed()).toBe(true);
    expect(calls).toBe(1);
    unsubscribe();

    // A subscriber arriving after the failure hears about it immediately.
    onAdMaxScriptError(() => {
      calls += 1;
    });
    expect(calls).toBe(2);

    // And nothing queues for a loader that will not come.
    requestAdMaxFrame('frame-b');
    expect(admaxScripts()).toHaveLength(1);
  });
});

/**
 * AdMax answers a no-fill by writing an iframe and putting nothing useful in
 * it — measured in production, one page view carried only Criteo's 0×0 cookie
 * sync while the next carried a real creative. Since there is no status
 * attribute to read, "was this box filled" is a question about its contents,
 * and the answer has to lean towards YES: collapsing a real ad costs revenue
 * and shows the reader a flicker.
 */
describe('adMaxUnitRendered', () => {
  const unitWith = (write?: (doc: Document) => void): HTMLElement => {
    const unit = document.createElement('div');
    unit.className = 'admax-ads';
    document.body.appendChild(unit);
    if (!write) return unit;

    const frame = document.createElement('iframe');
    unit.appendChild(frame);
    const doc = frame.contentDocument;
    if (doc) write(doc);
    return unit;
  };

  afterEach(() => {
    document.querySelectorAll('body > .admax-ads').forEach((node) => node.remove());
  });

  it('says no when nothing was written into the unit', () => {
    expect(adMaxUnitRendered(unitWith())).toBe(false);
    expect(adMaxUnitRendered(null)).toBe(false);
  });

  it('says no for a frame holding only a cookie sync', () => {
    const unit = unitWith((doc) => {
      doc.body.innerHTML =
        '<script>window.Criteo = window.Criteo || {};</script><iframe id="sync"></iframe>';
    });
    // jsdom gives every element a zero rect, which is what a 0×0 sync frame
    // has in a browser too.
    expect(adMaxUnitRendered(unit)).toBe(false);
  });

  it('says yes for a creative — an image, text, or a sized frame', () => {
    expect(adMaxUnitRendered(unitWith((doc) => (doc.body.innerHTML = '<img src="ad.png">')))).toBe(
      true,
    );
    expect(
      adMaxUnitRendered(unitWith((doc) => (doc.body.innerHTML = '<a href="#">Sponsored</a>'))),
    ).toBe(true);

    // jsdom gives every element a zero rect, so the sized nested frame — what
    // a real creative is — has to be spelled out.
    const sized = unitWith((doc) => (doc.body.innerHTML = '<iframe id="creative"></iframe>'));
    const nested = sized.querySelector('iframe')?.contentDocument?.getElementById('creative');
    Object.defineProperty(nested as Element, 'getBoundingClientRect', {
      value: () => ({ width: 320, height: 100 }),
    });
    expect(adMaxUnitRendered(sized)).toBe(true);
  });
});
