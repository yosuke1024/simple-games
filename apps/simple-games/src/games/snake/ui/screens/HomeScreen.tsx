/**
 * Snake's home (docs/SNAKE_RULES.md §6, §7): the shared header, the hero, the
 * early-release notice, and one way into a run.
 *
 * Endless only — no levels, no daily. A suspended run is offered back first
 * ("Resume", with its score and speed); replacing it with a new run is the
 * one thing here worth asking about, and the question is the same one 2048
 * asks. With nothing suspended, New Game opens a fresh board at once.
 *
 * The speed is a choice that can be left alone: Normal until somebody picks,
 * remembered once picked (`sn.prefs`), and it only reaches new runs — a
 * suspended run keeps the speed it began with (§7). Nothing has to be chosen
 * before playing.
 *
 * The early-release notice under the tagline is the shell's
 * (docs/WEB_VERSION.md「先行公開(ベータ)」): it says, before anything is saved,
 * that this game's saves may be reset while it is in early release.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { IconChart } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { SPEEDS } from '../../game';
import { useSnake } from '../../state/GameContext';

export function SnakeHomeScreen() {
  const {
    session,
    stats,
    speed,
    canResume,
    setSpeed,
    navigate,
    startNewRun,
    resumeRun,
    exitToCollection,
  } = useSnake();
  const { t } = useSettings();
  const [confirmNew, setConfirmNew] = useState(false);
  const best = stats[speed].bestScore;

  return (
    <div className="screen home-screen illustrated-game-home">
      <GameHomeHeader gameId="snake" onBack={exitToCollection} />

      <div className="home-hero">
        <span className="game-home-artwork" aria-hidden="true">
          <GameArtwork id="snake" />
        </span>
        <h1 className="home-title">{t('snakeName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="snake" />
      </div>

      <div className="home-actions">
        {canResume && session ? (
          <>
            <button type="button" className="btn btn-primary btn-big" onClick={resumeRun}>
              {t('resume')}
              <span className="btn-note">
                {t('snakeResumeNote', {
                  score: session.score,
                  speed: t(`snakeSpeed_${session.speed}`),
                })}
              </span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-big"
              onClick={() => setConfirmNew(true)}
            >
              {t('newGame')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-big" onClick={startNewRun}>
            {t('newGame')}
            {/* The record at this speed, stated once and quietly — never a target. */}
            {best > 0 ? (
              <span className="btn-note">{t('snakeBestNote', { score: best })}</span>
            ) : null}
          </button>
        )}

        <div className="sn-speed">
          <span className="sn-speed-label" id="sn-speed-label">
            {t('snakeSpeed')}
          </span>
          <div className="segmented sn-speed-toggle" role="group" aria-labelledby="sn-speed-label">
            {SPEEDS.map((option) => (
              <button
                key={option}
                type="button"
                className={`segment ${option === speed ? 'segment-active' : ''}`}
                aria-pressed={option === speed}
                onClick={() => setSpeed(option)}
              >
                {t(`snakeSpeed_${option}`)}
              </button>
            ))}
          </div>
        </div>

        <nav className="home-chips">
          <button type="button" className="home-chip" onClick={() => navigate('stats')}>
            <IconChart className="home-chip-icon" />
            <span>{t('statistics')}</span>
          </button>
        </nav>

        <div className="home-links">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('tutorial')}>
            {t('howToPlay')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmNew}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => {
          setConfirmNew(false);
          startNewRun();
        }}
      />
    </div>
  );
}
