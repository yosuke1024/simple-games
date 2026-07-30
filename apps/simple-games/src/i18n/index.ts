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
 * Indonesian, and devices still report it.
 */
const PRIMARY_ALIASES: Record<string, string> = {
  in: 'id',
};

/**
 * Languages whose written form splits by script or region, where the primary
 * subtag alone is not enough to pick a catalog. Chinese is the real case: a
 * zh-TW reader cannot read Simplified. Everything is lower-cased before
 * lookup, so the keys are too.
 *
 * The default is what a bare `zh` becomes — the more widely read script, and
 * the same choice Android and the web platform make.
 */
const SCRIPT_RESOLUTION: Record<string, { readonly byRegion: Record<string, string>; readonly fallback: string }> = {
  zh: {
    byRegion: {
      tw: 'zh-hant',
      hk: 'zh-hant',
      mo: 'zh-hant',
      cn: 'zh-hans',
      sg: 'zh-hans',
      my: 'zh-hans',
      hant: 'zh-hant',
      hans: 'zh-hans',
    },
    fallback: 'zh-hans',
  },
  pt: {
    // Only Brazilian Portuguese ships; European Portuguese readers get it
    // rather than English, which is much closer to their language.
    byRegion: { br: 'pt-br', pt: 'pt-br' },
    fallback: 'pt-br',
  },
};

const isSupported = (candidate: string): boolean =>
  (SUPPORTED as readonly string[]).includes(candidate);

/**
 * Maps one BCP-47 tag to a supported locale, or null.
 *
 * Region variants fall back to their parent (en-IN → en). Script-split
 * languages resolve through their own table first, because dropping the
 * subtag there would hand a Traditional reader Simplified text.
 */
export function matchLocale(tag: string): Locale | null {
  const lower = tag.toLowerCase();
  if (isSupported(lower)) return lower as Locale;

  const parts = lower.split('-');
  const primary = parts[0] ?? lower;

  const script = SCRIPT_RESOLUTION[primary];
  if (script) {
    // Any subtag may carry the script or the region: zh-Hant, zh-TW, and
    // zh-Hant-TW all have to land in the same place.
    for (const part of parts.slice(1)) {
      const resolved = script.byRegion[part];
      if (resolved !== undefined && isSupported(resolved)) return resolved as Locale;
    }
    return isSupported(script.fallback) ? (script.fallback as Locale) : null;
  }

  const aliased = PRIMARY_ALIASES[primary] ?? primary;
  return isSupported(aliased) ? (aliased as Locale) : null;
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
