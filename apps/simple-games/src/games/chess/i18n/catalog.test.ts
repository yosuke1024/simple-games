/**
 * The catalog's own promises (docs/CHESS_RULES.md §10): the title stays
 * "Chess" in every locale, and the words whose mistranslation would flip a
 * result follow the glossary of §10.1 — the stalemate line never uses the
 * checkmate word, and the checkmate line does. Who won is a separate key from
 * why (the reason keys), so these lines can never carry the result alone.
 *
 * The catalogs are AI-written and unread (§10); this checks that they say
 * what the glossary decided, not that they read well.
 */
import { describe, expect, it } from 'vitest';
import type { Locale } from '@/i18n';
import { catalogs } from './index';

/** §10.1's checkmate and stalemate words, per locale. */
const GLOSSARY: Record<Locale, { checkmate: string; stalemate: string }> = {
  en: { checkmate: 'Checkmate', stalemate: 'Stalemate' },
  ja: { checkmate: 'チェックメイト', stalemate: 'ステイルメイト' },
  de: { checkmate: 'Schachmatt', stalemate: 'Patt' },
  es: { checkmate: 'Jaque mate', stalemate: 'Ahogado' },
  fr: { checkmate: 'Échec et mat', stalemate: 'Pat' },
  'pt-br': { checkmate: 'Xeque-mate', stalemate: 'Afogamento' },
  hi: { checkmate: 'शहमात', stalemate: 'स्टेलमेट' },
  id: { checkmate: 'Skakmat', stalemate: 'Pat' },
  ko: { checkmate: '체크메이트', stalemate: '스테일메이트' },
  th: { checkmate: 'รุกจน', stalemate: 'อับ' },
  tr: { checkmate: 'Şah mat', stalemate: 'Pat' },
  vi: { checkmate: 'Chiếu hết', stalemate: 'Hết nước đi' },
  'zh-hans': { checkmate: '将死', stalemate: '逼和' },
  'zh-hant': { checkmate: '將死', stalemate: '逼和' },
};

/** Words that would read the stalemate as a mate (§10.1「取り違えてはならない組」). */
const MATE_WORDS: Partial<Record<Locale, readonly string[]>> = {
  ja: ['詰み', 'チェックメイト'],
  ko: ['외통', '체크메이트'],
  th: ['รุกจน'],
  vi: ['Chiếu hết', 'chiếu hết'],
  'zh-hans': ['将死'],
  'zh-hant': ['將死'],
};

describe('the Chess catalog (§10)', () => {
  const locales = Object.keys(catalogs) as Locale[];

  it('covers all fourteen locales with the same keys', () => {
    expect(locales).toHaveLength(14);
    const keys = Object.keys(catalogs.en).sort();
    for (const locale of locales) expect(Object.keys(catalogs[locale]).sort()).toEqual(keys);
  });

  it('keeps the title "Chess" in every locale', () => {
    for (const locale of locales) expect(catalogs[locale].chessName).toBe('Chess');
  });

  it.each(Object.keys(GLOSSARY) as Locale[])(
    '%s names the endings with the glossary’s words',
    (locale) => {
      const messages = catalogs[locale];
      const words = GLOSSARY[locale];
      expect(messages.chessReason_checkmate.startsWith(words.checkmate)).toBe(true);
      // Thai stands the stalemate beside the draw word on the reason line (§10.1).
      expect(messages.chessReason_stalemate).toContain(words.stalemate);
      for (const word of MATE_WORDS[locale] ?? []) {
        expect(messages.chessReason_stalemate).not.toContain(word);
      }
    },
  );

  it('leaves no scaffold placeholder and no praise in any locale', () => {
    for (const locale of locales) {
      for (const [key, value] of Object.entries(catalogs[locale])) {
        expect(value, `${locale}.${key}`).not.toMatch(/placeholder|Nice work|sample round/i);
        expect(value.length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('never calls the opponent strong or an AI (§10)', () => {
    for (const locale of locales) {
      for (const [key, value] of Object.entries(catalogs[locale])) {
        expect(value, `${locale}.${key}`).not.toMatch(/\bAI\b|strong|つよい|強い/);
      }
    }
  });
});
