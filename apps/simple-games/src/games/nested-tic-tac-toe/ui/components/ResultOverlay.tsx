/**
 * NestedTicTacToe's result overlay (scaffolded by scripts/new-game.mjs): the one
 * place `ShareAction` belongs (docs/ARCHITECTURE.md「結果画面の共有」,
 * issue #86). Replace the placeholder copy with the game's real outcome.
 */
import { useSettings } from '@/state/SettingsContext';
import { ShareAction } from '@/ui/components/ShareAction';
import type { LastResult } from '../../state/GameContext';

export interface NestedTicTacToeResultOverlayProps {
  result: LastResult | null;
  onDismiss: () => void;
}

export function NestedTicTacToeResultOverlay({
  result,
  onDismiss,
}: NestedTicTacToeResultOverlayProps) {
  const { t } = useSettings();
  if (result === null) return null;

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('nestedTicTacToeResultTitle')}
      >
        <h2 className="dialog-title">{t('nestedTicTacToeResultTitle')}</h2>
        <p className="dialog-body">{t('nestedTicTacToeResultBody')}</p>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onDismiss} autoFocus>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="nested-tic-tac-toe" outcome="played" details={[]} />
      </div>
    </div>
  );
}
