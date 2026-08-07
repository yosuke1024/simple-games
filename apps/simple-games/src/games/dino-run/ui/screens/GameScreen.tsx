/**
 * The Dino Run game screen (docs/DINO_RUN_RULES.md §2, §6).
 *
 * The run's score and the personal best are drawn on the track itself, in the
 * board's own digits — so this screen carries only the two things the board
 * cannot: the way back, and the free retry (§8). The score is still here as a
 * labelled value for screen readers, which cannot read a canvas.
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

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={settled}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="dr-sr-only" aria-label={t('score')}>
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
            best={stats.bestScore}
            onRunEnd={reportRunEnd}
            onBookSeconds={bookPlaySeconds}
            onHudChange={setHud}
            ariaLabel={t('dinoBoardLabel')}
            jumpLabel={t('dinoJump')}
          />
          {hud.status === 'ready' ? <p className="dr-hint">{t('dinoTapToStart')}</p> : null}
        </div>

        <BannerSlot />
      </div>

      <DinoResultOverlay result={lastResult} onRunAgain={startRun} onHome={goHome} />
    </div>
  );
}
