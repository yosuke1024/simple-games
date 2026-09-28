/**
 * The bridge to the native side of the Meta install measurement (issue #204,
 * docs/META_ANDROID_ACQUISITION.md): android/app/src/metaOn (the real one,
 * compiled only into a release that asked for Meta) or android/app/src/metaOff
 * (the stub every other build has). Both are registered in MainActivity under
 * the same name.
 *
 * Three calls and no more. There is deliberately no `logEvent` here, nor any
 * way to hand the native side a name or a value to send: what goes to Meta is
 * decided in Java, once, and nothing in the games or the shell can add to it.
 *
 * There is no iOS implementation and never will be — the measurement is
 * Android-only — and the web one below answers "unavailable", so neither the
 * browser nor a test has to catch a "not implemented" rejection. Callers gate
 * on the platform first anyway (metaInstall.ts).
 */
import { registerPlugin } from '@capacitor/core';

/**
 * The player's answer, as the native side keeps it — outside the WebView's
 * storage, in a file Android never backs up, so it is neither in the
 * Backup & Restore file nor carried to another phone by Android's own backup.
 * `unset` means never asked; a file that cannot be read comes back as
 * `declined`, never as `unset` (fail closed, and do not ask again).
 */
export type MetaConsent = 'unset' | 'granted' | 'declined';

export interface MetaInstallState {
  /** A release built with Meta and a well-formed configuration. Everything else is false. */
  available: boolean;
  consent?: MetaConsent;
  /** Meta has acknowledged this install's one report; nothing more will ever be sent. */
  reported?: boolean;
  /**
   * Not reported, and never going to be tried again: the attempts ran out
   * without Meta accepting the report, or Meta's app settings would switch on
   * automatic logging (runbook §4). The answer can still be changed.
   */
  stopped?: boolean;
  /**
   * An attempt was made on this install. Meta's answer is read at the next
   * launch, so until then a report may already have been received even though
   * `reported` is false.
   */
  attempted?: boolean;
  /** When this app was first installed on this device (ms since epoch; Android's firstInstallTime). */
  installedAt?: number;
}

export interface MetaInstallPlugin {
  getState(): Promise<MetaInstallState>;
  /** Records the player's answer and returns the state after it. */
  setConsent(options: { granted: boolean }): Promise<MetaInstallState>;
  /**
   * Starts the one install report, if the native side agrees it is due:
   * consent granted, not yet reported, not already tried this launch, a
   * network present. `started` says whether it was handed over, not whether
   * Meta received it — that is learned at the next launch.
   */
  reportInstall(): Promise<{ started: boolean }>;
}

let native: MetaInstallPlugin | undefined;

/**
 * Registered on first use rather than at import: this module is reachable
 * from the Settings screen and the shell, and importing it must cost nothing
 * — no bridge lookup — in the builds and tests where it is never called.
 */
function plugin(): MetaInstallPlugin {
  native ??= registerPlugin<MetaInstallPlugin>('MetaInstall', {
    web: {
      getState: () => Promise.resolve({ available: false }),
      setConsent: () => Promise.resolve({ available: false }),
      reportInstall: () => Promise.resolve({ started: false }),
    },
  });
  return native;
}

export const MetaInstall: MetaInstallPlugin = {
  getState: () => plugin().getState(),
  setConsent: (options) => plugin().setConsent(options),
  reportInstall: () => plugin().reportInstall(),
};
