/**
 * The brand footer at the bottom of the shell's scrolling screens (collection
 * home and settings): the series name, and "by PixApps" with the publisher's
 * name as the one tappable thing — it opens the PixApps site's top page in
 * the system browser (PUBLISHER_URL), the way from an installed app to the
 * rest of what PixApps makes.
 *
 * Shared because the two screens' footers are byte-identical shell framing,
 * not game content (docs/ARCHITECTURE.md「シェルの枠とゲームの中身」); it takes
 * no props, so there is nothing for a screen to configure.
 *
 * Offline: the tap does nothing (openExternal), the same contract as the
 * About links on the settings screen (docs/OFFLINE_POLICY.md). The word "by"
 * stays an untranslated brand string, as the by-line was before it gained a
 * link (docs/BRAND.md「名称」).
 */
import { PUBLISHER_NAME, PUBLISHER_URL, SERIES_NAME } from '@simple-games/brand';
import { openExternal } from '../openExternal';

export function BrandFooter() {
  return (
    <footer className="brand-footer">
      <span className="brand-name">{SERIES_NAME}</span>
      <span className="brand-by">
        by{' '}
        <button type="button" className="brand-link" onClick={() => openExternal(PUBLISHER_URL)}>
          {PUBLISHER_NAME}
        </button>
      </span>
    </footer>
  );
}
