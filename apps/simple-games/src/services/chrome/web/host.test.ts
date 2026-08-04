/**
 * The header is one element for the whole page load, moved between screens.
 * These are the moves that have to hold: it never appears twice, it survives
 * a screen change, and a stale cleanup cannot steal it from the live screen.
 *
 * Why that last one matters: React runs the previous screen's cleanup before
 * the next screen's effect only within one commit. Nothing guarantees the
 * order across a StrictMode double-invoke, so `releaseChrome` is guarded by
 * identity rather than trusting the sequence.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { claimChrome, releaseChrome, resetChromeHostForTesting, setChromeElement } from './host';

function makeHeader(): HTMLElement {
  const header = document.createElement('header');
  header.setAttribute('data-global-header', 'true');
  return header;
}

function makeHost(): HTMLDivElement {
  const host = document.createElement('div');
  host.className = 'sg-web-chrome';
  document.body.appendChild(host);
  return host;
}

beforeEach(() => {
  resetChromeHostForTesting();
  document.body.replaceChildren();
});

afterEach(() => {
  resetChromeHostForTesting();
  document.body.replaceChildren();
});

describe('chrome host', () => {
  it('parks the header at body level until a screen claims it', () => {
    const header = makeHeader();
    setChromeElement(header);
    // Parked, not hidden by an attribute: styles.css hides
    // `header[data-global-header]` outside `.sg-web-chrome`, so there is no
    // flash between the script landing and the first claim.
    expect(header.parentElement).toBe(document.body);
  });

  it('moves the header into a screen that claims it', () => {
    const header = makeHeader();
    const host = makeHost();
    setChromeElement(header);
    claimChrome(host);
    expect(header.parentElement).toBe(host);
  });

  it('adopts the header when it arrives after the screen mounted', () => {
    // The common case on a first visit: the home screen renders long before
    // the header script has finished loading.
    const host = makeHost();
    claimChrome(host);
    const header = makeHeader();
    setChromeElement(header);
    expect(header.parentElement).toBe(host);
  });

  it('hands the header to the next screen without duplicating it', () => {
    const header = makeHeader();
    const first = makeHost();
    const second = makeHost();
    setChromeElement(header);

    claimChrome(first);
    // A screen change: the outgoing screen releases, the incoming one claims.
    releaseChrome(first);
    claimChrome(second);

    expect(header.parentElement).toBe(second);
    expect(document.querySelectorAll('header[data-global-header]')).toHaveLength(1);
  });

  it('ignores a release from a screen that no longer holds the header', () => {
    const header = makeHeader();
    const first = makeHost();
    const second = makeHost();
    setChromeElement(header);

    claimChrome(first);
    claimChrome(second);
    // Late cleanup from the screen that already handed it over.
    releaseChrome(first);

    expect(header.parentElement).toBe(second);
  });

  it('parks the header again when the last screen releases it', () => {
    const header = makeHeader();
    const host = makeHost();
    setChromeElement(header);
    claimChrome(host);
    releaseChrome(host);
    expect(header.parentElement).toBe(document.body);
  });

  it('closes the header’s overlays when it leaves the screen', () => {
    // The drawer is appended to <body> by global-header.js, so parking the
    // header neither moves nor hides it. Left open it would cover a board.
    const header = makeHeader();
    const host = makeHost();
    const drawer = document.createElement('div');
    drawer.className = 'global-header-drawer open';
    document.body.appendChild(drawer);
    const dropdown = document.createElement('div');
    dropdown.className = 'global-header-dropdown open';
    header.appendChild(dropdown);

    setChromeElement(header);
    claimChrome(host);
    releaseChrome(host);

    expect(drawer.classList.contains('open')).toBe(false);
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
    expect(dropdown.classList.contains('open')).toBe(false);
  });

  it('leaves the overlays alone while a screen still shows the header', () => {
    const header = makeHeader();
    const first = makeHost();
    const second = makeHost();
    const drawer = document.createElement('div');
    drawer.className = 'global-header-drawer open';
    document.body.appendChild(drawer);

    setChromeElement(header);
    claimChrome(first);
    // Screen change between two chrome-bearing screens: the header never
    // parks, so an open menu is the user's, not a leak.
    claimChrome(second);

    expect(drawer.classList.contains('open')).toBe(true);
  });
});
