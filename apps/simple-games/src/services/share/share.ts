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
 * THE NATIVE APPS DO NOT HAVE THE WEB SHARE API — ANDROID PROVED IT
 *
 * This module used to assume `navigator.share` existed in both native
 * WebViews, and shipped without a Capacitor plugin on that basis. It was
 * wrong. Measured 2026-09-04 inside the app on Android 17 / WebView 148, on
 * the app's own secure `https://localhost` origin:
 *
 *     navigator.share = undefined      navigator.canShare = undefined
 *
 * Android's WebView does not implement Web Share at all, at any version. So
 * every Android share fell all the way down this ladder to the clipboard: no
 * sheet ever opened, and the player had to paste the text somewhere by hand.
 * iOS was fine, because WKWebView does implement it — which is exactly why
 * the gap went unseen until someone shared from a phone.
 *
 * So the native platforms now go through `@capacitor/share`, which is the
 * OS-level share sheet, and the picture travels as a file written to the
 * app's cache (`@capacitor/filesystem`) because that plugin takes file URLs
 * rather than in-memory blobs. Two plugins, no new permissions (both declare
 * an empty Android manifest), and nothing about the browser path changes.
 *
 * iOS goes through the plugin too, even though Web Share worked there: one
 * path is easier to keep honest than two, and the web rungs below are still
 * the fallback if the plugin ever fails. Nothing regresses — a native failure
 * falls through to exactly the ladder that ran before.
 *
 * IN THE BROWSER, THE WEB SHARE API IS STILL THE PATH
 *
 * The picture rides `navigator.share`'s `files`, and
 * `navigator.canShare({ files })` is asked first: where it says no, the
 * text-only rung runs exactly as it did before the card existed.
 *
 * NOTHING IS COUNTED
 *
 * Not how often this is pressed, not which game, not whether the sheet was
 * used or dismissed. There is no analytics in the app artifact
 * (docs/ARCHITECTURE.md), and a share counter would be the first
 * (docs/GROWTH_MEASUREMENT.md keeps growth measurement off the device).
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { ShareCard } from './card';
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

/**
 * A cancelled share sheet. Firefox reports it as AbortError too. Read the
 * name structurally rather than through `instanceof Error`: the sheet rejects
 * with a DOMException, and a WebView (or a cross-realm one) does not always
 * put Error on that prototype chain — and mistaking a "no" for a failure here
 * would open a second sheet right after the player closed the first.
 */
function isDismissal(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

/**
 * The plugin's cancellation. Both platforms reject with this exact sentence
 * (`SharePlugin.java`, `SharePlugin.swift`), and there is no code or class to
 * match on instead — so the string is the contract, and a wording change on
 * their side degrades to "fell through to the web path", never to a second
 * sheet in the player's face.
 */
function isPluginDismissal(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    /share canceled/i.test((error as { message: string }).message)
  );
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
 * The native rung: the OS share sheet through `@capacitor/share`.
 *
 * Returns a result when the sheet did its job, and `null` when this path did
 * not work out — the caller then runs the browser ladder below, which is what
 * every native build did before this plugin existed. A missing picture is not
 * a failure: the sheet still opens with the sentences and the link.
 *
 * The picture is written to the cache directory because the plugin shares
 * file URLs, not blobs. Cache is the right home for it: the OS may reclaim it
 * whenever it likes, nothing reads it back, and it needs no permission. The
 * name is stable per game, so repeated shares overwrite rather than pile up.
 */
async function shareViaPlugin(
  message: ShareMessage,
  card: ShareCard | null,
): Promise<ShareResult | null> {
  try {
    let files: string[] | undefined;
    if (card) {
      try {
        const written = await Filesystem.writeFile({
          path: card.name,
          data: card.base64,
          directory: Directory.Cache,
        });
        files = [written.uri];
      } catch {
        // Could not write the picture. Share the words rather than nothing.
      }
    }
    // THE LINK TRAVELS INSIDE THE TEXT, NEVER AS A SEPARATE `url`
    //
    // A share whose link does not arrive is not a share: the picture is the
    // invitation, the address is the whole of what it invites you to. Handed
    // over as its own field, the address is something the receiving app may
    // decline — and X does, on a post that carries a picture. Reported from
    // iOS on 2026-09-04: the three sentences arrived, the address did not.
    // The same message pasted as one block of text — the clipboard fallback
    // below, where the address sits on its own line — posted with the address
    // intact.
    //
    // So both platforms get one string, with the address on its own line, and
    // `url` is not passed at all (passing both would send the address twice:
    // Android's plugin appends it to the text as well, `SharePlugin.java`).
    // What this gives up is the receiver's chance to treat the address as a
    // real URL rather than as characters — worth losing, since a link that is
    // only text still opens, and a link that is dropped does not exist.
    await Share.share({
      text: shareMessageAsText(message),
      ...(files ? { files } : {}),
    });
    return 'shared';
  } catch (error) {
    // A cancelled sheet is an answer; opening a second one would argue with it.
    if (isPluginDismissal(error)) return 'dismissed';
    return null;
  }
}

/**
 * The text-only rung: the share sheet with `{ text, url }`, or the clipboard
 * ladder when there is no sheet or it fails for anything but a dismissal.
 * This is the whole of `shareGame` before the picture card existed, kept as
 * its own function because the picture rung above it falls back to exactly
 * this — a target that cannot or will not take a file gets what a browser
 * without file sharing gets, not a worse experience for having one.
 */
async function shareText(message: ShareMessage): Promise<ShareResult> {
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

/**
 * Opens the share sheet, or copies the link, or does nothing.
 *
 * Call it straight from the click handler: `navigator.share` needs the user
 * activation of the gesture that started it, and nothing is awaited before it
 * here so that activation is still in hand when the sheet is asked for. That
 * includes drawing `card`: it has to already exist by the time this runs
 * (card.ts is synchronous for the same reason).
 *
 * `card` is optional and defaults to none, so every caller from before the
 * picture card existed is still calling this the same way. On a device the
 * plugin above answers first; `card.file` is only ever read by the browser
 * rungs.
 */
export async function shareGame(
  message: ShareMessage,
  card: ShareCard | null = null,
): Promise<ShareResult> {
  // Synchronous, so the browser path below still reaches `navigator.share`
  // inside the click's user activation.
  if (Capacitor.isNativePlatform()) {
    const viaPlugin = await shareViaPlugin(message, card);
    if (viaPlugin) return viaPlugin;
  }

  const file = card?.file ?? null;
  const share = typeof navigator !== 'undefined' ? navigator.share : undefined;
  if (share && file) {
    const data: ShareData = { files: [file], text: message.text, url: message.url };
    if (navigator.canShare?.(data)) {
      try {
        await share.call(navigator, data);
        return 'shared';
      } catch (error) {
        if (isDismissal(error)) return 'dismissed';
        // A target that accepted the feature test but refused the file
        // anyway — falls through to the text-only rung below, same as a
        // platform that never claimed to take files in the first place.
      }
    }
  }
  return shareText(message);
}
