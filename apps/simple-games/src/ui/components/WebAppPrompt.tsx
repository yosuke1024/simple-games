/**
 * The browser version's one-time app card (docs/WEB_VERSION.md「アプリへの送客」),
 * placed inline on the collection home between the shortcuts and the full
 * list. Deliberately a card and not a dialog: nothing is covered, nothing is
 * interrupted, and scrolling past it is a valid answer.
 *
 * Whether it appears at all is `services/webAppPrompt.ts`'s decision and the
 * shell's to pass down; by the time this renders, the one showing has already
 * been booked. So both buttons here do the same thing to the state — nothing —
 * and simply take the card off the screen.
 *
 * The store buttons carry the stores' own names rather than a translated
 * label. They are proper nouns, identical in all fourteen languages, which is
 * the same reason the game titles in the registry are not translated either.
 */
import { useState } from 'react';
import { STORE_URLS, storeTargets } from '../../services/webAppPrompt';
import { useSettings } from '../../state/SettingsContext';
import { openExternal } from '../openExternal';

/** The store's own name — never translated, never localised per storefront. */
const STORE_NAMES = { android: 'Google Play', ios: 'App Store' } as const;

export interface WebAppPromptProps {
  onClose: () => void;
}

export function WebAppPrompt({ onClose }: WebAppPromptProps) {
  const { t } = useSettings();
  // Read once per mount: which links to offer cannot change while the card is
  // on screen, and re-reading the user agent per render would be work for an
  // answer that is already known.
  const [targets] = useState(storeTargets);

  return (
    <section className="app-prompt" aria-labelledby="app-prompt-title">
      <h2 className="app-prompt-title" id="app-prompt-title">
        {t('webAppPromptTitle')}
      </h2>
      <p className="app-prompt-body">{t('webAppPromptBody')}</p>
      <div className="app-prompt-actions">
        {targets.map((target) => (
          <button
            key={target}
            type="button"
            className="btn btn-secondary app-prompt-store"
            onClick={() => {
              // Fails quietly offline, like every other external link
              // (ui/openExternal.ts, docs/OFFLINE_POLICY.md).
              openExternal(STORE_URLS[target]);
              onClose();
            }}
          >
            {STORE_NAMES[target]}
          </button>
        ))}
        <button type="button" className="btn btn-ghost app-prompt-close" onClick={onClose}>
          {t('close')}
        </button>
      </div>
    </section>
  );
}
