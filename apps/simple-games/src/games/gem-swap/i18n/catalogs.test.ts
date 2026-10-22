/**
 * What the shared catalog gates (src/i18n/i18n.test.ts) cannot know about this
 * game's strings (docs/GEM_SWAP_RULES.md §11): the title stays "Gem Swap" in
 * every language, no translation is the English source left in place, and
 * no game string praises or makes a promise.
 */
import { describe, expect, it } from 'vitest';
import { catalogs } from './index';
import { en } from './en';

const locales = Object.keys(catalogs) as (keyof typeof catalogs)[];
const translated = locales.filter((locale) => locale !== 'en');

/** Strings that read the same in a language as in English, named one by one. */
const SAME_AS_ENGLISH: Readonly<Record<string, readonly string[]>> = {
  // "Normal" is the word in these languages too (the other games' difficulty names).
  de: ['gemSwapKinds_6'],
  es: ['gemSwapKinds_6'],
  id: ['gemSwapKinds_6'],
  tr: ['gemSwapKinds_6'],
  // French says "Score" too, as the shell's own `score` does (and Snake's
  // "Score {score} · {speed}").
  fr: ['gemSwapKinds_6', 'gemSwapResumeNote', 'gemSwapStep3Title'],
  // "marquise" is the Brazilian jewellers' word for the cut as well.
  'pt-br': ['gemSwapKinds_6', 'gemSwapGem_marquise'],
};

describe('Gem Swap catalogs', () => {
  it('keep the title as it is, everywhere', () => {
    for (const locale of locales) expect(catalogs[locale].gemSwapName).toBe('Gem Swap');
  });

  it('leave no English source string untranslated', () => {
    const left: string[] = [];
    for (const locale of translated) {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        if (key === 'gemSwapName') continue;
        if ((SAME_AS_ENGLISH[locale] ?? []).includes(key)) continue;
        if (catalogs[locale][key] === en[key]) left.push(`${locale}.${key}`);
      }
    }
    expect(left, left.join('\n')).toEqual([]);
  });

  it('praise nothing and promise nothing', () => {
    const banned = /great|awesome|amazing|well done|nice work|free|offline|purchase|delete/i;
    for (const [key, value] of Object.entries(en)) {
      expect(value, key).not.toMatch(banned);
    }
  });
});
