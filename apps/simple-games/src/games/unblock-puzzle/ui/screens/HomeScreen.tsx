/**
 * Home (docs/UNBLOCK_PUZZLE_RULES.md §9): three difficulties and today's
 * daily, and nothing between the player and either of them. There is no
 * level list — the game has no progression to walk through (§16). Each
 * difficulty says what it deals in moves, the one number that tells them
 * apart (§7).
 *
 * The Free Play slot holds one board, so picking a different difficulty
 * while one is in progress replaces it. That is the one thing here worth
 * asking about first (§11).
 *
 * The header is the shell's (`GameHomeHeader`), and so is the early-release
 * notice under the tagline (docs/WEB_VERSION.md「先行公開(ベータ)」): it says,
 * before anything is saved, that this game's saves may be reset while it is
 * in early release.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart, IconCheck } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { DIFFICULTIES, TIERS, localDateString, type Difficulty } from '../../game';
import { useUnblockPuzzle } from '../../state/GameContext';

export function UnblockPuzzleHomeScreen() {
  const {
    navigate,
    sessions,
    prefs,
    dailyDoneToday,
    startFree,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useUnblockPuzzle();
  const { t } = useSettings();
  const [pending, setPending] = useState<Difficulty | null>(null);

  const current = sessions.free?.status === 'playing' ? sessions.free : null;
  const today = localDateString(new Date());
  // Today's board or nothing: a daily left from another day is not the one
  // this button names (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」).
  const dailyGame =
    sessions.daily?.status === 'playing' && sessions.daily.dailyDate === today
      ? sessions.daily
      : null;
  // The board the home leads with: the one in progress, else the last chosen.
  const leading: Difficulty = current?.difficulty ?? prefs.difficulty;

  const choose = (difficulty: Difficulty) => {
    if (current && current.difficulty === difficulty) {
      resumeGame('free');
      return;
    }
    // Replacing a board in progress is the one thing worth a question (§11).
    if (current) setPending(difficulty);
    else startFree(difficulty);
  };

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="unblock-puzzle" onBack={exitToCollection} />

      <div className="home-hero">
        {/* Matches the tile glyph in app/registry.ts. */}
        <div className="home-logo" aria-hidden="true">
          {'⇥'}
        </div>
        <h1 className="home-title">{t('unblockPuzzleName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="unblock-puzzle" />
      </div>

      <div className="home-actions">
        <p className="ub-choose-label">{t('unblockPuzzleChooseBoard')}</p>

        {DIFFICULTIES.map((difficulty: Difficulty) => {
          const tier = TIERS[difficulty];
          const isCurrent = current?.difficulty === difficulty;
          const range = Number.isFinite(tier.maxMoves)
            ? t('unblockPuzzleRange', { min: tier.minMoves, max: tier.maxMoves })
            : t('unblockPuzzleRangeOpen', { min: tier.minMoves });
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${difficulty === leading ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`unblockPuzzleDifficulty_${difficulty}`)}
              <span className="btn-note">{isCurrent ? t('resume') : range}</span>
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

        <nav className="home-chips ub-chips">
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
        title={t('unblockPuzzleConfirmSwitchTitle')}
        body={
          pending === null || current === null
            ? undefined
            : t('unblockPuzzleConfirmSwitchBody', {
                current: t(`unblockPuzzleDifficulty_${current.difficulty}`),
                next: t(`unblockPuzzleDifficulty_${pending}`),
              })
        }
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const next = pending;
          setPending(null);
          if (next) startFree(next);
        }}
      />
    </div>
  );
}
