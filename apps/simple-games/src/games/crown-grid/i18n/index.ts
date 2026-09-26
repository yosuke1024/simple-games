/**
 * This game's catalog: all 14 locales, riding in the game's chunk (issue #38
 * pattern). Importing this module is what makes the game's strings exist at
 * runtime — every chunk entry point does so via `import '../i18n';`, which
 * runs before React.lazy can render anything. The `declare module` block is
 * the type-side twin: it merges this game's keys into the app-wide
 * MessageKey union without the shell importing anything from src/games/
 * (src/i18n/registry.ts explains the pairing).
 *
 * Scaffolded by scripts/new-game.mjs.
 */
import type { Locale } from '@/i18n';
import { registerGameMessages } from '@/i18n/registry';
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
import { en, type CrownGridMessages } from './en';

declare module '@/i18n/registry' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the extends clause is the contribution
  interface GameMessages extends CrownGridMessages {}
}

export const catalogs: Record<Locale, CrownGridMessages> = {
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

registerGameMessages('crown-grid', catalogs);
