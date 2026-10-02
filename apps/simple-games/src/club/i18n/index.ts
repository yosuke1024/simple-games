import type { Locale } from '@/i18n';
import { registerGameMessages } from '@/i18n/registry';
import { en, type ClubMessages } from './en';

declare module '@/i18n/registry' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the extends clause is the contribution
  interface GameMessages extends ClubMessages {}
}

// TODO(work package B): the 14 locales. Until then every locale reads en.
export const catalogs: Record<Locale, ClubMessages> = {
  en,
  ja: en,
  hi: en,
  th: en,
  id: en,
  vi: en,
  ko: en,
  'zh-hans': en,
  'zh-hant': en,
  es: en,
  'pt-br': en,
  fr: en,
  de: en,
  tr: en,
};

registerGameMessages('club', catalogs);
