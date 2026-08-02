/**
 * The strings where a mistranslation stops being "hard to read" and becomes
 * "a promise we cannot keep" (docs/I18N_POLICY.md, 「約束の反故になる文言」).
 *
 * These are the keys the release gate covers: before shipping, every `machine`
 * locale must have each of them back-translated by someone who was not shown
 * the source, and the author must have read that back-translation. The record
 * lives in `gateRecord.json` and `gate.test.ts` enforces it.
 *
 * Typed as `keyof Messages`, so renaming a key in `en.ts` without revisiting
 * this list is a compile error rather than a key that quietly stops being
 * checked.
 *
 * The list is deliberately short. Every addition is another 12 short strings to
 * read per release, and a gate nobody can complete is the failure mode this
 * whole document was written to escape. Add a key when a wrong translation of
 * it would cost a player money, data, or a promise — not when it would merely
 * read badly.
 */
import type { Messages } from './locales/en';

export const HIGH_RISK_KEYS: readonly (keyof Messages)[] = [
  // 課金 — 「一度だけの購入」がサブスクに読めないこと
  'removeAdsTitle',
  'adSupportBody',
  'removeAdsAction',
  'restorePurchase',
  'purchaseThanks',

  // 削除 — 「元に戻せない」が弱まっていないこと
  'resetData',
  'resetConfirmTitle',
  'resetConfirmBody',
  'delete',

  // プライバシーの本文はもうここに無い(2026-08-02)。`privacy1`〜`privacy5` と
  // `privacyWebAds` は 14 言語ぶんのカタログごと廃止し、設定画面は
  // pixapps.ai の公開ページへリンクするだけになった。訳を 12 言語ぶん抱えて
  // 門に積む代わりに、1 枚のページを 1 回直す形にしたということ
  // (packages/brand の PRIVACY_URL に理由、docs/I18N_POLICY.md に経緯)。
  // これで門の未承認は 240 → 168 件になった。

  // 破壊的操作の確認 — 誤訳がそのままデータ損失になる
  'confirmNewGameBody',
  'minesConfirmSwitchBody',

  // 無料・オフライン・paywall 不在の保証
  'tagline',
  'step3Body',
  'sudokuStep3Body',
];
