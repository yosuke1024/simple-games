/**
 * Where a row of the collection home's "More from PixApps" list sends
 * somebody (issue #276, ui/components/MoreFromPixApps.tsx). The answer is the
 * store this device can install from, for the same reason the review fallback
 * and the browser's app card pick one (services/review.ts,
 * services/webStoreLinks.ts): an iPhone sent to Google Play lands on a page it
 * cannot install from, and that reads as a broken link.
 *
 * - The app build asks Capacitor which platform it is.
 * - The browser build reads the user agent through `storeTargets`, and nothing
 *   else. When that cannot tell (a desktop), there is no store to install from
 *   at all, so the row opens the app's page on the PixApps site instead.
 *
 * Nothing here is stored, sent, or turned into an event. The row only works
 * out the address when somebody taps it.
 */
import { Capacitor } from '@capacitor/core';
import type { PixAppsApp } from '@simple-games/brand';
import { storeTargets } from './webStoreLinks';

export function pixAppsAppUrl(app: PixAppsApp): string {
  if (Capacitor.isNativePlatform()) {
    return Capacitor.getPlatform() === 'ios' ? app.appStoreUrl : app.playStoreUrl;
  }
  const targets = storeTargets();
  if (targets.length !== 1) return app.landingUrl;
  return targets[0] === 'ios' ? app.appStoreUrl : app.playStoreUrl;
}
