/**
 * The release gate (gate.test.ts) reads provenance per locale, and `ja` is
 * `author` (provenance.ts) — so the gate only ever covers the twelve `machine`
 * locales. That is true of the shell's catalogs and the released games', but
 * not of the five web-beta titles of 2026-10-17: their `ja` was drafted by AI
 * and the author has not read it yet (docs/I18N_POLICY.md「Web 先行公開の 5 本」).
 * The five of 2026-10-19 (No. 47–51) joined the list from their scaffolds and
 * had their catalogs written when they became playable (on the beta channel
 * since 2026-10-22): `ja` is an AI draft the author has not read, and the other
 * twelve are machine-written with no native reader (docs/I18N_POLICY.md, the
 * No. 47〜51 paragraph).
 * The five of 2026-10-20 (No. 52–56) had their catalogs written on 2026-10-21:
 * `ja` is an AI draft the author has not read, and the other twelve are
 * machine-written with no native reader (docs/I18N_POLICY.md「さらに次の 5 本」).
 *
 * The policy's answer is that those catalogs define no high-risk key at all,
 * so no unread `ja` can carry a promise the gate would have stopped. This test
 * makes that claim a check rather than something matched by hand once: a
 * high-risk key added to one of these catalogs fails here, until either the
 * author has read that game's `ja` (and the id leaves this list, with
 * I18N_POLICY.md) or the key moves to a catalog the gate covers.
 */
import { describe, expect, it } from 'vitest';
import type { Locale } from './index';
import { HIGH_RISK_KEYS } from './highRiskKeys';

/** Game catalogs whose `ja` the author has not read (docs/I18N_POLICY.md). */
const UNREAD_JA_GAME_IDS = [
  'unblock-puzzle',
  'snake',
  'loop-puzzle',
  'bridges',
  'peg-solitaire',
  'chess',
  'gem-swap',
  'pipe-link',
  'bounce-up',
  'echo-pads',
  'overtake',
  'make-the-target',
  'nested-tic-tac-toe',
  'scopa',
  'tangram',
  'light-grid',
  'color-flood',
  'three-peaks',
  'nim',
  'knight-tour',
] as const;

const gameModules = import.meta.glob<{ catalogs: Record<Locale, Record<string, string>> }>(
  '../games/*/i18n/index.ts',
  { eager: true },
);

const catalogOf = (id: string) => gameModules[`../games/${id}/i18n/index.ts`]?.catalogs;

describe('game catalogs whose ja is unread', () => {
  it('names only games whose catalog exists', () => {
    const missing = UNREAD_JA_GAME_IDS.filter((id) => catalogOf(id) === undefined);
    expect(missing).toEqual([]);
  });

  it('define no high-risk key, in any locale', () => {
    const found: string[] = [];
    for (const id of UNREAD_JA_GAME_IDS) {
      const catalogs = catalogOf(id);
      if (catalogs === undefined) continue;
      for (const [locale, messages] of Object.entries(catalogs)) {
        for (const key of HIGH_RISK_KEYS) {
          if (Object.hasOwn(messages, key)) found.push(`${id} ${locale}.${key}`);
        }
      }
    }
    expect(found, found.join('\n')).toEqual([]);
  });
});
