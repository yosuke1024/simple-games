/**
 * bubble-pop's catalog: all 14 locales ride in the game's chunk (issue #38),
 * same shape as every other game's i18n/index.ts.
 *
 * Importing this module is what makes the game's strings exist at runtime —
 * every chunk entry point (the files the registry's loaders name) does so
 * via `import '../i18n'`, which runs before React.lazy can render anything.
 * The `declare module` block is the type-side twin: it merges this game's
 * keys into the app-wide MessageKey union without the shell importing
 * anything from src/games/ (src/i18n/registry.ts explains the pairing).
 *
 * TODO(translation team, docs/plans/2026-08-08-mahjong-bubble-ludo.md):
 * only en/ja are authored for this UI slice — hi/th/id/vi/ko/zh-hans/zh-hant/
 * es/pt-br/fr/de/tr are placeholder aliases of `en` below so `catalogs`
 * type-checks as `Record<Locale, BubblePopMessages>` and the i18n
 * consistency/gate tests (which glob every game's index.ts) stay green. This
 * is the "type allows the fallback" branch the hand-off note calls for —
 * replace each alias with a real locale module (mirroring brick-breaker's
 * i18n/ folder) and import it above instead of falling back to `en`.
 */
import type { Locale } from '@/i18n';
import { registerGameMessages } from '@/i18n/registry';
import { en, type BubblePopMessages } from './en';
import { ja } from './ja';

declare module '@/i18n/registry' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the extends clause is the contribution
  interface GameMessages extends BubblePopMessages {}
}

export const catalogs: Record<Locale, BubblePopMessages> = {
  en,
  ja,
  // TODO(translation team): replace with authored locale modules (en fallback).
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

registerGameMessages('bubble-pop', catalogs);
