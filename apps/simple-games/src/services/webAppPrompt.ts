/**
 * The browser version's one quiet pointer at the installed app
 * (docs/WEB_VERSION.md「アプリへの送客」). One inline card, on the collection
 * home, once per browser — and only for somebody who has actually played.
 *
 * The rules it enforces rather than promises:
 * - Web only. `Capacitor.isNativePlatform()` is a runtime guard, the way every
 *   web/app difference in this product is expressed (docs/WEB_VERSION.md
 *   「実装上の約束」 keeps the build-time gate list closed at three: ads,
 *   analytics, site chrome). In the app nothing below runs, nothing is read
 *   and nothing is written — an installed app never carries a record about
 *   installing itself.
 * - Experience first: nothing before WEB_APP_PROMPT_AT games have been left
 *   for the collection. A first visit and a first game see no card at all.
 * - Once, ever. The showing is booked the moment the card renders, so a
 *   reload or a killed tab cannot turn one card into several.
 * - Offline it simply does not appear, and nothing is booked or retried
 *   (docs/OFFLINE_POLICY.md): the store link would open nothing, and a card
 *   spent on a dead link is the one showing this browser had.
 *
 * What it deliberately is not: a modal, a full screen, a toast, an interstitial
 * on the way into a game, or anything with a countdown. It is a card in the
 * page, below the shortcuts, that the collection scrolls past.
 *
 * State lives at module level with fire-and-forget persistence, mirroring the
 * services/ pattern (`services/review.ts`). A failed save costs at most one
 * card, never a saved game.
 */
import { Capacitor } from '@capacitor/core';
import { APP_STORE_URL, PLAY_STORE_URL } from '@simple-games/brand';
import type { KVStore } from '../storage/kv';
import { preferencesKV } from '../storage/kv';
import { loadRecord, saveRecord } from '../storage/repo';
import { WEB_APP_PROMPT_AT, webAppPromptSchema, type WebAppPromptState } from '../storage/schemas';
import { isOnline } from './network';

let state: WebAppPromptState = webAppPromptSchema.defaultValue();
let kvStore: KVStore = preferencesKV;

/**
 * Loads the counter at boot. Local read only; never blocks the app. On the
 * app build it does not even read: the record belongs to the browser.
 */
export async function initWebAppPrompt(kv: KVStore = preferencesKV): Promise<void> {
  kvStore = kv;
  state = webAppPromptSchema.defaultValue();
  if (Capacitor.isNativePlatform()) return;
  state = await loadRecord(webAppPromptSchema, kv);
}

/**
 * Called by the shell when a game leaves the screen for the collection. It is
 * the only thing that moves the counter, and it stops counting once the card
 * has been shown — after that the number can never matter again, and a
 * counter that keeps climbing is a write on every exit for nothing.
 */
export function recordWebGameExit(): void {
  if (Capacitor.isNativePlatform() || state.shown) return;
  state = { ...state, gameExits: state.gameExits + 1 };
  void saveRecord(webAppPromptSchema, state, kvStore);
}

/** Whether the collection home should carry the card right now. */
export function shouldShowWebAppPrompt(): boolean {
  return (
    !Capacitor.isNativePlatform() &&
    !state.shown &&
    state.gameExits >= WEB_APP_PROMPT_AT &&
    isOnline()
  );
}

/**
 * Books the one showing. Called as the card goes on screen, not when it is
 * answered: whatever the visitor does with it — tap a store link, close it,
 * or close the tab — this browser has had its card.
 */
export function markWebAppPromptShown(): void {
  if (state.shown) return;
  state = { ...state, shown: true };
  void saveRecord(webAppPromptSchema, state, kvStore);
}

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

/** Test hooks. */
export function resetWebAppPromptForTesting(): void {
  state = webAppPromptSchema.defaultValue();
  kvStore = preferencesKV;
}
export function getWebAppPromptStateForTesting(): WebAppPromptState {
  return state;
}
