/**
 * Locale resolution and catalog-consistency tests (docs/I18N_POLICY.md):
 * region variants fall back to their parent, the device's preferred-language
 * list is walked in order, unsupported languages land on English, and every
 * catalog carries every key with matching placeholders — a translation can
 * never render as an empty string or with a missing variable.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGES } from '@/storage/schemas';
import {
  catalogs,
  LANGUAGE_NAMES,
  matchLocale,
  resolveLocale,
  translate,
  type Locale,
  type MessageKey,
} from './index';

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
  /**
   * Shell catalogs plus every game's (issue #38): the guarantees below apply
   * to every string wherever it lives. Games are collected by glob, so a new
   * game's catalog is under these tests the moment its i18n/ folder exists —
   * and the eager import also registers each catalog, which is what lets the
   * `translate` tests below exercise game keys through the public API.
   */
  const gameModules = import.meta.glob<{ catalogs: Record<Locale, Record<string, string>> }>(
    '../games/*/i18n/index.ts',
    { eager: true },
  );
  const sets: { name: string; catalogs: Record<Locale, Record<string, string>> }[] = [
    { name: 'shell', catalogs: catalogs as Record<Locale, Record<string, string>> },
    ...Object.entries(gameModules).map(([path, module]) => ({
      name: path.replace('../games/', '').replace('/i18n/index.ts', ''),
      catalogs: module.catalogs,
    })),
  ];
  const locales = Object.keys(catalogs) as Locale[];
  const placeholdersOf = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it('every locale provides every key as a non-empty string', () => {
    for (const { name, catalogs: set } of sets) {
      for (const locale of locales) {
        for (const key of Object.keys(set.en)) {
          const value = set[locale][key];
          expect(typeof value, `${name}: ${locale}.${key}`).toBe('string');
          expect((value ?? '').trim().length, `${name}: ${locale}.${key} is empty`).toBeGreaterThan(
            0,
          );
        }
      }
    }
  });

  it('placeholder names match English in every locale', () => {
    for (const { name, catalogs: set } of sets) {
      for (const locale of locales) {
        for (const [key, english] of Object.entries(set.en)) {
          expect(placeholdersOf(set[locale][key] ?? ''), `${name}: ${locale}.${key}`).toEqual(
            placeholdersOf(english),
          );
        }
      }
    }
  });

  it('no key lives in more than one catalog', () => {
    // Disjoint key sets are what make the shell-then-games lookup order in
    // `translate` a non-choice. A duplicate would mean one catalog silently
    // shadowing another in whichever order the chunks happened to load.
    const owner = new Map<string, string>();
    const duplicates: string[] = [];
    for (const { name, catalogs: set } of sets) {
      for (const key of Object.keys(set.en)) {
        const existing = owner.get(key);
        if (existing !== undefined) duplicates.push(`${key} (${existing} and ${name})`);
        else owner.set(key, name);
      }
    }
    expect(duplicates, duplicates.join('\n')).toEqual([]);
  });

  it('no catalog string contains markup or control characters', () => {
    for (const { name, catalogs: set } of sets) {
      for (const locale of locales) {
        for (const key of Object.keys(set.en)) {
          const value = set[locale][key] ?? '';
          expect(value, `${name}: ${locale}.${key}`).not.toMatch(
            // eslint-disable-next-line no-control-regex -- the check exists to ban control chars
            /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F]/,
          );
        }
      }
    }
  });

  it('translate substitutes variables and leaves unknown tokens intact', () => {
    expect(translate('en', 'modeLevel', { n: 42 })).toBe('Level 42');
    expect(translate('ja', 'modeLevel', { n: 42 })).toBe('レベル 42');
    expect(translate('en', 'modeLevel')).toBe('Level {n}');
  });

  it('resolves dynamically assembled game keys in every locale', () => {
    // These keys are built at runtime (t(`sudokuTier_${difficulty}`), …), so
    // no grep proves they are referenced — this test is what keeps them from
    // being "cleaned up" and silently breaking those screens (issue #38).
    const assembled: readonly MessageKey[] = [
      'sudokuTier_easy',
      'sudokuTier_medium',
      'sudokuTier_hard',
      'minesDifficulty_easy',
      'minesDifficulty_medium',
      'minesDifficulty_hard',
      'memoryDifficulty_easy',
      'memoryDifficulty_medium',
      'memoryDifficulty_hard',
      'solSuit_spades',
      'solSuit_hearts',
      'solSuit_diamonds',
      'solSuit_clubs',
    ];
    for (const locale of locales) {
      for (const key of assembled) {
        const value = translate(locale, key);
        expect(value, `${locale}.${key}`).not.toBe(key);
        expect(value.trim().length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to the key itself for a key no loaded catalog owns', () => {
    // The shape of the one bug the split makes possible: shell code asking
    // for a game string before the game's chunk has loaded. It must degrade
    // to something greppable, never crash.
    expect(translate('ja', 'notARealKey' as MessageKey)).toBe('notARealKey');
  });
});
