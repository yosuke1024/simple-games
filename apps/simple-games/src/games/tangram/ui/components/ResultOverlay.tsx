/**
 * Tangram's result overlay (scaffolded by scripts/new-game.mjs): the one
 * place `ShareAction` belongs (docs/ARCHITECTURE.md「結果画面の共有」,
 * issue #86). Replace the placeholder copy with the game's real outcome.
 */
import { useSettings } from '@/state/SettingsContext';
import { ShareAction } from '@/ui/components/ShareAction';
import type { LastResult } from '../../state/GameContext';

export interface TangramResultOverlayProps {
  result: LastResult | null;
  onDismiss: () => void;
}

export function TangramResultOverlay({ result, onDismiss }: TangramResultOverlayProps) {
  const { t } = useSettings();
  if (result === null) return null;

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('tangramResultTitle')}
      >
        <h2 className="dialog-title">{t('tangramResultTitle')}</h2>
        <p className="dialog-body">{t('tangramResultBody')}</p>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onDismiss} autoFocus>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="tangram" outcome="played" details={[]} />
      </div>
    </div>
  );
}
