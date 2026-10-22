/**
 * Home (docs/PIPE_LINK_RULES.md §8): three boards and the daily, and nothing
 * between the player and either of them. There is no level list, no streak
 * and no past daily (§12).
 *
 * The difficulty slot holds one game, so picking a different difficulty
 * replaces it. That is the one thing here worth asking about first (§7).
 * The early-release notice under the tagline is the shell's
 * (docs/WEB_VERSION.md「先行公開(ベータ)」): it says, before anything is
 * saved, that this game's saves may be reset while it is in early release.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart, IconCheck } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, localDateString, PRESETS, type Difficulty } from '../../game';
import { usePipeLink } from '../../state/GameContext';
import { DIFFICULTY_KEYS } from '../labels';

export function PipeLinkHomeScreen() {
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
  } = usePipeLink();
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
  // The board the home leads with: the one in progress, else the last chosen (§8).
  const leading: Difficulty = current?.difficulty ?? prefs.difficulty;

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
      <GameHomeHeader gameId="pipe-link" onBack={exitToCollection} />

      <div className="home-hero">
        {/* Matches the tile glyph in app/registry.ts: a T-joint. */}
        <div className="home-logo" aria-hidden="true">
          {'┣'}
        </div>
        <h1 className="home-title">{t('pipeLinkName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="pipe-link" />
      </div>

      <div className="home-actions">
        <p className="pn-choose-label">{t('pipeLinkChooseBoard')}</p>

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
              {t(DIFFICULTY_KEYS[difficulty])}
              <span className="btn-note">
                {isCurrent
                  ? t('resume')
                  : t('pipeLinkBoardNote', { width: preset.width, height: preset.height })}
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

        <nav className="home-chips pn-chips">
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
        title={t('pipeLinkConfirmSwitchTitle')}
        body={
          pending === null || current === null
            ? undefined
            : t('pipeLinkConfirmSwitchBody', {
                current: t(DIFFICULTY_KEYS[current.difficulty]),
                next: t(DIFFICULTY_KEYS[pending]),
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
