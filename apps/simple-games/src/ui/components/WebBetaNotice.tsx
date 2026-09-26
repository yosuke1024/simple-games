/**
 * The mark a web-beta title wears on its own home (docs/WEB_VERSION.md
 * 「先行公開(ベータ)」, issue #194): the language-independent BETA badge, and
 * — in English and Japanese only — the one sentence a player has to be told
 * before trusting this game with their time: that its saved progress may be
 * reset while it is in early release.
 *
 * Why two languages and not fourteen. That sentence is about data being
 * lost, which docs/I18N_POLICY.md lists among the high-risk strings — a
 * mistranslation there is a broken promise, and the release gate that
 * catches those (an independent back-translation, read by the author) has
 * no reader for twelve of the locales. So the other twelve get the badge
 * alone, which needs no translation, rather than a machine-written promise
 * about their data. The wording is the purpose, not a trade: early release
 * exists to see how a game plays before it joins the app, and measurement
 * is for that decision (docs/BRAND.md「静かに、正直に」).
 *
 * Shell-owned, rendered by the game (the same shape as `GameHomeHeader`): the
 * game names itself and nothing else, and the answer — whether this title is
 * on the beta channel at all, and whether this build is the browser — comes
 * from the registry and the platform, never from the game's own code. On the
 * app, where a beta title is never shown, this renders nothing, and it
 * renders nothing for a released title anywhere, so a game promoted to the
 * app later needs no edit here: dropping `channel` from its registry entry is
 * the whole of "remove the BETA badge" (docs/RELEASE_CHECKLIST.md §0).
 */
import { Capacitor } from '@capacitor/core';
import { GAMES, type GameId } from '../../app/registry';
import { useSettings } from '../../state/SettingsContext';

/** The save caveat, in the two languages a native reader has checked. */
const SAVE_NOTE = {
  en: 'Early release: we watch how it plays before adding it to the app. Saved progress in this game may be reset by an update.',
  ja: '先行公開中: 反応を見て、アプリへの正式収録を決めます。このゲームの保存データは更新で消えることがあります。',
} as const;

import { BETA_BADGE } from './GameBetaBadge';

export function WebBetaNotice({ gameId }: { gameId: GameId }) {
  const { locale } = useSettings();
  const game = GAMES.find((entry) => entry.id === gameId);
  if (game?.channel !== 'web-beta' || Capacitor.isNativePlatform()) return null;
  const note = locale === 'ja' ? SAVE_NOTE.ja : locale === 'en' ? SAVE_NOTE.en : null;
  return (
    <p className="web-beta-notice">
      <span className="beta-badge">{BETA_BADGE}</span>
      {note ? <span className="web-beta-note">{note}</span> : null}
    </p>
  );
}
