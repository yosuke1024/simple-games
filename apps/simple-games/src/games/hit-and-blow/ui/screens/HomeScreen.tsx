/**
 * Home (docs/HIT_AND_BLOW_RULES.md §1, §8): three difficulties and nothing
 * between the player and a hidden row. There is no level list — every game
 * deals a new secret, and the three sizes are the whole progression.
 *
 * The slot holds one game, so picking a different difficulty replaces it.
 * That is the one thing here worth asking about first. The difficulty last
 * picked leads (§1), unless a game is already waiting.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { DIFFICULTIES, POOL_FOR, SLOTS_FOR, type Difficulty } from '../../game';
import { useHitAndBlow } from '../../state/GameContext';
import { DIFFICULTY_KEY } from '../difficultyKey';

export function HitAndBlowHomeScreen() {
  const {
    navigate,
    session,
    stats,
    lastDifficulty,
    canResume,
    startNewGame,
    resumeGame,
    exitToCollection,
  } = useHitAndBlow();
  const { t } = useSettings();
  const [pending, setPending] = useState<Difficulty | null>(null);

  const current = canResume && session ? session : null;
  /** The button that leads: the game in progress, else the pick remembered (§1). */
  const leading = current?.difficulty ?? lastDifficulty;

  const choose = (difficulty: Difficulty) => {
    if (current && current.difficulty === difficulty) {
      resumeGame();
      return;
    }
    // Replacing a game in progress is the one thing worth a question.
    if (current) setPending(difficulty);
    else startNewGame(difficulty);
  };

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="hit-and-blow" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): arriving here should look like the tile that
            was tapped, not like a second mark for the same game. */}
        <div className="home-logo" aria-hidden="true">
          ◉
        </div>
        <h1 className="home-title">{t('hitAndBlowName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="hit-and-blow" />
      </div>

      <div className="home-actions">
        <p className="hb-choose-label">{t('hitAndBlowChooseDifficulty')}</p>

        {DIFFICULTIES.map((difficulty) => {
          const best = stats[difficulty].bestGuesses;
          const isCurrent = current?.difficulty === difficulty;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${difficulty === leading ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(DIFFICULTY_KEY[difficulty])}
              <span className="btn-note">
                {isCurrent
                  ? t('resume')
                  : t('hitAndBlowCodeNote', {
                      slots: SLOTS_FOR[difficulty],
                      pool: POOL_FOR[difficulty],
                    })}
                {/* The count to beat, stated once and quietly — never a target. */}
                {!isCurrent && best !== null
                  ? ` · ${t('hitAndBlowBestNote', { count: best })}`
                  : ''}
              </span>
            </button>
          );
        })}

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
        open={pending !== null}
        title={t('hitAndBlowConfirmSwitchTitle')}
        body={
          pending === null || current === null
            ? undefined
            : t('hitAndBlowConfirmSwitchBody', {
                current: t(DIFFICULTY_KEY[current.difficulty]),
                next: t(DIFFICULTY_KEY[pending]),
              })
        }
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const next = pending;
          setPending(null);
          if (next) startNewGame(next);
        }}
      />
    </div>
  );
}
