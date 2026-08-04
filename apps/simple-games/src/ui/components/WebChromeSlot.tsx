/**
 * The web build's site-chrome slot: the shared PixApps header, which is how
 * the browser version leads back to the rest of the site
 * (docs/WEB_VERSION.md「サイトクローム」).
 *
 * On the native app this renders nothing — an installed app has no site to
 * return to — and the header integration is referenced only when the bundle
 * is built with `--mode web`, so the native artifact carries none of it
 * (verified in CI by .github/scripts/check-dist-ads-separation.sh).
 *
 * Placed on screens that scroll: the collection home, settings, and each
 * game's own home. NOT on a board, a result overlay, or the loading screen —
 * a board is a fixed viewport, and 64px of header on top of the 116px the
 * anchor ad already reserves at the bottom would shrink the board itself.
 *
 * Unlike the ad slots this reserves no space. The header sits in the
 * document flow and scrolls away with the page, so when it is missing
 * (offline, or a failed load) there is nothing left behind to explain.
 */
import { Suspense, lazy } from 'react';

// `import.meta.env.MODE` is replaced at build time, so in the default
// (native-mode) build this whole expression folds to `null` and the dynamic
// import — and with it the header integration — is dropped from the bundle.
const WebChrome =
  import.meta.env.MODE === 'web' ? lazy(() => import('../../services/chrome/web/WebChrome')) : null;

export function WebChromeSlot() {
  if (!WebChrome) return null;
  return (
    <Suspense fallback={null}>
      <WebChrome />
    </Suspense>
  );
}
