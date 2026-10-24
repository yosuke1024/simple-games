import type { Locale } from '@/i18n';
import { registerGameMessages } from '@/i18n/registry';
import { en, type HanoiTowersMessages } from './en';
import { ja } from './ja';
import { hi } from './hi';
import { th } from './th';
import { id } from './id';
import { vi } from './vi';
import { ko } from './ko';
import { zhHans } from './zh-hans';
import { zhHant } from './zh-hant';
import { es } from './es';
import { ptBR } from './pt-br';
import { fr } from './fr';
import { de } from './de';
import { tr } from './tr';
declare module '@/i18n/registry' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- contributes this game's keys
  interface GameMessages extends HanoiTowersMessages {}
}
export const catalogs: Record<Locale, HanoiTowersMessages> = {
  en: en,
  ja: ja,
  hi: hi,
  th: th,
  id: id,
  vi: vi,
  ko: ko,
  'zh-hans': zhHans,
  'zh-hant': zhHant,
  es: es,
  'pt-br': ptBR,
  fr: fr,
  de: de,
  tr: tr,
};
registerGameMessages('hanoi-towers', catalogs);
