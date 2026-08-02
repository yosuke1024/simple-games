/**
 * The Brick Breaker game screen (docs/BRICK_BREAKER_RULES.md §2, §3, §6).
 *
 * The status row carries the level, the bricks left, and the lives — counts
 * the player glances at, never a clock (§6). Retry is instant and free (§8):
 * an attempt is seconds long, so there is nothing worth a confirmation
 * dialog.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { STARTING_LIVES } from '../../game/constants';
import { useBrickBreaker } from '../../state/GameContext';
import { BrickBoard, type BoardHud } from '../components/BrickBoard';
import { BrickResultOverlay } from '../components/BrickResultOverlay';

export function BrickGameScreen() {
  const { attempt, lastResult, reportRunEnd, bookPlaySeconds, retryLevel, startNextLevel, goHome } =
    useBrickBreaker();
  const { t } = useSettings();
  const [hud, setHud] = useState<BoardHud>({ lives: STARTING_LIVES, bricksLeft: 0 });

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
              {t('modeLevel', { n: attempt.level })}
              <span className="game-status-sub">{t('bbBricksLeft', { n: hud.bricksLeft })}</span>
            </span>
            <span className="game-lives" role="img" aria-label={t('livesLeft', { n: hud.lives })}>
              {Array.from({ length: STARTING_LIVES }, (_, i) => (
                <span
                  key={i}
                  className={`game-life-dot ${i < hud.lives ? '' : 'game-life-dot-spent'}`}
                />
              ))}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={retryLevel}
          >
            <IconRetry />
          </button>
        </header>

        <div className="game-board-body">
          <BrickBoard
            key={`${attempt.level}:${attempt.nonce}`}
            level={attempt.level}
            onRunEnd={reportRunEnd}
            onBookSeconds={bookPlaySeconds}
            onHudChange={setHud}
            ariaLabel={t('bbBoardLabel')}
          />
        </div>

        <BannerSlot />
      </div>

      <BrickResultOverlay
        result={lastResult}
        onNextLevel={startNextLevel}
        onRetry={retryLevel}
        onHome={goHome}
      />
    </div>
  );
}
