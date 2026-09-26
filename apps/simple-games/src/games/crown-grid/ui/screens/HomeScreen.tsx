/**
 * Home (docs/CROWN_GRID_RULES.md §9): three boards and the daily, and nothing
 * between the player and either of them. There is no level list — the three
 * tiers are the whole progression, and a hundred rungs would be padding (§14).
 *
 * The difficulty slot holds one game, so picking a different difficulty
 * replaces it. That is the one thing here worth asking about first (§11).
 * The difficulty last picked leads (§9), unless a game is already waiting.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconCalendar, IconChart, IconCheck } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, localDateString, SIZE_FOR, type Difficulty } from '../../game';
import { useCrownGrid } from '../../state/GameContext';
import { DIFFICULTY_KEY } from '../difficultyKey';

export function CrownGridHomeScreen() {
  const {
    navigate,
    sessions,
    stats,
    prefs,
    dailyDoneToday,
    startDifficulty,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useCrownGrid();
  const { t } = useSettings();
  const [pending, setPending] = useState<Difficulty | null>(null);

  const current = sessions.difficulty?.status === 'playing' ? sessions.difficulty : null;
  const dailyGame = sessions.daily?.status === 'playing' ? sessions.daily : null;
  const today = localDateString(new Date());
  const dailyIsToday = dailyGame?.dailyDate === today;
  /** The button that leads: the game in progress, else the pick remembered (§9). */
  const leading = current?.difficulty ?? prefs.difficulty;

  const choose = (difficulty: Difficulty) => {
    if (current && current.difficulty === difficulty) {
      resumeGame('difficulty');
      return;
    }
    // Replacing a game in progress is the one thing worth a question (§11).
    if (current) setPending(difficulty);
    else startDifficulty(difficulty);
  };

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="crown-grid" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The series mark: a tile holding the game's whole shape — one crown. */}
        <div className="home-logo" aria-hidden="true">
          ♛
        </div>
        <h1 className="home-title">{t('crownGridName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="crown-grid" />
      </div>

      <div className="home-actions">
        <p className="cg-choose-label">{t('crownGridChooseBoard')}</p>

        {DIFFICULTIES.map((difficulty: Difficulty) => {
          const best = stats[difficulty].bestSeconds;
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
                {isCurrent ? t('resume') : t('crownGridBoardNote', { size: SIZE_FOR[difficulty] })}
                {/* The time to beat, stated once and quietly — never a target. */}
                {!isCurrent && best !== null ? ` · ${formatDuration(best)}` : ''}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          className="btn btn-secondary btn-big"
          onClick={() => (dailyGame ? resumeGame('daily') : startDaily())}
        >
          {t('dailyChallenge')}
          {dailyGame ? (
            <span className="btn-note">
              {t('resume')}
              {dailyIsToday ? '' : ` · ${dailyGame.dailyDate}`}
            </span>
          ) : dailyDoneToday ? (
            <span className="btn-note">
              <IconCheck className="badge-icon" /> {t('dailyDoneBadge')}
            </span>
          ) : null}
        </button>

        <nav className="home-chips cg-chips">
          <button type="button" className="home-chip" onClick={() => navigate('daily')}>
            <IconCalendar className="home-chip-icon" />
            <span>{t('dailyPast')}</span>
          </button>
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
        title={t('crownGridConfirmSwitchTitle')}
        body={
          pending === null || current === null
            ? undefined
            : t('crownGridConfirmSwitchBody', {
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
          if (next) startDifficulty(next);
        }}
      />
    </div>
  );
}
