/**
 * Bundled i18n — all catalogs ship with the app (offline requirement).
 * English is the fallback for unknown device languages.
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

/** Language names shown in the picker, each in its own language. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  hi: 'हिन्दी',
  th: 'ไทย',
  id: 'Bahasa Indonesia',
};

export function resolveLocale(setting: LanguageSetting): Locale {
  if (setting !== 'system') return setting;
  const raw =
    typeof navigator !== 'undefined'
      ? (navigator.languages?.[0] ?? navigator.language ?? 'en')
      : 'en';
  const tag = raw.toLowerCase();
  if (tag.startsWith('ja')) return 'ja';
  if (tag.startsWith('hi')) return 'hi';
  if (tag.startsWith('th')) return 'th';
  // 'in' is the legacy Android language code for Indonesian.
  if (tag.startsWith('id') || tag.startsWith('in')) return 'id';
  return 'en';
}

export type TranslateVars = Record<string, string | number>;

export function translate(locale: Locale, key: MessageKey, vars?: TranslateVars): string {
  const template = catalogs[locale][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
