/**
 * Home (docs/MAKE_THE_TARGET_RULES.md §8): the three difficulties and the
 * daily, and nothing between the player and either of them. No levels, no
 * stars, no streak, and no time — the fastest clear is shown on the result
 * card and the statistics only (§9) — and the daily is today's problem only.
 *
 * The Free Play slot holds one problem, so picking a different difficulty
 * replaces it. That is the one thing here worth asking about first (§8). A
 * problem left on the `missed` panel is still in progress: it resumes like
 * any other.
 *
 * The early-release notice under the tagline is the shell's
 * (docs/WEB_VERSION.md「先行公開(ベータ)」): it says, before anything is
 * saved, that this game's saves may be reset while it is in early release.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { IconChart, IconCheck } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { DIFFICULTIES, localDateString, type Difficulty } from '../../game';
import { useMakeTheTarget } from '../../state/GameContext';
import { isSuspendable } from '../../storage/gamePersistence';

export function MakeTheTargetHomeScreen() {
  const {
    navigate,
    sessions,
    prefs,
    dailyDoneToday,
    startDifficulty,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useMakeTheTarget();
  const { t } = useSettings();
  const [pending, setPending] = useState<Difficulty | null>(null);

  const current = isSuspendable(sessions.free) ? sessions.free : null;
  const today = localDateString(new Date());
  // Today's problem or nothing: a daily left from another day is not the one
  // this button names (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」).
  const dailyGame =
    isSuspendable(sessions.daily) && sessions.daily?.dailyDate === today ? sessions.daily : null;
  // The difficulty the home leads with: the one in progress, else the last chosen (§8).
  const leading: Difficulty = current?.difficulty ?? prefs.difficulty;

  const choose = (difficulty: Difficulty) => {
    if (current && current.difficulty === difficulty) {
      resumeGame('free');
      return;
    }
    // Replacing a problem in progress is the one thing worth a question (§8).
    if (current) setPending(difficulty);
    else startDifficulty(difficulty);
  };

  return (
    <div className="screen home-screen illustrated-game-home">
      <GameHomeHeader gameId="make-the-target" onBack={exitToCollection} />

      <div className="home-hero">
        <span className="game-home-artwork" aria-hidden="true">
          <GameArtwork id="make-the-target" />
        </span>
        <h1 className="home-title">{t('makeTheTargetName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="make-the-target" />
      </div>

      <div className="home-actions">
        <p className="tg-choose-label">{t('makeTheTargetChooseTier')}</p>

        {DIFFICULTIES.map((difficulty: Difficulty) => {
          const isCurrent = current?.difficulty === difficulty;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${difficulty === leading ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`makeTheTargetDifficulty_${difficulty}`)}
              <span className="btn-note">
                {isCurrent ? t('resume') : t(`makeTheTargetTierNote_${difficulty}`)}
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

        <nav className="home-chips tg-chips">
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
        title={t('makeTheTargetConfirmSwitchTitle')}
        body={
          pending === null || current === null
            ? undefined
            : t('makeTheTargetConfirmSwitchBody', {
                current: t(`makeTheTargetDifficulty_${current.difficulty}`),
                next: t(`makeTheTargetDifficulty_${pending}`),
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
