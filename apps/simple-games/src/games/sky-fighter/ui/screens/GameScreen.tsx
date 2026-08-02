/**
 * The Sky Fighter game screen (docs/SKY_FIGHTER_RULES.md §2, §3).
 *
 * The status row carries the score, the wave, and the lives — the game's own
 * measures, never a clock (§6 of the product principles: no timer pressure).
 * Retry is instant and free (§8).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { STARTING_LIVES } from '../../game/constants';
import { wavesInLevel } from '../../game/levels';
import { useSkyFighter } from '../../state/GameContext';
import { SkyBoard, type BoardHud } from '../components/SkyBoard';
import { SkyResultOverlay } from '../components/SkyResultOverlay';

export function SkyGameScreen() {
  const { attempt, lastResult, reportRunEnd, bookPlaySeconds, retryLevel, startNextLevel, goHome } =
    useSkyFighter();
  const { t } = useSettings();
  const [hud, setHud] = useState<BoardHud>({
    score: 0,
    wave: 1,
    waves: 4,
    lives: STARTING_LIVES,
    power: 1,
  });

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
              <span className="game-status-sub">
                {t('sfWave', { n: hud.wave, m: wavesInLevel(attempt.level) })}
              </span>
            </span>
            <span className="sf-score" aria-label={t('score')}>
              {hud.score}
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
          <SkyBoard
            key={`${attempt.level}:${attempt.nonce}`}
            level={attempt.level}
            onRunEnd={reportRunEnd}
            onBookSeconds={bookPlaySeconds}
            onHudChange={setHud}
            ariaLabel={t('sfBoardLabel')}
          />
        </div>

        <BannerSlot />
      </div>

      <SkyResultOverlay
        result={lastResult}
        onNextLevel={startNextLevel}
        onRetry={retryLevel}
        onHome={goHome}
      />
    </div>
  );
}
