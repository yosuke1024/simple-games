/**
 * What this game's catalogs promise beyond the shell's catalog tests
 * (src/i18n/i18n.test.ts checks every key and placeholder in every locale) —
 * docs/OVERTAKE_RULES.md §12:
 *
 * - the title is the same proper noun everywhere;
 * - no locale still carries the English source as a stand-in. The first
 *   Phase 3 commit had 13 copies of `en`, and a forgotten one fails nothing
 *   else. The few values that are the same word in another language are
 *   listed by name;
 * - Quick Rules 2's hold sentence shows the ▼ it talks about, in every locale
 *   (the button itself carries only the mark);
 * - the words §12 rules out (rank and ranking, crash and accident, rival and
 *   opponent) appear in no locale, spelled the way that locale would spell
 *   them. The terms used instead are in each catalog's header. This catches
 *   only the listed spellings: it says nothing about what a sentence means,
 *   and nobody has read these catalogs (§12).
 */
import { describe, expect, it } from 'vitest';
import type { Locale } from '@/i18n';
import { catalogs } from './index';
import { en, type OvertakeMessages } from './en';

const TITLE = 'Overtake';

/** Values that are the English word in that language too. */
const SAME_AS_EN: Partial<Record<Locale, readonly (keyof OvertakeMessages)[]>> = {
  // "level" is the shell's Indonesian word (modeLevel: 'Level {n}').
  id: ['overtakeBoardLabel', 'overtakeResultPlaced'],
  fr: ['overtakePause'],
  de: ['overtakePause'],
};

/** §12: no rank, no crash, no rival — per locale. */
const RULED_OUT: Record<Locale, RegExp> = {
  en: /\brank|leaderboard|\brivals?\b|opponent|\bcrash|accident|pace car|versus/i,
  ja: /順位|ランキング|事故|クラッシュ|対戦|ライバル|敵/,
  de: /\bRang|Unfall|Crash|Gegner|Rivale/i,
  es: /clasificaci[oó]n|ranking|choque|accidente|rival|oponente/i,
  fr: /classement|accident|rival|adversaire/i,
  hi: /रैंक|दुर्घटना|प्रतिद्वंद्वी/,
  id: /peringkat|tabrakan|kecelakaan|\blawan|saingan/i,
  ko: /순위|랭킹|사고|라이벌/,
  'pt-br': /classifica[cç][aã]o|ranking|batida|acidente|rival|advers[aá]rio/i,
  th: /อันดับ|อุบัติเหตุ|คู่แข่ง|ชน/,
  tr: /sıralama|kaza|rakip/i,
  vi: /hạng|tai nạn|đối thủ/i,
  'zh-hans': /排名|排行|事故|撞车|对手/,
  'zh-hant': /排名|排行|事故|車禍|對手/,
};

const KEYS = Object.keys(en) as (keyof OvertakeMessages)[];
const LOCALES = Object.keys(catalogs) as Locale[];

describe('Overtake catalogs (§12)', () => {
  it('has all 14 locales, each with the 30 keys of the source', () => {
    expect(LOCALES).toHaveLength(14);
    expect(KEYS).toHaveLength(30);
    for (const locale of LOCALES) {
      expect(Object.keys(catalogs[locale]).sort(), locale).toEqual([...KEYS].sort());
    }
  });

  it('keeps the title as the English proper noun in every locale', () => {
    for (const locale of LOCALES) {
      expect(catalogs[locale].overtakeName, locale).toBe(TITLE);
    }
  });

  it('has no English stand-ins left outside the source', () => {
    for (const locale of LOCALES) {
      if (locale === 'en') continue;
      const copied = KEYS.filter(
        (key) => key !== 'overtakeName' && catalogs[locale][key] === en[key],
      );
      expect(copied, locale).toEqual(SAME_AS_EN[locale] ?? []);
    }
  });

  it('shows the ▼ in the hold sentence of Quick Rules 2 in every locale', () => {
    for (const locale of LOCALES) {
      expect(catalogs[locale].overtakeStep2BodyHold, locale).toContain('▼');
    }
  });

  it('uses none of the words §12 rules out, in any locale', () => {
    for (const locale of LOCALES) {
      const hits = KEYS.filter((key) => RULED_OUT[locale].test(catalogs[locale][key]));
      expect(hits, locale).toEqual([]);
    }
  });

  it('would catch a ruled-out word (the patterns are not dead)', () => {
    const probes: Record<Locale, string> = {
      en: 'Rank 2',
      ja: '順位 2',
      de: 'Rangliste',
      es: 'Choques: 2',
      fr: 'Classement',
      hi: 'रैंक 2',
      id: 'Peringkat 2',
      ko: '순위 2',
      'pt-br': 'Batidas: 2',
      th: 'อันดับ 2',
      tr: 'Kaza: 2',
      vi: 'Hạng 2',
      'zh-hans': '排名 2',
      'zh-hant': '車禍 2',
    };
    for (const locale of LOCALES) {
      expect(RULED_OUT[locale].test(probes[locale]), locale).toBe(true);
    }
  });
});
