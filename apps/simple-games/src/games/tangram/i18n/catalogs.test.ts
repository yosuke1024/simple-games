/**
 * What this game's catalogs promise beyond the shell's catalog tests
 * (src/i18n/i18n.test.ts checks every key and placeholder in every locale):
 * the title is the same word everywhere, and no locale still carries the
 * English source as a stand-in — docs/TANGRAM_RULES.md §11 says all 14 are
 * written, and a forgotten placeholder would make that untrue without
 * failing anything else (the Unblock Puzzle catalogs' test, same shape).
 *
 * A string may equal the English one only when it has no words of its own
 * (`{tier} {number}`), or when the word is the same in that language — each
 * such case is listed here by name, so a new one is a decision, not a slip.
 */
import { describe, expect, it } from 'vitest';
import { catalogs } from './index';
import { en } from './en';

const TITLE = 'Tangram';

type Key = keyof typeof en;

/** Same spelling as English on purpose: the word is that language's own. */
const SAME_WORD: Readonly<Partial<Record<string, readonly Key[]>>> = {
  de: ['tangramSilhouetteLabel'], // "Silhouette: {figure}"
  fr: ['tangramFigureLabel'], // "Figure"
};

/** Nothing but `{var}` slots, spaces and punctuation — nothing to translate. */
const wordless = (s: string): boolean => !/\p{L}/u.test(s.replace(/\{\w+\}/g, ''));

describe('Tangram catalogs (§11)', () => {
  it('keeps the title "Tangram" in every locale', () => {
    for (const [locale, messages] of Object.entries(catalogs)) {
      expect(messages.tangramName, locale).toBe(TITLE);
    }
  });

  it('has no English stand-ins left outside the source', () => {
    for (const [locale, messages] of Object.entries(catalogs)) {
      if (locale === 'en') continue;
      const allowed = SAME_WORD[locale] ?? [];
      const copied = (Object.keys(en) as Key[]).filter(
        (key) =>
          key !== 'tangramName' &&
          messages[key] === en[key] &&
          !wordless(en[key]) &&
          !allowed.includes(key),
      );
      expect(copied, locale).toEqual([]);
    }
  });

  it('lists only real coincidences as the same word', () => {
    for (const [locale, keys] of Object.entries(SAME_WORD)) {
      for (const key of keys ?? []) {
        expect(catalogs[locale as keyof typeof catalogs][key], `${locale}.${key}`).toBe(en[key]);
      }
    }
  });
});
