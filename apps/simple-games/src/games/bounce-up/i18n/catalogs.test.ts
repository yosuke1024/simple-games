/**
 * What this game's catalogs promise beyond the shell's catalog tests
 * (src/i18n/i18n.test.ts checks every key and placeholder in every locale) —
 * docs/BOUNCE_UP_RULES.md §8:
 *
 * - the title is the same proper noun everywhere;
 * - no locale still carries the English source as a stand-in (the scaffold
 *   shipped 13 copies of placeholder English, and a forgotten one fails
 *   nothing else). The few values that are the same word in another
 *   language are listed by name;
 * - the controls the first Quick Rules step and the ready line name (← →)
 *   are in every locale's sentence;
 * - the words §8 rules out — rank and ranking, praise of the "new record!"
 *   kind — appear in no locale, spelled the way that locale would spell
 *   them. This catches only the listed spellings: it says nothing about what
 *   a sentence means, and nobody has read these catalogs (§8).
 */
import { describe, expect, it } from 'vitest';
import type { Locale } from '@/i18n';
import { catalogs } from './index';
import { en, type BounceUpMessages } from './en';

const TITLE = 'Bounce Up';

/** Values that are the English word in that language too. */
const SAME_AS_EN: Partial<Record<Locale, readonly (keyof BounceUpMessages)[]>> = {
  de: ['bounceUpWidth_normal', 'bounceUpPause'],
};

/** §8: no rank, no praise — per locale. */
const RULED_OUT: Record<Locale, RegExp> = {
  en: /\brank|leaderboard|new record|great|awesome|amazing|well done|nice/i,
  ja: /順位|ランキング|新記録|すごい|素晴らしい|おめでとう/,
  de: /\bRang|Rangliste|Rekord|toll|super|großartig|glückwunsch/i,
  es: /clasificaci[oó]n|ranking|r[eé]cord|genial|incre[ií]ble|felicidades/i,
  fr: /classement|record|bravo|génial|super\b|félicitations/i,
  hi: /रैंक|रिकॉर्ड|शाबाश|बधाई/,
  id: /peringkat|rekor|hebat|selamat/i,
  ko: /순위|랭킹|신기록|대단|축하/,
  'pt-br': /classifica[cç][aã]o|ranking|recorde|parab[eé]ns|incr[ií]vel/i,
  th: /อันดับ|สถิติใหม่|เยี่ยม|ยินดีด้วย/,
  tr: /sıralama|rekor|harika|tebrik/i,
  vi: /bảng xếp hạng|kỷ lục|tuyệt vời|chúc mừng/i,
  'zh-hans': /排名|排行|新纪录|太棒|恭喜/,
  'zh-hant': /排名|排行|新紀錄|太棒|恭喜/,
};

const KEYS = Object.keys(en) as (keyof BounceUpMessages)[];
const LOCALES = Object.keys(catalogs) as Locale[];

describe('Bounce Up catalogs (§8)', () => {
  it('has all 14 locales, each with the 29 keys of the source', () => {
    expect(LOCALES).toHaveLength(14);
    expect(KEYS).toHaveLength(29);
    for (const locale of LOCALES) {
      expect(Object.keys(catalogs[locale]).sort(), locale).toEqual([...KEYS].sort());
    }
  });

  it('keeps the title as the English proper noun in every locale', () => {
    for (const locale of LOCALES) {
      expect(catalogs[locale].bounceUpName, locale).toBe(TITLE);
    }
  });

  it('has no English stand-ins left outside the source', () => {
    for (const locale of LOCALES) {
      if (locale === 'en') continue;
      const copied = KEYS.filter(
        (key) => key !== 'bounceUpName' && catalogs[locale][key] === en[key],
      );
      expect(copied, locale).toEqual(SAME_AS_EN[locale] ?? []);
    }
  });

  it('names ← → where the first step and the ready line talk about them', () => {
    for (const locale of LOCALES) {
      expect(catalogs[locale].bounceUpStep1Body, locale).toContain('← →');
      expect(catalogs[locale].bounceUpTouchToStart, locale).toContain('← →');
    }
  });

  it('uses none of the words §8 rules out, in any locale', () => {
    for (const locale of LOCALES) {
      const hits = KEYS.filter((key) => RULED_OUT[locale].test(catalogs[locale][key]));
      expect(hits, locale).toEqual([]);
    }
  });

  it('would catch a ruled-out word (the patterns are not dead)', () => {
    const probes: Record<Locale, string> = {
      en: 'New record!',
      ja: '新記録!',
      de: 'Neuer Rekord',
      es: '¡Nuevo récord!',
      fr: 'Nouveau record',
      hi: 'नया रिकॉर्ड',
      id: 'Rekor baru',
      ko: '신기록!',
      'pt-br': 'Novo recorde',
      th: 'สถิติใหม่',
      tr: 'Yeni rekor',
      vi: 'Kỷ lục mới',
      'zh-hans': '新纪录',
      'zh-hant': '新紀錄',
    };
    for (const locale of LOCALES) {
      expect(RULED_OUT[locale].test(probes[locale]), locale).toBe(true);
    }
  });
});
