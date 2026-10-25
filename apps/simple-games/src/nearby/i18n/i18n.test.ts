import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { catalogs as shellCatalogs, type Locale } from '@/i18n';
import { catalogs, nearbyText, useNearbyText, type NearbyMessages } from './index';
import { en } from './en';

const settings = vi.hoisted(() => ({ locale: 'en' as Locale }));
vi.mock('@/state/SettingsContext', () => ({ useSettings: () => settings }));

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const sources = import.meta.glob<string>('./*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});

describe('Nearby feature translations', () => {
  it('covers every supported locale without registering its short keys globally', () => {
    expect(Object.keys(catalogs).sort()).toEqual(Object.keys(shellCatalogs).sort());
  });
  for (const locale of Object.keys(catalogs) as Locale[]) {
    it(`${locale} has complete text, matching placeholders and no control or markup characters`, () => {
      expect(Object.keys(catalogs[locale]).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en) as Array<keyof NearbyMessages>) {
        const text = catalogs[locale][key];
        expect(text.trim(), `${locale}.${key}`).not.toBe('');
        expect(placeholders(text), `${locale}.${key}`).toEqual(placeholders(en[key]));
        // Check code points rather than a regex containing literal control characters.
        expect(
          Array.from(text).some((character) => {
            const point = character.codePointAt(0)!;
            return (
              point < 32 ||
              (point >= 127 && point <= 159) ||
              (point >= 0x202a && point <= 0x202e) ||
              (point >= 0x2066 && point <= 0x2069) ||
              (point >= 0xd800 && point <= 0xdfff)
            );
          }),
          `${locale}.${key}`,
        ).toBe(false);
        expect(text, `${locale}.${key}`).not.toMatch(/[<>]/);
      }
      for (const key of ['nameHint', 'roomNameHint', 'chatHint', 'twoPeople', 'turn'] as const)
        expect(catalogs[locale][key].match(/\d+/g), `${locale}.${key}`).toEqual(
          en[key].match(/\d+/g),
        );
    });
    it(`${locale} declares all messages explicitly rather than spreading English fallback text`, () => {
      const source = sources[`./${locale}.ts`];
      expect(typeof source).toBe('string');
      expect(source).not.toMatch(/\.\.\.\s*en\b/);
      expect(source).not.toMatch(/from ['"]\.\/en['"];?[\s\S]*=\s*en\b/);
      if (locale !== 'en') {
        for (const key of [
          'localNote',
          'deleteBody',
          'clearBody',
          'blockBody',
          'historyReadOnly',
        ] as const)
          expect(catalogs[locale][key], `${locale}.${key}`).not.toBe(en[key]);
      }
    });
  }
  it('keeps gathering names separate from personal names and removes the obsolete audience choices', () => {
    for (const locale of Object.keys(catalogs) as Locale[]) {
      expect(catalogs[locale].roomName).not.toBe(catalogs[locale].name);
      expect(nearbyText(locale, 'participants', { count: 1, capacity: 2 })).toContain('1/2');
      for (const key of ['friends', 'public', 'audienceHint', 'hostNameHint'])
        expect(catalogs[locale]).not.toHaveProperty(key);
    }
  });
  it('substitutes values literally and leaves missing placeholders intact', () => {
    expect(nearbyText('en', 'request', { name: '$& <Player>' })).toBe('$& <Player> wants to join');
    expect(nearbyText('en', 'turn', { name: 'Player', rolls: 0 })).toBe(
      'Player’s turn · 0/3 rolls',
    );
    expect(nearbyText('en', 'confirmation')).toBe('Connection code: {code}');
  });
  it('follows the current settings locale without caching the initial language', () => {
    settings.locale = 'en';
    const { result, rerender } = renderHook(() => useNearbyText());
    expect(result.current('create')).toBe(en.create);
    settings.locale = 'ja';
    rerender();
    expect(result.current('create')).toBe(catalogs.ja.create);
    expect(result.current('request', { name: 'ひと' })).toBe('ひと さんが参加を希望しています');
    settings.locale = 'en';
  });
});
