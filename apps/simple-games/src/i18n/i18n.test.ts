/**
 * Locale resolution and catalog-consistency tests (docs/I18N_POLICY.md):
 * region variants fall back to their parent, the device's preferred-language
 * list is walked in order, unsupported languages land on English, and every
 * catalog carries every key with matching placeholders — a translation can
 * never render as an empty string or with a missing variable.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogs, matchLocale, resolveLocale, translate, type Locale } from './index';
import { en } from './locales/en';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubLanguages(languages: readonly string[]): void {
  vi.stubGlobal('navigator', { languages, language: languages[0] ?? 'en' });
}

describe('matchLocale', () => {
  it('matches exact supported tags', () => {
    expect(matchLocale('ja')).toBe('ja');
    expect(matchLocale('en')).toBe('en');
  });

  it('falls back from region variants to the parent language', () => {
    expect(matchLocale('en-IN')).toBe('en');
    expect(matchLocale('en-GB')).toBe('en');
    expect(matchLocale('ja-JP')).toBe('ja');
    expect(matchLocale('hi-IN')).toBe('hi');
    expect(matchLocale('th-TH')).toBe('th');
    expect(matchLocale('id-ID')).toBe('id');
  });

  it("maps Android's legacy Indonesian code", () => {
    expect(matchLocale('in')).toBe('id');
    expect(matchLocale('in-ID')).toBe('id');
  });

  it('returns null for unsupported languages', () => {
    expect(matchLocale('fr')).toBeNull();
    expect(matchLocale('zh-TW')).toBeNull();
    expect(matchLocale('')).toBeNull();
  });
});

describe('resolveLocale', () => {
  it('honors the explicit in-app choice over the device language', () => {
    stubLanguages(['th-TH']);
    expect(resolveLocale('ja')).toBe('ja');
  });

  it('walks the preferred-language list until a supported language', () => {
    stubLanguages(['fr-FR', 'de-DE', 'ja-JP']);
    expect(resolveLocale('system')).toBe('ja');
  });

  it('falls back to English when no preferred language is supported', () => {
    stubLanguages(['fr-FR', 'ko-KR']);
    expect(resolveLocale('system')).toBe('en');
  });

  it('falls back to English when the device reports nothing', () => {
    stubLanguages([]);
    expect(resolveLocale('system')).toBe('en');
  });
});

describe('catalog consistency', () => {
  const locales = Object.keys(catalogs) as Locale[];
  const keys = Object.keys(en) as (keyof typeof en)[];
  const placeholdersOf = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it('every locale provides every key as a non-empty string', () => {
    for (const locale of locales) {
      for (const key of keys) {
        const value = catalogs[locale][key];
        expect(typeof value, `${locale}.${key}`).toBe('string');
        expect(value.trim().length, `${locale}.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('placeholder names match English in every locale', () => {
    for (const locale of locales) {
      for (const key of keys) {
        expect(placeholdersOf(catalogs[locale][key]), `${locale}.${key}`).toEqual(
          placeholdersOf(en[key]),
        );
      }
    }
  });

  it('no catalog string contains markup or control characters', () => {
    for (const locale of locales) {
      for (const key of keys) {
        const value = catalogs[locale][key];
        // eslint-disable-next-line no-control-regex -- the check exists to ban control chars
        expect(value, `${locale}.${key}`).not.toMatch(/[<>\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
      }
    }
  });

  it('translate substitutes variables and leaves unknown tokens intact', () => {
    expect(translate('en', 'modeLevel', { n: 42 })).toBe('Level 42');
    expect(translate('ja', 'modeLevel', { n: 42 })).toBe('レベル 42');
    expect(translate('en', 'modeLevel')).toBe('Level {n}');
  });
});
