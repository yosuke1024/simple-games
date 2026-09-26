/**
 * Home (docs/SHAPE_REGIONS_RULES.md §9): three boards and the daily, and
 * nothing between the player and either of them. There is no level list —
 * the game has no progression to walk through (§14).
 *
 * The difficulty slot holds one game, so picking a different difficulty
 * replaces it. That is the one thing here worth asking about first (§11).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconCalendar, IconChart, IconCheck } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, localDateString, PRESETS, type Difficulty } from '../../game';
import { useShapeRegions } from '../../state/GameContext';

export function ShapeRegionsHomeScreen() {
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
  } = useShapeRegions();
  const { t } = useSettings();
  const [pending, setPending] = useState<Difficulty | null>(null);

  const current = sessions.difficulty?.status === 'playing' ? sessions.difficulty : null;
  const dailyGame = sessions.daily?.status === 'playing' ? sessions.daily : null;
  const today = localDateString(new Date());
  const dailyIsToday = dailyGame?.dailyDate === today;
  // The board the home leads with: the one in progress, else the last chosen (§11).
  const leading: Difficulty = current?.difficulty ?? prefs.difficulty;

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
      <GameHomeHeader gameId="shape-regions" onBack={exitToCollection} />

      <div className="home-hero">
        {/* Matches the tile glyph in app/registry.ts: three quadrants, one shape. */}
        <div className="home-logo" aria-hidden="true">
          {'▙'}
        </div>
        <h1 className="home-title">{t('shapeRegionsName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="shape-regions" />
      </div>

      <div className="home-actions">
        <p className="sr-choose-label">{t('shapeRegionsChooseBoard')}</p>

        {DIFFICULTIES.map((difficulty: Difficulty) => {
          const preset = PRESETS[difficulty];
          const best = stats[difficulty].bestSeconds;
          const isCurrent = current?.difficulty === difficulty;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${difficulty === leading ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`shapeRegionsDifficulty_${difficulty}`)}
              <span className="btn-note">
                {isCurrent
                  ? t('resume')
                  : t('shapeRegionsBoardNote', { width: preset.width, height: preset.height })}
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

        <nav className="home-chips sr-chips">
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
        title={t('shapeRegionsConfirmSwitchTitle')}
        body={
          pending === null || current === null
            ? undefined
            : t('shapeRegionsConfirmSwitchBody', {
                current: t(`shapeRegionsDifficulty_${current.difficulty}`),
                next: t(`shapeRegionsDifficulty_${pending}`),
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
