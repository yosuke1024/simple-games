/**
 * Chess's game screen (scaffolded by scripts/new-game.mjs): the shell's
 * frame — the way home, the one banner, the result overlay — around a board
 * that does not exist yet. Two rules the frame already keeps, and a new
 * board must keep with it:
 *
 * - While anything modal is up, `.game-content` is `inert`
 *   (docs/ARCHITECTURE.md「モーダルの間、盤面は inert」): the result overlay
 *   is the one flag today; a ConfirmDialog's `open` flag joins the same
 *   expression, and the dialog renders after `.game-content`, never inside
 *   it. `useGameKeys`, when added, takes an explicit `enabled` argument
 *   that goes false on the same flags (src/test/modalIsolationWiring.test.ts).
 * - A board element that hears `onPointerUp` also hears `onPointerCancel`
 *   (src/test/pointerContractWiring.test.ts, issue #169).
 */
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack } from '@/ui/components/icons';
import { useChess } from '../../state/GameContext';
import { ChessResultOverlay } from '../components/ResultOverlay';

export function ChessGameScreen() {
  const { round, lastResult, finishPlaceholderRound, goHome } = useChess();
  const { t } = useSettings();

  if (!round) return null;

  const finished = round.status === 'finished';

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={finished}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t('chessName')}</span>
          {/* Keeps the title centred until a retry or hint button takes this slot. */}
          <span aria-hidden="true" />
        </header>

        {/* Scaffold placeholder — the board goes here. */}
        <div className="chess-board">
          <button type="button" className="btn btn-secondary" onClick={finishPlaceholderRound}>
            {t('chessFinishPlaceholder')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <ChessResultOverlay result={lastResult} onDismiss={goHome} />
    </div>
  );
}
