/**
 * What this game's catalogs promise beyond the shell's catalog tests
 * (src/i18n/i18n.test.ts checks every key and placeholder in every locale):
 * the title is the same proper noun everywhere, and no locale still carries
 * the English source as a stand-in — docs/UNBLOCK_PUZZLE_RULES.md §15 says
 * all 14 are written, and a forgotten placeholder would make that untrue
 * without failing anything else.
 */
import { describe, expect, it } from 'vitest';
import { catalogs } from './index';
import { en } from './en';

const TITLE = 'Unblock Puzzle';

describe('Unblock Puzzle catalogs (§15)', () => {
  it('keeps the title as the English proper noun in every locale', () => {
    for (const [locale, messages] of Object.entries(catalogs)) {
      expect(messages.unblockPuzzleName, locale).toBe(TITLE);
    }
  });

  it('has no English stand-ins left outside the source', () => {
    for (const [locale, messages] of Object.entries(catalogs)) {
      if (locale === 'en') continue;
      const copied = (Object.keys(en) as (keyof typeof en)[]).filter(
        (key) => key !== 'unblockPuzzleName' && messages[key] === en[key],
      );
      expect(copied, locale).toEqual([]);
    }
  });
});
