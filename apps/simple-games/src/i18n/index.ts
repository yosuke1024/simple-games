/**
 * Bundled i18n — all catalogs ship with the app (offline requirement).
 * "One app. Many games. Many languages." — adding a language must never take
 * more than adding one locale file and registering it here; the Messages
 * type then forces every key to exist (no missing keys, no empty fallbacks).
 *
 * Resolution order (docs/I18N_POLICY.md): the explicit in-app choice, else
 * the device's preferred-language list (Android per-app language settings
 * surface through it), else English. There is deliberately no first-run
 * language picker — the app must be playable immediately.
 */
import type { LanguageSetting } from '../storage/schemas';
import { en, type Messages } from './locales/en';
import { hi } from './locales/hi';
import { id } from './locales/id';
import { ja } from './locales/ja';
import { th } from './locales/th';

export type Locale = 'en' | 'ja' | 'hi' | 'th' | 'id';
export type MessageKey = keyof Messages;

export const catalogs: Record<Locale, Messages> = { en, ja, hi, th, id };

const SUPPORTED = Object.keys(catalogs) as readonly Locale[];

/** Language names shown in the picker — always in their own language. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  hi: 'हिन्दी',
  th: 'ไทย',
  id: 'Bahasa Indonesia',
};

/**
 * Legacy / alias primary subtags. 'in' is the historical Android code for
 * Indonesian. When Chinese support lands, script resolution (zh-TW → zh-Hant)
 * is added here — see docs/I18N_POLICY.md for the fallback table.
 */
const PRIMARY_ALIASES: Record<string, string> = {
  in: 'id',
};

/**
 * Maps one BCP-47 tag to a supported locale, or null. Region variants fall
 * back to their parent (en-IN → en, hi-Latn? no — script tags are ignored
 * until a script-split language is supported).
 */
export function matchLocale(tag: string): Locale | null {
  const lower = tag.toLowerCase();
  if ((SUPPORTED as readonly string[]).includes(lower)) return lower as Locale;
  const primary = lower.split('-')[0] ?? lower;
  const aliased = PRIMARY_ALIASES[primary] ?? primary;
  return (SUPPORTED as readonly string[]).includes(aliased) ? (aliased as Locale) : null;
}

/**
 * Resolves the effective locale. Walks the device's full preferred-language
 * list, not just the first entry, so a French/Japanese bilingual device with
 * ['fr', 'ja'] lands on Japanese rather than English.
 */
export function resolveLocale(setting: LanguageSetting): Locale {
  if (setting !== 'system') return setting;
  const tags: readonly string[] =
    typeof navigator !== 'undefined'
      ? (navigator.languages ?? (navigator.language ? [navigator.language] : []))
      : [];
  for (const tag of tags) {
    const matched = matchLocale(tag);
    if (matched !== null) return matched;
  }
  return 'en';
}

export type TranslateVars = Record<string, string | number>;

/**
 * English is the fallback for any key a catalog misses (the Messages type
 * makes that impossible at compile time, but data safety costs nothing);
 * a translation is therefore never an empty string in production.
 */
export function translate(locale: Locale, key: MessageKey, vars?: TranslateVars): string {
  const template = catalogs[locale][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
