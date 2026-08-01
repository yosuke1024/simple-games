/**
 * Who actually wrote each catalogue (docs/I18N_POLICY.md, 「翻訳の状態」).
 *
 *   source  — the original. Everything else is measured against it.
 *   author  — written by the author, who is native in that language.
 *   machine — written with AI assistance and **not read by a native speaker**.
 *
 * This is a `Record<Locale, …>`, so adding a locale without deciding its
 * provenance is a compile error rather than a silent `undefined`. That matters:
 * `machine` is what puts a locale under the release gate (`highRiskKeys.ts`),
 * and a locale missing from this map would slip past it.
 *
 * **`author` is not a grade that careful process earns.** Independent
 * back-translation, the author's review of it, and a second model's audit all
 * leave the fact untouched: no native speaker has read the text. Only a native
 * reader moves a locale here.
 */
import type { Locale } from './index';

export type Provenance = 'source' | 'author' | 'machine';

export const LOCALE_PROVENANCE: Record<Locale, Provenance> = {
  en: 'source',
  ja: 'author',
  hi: 'machine',
  th: 'machine',
  id: 'machine',
  vi: 'machine',
  ko: 'machine',
  'zh-hans': 'machine',
  'zh-hant': 'machine',
  es: 'machine',
  'pt-br': 'machine',
  fr: 'machine',
  de: 'machine',
  tr: 'machine',
};

/** The locales the release gate applies to: every one no native has read. */
export function machineLocales(): Locale[] {
  return (Object.keys(LOCALE_PROVENANCE) as Locale[]).filter(
    (locale) => LOCALE_PROVENANCE[locale] === 'machine',
  );
}
