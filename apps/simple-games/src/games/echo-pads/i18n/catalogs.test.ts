/**
 * What this game's catalogs promise beyond the shell's catalog tests
 * (src/i18n/i18n.test.ts checks every key and placeholder in every locale):
 * the title is the same words everywhere, and no locale still carries the
 * English source as a stand-in — docs/ECHO_PADS_RULES.md §14 says all 14 are
 * written, and a forgotten placeholder would make that untrue without failing
 * anything else (Tangram's catalogs test, same shape).
 *
 * A string may equal the English one only when it has no words of its own
 * (`{mark}, {position}`), or when the word is the same in that language —
 * each such case is listed here by name, so a new one is a decision.
 */
import { describe, expect, it } from 'vitest';
import { catalogs } from './index';
import { en } from './en';

const TITLE = 'Echo Pads';

type Key = keyof typeof en;

/** Same spelling as English on purpose: the word is that language's own. */
const SAME_WORD: Readonly<Partial<Record<string, readonly Key[]>>> = {
  fr: ['echoPadsMark_triangle'], // "Triangle"
};

/** Nothing but `{var}` slots, spaces and punctuation — nothing to translate. */
const wordless = (s: string): boolean => !/\p{L}/u.test(s.replace(/\{\w+\}/g, ''));

describe('Echo Pads catalogs (§14)', () => {
  it('keeps the title "Echo Pads" in every locale', () => {
    for (const [locale, messages] of Object.entries(catalogs)) {
      expect(messages.echoPadsName, locale).toBe(TITLE);
    }
  });

  it('has no English stand-ins left outside the source', () => {
    for (const [locale, messages] of Object.entries(catalogs)) {
      if (locale === 'en') continue;
      const allowed = SAME_WORD[locale] ?? [];
      const copied = (Object.keys(en) as Key[]).filter(
        (key) =>
          key !== 'echoPadsName' &&
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

  it('keeps the Quick Rules to three steps of one sentence each (§10)', () => {
    for (const [locale, messages] of Object.entries(catalogs)) {
      for (const key of ['echoPadsStep1Body', 'echoPadsStep2Body', 'echoPadsStep3Body'] as const) {
        // One sentence: at most one sentence end, and it is the last character.
        const ends = messages[key].match(/[.!?。！？।]/g) ?? [];
        expect(ends.length, `${locale}.${key}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
