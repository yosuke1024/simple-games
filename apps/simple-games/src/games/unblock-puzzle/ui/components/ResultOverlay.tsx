/**
 * UnblockPuzzle's result overlay (scaffolded by scripts/new-game.mjs): the one
 * place `ShareAction` belongs (docs/ARCHITECTURE.md「結果画面の共有」,
 * issue #86). Replace the placeholder copy with the game's real outcome.
 */
import { useSettings } from '@/state/SettingsContext';
import { ShareAction } from '@/ui/components/ShareAction';
import type { LastResult } from '../../state/GameContext';

export interface UnblockPuzzleResultOverlayProps {
  result: LastResult | null;
  onDismiss: () => void;
}

export function UnblockPuzzleResultOverlay({ result, onDismiss }: UnblockPuzzleResultOverlayProps) {
  const { t } = useSettings();
  if (result === null) return null;

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('unblockPuzzleResultTitle')}
      >
        <h2 className="dialog-title">{t('unblockPuzzleResultTitle')}</h2>
        <p className="dialog-body">{t('unblockPuzzleResultBody')}</p>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onDismiss} autoFocus>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="unblock-puzzle" outcome="played" details={[]} />
      </div>
    </div>
  );
}
