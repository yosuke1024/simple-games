/**
 * Handing a game to somebody (issue #86): the OS share sheet where there is
 * one, the clipboard where there is not, a text selection where there is not
 * even that, and silence when none of the three works.
 *
 * EVERY ENDING IS A NORMAL ENDING
 *
 * Dismissing the share sheet, denying clipboard permission, a browser with
 * neither API, being offline — none of these is an error, and none of them
 * produces a dialog, a toast that says something went wrong, or a second ask.
 * The player pressed a secondary button on a result screen; the worst outcome
 * this function allows is that nothing visible happens. It never rejects, so
 * no caller has to guard a share with a try/catch to keep a game running
 * (docs/OFFLINE_POLICY.md: a service's failure never reaches the game).
 *
 * WEB SHARE API ON ALL THREE PLATFORMS
 *
 * No Capacitor share plugin. `navigator.share` is implemented by the Android
 * WebView and by WKWebView, and both open the real system sheet from it, so
 * the app and the browser take the same path and the native bundle gains no
 * dependency for this. The one thing that is genuinely uncertain is iOS: the
 * app runs on `capacitor://localhost`, and a custom scheme is not always a
 * secure context, which is where `navigator.share` and `navigator.clipboard`
 * both live. That uncertainty is why the ladder has a third rung rather than
 * two — and if a device is ever found where the sheet does not open, the
 * plugin can be added then, against evidence, rather than pre-emptively.
 *
 * NOTHING IS COUNTED
 *
 * Not how often this is pressed, not which game, not whether the sheet was
 * used or dismissed. There is no analytics in the app artifact
 * (docs/ARCHITECTURE.md), and a share counter would be the first
 * (docs/GROWTH_MEASUREMENT.md keeps growth measurement off the device).
 */
import { shareMessageAsText, type ShareMessage } from './message';

/**
 * What happened, for the one caller that shows a two-second "Link copied".
 *
 * `shared` and `dismissed` both mean the sheet did its job — the player either
 * sent it or changed their mind, and neither needs a word from us. Only
 * `copied` is worth saying out loud, because a clipboard write is the one
 * outcome with nothing on screen to show for it.
 */
export type ShareResult = 'shared' | 'dismissed' | 'copied' | 'unavailable';

/** A cancelled share sheet. Firefox reports it as AbortError too. */
function isDismissal(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * The copy of last resort, for a WebView where `navigator.clipboard` does not
 * exist: a selection plus the old `execCommand`, which needs neither a secure
 * context nor a permission.
 *
 * Deprecated, and kept anyway. The floor this app supports is a 2021 WebView
 * (docs/ARCHITECTURE.md), and on an origin the browser does not consider
 * trustworthy the modern clipboard is simply absent — without this, "copy the
 * link" would be a promise that quietly does nothing on exactly the devices
 * least likely to have a share sheet either.
 */
function copyByExecCommand(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const field = document.createElement('textarea');
  field.value = text;
  // Off-screen but focusable: `display: none` cannot be selected, and moving
  // the viewport under the player would be worse than not copying at all.
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.top = '-1000px';
  field.style.opacity = '0';
  document.body.appendChild(field);
  try {
    field.select();
    field.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

async function copyLink(message: ShareMessage): Promise<ShareResult> {
  const text = shareMessageAsText(message);
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    // No clipboard API, or an insecure context. Falling through to the old
    // path is not a way around a refusal: `execCommand('copy')` copies only
    // from the gesture the player just made, which is the same consent as
    // pressing Ctrl+C, and it is what a WebView without the modern API has.
  }
  // Copied, or not copied. Either way the game is untouched and nothing is said.
  return copyByExecCommand(text) ? 'copied' : 'unavailable';
}

/**
 * Opens the share sheet, or copies the link, or does nothing.
 *
 * Call it straight from the click handler: `navigator.share` needs the user
 * activation of the gesture that started it, and nothing is awaited before it
 * here so that activation is still in hand when the sheet is asked for.
 */
export async function shareGame(message: ShareMessage): Promise<ShareResult> {
  const data: ShareData = { text: message.text, url: message.url };
  const share = typeof navigator !== 'undefined' ? navigator.share : undefined;
  if (share && (navigator.canShare?.(data) ?? true)) {
    try {
      await share.call(navigator, data);
      return 'shared';
    } catch (error) {
      // A dismissal is an answer, and copying the link after it would be
      // acting on a decision the player already made.
      if (isDismissal(error)) return 'dismissed';
      // Anything else — a WebView that advertises the API without a sheet
      // behind it, a target that refused the payload — falls through to the
      // clipboard, which is what a browser without the API gets anyway.
    }
  }
  return copyLink(message);
}
