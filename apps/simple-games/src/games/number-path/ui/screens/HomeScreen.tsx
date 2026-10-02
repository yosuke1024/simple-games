/**
 * Home (docs/NUMBER_PATH_RULES.md §7): three boards and the daily, and
 * nothing between the player and either of them. There is no level list —
 * Number Path has no progression to walk through.
 *
 * The difficulty slot holds one game, so picking a different difficulty
 * replaces it. That is the one thing here worth asking about first (§7).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart, IconCheck } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, localDateString, TIERS, type Difficulty } from '../../game';
import { useNumberPath } from '../../state/GameContext';

export function NumberPathHomeScreen() {
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
  } = useNumberPath();
  const { t } = useSettings();
  const [pending, setPending] = useState<Difficulty | null>(null);

  const current = sessions.difficulty?.status === 'playing' ? sessions.difficulty : null;
  const today = localDateString(new Date());
  // Today's board or nothing: a daily left from another day is not the one
  // this button names (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」).
  const dailyGame =
    sessions.daily?.status === 'playing' && sessions.daily.dailyDate === today
      ? sessions.daily
      : null;

  const choose = (difficulty: Difficulty) => {
    if (current && current.difficulty === difficulty) {
      resumeGame('difficulty');
      return;
    }
    // Replacing a game in progress is the one thing worth a question (§7).
    if (current) setPending(difficulty);
    else startDifficulty(difficulty);
  };

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="number-path" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The series mark: the tile glyph of app/registry.ts — one bending road. */}
        <div className="home-logo" aria-hidden="true">
          ↝
        </div>
        <h1 className="home-title">{t('numberPathName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="number-path" />
      </div>

      <div className="home-actions">
        <p className="np-choose-label">{t('numberPathChooseBoard')}</p>

        {DIFFICULTIES.map((difficulty: Difficulty) => {
          const tier = TIERS[difficulty];
          const best = stats[difficulty].bestSeconds;
          const isCurrent = current?.difficulty === difficulty;
          // The board in progress leads; with none, the difficulty last chosen (§7).
          const leads = current ? isCurrent : prefs.difficulty === difficulty;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${leads ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`numberPathDifficulty_${difficulty}`)}
              <span className="btn-note">
                {isCurrent
                  ? t('resume')
                  : t('numberPathBoardNote', { width: tier.width, height: tier.height })}
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
            <span className="btn-note">{t('resume')}</span>
          ) : dailyDoneToday ? (
            <span className="btn-note">
              <IconCheck className="badge-icon" /> {t('dailyDoneBadge')}
            </span>
          ) : null}
        </button>

        <nav className="home-chips np-chips">
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
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
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
