/**
 * The store-review flow (docs/REVIEW_PROMPT_POLICY.md): after enough
 * completed games, one quiet in-app question at a natural pause — enjoying
 * it? "Yes" opens the native in-app review card; "not really" offers a
 * feedback mail instead, so criticism reaches us and not the store rating.
 *
 * Honesty rules, enforced here rather than promised:
 * - Engagement first: nothing is asked before REVIEW_FIRST_PROMPT_AT wins.
 * - Asked at most twice per install, ever ("not now" re-arms once, far
 *   later); any actual answer retires the question for good.
 * - Never at launch, never mid-game — the shell asks only on the way back
 *   from a game to the collection, and only while online (so a "yes" can
 *   actually reach the store instead of doing nothing).
 * - Native only: on the web build (docs/WEB_VERSION.md) there is no install
 *   to review, so the question is never asked at all.
 *
 * State lives at module level with fire-and-forget persistence, mirroring
 * the services/ pattern. Failures never affect gameplay.
 */
import { InAppReview } from '@capacitor-community/in-app-review';
import { Capacitor } from '@capacitor/core';
import { APP_STORE_URL, PLAY_STORE_URL, SUPPORT_EMAIL } from '@simple-games/brand';
import packageJson from '../../package.json';
import type { KVStore } from '../storage/kv';
import { preferencesKV } from '../storage/kv';
import { loadRecord, saveRecord } from '../storage/repo';
import { reviewSchema, type ReviewState } from '../storage/schemas';
import { openExternal } from '../ui/openExternal';
import { isOnline } from './network';

/** "Not now" re-arms the question this many completions later. */
const RETRY_AFTER_COMPLETIONS = 20;
/** Hard cap on how many times the question can ever be shown. */
const MAX_PROMPTS = 2;

let state: ReviewState = reviewSchema.defaultValue();
let kvStore: KVStore = preferencesKV;

/** Loads the counter at boot. Local read only; never blocks the app. */
export async function initReview(kv: KVStore = preferencesKV): Promise<void> {
  kvStore = kv;
  state = await loadRecord(reviewSchema, kv);
}

function persist(): void {
  void saveRecord(reviewSchema, state, kvStore);
}

/** Called by each game when a game is won. Counting is all it does. */
export function recordGameCompleted(): void {
  state = { ...state, gamesCompleted: state.gamesCompleted + 1 };
  persist();
}

/**
 * Whether the shell should ask now (evaluated on game exit). Pure state
 * rules plus two gates: offline, a "yes" could open nothing — so the
 * question quietly waits for a better moment; and on the web the player has
 * no install to rate, so asking would only be a store advert.
 */
export function shouldPromptReview(): boolean {
  return (
    Capacitor.isNativePlatform() &&
    !state.resolved &&
    state.promptsShown < MAX_PROMPTS &&
    state.gamesCompleted >= state.nextPromptAt &&
    isOnline()
  );
}

/** Books a shown prompt: whatever happens next, no early re-ask. */
export function markReviewPromptShown(): void {
  state = {
    ...state,
    promptsShown: state.promptsShown + 1,
    nextPromptAt: state.gamesCompleted + RETRY_AFTER_COMPLETIONS,
  };
  persist();
}

/** The player answered (either direction): the question retires for good. */
export function resolveReviewPrompt(): void {
  state = { ...state, resolved: true };
  persist();
}

/**
 * The listing to open when the native review card cannot be shown. Picked by
 * platform, because the two stores are not interchangeable destinations: an
 * iPhone sent to Google Play lands on a page it cannot install from, which
 * reads as a broken button rather than as a review invitation.
 *
 * Off a native platform there is no install to review at all — the question is
 * never asked on the web build (see the module comment) — so Play is the
 * arbitrary-but-harmless default for the one path that can still get here,
 * a direct call from a test or a future surface.
 */
function storeListingUrl(): string {
  return Capacitor.getPlatform() === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
}

/**
 * Opens the native in-app review card; the store decides whether it actually
 * appears (Play has a quota, and iOS caps the prompt per year). Falls back to
 * this platform's listing, and fails quietly — a review must never produce an
 * error screen.
 */
export async function requestStoreReview(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await InAppReview.requestReview();
      return;
    } catch {
      // Fall through to the listing.
    }
  }
  openExternal(storeListingUrl());
}

/**
 * Opens a mail draft to the support address. Nothing is sent by the app —
 * the player sees and owns the draft. The trailing metadata (version,
 * language) is the only context attached, and they can delete it.
 */
export function openFeedbackEmail(locale: string): void {
  const subject = encodeURIComponent('Simple Games feedback');
  const body = encodeURIComponent(`\n\n—\nSimple Games v${packageJson.version} · ${locale}`);
  try {
    // location.href (not window.open): the WebView hands non-http schemes
    // to the OS, which opens the mail app. Works offline by design.
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  } catch {
    // No mail app: the tap does nothing; the app keeps running.
  }
}

/** Test hooks. */
export function resetReviewForTesting(): void {
  state = reviewSchema.defaultValue();
  kvStore = preferencesKV;
}
export function getReviewStateForTesting(): ReviewState {
  return state;
}
