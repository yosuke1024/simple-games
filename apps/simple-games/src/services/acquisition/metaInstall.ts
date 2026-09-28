/**
 * Meta install measurement — Android only, and only in a release built with
 * Meta (issue #204, docs/META_ANDROID_ACQUISITION.md).
 *
 * WHAT THIS IS, AND IS NOT
 *
 * One report, once per install: "this app was installed", so that the Meta
 * ads bringing players to Google Play can be measured and optimised for
 * installs. It is not analytics. Nothing about play reaches it — which games,
 * how long, scores, hints, saves, purchases, settings — because nothing here
 * can carry any of that: the native side sends a fixed report and this module
 * can only say yes, no, or "now" (plugin.ts). No game imports it
 * (src/test/importBoundaries.test.ts).
 *
 * WHEN ANYTHING IS SENT
 *
 * Only when all of these hold: the build carries Meta (`available`), the
 * player said yes, Meta has not yet acknowledged this install, and the device
 * is online. At most one attempt per launch; offline, the attempt waits for
 * the way back online (`onNextOnline`) instead of retrying. The native side
 * checks the same conditions again before it starts the SDK at all, and
 * after Meta has acknowledged the install it never starts it again.
 *
 * THE QUESTION
 *
 * Asked at most once per install, on the way back from a game to the
 * collection — the review question's doorway (docs/REVIEW_PROMPT_POLICY.md):
 * never at launch, never mid-game — and only while it can still mean
 * something: within the first week after the app was installed, because the
 * question is about how this install came about. A player updating from an
 * older version is never asked.
 *
 * English and Japanese only (`META_ASK_LOCALES`). This is a consent, and a
 * consent read in a machine translation nobody has checked is not one we can
 * say we were given (docs/I18N_POLICY.md, the WebBetaNotice precedent). In
 * the other twelve languages the question is not asked and nothing is sent.
 *
 * The showing is booked as a "no" before the dialog opens: whatever ends it —
 * "Don't allow", a tap outside, the hardware back, the app being killed — is
 * an answer of no, and the question does not come back. Only "Allow" changes
 * it. Settings can turn it on or off at any time.
 */
import { Capacitor } from '@capacitor/core';
import { isOnline, onNextOnline } from '../network';
import { MetaInstall, type MetaConsent, type MetaInstallState } from './plugin';

/** The languages in which the question is asked (see the header). */
export const META_ASK_LOCALES: readonly string[] = ['en', 'ja'];

/** How long after installing the question is still worth asking. */
export const META_ASK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const UNAVAILABLE: MetaInstallState = { available: false };
const CONSENTS: readonly MetaConsent[] = ['unset', 'granted', 'declined'];

let state: MetaInstallState = UNAVAILABLE;
let reportRequested = false;
let askedThisLaunch = false;
let cancelOnlineWait: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * The native answer, trusted only as far as it is well-formed. Anything odd
 * reads as unavailable, or as "declined" — never as a yes and never as a
 * question still to ask.
 */
function normalize(raw: MetaInstallState | null | undefined): MetaInstallState {
  if (!raw || raw.available !== true) return UNAVAILABLE;
  const consent = CONSENTS.includes(raw.consent as MetaConsent)
    ? (raw.consent as MetaConsent)
    : 'declined';
  const installedAt =
    typeof raw.installedAt === 'number' && Number.isFinite(raw.installedAt) ? raw.installedAt : 0;
  return {
    available: true,
    consent,
    reported: raw.reported === true,
    stopped: raw.stopped === true,
    attempted: raw.attempted === true,
    installedAt,
  };
}

function setState(next: MetaInstallState): void {
  state = next;
  notify();
}

function stopWaitingForOnline(): void {
  cancelOnlineWait?.();
  cancelOnlineWait = null;
}

/**
 * Hands the native side its one attempt for this launch, if one is due.
 * Every condition is read again at the moment it would go, so a "no" given
 * while waiting for the network wins.
 */
function reportIfDue(): void {
  if (
    !state.available ||
    state.consent !== 'granted' ||
    state.reported ||
    state.stopped ||
    reportRequested
  ) {
    return;
  }
  if (!isOnline()) {
    if (!cancelOnlineWait) {
      cancelOnlineWait = onNextOnline(() => {
        cancelOnlineWait = null;
        reportIfDue();
      });
    }
    return;
  }
  reportRequested = true;
  void MetaInstall.reportInstall().catch(() => undefined);
}

/**
 * Boot, after the first render and never awaited by anything that draws.
 * Off Android, or in a build without Meta, this reads nothing and leaves the
 * state unavailable.
 */
export async function initMetaInstall(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    setState(normalize(await MetaInstall.getState()));
  } catch {
    setState(UNAVAILABLE);
    return;
  }
  reportIfDue();
}

export function getMetaInstallState(): MetaInstallState {
  return state;
}

/** Subscribe for React (useSyncExternalStore). Returns the unsubscriber. */
export function subscribeMetaInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Whether the one question is due now, on the way back from a game. See the
 * header for every condition; `locale` is the language the app is showing.
 */
export function shouldAskMetaInstall(locale: string, now: number = Date.now()): boolean {
  if (askedThisLaunch) return false;
  if (!state.available || state.consent !== 'unset' || state.reported || state.stopped) {
    return false;
  }
  if (!META_ASK_LOCALES.includes(locale)) return false;
  const installedAt = state.installedAt ?? 0;
  if (installedAt <= 0 || now < installedAt) return false;
  return now - installedAt < META_ASK_WINDOW_MS;
}

/**
 * Books the showing as a "no" before the dialog opens (see the header), so
 * no way of closing it can bring the question back.
 */
export function bookMetaInstallAsk(): void {
  askedThisLaunch = true;
  void setMetaInstallAllowed(false);
}

/**
 * The player's answer, from the question or from Settings. A yes starts the
 * report if it is due; a no stops any wait for the network and, on the native
 * side, deletes what the Meta SDK kept on this device. Resolves quietly
 * whatever happens — an answer that could not be written leaves Meta off.
 */
export async function setMetaInstallAllowed(granted: boolean): Promise<void> {
  if (!state.available) return;
  if (!granted) stopWaitingForOnline();
  setState({ ...state, consent: granted ? 'granted' : 'declined' });
  try {
    setState(normalize(await MetaInstall.setConsent({ granted })));
  } catch {
    // Not written. The native side still holds the previous answer, which is
    // what the next launch will read; nothing is sent on a yes we could not
    // record.
    if (granted) setState({ ...state, consent: 'declined' });
    return;
  }
  if (granted) reportIfDue();
}

/** Test hook. */
export function resetMetaInstallForTesting(): void {
  state = UNAVAILABLE;
  reportRequested = false;
  askedThisLaunch = false;
  stopWaitingForOnline();
  listeners.clear();
}
