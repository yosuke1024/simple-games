/**
 * Where the browser version's app card can send somebody
 * (docs/WEB_VERSION.md「アプリへの送客」) — and that is the whole module.
 *
 * It used to be a state machine: a counter of games left for the collection,
 * a `shown` flag, two thresholds, a record in storage, and a shell that asked
 * at exactly two moments whether the one card was due. All of it existed to
 * spend a single showing well. The card is ordinary content on the collection
 * home now (issue #192), always there while the browser is online, so there
 * is no showing to spend: no counter to keep, no flag to book, and nothing
 * written down about a visitor at all.
 *
 * What survives is the one decision that was never about timing — which store
 * this browser could actually install from — and it reads the user agent and
 * nothing else. The web-only and offline rules moved to the card itself
 * (`ui/components/WebAppStoreCard.tsx`), which is where they are visible.
 */
import { APP_STORE_URL, PLAY_STORE_URL } from '@simple-games/brand';

export type StoreTarget = 'android' | 'ios';

export const STORE_URLS: Record<StoreTarget, string> = {
  android: PLAY_STORE_URL,
  ios: APP_STORE_URL,
};

/**
 * Which store links the card offers. The two stores are not interchangeable
 * destinations: an iPhone sent to Google Play lands on a page it cannot
 * install from, which reads as a broken button rather than as an invitation.
 *
 * Read from the user agent, and read is all — nothing here is stored, sent,
 * or turned into an event. When the answer is not obvious (a desktop browser,
 * a user agent nobody recognises) both links are offered, which is honest
 * about not knowing and still gets everyone to the right page.
 *
 * iPadOS 13+ reports itself as a Macintosh, so a plain string test would send
 * every iPad to the desktop pair; the touch points tell the two apart.
 */
export function storeTargets(): readonly StoreTarget[] {
  if (typeof navigator === 'undefined') return ['android', 'ios'];
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return ['android'];
  if (/iphone|ipad|ipod/i.test(ua)) return ['ios'];
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return ['ios'];
  return ['android', 'ios'];
}
