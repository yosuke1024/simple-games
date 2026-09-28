/**
 * The one question the Meta install measurement ever asks (issue #204,
 * docs/META_ANDROID_ACQUISITION.md): may the app tell Meta, once, that it was
 * installed? Shown by the shell on the way back from a game, at most once per
 * install, in English or Japanese only (services/acquisition/metaInstall.ts).
 *
 * The two answers carry the same weight on screen — the same button style,
 * side by side in one column — and the keyboard's default is the "no". This
 * is a request, not a funnel: nothing in the app changes with either answer,
 * and nothing is offered for a yes.
 *
 * The showing was booked as a "no" before this mounted, so every way of
 * closing it — a tap outside, Android's hardware back (which reaches it
 * through the collection's listener, like the review question, issue #173) —
 * leaves Meta off and the question gone. Only "Allow" changes anything.
 */
import { PRIVACY_URL } from '@simple-games/brand';
import { setMetaInstallAllowed } from '../../services/acquisition/metaInstall';
import { useSettings } from '../../state/SettingsContext';
import { openExternal } from '../openExternal';
import { metaInstallCopy } from './metaInstallCopy';

export interface MetaInstallPromptProps {
  onClose: () => void;
}

export function MetaInstallPrompt({ onClose }: MetaInstallPromptProps) {
  const { locale } = useSettings();
  const copy = metaInstallCopy(locale);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={copy.askTitle}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="dialog-title">{copy.askTitle}</h2>
        <p className="dialog-body">{copy.askBody}</p>
        <p className="dialog-body">{copy.askNever}</p>
        <p className="dialog-body">{copy.askSettings}</p>
        <div className="dialog-actions dialog-actions-column">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              void setMetaInstallAllowed(true);
              onClose();
            }}
          >
            {copy.allow}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              void setMetaInstallAllowed(false);
              onClose();
            }}
            autoFocus
          >
            {copy.deny}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => openExternal(PRIVACY_URL)}>
            {copy.privacyPolicy}
          </button>
        </div>
      </div>
    </div>
  );
}
