import { describe, expect, it } from 'vitest';
import { filteredNearbyText, isAllowedNearbyText } from './contentFilter';

// This small, reviewed fixture covers the intended rule classes in each UI
// language. It is not a claim of complete language or evasion coverage.
const blockedByLanguage = {
  en: ['fuck you', 'I will kill you', 'send nudes'],
  ja: ['クソ野郎', 'お前は死ね', '裸の写真送れ'],
  de: ['fick dich', 'ich bringe dich um', 'schick nacktfotos'],
  fr: ['va te faire foutre', 'je vais te tuer', 'envoie des nudes'],
  es: ['hijo de puta', 'te voy a matar', 'mándame fotos desnudas'],
  'pt-br': ['vai se foder', 'vou te matar', 'manda nudes'],
  tr: ['siktir git', 'seni öldüreceğim', 'çıplak fotoğraf gönder'],
  id: ['dasar bajingan', 'aku akan membunuhmu', 'kirim foto telanjang'],
  vi: ['đồ khốn', 'tao sẽ giết mày', 'gửi ảnh khỏa thân'],
  th: ['ไปตายซะ', 'กูจะฆ่ามึง', 'ส่งรูปโป๊มา'],
  hi: ['तुम चूतिया हो', 'मैं तुम्हें मार डालूँगा', 'अपनी नंगी तस्वीर भेजो'],
  ko: ['씨발', '죽여 버릴 거야', '누드 사진 보내'],
  'zh-hans': ['傻逼', '我要杀了你', '发裸照给我'],
  'zh-hant': ['去死吧', '我要殺了你', '發裸照給我'],
};

describe('limited local Nearby content rules', () => {
  it.each(Object.entries(blockedByLanguage))('rejects the curated examples for %s', (_, values) => {
    for (const value of values) {
      expect(isAllowedNearbyText(value)).toBe(false);
      expect(isAllowedNearbyText(`! ${value} !`)).toBe(false);
      expect(filteredNearbyText(value, '[hidden]')).toBe('[hidden]');
    }
  });

  it.each([
    'ＦＵＣＫ',
    '𝒇𝒖𝒄𝒌',
    'FuCk',
    'fu\u200bck',
    'f\u200cu\u200dck',
    'fu\u2060\ufeffck',
    'f\u00adu\u034fck',
    'f\u{e0001}uck',
    'SEND\u00a0NUDES',
    'send   nudes',
    'send\u200bnudes',
    'i\u200bwill\u200bkill\u200byou',
    'siktir\u2060git',
    'I’LL KILL YOU',
    'SİKTİR GİT',
    'MÁNDAME FOTOS DESNUDAS'.normalize('NFD'),
    'ク\u200bソ野郎',
    '我要\u200d殺了你',
    '씨발'.normalize('NFD'),
  ])('detects compatibility/case/formatting evasion (%#)', (value) => {
    expect(isAllowedNearbyText(value)).toBe(false);
  });

  it.each([
    'Scunthorpe',
    'Scunthorpe players',
    'Dick',
    'Fanny',
    'Gay',
    'Assunta',
    'Francis',
    'GAY PRIDE',
    'gay lesbian bisexual transgender queer',
    '同性愛者 レズビアン ゲイ',
    'homosexuel lesbienne',
    'schwul lesbisch',
    'homosexual lesbiana',
    'homossexual lésbica',
    'eşcinsel lezbiyen',
    'homoseksual lesbian',
    'đồng tính',
    'รักร่วมเพศ',
    'समलैंगिक',
    '동성애자',
    '同性恋 双性恋',
    '同性戀 雙性戀',
    '好勝負でした！',
    'Nice move — let’s play again 🎲',
    'שלום',
    '👨‍👩‍👧‍👦 ♟️',
    'a\u200bb',
  ])('does not ban benign names, identities or conversation (%#)', (value) => {
    expect(isAllowedNearbyText(value)).toBe(true);
    expect(filteredNearbyText(value, '[hidden]')).toBe(value);
  });

  it('uses Unicode word boundaries without substring bans', () => {
    for (const value of ['scunthorpe', 'éfuck', 'fucké', 'fuck\u0301', 'cunt2'])
      expect(isAllowedNearbyText(value)).toBe(true);
    for (const value of ['(fuck)', 'fuck!', 'hello, fuck', 'fuck-you'])
      expect(isAllowedNearbyText(value)).toBe(false);
  });

  it('does not sanitize or erase the original value when hiding legacy text', () => {
    const saved = Object.freeze({ text: 'ＦＵＣＫ' });
    expect(filteredNearbyText(saved.text, 'Content hidden')).toBe('Content hidden');
    expect(saved.text).toBe('ＦＵＣＫ');
    const allowed = 'Ｇａｙ 👩‍👩‍👧‍👦';
    expect(filteredNearbyText(allowed, 'Content hidden')).toBe(allowed);
  });
});
