/**
 * What a missed round ends with (docs/NUMBER_RECALL_RULES.md §4, §8).
 *
 * **This is not an overlay, and that is the whole point.** The first version
 * used the same centred modal the win does, and playing it showed the flaw at
 * once: the dialog sat on top of the board and covered the ringed tile — the
 * one thing §4 exists to show. A panel that hides the answer it is announcing
 * is worse than no panel.
 *
 * So the panel sits in the page flow under the board, which pushes the board
 * up rather than covering it, and carries no scrim. Nothing is on a timer
 * either: the reveal waits for the player, because a reveal that expired would
 * be the app deciding how long they get to look — the exact thing §3 refuses.
 */
import { useSettings } from '@/state/SettingsContext';

export interface RecallRevealPanelProps {
  onRetry: () => void;
  onHome: () => void;
}

export function RecallRevealPanel({ onRetry, onHome }: RecallRevealPanelProps) {
  const { t } = useSettings();

  return (
    <div className="recall-reveal" role="status">
      <p className="recall-reveal-title">{t('recallMissTitle')}</p>
      <p className="recall-reveal-body">{t('recallMissBody')}</p>
      <div className="recall-reveal-actions">
        <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
          {t('recallNewLayout')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onHome}>
          {t('backHome')}
        </button>
      </div>
    </div>
  );
}
