/**
 * The browser version's pointer at the installed app
 * (docs/WEB_VERSION.md「アプリへの送客」): one small card in the collection
 * home's flow, under the hero and above the shelves, on every visit.
 *
 * It was a one-time card until issue #192 — shown after a couple of games and
 * never again — which was quiet but left anybody landing here from an ad
 * playing a full session without learning an app exists. Permanent is the
 * quieter answer, not the louder one: nothing has to be timed, counted, or
 * remembered about a visitor, so there is no dismiss control, no frequency
 * cap and no stored state anywhere behind this card. Scrolling past it is
 * still the whole of "no", and it costs nothing to do it again tomorrow.
 *
 * Deliberately a card and not a dialog: nothing is covered, nothing is
 * interrupted, and no game is worse in the browser for it (the web build is
 * not the crippled half — docs/WEB_VERSION.md「役割分担」).
 *
 * The two rules it enforces itself, because both are about whether the card
 * can mean anything at all:
 *
 * - **Web only.** `Capacitor.isNativePlatform()` is a runtime guard, the way
 *   every web/app difference in this product is expressed
 *   (docs/WEB_VERSION.md「実装上の約束」 keeps the build-time gate list closed
 *   at three: ads, analytics, site chrome). An installed app never invites
 *   somebody to install it.
 * - **Online only.** Offline the store link opens nothing, so the card is
 *   simply absent — not an error, not a disabled button, and with no retry or
 *   polling arranged (docs/OFFLINE_POLICY.md). The home is rebuilt on the way
 *   back from every game, so a connection that comes back brings the card
 *   with it at the next ordinary moment.
 *
 * The store buttons carry the stores' own names rather than a translated
 * label. They are proper nouns, identical in all fourteen languages, which is
 * the same reason the game titles in the registry are not translated either.
 */
import { Capacitor } from '@capacitor/core';
import { useState } from 'react';
import { isOnline } from '../../services/network';
import { STORE_URLS, storeTargets } from '../../services/webStoreLinks';
import { useSettings } from '../../state/SettingsContext';
import { openExternal } from '../openExternal';

/** The store's own name — never translated, never localised per storefront. */
const STORE_NAMES = { android: 'Google Play', ios: 'App Store' } as const;

export function WebAppStoreCard() {
  const { t } = useSettings();
  // Read once per mount: which links to offer cannot change while the card is
  // on screen, and re-reading the user agent per render would be work for an
  // answer that is already known. `null` on the app build — nothing below ever
  // renders there, and the user agent is then not this component's business.
  const [targets] = useState(() => (Capacitor.isNativePlatform() ? null : storeTargets()));

  if (targets === null || !isOnline()) return null;

  return (
    <section className="app-store-card" aria-labelledby="app-store-card-title">
      <h2 className="app-store-card-title" id="app-store-card-title">
        {t('webAppPromptTitle')}
      </h2>
      <p className="app-store-card-body">{t('webAppPromptBody')}</p>
      <div className="app-store-card-actions">
        {targets.map((target) => (
          <button
            key={target}
            type="button"
            className="btn btn-secondary app-store-card-store"
            onClick={() => {
              // Fails quietly offline, like every other external link
              // (ui/openExternal.ts, docs/OFFLINE_POLICY.md).
              openExternal(STORE_URLS[target]);
            }}
          >
            {STORE_NAMES[target]}
          </button>
        ))}
      </div>
    </section>
  );
}
