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
