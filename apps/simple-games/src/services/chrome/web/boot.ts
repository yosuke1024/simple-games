/**
 * Web-build site-chrome bootstrap, dynamically imported by main.tsx behind
 * the `--mode web` gate — the native bundle never contains this module
 * (docs/WEB_VERSION.md「サイトクローム」).
 *
 * It loads the shared PixApps header from the same origin that serves the
 * game (pixapps.ai), so the browser version has a way back to the rest of
 * the site. The header is the landing repository's asset; nothing about its
 * markup or its strings lives here.
 *
 * Offline: not a single request and no retry — the next page load while
 * online tries again (docs/OFFLINE_POLICY.md). Every failure is swallowed:
 * the header simply does not appear, and because it sits in the document
 * flow rather than over it, its absence leaves no gap to explain.
 */
import type { Locale } from '../../../i18n';
import { isOnline } from '../../network';
import { setChromeElement } from './host';
// Imported here rather than from ui/styles.css so it rides this web-only
// chunk: the shared stylesheet ships in both builds, and CSS naming the
// header would put site-chrome traces in the native artifact — which
// check-dist-ads-separation.sh rejects, and rightly (the promise is absence,
// not merely "unused"). Loading it from the module that injects the header
// also orders it correctly: the styles are in place before the header can
// exist, so it is never briefly visible in its parked position.
import './chrome.css';

const HEADER_SCRIPT_SRC = '/global-header.js';
const HEADER_STYLES_HREF = '/global-header.css';
const PAGE_CONFIG_ID = 'pixapps-page-config';
/**
 * The div `global-header.js` swaps its built header into. It MUST exist
 * before that script executes: without it the script falls back to
 * `document.querySelector('nav')` and replaces whatever it finds — which on
 * the collection home is the "recently played" nav, i.e. it would delete
 * part of the game list.
 */
const HEADER_PLACEHOLDER_ID = 'global-header';
/** Set by `global-header.js` on the header it builds. */
const HEADER_SELECTOR = 'header[data-global-header]';

/**
 * The header renders in one language, chosen from the locale the app already
 * resolved. Declaring a SINGLE supported locale is also what keeps the
 * header's own language switcher from rendering: two language controls on
 * one screen, only one of which touches the app's setting, would be a bug
 * rather than a feature.
 *
 * The site itself is ja/en only, so every other locale gets the English
 * header. That is the accepted trade of not spending fourteen translations
 * on site chrome (docs/WEB_VERSION.md「サイトクローム」).
 */
function headerLocale(locale: Locale): 'ja' | 'en' {
  return locale === 'ja' ? 'ja' : 'en';
}

function injectPageConfig(locale: 'ja' | 'en'): void {
  if (document.getElementById(PAGE_CONFIG_ID)) return;
  const config = document.createElement('script');
  config.id = PAGE_CONFIG_ID;
  config.type = 'application/json';
  config.textContent = JSON.stringify({
    pageId: 'simple-games-play',
    supportedLocales: [locale],
    defaultLocale: locale,
  });
  document.head.appendChild(config);
}

function injectStyles(onReady: () => void): void {
  if (document.querySelector(`link[href="${HEADER_STYLES_HREF}"]`)) {
    onReady();
    return;
  }
  const styles = document.createElement('link');
  styles.rel = 'stylesheet';
  styles.href = HEADER_STYLES_HREF;
  styles.addEventListener('load', onReady);
  styles.addEventListener('error', () => {
    // Deliberately does NOT call onReady: without the site's own stylesheet
    // the header would be raw unstyled markup. See initWebChrome.
  });
  document.head.appendChild(styles);
}

function ensurePlaceholder(): void {
  if (document.getElementById(HEADER_PLACEHOLDER_ID)) return;
  const placeholder = document.createElement('div');
  placeholder.id = HEADER_PLACEHOLDER_ID;
  document.body.appendChild(placeholder);
}

function injectScript(onBuilt: (header: HTMLElement) => void): void {
  if (document.querySelector(`script[src="${HEADER_SCRIPT_SRC}"]`)) return;
  const script = document.createElement('script');
  script.src = HEADER_SCRIPT_SRC;
  // The script mounts synchronously on execution when the document is already
  // parsed (it only defers to DOMContentLoaded while readyState is
  // 'loading'), so by `load` the header element exists.
  script.addEventListener('load', () => {
    const header = document.querySelector<HTMLElement>(HEADER_SELECTOR);
    if (header) onBuilt(header);
  });
  script.addEventListener('error', () => {
    // Same as offline: no header, no retry, nothing said to the player.
  });
  document.body.appendChild(script);
}

/**
 * Called once per page load, after the first render (main.tsx).
 *
 * The locale is passed in rather than read from the DOM because
 * SettingsContext writes <html lang> from an effect — reading it here would
 * race the first commit. It is also read only once: changing the language in
 * Settings later does not rebuild the header. That is invisible today
 * because every label and status in the header is the same string in ja and
 * en (all fifteen pairs — they are product names and English loanwords), so
 * a locale change has nothing to redraw. **If the header ever gains a string
 * that differs between the two, this needs to become a subscription.**
 */
export function initWebChrome(locale: Locale): void {
  if (!isOnline()) return;
  try {
    injectPageConfig(headerLocale(locale));
    // Order matters: the placeholder has to be in the DOM before the script
    // that looks for it (see HEADER_PLACEHOLDER_ID).
    ensurePlaceholder();

    // The header is handed over only once BOTH its script has built it and
    // its stylesheet has loaded. Local CSS positions the header but does not
    // style it — the site's own stylesheet does — so publishing on the
    // script alone would turn a failed CSS request into a wall of unstyled
    // navigation instead of the promised "no header at all"
    // (docs/WEB_VERSION.md「サイトクローム」). Both are same-origin and ship
    // together, so this guards a partial failure, not the normal path.
    let stylesReady = false;
    let header: HTMLElement | null = null;
    const publishWhenReady = () => {
      if (stylesReady && header) setChromeElement(header);
    };

    injectStyles(() => {
      stylesReady = true;
      publishWhenReady();
    });
    injectScript((built) => {
      header = built;
      publishWhenReady();
    });
  } catch {
    // Site chrome never blocks play.
  }
}
