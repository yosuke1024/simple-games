/**
 * PixApps' other apps, at the very end of the collection home (issue #276,
 * docs/architecture/collection-home.md「PixApps のほかのアプリ」): a heading,
 * one sentence saying what these are, and one row per app with its name and
 * the line its own page uses.
 *
 * It is for the player who has scrolled past every game and still wants to
 * know who made them. It is not for click-through. So it comes after the
 * last shelf, never in search results, and it looks like text on the paper
 * rather than like a game tile or an ad: no icon artwork, no card, no
 * colour, no animation and no dismiss control. Nothing is counted, stored or
 * sent about it. A tap opens the store and that is all
 * (docs/PRODUCT_PRINCIPLES.md「PixApps の自社アプリの一覧は広告ではない」).
 *
 * The sentence under the heading is required, not optional. These are
 * separate apps with their own features and prices. A list of them under
 * a home whose every promise is "no subscription, no account" would
 * otherwise read as if those promises came along (docs/BRAND.md「PixApps の
 * ほかのアプリの書き方」).
 *
 * Online only, like the browser's app card (WebAppStoreCard.tsx). Offline,
 * no row can open anything, so the section is simply absent. That means no
 * disabled rows and no retry, and the home is rebuilt on the way back from
 * every game, so a connection that comes back brings the section with it.
 *
 * App names are proper nouns, identical in every language, like the game
 * titles. The heading, the sentence and the two lines come from the
 * catalogs.
 */
import { PIXMEAL, PIXWORK, type PixAppsApp } from '@simple-games/brand';
import type { MessageKey } from '../../i18n';
import { isOnline } from '../../services/network';
import { pixAppsAppUrl } from '../../services/pixAppsLinks';
import { useSettings } from '../../state/SettingsContext';
import { openExternal } from '../openExternal';
import { IconExternal } from './icons';

const APPS: readonly { readonly app: PixAppsApp; readonly taglineKey: MessageKey }[] = [
  { app: PIXMEAL, taglineKey: 'pixMealTagline' },
  { app: PIXWORK, taglineKey: 'pixWorkTagline' },
];

export function MoreFromPixApps() {
  const { t } = useSettings();

  if (!isOnline()) return null;

  return (
    <section className="more-from-pixapps" aria-labelledby="more-from-pixapps-heading">
      <h2 className="home-section-label" id="more-from-pixapps-heading">
        {t('moreFromPixAppsTitle')}
      </h2>
      <p className="more-from-pixapps-body">{t('moreFromPixAppsBody')}</p>
      <div className="more-from-pixapps-apps">
        {APPS.map(({ app, taglineKey }) => {
          const nameId = `more-from-pixapps-${app.name}`;
          return (
            <button
              key={app.name}
              type="button"
              className="more-from-pixapps-app"
              // Named by the app alone, described by its line: a screen reader
              // hears "PixMeal, button", then what it is, rather than one
              // run-on sentence.
              aria-labelledby={nameId}
              aria-describedby={`${nameId}-tagline`}
              onClick={() => {
                // Fails quietly, like every other external link
                // (ui/openExternal.ts, docs/OFFLINE_POLICY.md).
                openExternal(pixAppsAppUrl(app));
              }}
            >
              <span className="more-from-pixapps-text">
                <span className="more-from-pixapps-name" id={nameId}>
                  {app.name}
                </span>
                <span className="more-from-pixapps-tagline" id={`${nameId}-tagline`}>
                  {t(taglineKey)}
                </span>
              </span>
              <span className="more-from-pixapps-mark" aria-hidden="true">
                <IconExternal />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
