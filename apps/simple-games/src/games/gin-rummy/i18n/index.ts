/**
 * Gin Rummy's catalog: all 14 locales, riding in the game's chunk (issue #38).
 *
 * Importing this module is what makes the game's strings exist at runtime —
 * every chunk entry point (the files the registry's loaders name) does so
 * via `import '../i18n'`, which runs before React.lazy can render anything.
 * The `declare module` block is the type-side twin: it merges this game's
 * keys into the app-wide MessageKey union without the shell importing
 * anything from src/games/ (src/i18n/registry.ts explains the pairing).
 *
 * Provenance, as docs/I18N_POLICY.md records it: `en` is the source, `ja` is
 * the author's own, and the other twelve are `machine` — written with AI help
 * and read by no native speaker. None of this game's keys is a high-risk key
 * (src/i18n/highRiskKeys.ts), so none of them goes through the release gate;
 * what holds them honest is the machine check (placeholders, emptiness,
 * markup) and reports from readers.
 */
import type { Locale } from '@/i18n';
import { registerGameMessages } from '@/i18n/registry';
import { de } from './de';
import { en, type GinRummyMessages } from './en';
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
  interface GameMessages extends GinRummyMessages {}
}

export const catalogs: Record<Locale, GinRummyMessages> = {
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

registerGameMessages('gin-rummy', catalogs);
