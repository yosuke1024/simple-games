/**
 * UMP (User Messaging Platform) consent, kept apart from the banner itself
 * because the two answer different questions: this module decides whether the
 * SDK is ALLOWED to request an ad, banner.ts decides whether we WANT one.
 *
 * Hard rules implemented here (docs/ADS_POLICY.md「同意(UMP)」):
 * - No ad is requested before UMP reports `canRequestAds`. Failing to obtain
 *   consent means no ads — never ads without an answer.
 * - A consent form that cannot be shown still records where UMP requires a
 *   privacy options entry point, so Settings keeps the withdrawal route in the
 *   region that required the form. The `canRequestAds` sitting beside it in
 *   that unanswered response is not recorded (issue #95).
 * - Consent never gates the game. Every failure resolves quietly and the app
 *   behaves exactly like a build with no ads at all.
 * - Offline sends nothing and schedules nothing. There is no retry loop: the
 *   flow is attempted at most `MAX_ATTEMPTS` times per launch, which is what
 *   lets a launch that started offline still show ads once the player is back
 *   online without turning that into a poll (docs/OFFLINE_POLICY.md).
 *
 * ATT (App Tracking Transparency) is deliberately absent — see
 * docs/PRIVACY_POLICY.md「iOS の ATT」. The app asks for no permission to
 * track, so `AdMob.requestTrackingAuthorization` is never called and
 * NSUserTrackingUsageDescription is not in Info.plist. Ads are contextual;
 * install attribution rides on SKAdNetwork, which reports in aggregate and
 * needs no permission.
 */
import { AdMob, AdmobConsentStatus, type AdmobConsentInfo } from '@capacitor-community/admob';
import { isOnline } from '../network';

/**
 * At most one attempt at boot and one more the first time a banner is wanted
 * (typically the first game screen). Two is what covers "launched offline,
 * played once online" without ever becoming a poll.
 */
const MAX_ATTEMPTS = 2;

/**
 * UMP's `PrivacyOptionsRequirementStatus.REQUIRED`. Compared as a plain
 * string because the plugin's consent barrel does not re-export that enum
 * (@capacitor-community/admob 8.0.0 — `AdmobConsentStatus` beside it is
 * exported), leaving it unreachable from the package root. The value on the
 * wire is this string either way.
 */
const PRIVACY_OPTIONS_REQUIRED = 'REQUIRED';

let attempts = 0;
let inFlight: Promise<boolean> | null = null;
let adsAllowed = false;
let privacyOptionsRequired = false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function record(info: AdmobConsentInfo): void {
  adsAllowed = info.canRequestAds;
  recordPrivacyOptions(info);
}

/**
 * The half of {@link record} that survives a form the player never answered:
 * whether a withdrawal entry point is required is a property of the region
 * they are in, not of an answer they gave.
 */
function recordPrivacyOptions(info: AdmobConsentInfo): void {
  privacyOptionsRequired =
    String(info.privacyOptionsRequirementStatus) === PRIVACY_OPTIONS_REQUIRED;
  notify();
}

/**
 * Resolves whether the ad SDK may request an ad right now. Callers must await
 * this before every first ad request; it is cheap after the first success.
 * Resolves false — never throws — when consent is unknown, unavailable, or
 * the device is offline.
 */
export async function canRequestAds(): Promise<boolean> {
  if (adsAllowed) return true;
  if (inFlight) return inFlight;
  if (attempts >= MAX_ATTEMPTS) return false;
  // Offline is not an attempt: nothing was asked, so nothing was spent. The
  // check also guarantees the UMP SDK makes no network call while offline.
  if (!isOnline()) return false;
  attempts += 1;
  inFlight = runConsentFlow().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runConsentFlow(): Promise<boolean> {
  try {
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
      try {
        // Showing the form updates the same fields, so its answer replaces the
        // pre-form one rather than being merged with it.
        info = await AdMob.showConsentForm();
      } catch {
        // The form could not be shown: it failed to load, there was no view
        // controller to present it from, or UMP itself errored. The pre-form
        // answer already carries `privacyOptionsRequirementStatus`, and
        // dropping it hides the Settings row (`adPrivacyOptions`) exactly
        // where a form was required — the EEA / UK, where withdrawing consent
        // has to stay reachable. So that one field is kept (issue #95).
        //
        // Only that one. The same response's `canRequestAds` is dropped even
        // when it is true, which UMP can report beside status = REQUIRED:
        // honouring it would serve ads for a form the player never saw. Of the
        // two readings — UMP's `canRequestAds` as the authority, and this
        // module's "never ads without an answer"
        // (docs/ADS_POLICY.md「同意(UMP)」) — the stricter one wins. It costs
        // one launch of banner revenue in a rare failure; the other costs
        // consent we could not show we were given. Ads are off for this launch
        // only: the next one asks again.
        recordPrivacyOptions(info);
        return false;
      }
    }
    record(info);
    return adsAllowed;
  } catch {
    // No UMP configuration, SDK error, or a connection that dropped between
    // the check above and the call: no consent, therefore no ads.
    return false;
  }
}

/** Whether UMP requires a way to reopen the privacy options form. */
export function isPrivacyOptionsRequired(): boolean {
  return privacyOptionsRequired;
}

/**
 * Reopens the privacy options form (Settings). Only ever reachable while
 * {@link isPrivacyOptionsRequired} is true. Resolves quietly on failure — a
 * form that cannot be shown must not become an error dialog of its own.
 */
export async function showPrivacyOptions(): Promise<void> {
  try {
    await AdMob.showPrivacyOptionsForm();
  } catch {
    return;
  }
  // The player may have just withdrawn consent, which can flip both answers.
  try {
    record(await AdMob.requestConsentInfo());
  } catch {
    // Keep the previous answer; the next launch asks again.
  }
}

/** Subscribe for React (useSyncExternalStore). Returns the unsubscriber. */
export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test hook. */
export function resetConsentForTesting(): void {
  attempts = 0;
  inFlight = null;
  adsAllowed = false;
  privacyOptionsRequired = false;
  listeners.clear();
}
