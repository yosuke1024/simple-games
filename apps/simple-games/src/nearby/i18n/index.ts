import { useCallback } from 'react';
import type { Locale } from '@/i18n';
import { useSettings } from '@/state/SettingsContext';
import { de } from './de';
import { en, type NearbyMessages } from './en';
import { es } from './es';
import { fr } from './fr';
import { hi } from './hi';
import { id } from './id';
import { ja } from './ja';
import { ko } from './ko';
import { ptBR } from './pt-br';
import { th } from './th';
import { tr } from './tr';
import { vi } from './vi';
import { zhHans } from './zh-hans';
import { zhHant } from './zh-hant';

export type { NearbyMessages } from './en';
export type NearbyText = (
  key: keyof NearbyMessages,
  vars?: Record<string, string | number>,
) => string;

/** Kept in the Nearby feature, without adding short keys to the shared catalog. */
export const catalogs: Record<Locale, NearbyMessages> = {
  en,
  ja,
  hi,
  th,
  id,
  vi,
  ko,
  'zh-hans': zhHans,
  'zh-hant': zhHant,
  es,
  'pt-br': ptBR,
  fr,
  de,
  tr,
};

export function nearbyText(
  locale: Locale,
  key: keyof NearbyMessages,
  vars: Record<string, string | number> = {},
): string {
  return catalogs[locale][key].replace(/\{(\w+)\}/g, (token: string, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : token,
  );
}

export function useNearbyText(): NearbyText {
  const { locale } = useSettings();
  return useCallback((key, vars) => nearbyText(locale, key, vars), [locale]);
}
