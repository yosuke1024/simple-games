/**
 * The Snake game screen (docs/SNAKE_RULES.md §2, §3, §12).
 *
 * The status row carries the score and the current length — the two numbers
 * the run is measured by, and never a clock (§12). Retry is instant and free
 * (§8): a run is seconds long, so there is nothing worth a confirmation
 * dialog (§13).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { STARTING_LENGTH } from '../../game/constants';
import { useSnake } from '../../state/GameContext';
import { SnakeBoard, type BoardHud } from '../components/SnakeBoard';
import { SnakeResultOverlay } from '../components/SnakeResultOverlay';

export function SnakeGameScreen() {
  const { attempt, lastResult, reportRunEnd, bookPlaySeconds, retry, goHome } = useSnake();
  const { t } = useSettings();
  const [hud, setHud] = useState<BoardHud>({ score: 0, length: STARTING_LENGTH });

  if (!attempt) return null;
  const settled = lastResult !== null;

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={settled}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="game-status-level">
              <span className="sn-score" aria-label={t('score')}>
                {hud.score}
              </span>
              <span className="game-status-sub">
                {t('snakeLength')} {hud.length}
              </span>
            </span>
          </div>
          {/* "New Game", not "Retry same board": every run is a fresh board,
              and the shared retry label would promise the one just lost. */}
          <button type="button" className="icon-btn" aria-label={t('newGame')} onClick={retry}>
            <IconRetry />
          </button>
        </header>

        <div className="game-board-body">
          <SnakeBoard
            key={attempt.nonce}
            onRunEnd={reportRunEnd}
            onBookSeconds={bookPlaySeconds}
            onHudChange={setHud}
            ariaLabel={t('snakeBoardLabel', { n: hud.length })}
          />
        </div>

        <BannerSlot />
      </div>

      <SnakeResultOverlay result={lastResult} onNewGame={retry} onHome={goHome} />
    </div>
  );
}
