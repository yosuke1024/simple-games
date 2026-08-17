/**
 * The 忍者AdMax fallback plumbing (docs/ADS_POLICY.md「Web 版」フォール
 * バック): frame lookup is exact per placement×size (no near-miss serving),
 * the loader loads once and records failure as final, and the queue is the
 * documented append-only SPA pattern.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  adMaxAnchorChoice,
  adMaxScriptFailed,
  adMaxSlotId,
  ensureAdMaxScript,
  onAdMaxScriptError,
  pushAdMaxAd,
  setAdMaxIdsForTesting,
} from './admax';

type AdMaxWindow = Window & { admaxads?: unknown[] };

const admaxScript = () => document.head.querySelector('script[data-sg-admax]');

afterEach(() => {
  setAdMaxIdsForTesting(null);
  admaxScript()?.remove();
  delete (window as AdMaxWindow).admaxads;
});

describe('adMaxSlotId', () => {
  it('matches a frame only for its exact placement and size', () => {
    setAdMaxIdsForTesting({
      slotHome728x90: 'home-wide',
      slotHome320x100: 'home-mobile',
      slotResult320x100: 'result-mobile',
    });
    expect(adMaxSlotId('home', { width: 728, height: 90 })).toBe('home-wide');
    expect(adMaxSlotId('home', { width: 320, height: 100 })).toBe('home-mobile');
    expect(adMaxSlotId('result', { width: 320, height: 100 })).toBe('result-mobile');
    // AdMax has no 234×60 — that size has no fallback, in either placement.
    expect(adMaxSlotId('home', { width: 234, height: 60 })).toBeNull();
    expect(adMaxSlotId('result', { width: 234, height: 60 })).toBeNull();
    // The result placement never uses the wide size (compact rule).
    expect(adMaxSlotId('result', { width: 728, height: 90 })).toBeNull();
  });

  it('returns null when the frame for a size is not configured', () => {
    setAdMaxIdsForTesting({ slotHome728x90: 'home-wide' });
    expect(adMaxSlotId('home', { width: 320, height: 100 })).toBeNull();
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

describe('ensureAdMaxScript', () => {
  it('loads the loader once and appends queue entries', () => {
    pushAdMaxAd('frame-a');
    ensureAdMaxScript();
    ensureAdMaxScript(); // idempotent
    pushAdMaxAd('frame-b');
    expect(document.head.querySelectorAll('script[data-sg-admax]')).toHaveLength(1);
    expect((window as AdMaxWindow).admaxads).toEqual([
      { admax_id: 'frame-a', type: 'banner' },
      { admax_id: 'frame-b', type: 'banner' },
    ]);
  });

  it('records a loader failure as final and notifies subscribers, past and future', () => {
    ensureAdMaxScript();
    expect(adMaxScriptFailed()).toBe(false);

    let calls = 0;
    const unsubscribe = onAdMaxScriptError(() => {
      calls += 1;
    });
    admaxScript()?.dispatchEvent(new Event('error'));
    expect(adMaxScriptFailed()).toBe(true);
    expect(calls).toBe(1);
    unsubscribe();

    // A subscriber arriving after the failure hears about it immediately.
    onAdMaxScriptError(() => {
      calls += 1;
    });
    expect(calls).toBe(2);

    // The failed element stays as the marker: nothing re-requests the loader.
    ensureAdMaxScript();
    expect(document.head.querySelectorAll('script[data-sg-admax]')).toHaveLength(1);
  });
});
