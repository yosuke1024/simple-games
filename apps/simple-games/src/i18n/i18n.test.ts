/**
 * Locale resolution and catalog-consistency tests (docs/I18N_POLICY.md):
 * region variants fall back to their parent, the device's preferred-language
 * list is walked in order, unsupported languages land on English, and every
 * catalog carries every key with matching placeholders — a translation can
 * never render as an empty string or with a missing variable.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGES } from '@/storage/schemas';
import { catalogs, LANGUAGE_NAMES, matchLocale, resolveLocale, translate, type Locale } from './index';
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

  it('resolves Chinese by script, never by dropping the subtag', () => {
    // A zh-TW reader cannot read Simplified, so this is the one language where
    // falling back to the primary subtag would be worse than useless.
    expect(matchLocale('zh-TW')).toBe('zh-hant');
    expect(matchLocale('zh-HK')).toBe('zh-hant');
    expect(matchLocale('zh-Hant')).toBe('zh-hant');
    expect(matchLocale('zh-Hant-TW')).toBe('zh-hant');
    expect(matchLocale('zh-CN')).toBe('zh-hans');
    expect(matchLocale('zh-SG')).toBe('zh-hans');
    expect(matchLocale('zh-Hans-CN')).toBe('zh-hans');
    // A bare `zh` takes the more widely read script.
    expect(matchLocale('zh')).toBe('zh-hans');
  });

  it('sends European Portuguese to the Brazilian catalog', () => {
    // Much closer to a pt-PT reader's language than English is.
    expect(matchLocale('pt')).toBe('pt-br');
    expect(matchLocale('pt-PT')).toBe('pt-br');
    expect(matchLocale('pt-BR')).toBe('pt-br');
  });

  it('falls back from region variants of the newer languages', () => {
    expect(matchLocale('es-MX')).toBe('es');
    expect(matchLocale('es-419')).toBe('es');
    expect(matchLocale('fr-CA')).toBe('fr');
    expect(matchLocale('de-AT')).toBe('de');
    expect(matchLocale('ko-KR')).toBe('ko');
    expect(matchLocale('vi-VN')).toBe('vi');
    expect(matchLocale('tr-TR')).toBe('tr');
  });

  it('returns null for languages the app does not ship', () => {
    expect(matchLocale('ar')).toBeNull();
    expect(matchLocale('ta')).toBeNull();
    expect(matchLocale('ru')).toBeNull();
    expect(matchLocale('')).toBeNull();
  });
});

describe('language picker', () => {
  it('offers every shipped locale, named in its own language', () => {
    for (const locale of Object.keys(catalogs) as Locale[]) {
      const name = LANGUAGE_NAMES[locale];
      expect(typeof name, locale).toBe('string');
      expect(name.trim().length, locale).toBeGreaterThan(0);
    }
    // The setting list is the picker; it must not drift from the catalogs.
    const offered = LANGUAGES.filter((code) => code !== 'system');
    expect([...offered].sort()).toEqual([...Object.keys(catalogs)].sort());
  });
});

describe('resolveLocale', () => {
  it('honors the explicit in-app choice over the device language', () => {
    stubLanguages(['th-TH']);
    expect(resolveLocale('ja')).toBe('ja');
  });

  it('walks the preferred-language list until a supported language', () => {
    // A bilingual device lists both; the first one the app ships wins, which
    // is why the whole list is walked instead of only its first entry.
    stubLanguages(['ru-RU', 'ar-EG', 'ja-JP']);
    expect(resolveLocale('system')).toBe('ja');
  });

  it('falls back to English when no preferred language is supported', () => {
    stubLanguages(['ru-RU', 'ar-EG']);
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
