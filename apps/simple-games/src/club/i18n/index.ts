/**
 * The Club House's catalog: all 14 locales, riding in the `club` chunk
 * (docs/architecture/club.md §11). `club/index.ts` imports this first, so no
 * screen renders a key before it exists. Same pairing as a game's catalog:
 * the `declare module` block merges the keys into the app-wide MessageKey
 * union (src/i18n/registry.ts), the call below registers the strings.
 */
import type { Locale } from '@/i18n';
import { registerGameMessages } from '@/i18n/registry';
import { de } from './de';
import { en, type ClubMessages } from './en';
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

declare module '@/i18n/registry' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the extends clause is the contribution
  interface GameMessages extends ClubMessages {}
}

export const catalogs: Record<Locale, ClubMessages> = {
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

registerGameMessages('club', catalogs);
