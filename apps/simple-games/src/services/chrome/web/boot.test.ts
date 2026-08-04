/**
 * The bootstrap's two promises: nothing is requested while offline, and the
 * header's placeholder exists before the script that looks for it.
 *
 * That second one is not a style point. Without the placeholder,
 * global-header.js falls back to `document.querySelector('nav')` and replaces
 * whatever it finds — on the collection home that is the "recently played"
 * nav, so getting the order wrong would delete part of the game list.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as network from '../../network';
import { initWebChrome } from './boot';

beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.head.replaceChildren();
  document.body.replaceChildren();
});

describe('initWebChrome', () => {
  it('requests nothing while offline, and does not retry', () => {
    vi.spyOn(network, 'isOnline').mockReturnValue(false);
    initWebChrome('en');
    expect(document.querySelector('script[src="/global-header.js"]')).toBeNull();
    expect(document.querySelector('link[href="/global-header.css"]')).toBeNull();
    expect(document.getElementById('global-header')).toBeNull();
  });

  it('creates the placeholder before appending the script', () => {
    vi.spyOn(network, 'isOnline').mockReturnValue(true);
    initWebChrome('en');

    const placeholder = document.getElementById('global-header');
    const script = document.querySelector('script[src="/global-header.js"]');
    expect(placeholder).not.toBeNull();
    expect(script).not.toBeNull();
    // Document order stands in for execution order: both are appended to
    // body, and the script cannot run before an element that precedes it.
    expect(placeholder!.compareDocumentPosition(script!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('declares exactly one locale so the header shows no language switcher', () => {
    vi.spyOn(network, 'isOnline').mockReturnValue(true);
    initWebChrome('ja');
    const config = document.getElementById('pixapps-page-config');
    expect(JSON.parse(config!.textContent!)).toMatchObject({
      supportedLocales: ['ja'],
      defaultLocale: 'ja',
    });
  });

  it('falls back to English for locales the site does not have', () => {
    vi.spyOn(network, 'isOnline').mockReturnValue(true);
    initWebChrome('de');
    const config = document.getElementById('pixapps-page-config');
    expect(JSON.parse(config!.textContent!).supportedLocales).toEqual(['en']);
  });

  it('is safe to call twice (nothing is injected a second time)', () => {
    vi.spyOn(network, 'isOnline').mockReturnValue(true);
    initWebChrome('en');
    initWebChrome('en');
    expect(document.querySelectorAll('script[src="/global-header.js"]')).toHaveLength(1);
    expect(document.querySelectorAll('link[href="/global-header.css"]')).toHaveLength(1);
    expect(document.querySelectorAll('#global-header')).toHaveLength(1);
    expect(document.querySelectorAll('#pixapps-page-config')).toHaveLength(1);
  });
});
