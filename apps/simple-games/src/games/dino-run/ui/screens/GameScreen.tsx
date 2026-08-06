/**
 * The Dino Run game screen (docs/DINO_RUN_RULES.md §2, §6).
 *
 * The status row carries the run's score and the personal best beside it —
 * the game's own measures, never a clock (product principle §6: no timer
 * pressure). The best score sits there rather than on the result screen alone
 * because it is the only thing a run is being measured against.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useDinoRun } from '../../state/GameContext';
import { DinoBoard, type BoardHud } from '../components/DinoBoard';
import { DinoResultOverlay } from '../components/DinoResultOverlay';

export function DinoGameScreen() {
  const { attempt, stats, lastResult, reportRunEnd, bookPlaySeconds, startRun, goHome } =
    useDinoRun();
  const { t } = useSettings();
  const [hud, setHud] = useState<BoardHud>({ score: 0, status: 'ready', milestones: 0 });

  if (!attempt) return null;
  const settled = lastResult !== null;
  const best = Math.max(stats.bestScore, hud.score);

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={settled}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            {best > 0 ? (
              <span className="dr-best">
                {t('dinoBestScore')} {best}
              </span>
            ) : null}
            {/* Keyed on the milestone so the flash replays on each hundred. */}
            <span
              key={hud.milestones}
              className={`dr-score ${hud.milestones > 0 ? 'dr-score-mark' : ''}`}
              aria-label={t('score')}
            >
              {hud.score}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('dinoRunAgain')}
            onClick={startRun}
          >
            <IconRetry />
          </button>
        </header>

        <div className="game-board-body dr-body">
          <DinoBoard
            key={`${attempt.seed}:${attempt.nonce}`}
            seed={attempt.seed}
            onRunEnd={reportRunEnd}
            onBookSeconds={bookPlaySeconds}
            onHudChange={setHud}
            ariaLabel={t('dinoBoardLabel')}
            jumpLabel={t('dinoJump')}
            duckLabel={t('dinoDuck')}
          />
          {hud.status === 'ready' ? <p className="dr-hint">{t('dinoTapToStart')}</p> : null}
        </div>

        <BannerSlot />
      </div>

      <DinoResultOverlay result={lastResult} onRunAgain={startRun} onHome={goHome} />
    </div>
  );
}
