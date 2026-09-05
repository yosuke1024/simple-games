/**
 * Home (docs/FREECELL_RULES.md §4, §5): a new deal, the daily, and nothing
 * between the player and the cards. Starting a new deal over one in progress
 * is the one thing worth a question.
 *
 * There is no setting here, unlike Klondike's Draw 1 / Draw 3 and Spider's
 * suit count: FreeCell is dealt the same way every time (§13).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconCalendar, IconChart, IconCheck } from '@/ui/components/icons';
import { localDateString } from '../../game';
import { useFreeCell } from '../../state/GameContext';

export function FreeCellHomeScreen() {
  const {
    navigate,
    sessions,
    stats,
    dailyDoneToday,
    startFree,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useFreeCell();
  const { t } = useSettings();
  const [confirmNew, setConfirmNew] = useState(false);

  const freeGame = sessions.free?.status === 'playing' ? sessions.free : null;
  const dailyGame = sessions.daily?.status === 'playing' ? sessions.daily : null;
  const today = localDateString(new Date());
  const dailyIsToday = dailyGame?.dailyDate === today;

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="freecell" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The series mark: the heart. Klondike wears the spade, Spider the
            club — one deck, three games, three suits. */}
        <div className="home-logo" aria-hidden="true">
          ♥
        </div>
        <h1 className="home-title">{t('freecellName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        {freeGame ? (
          <button
            type="button"
            className="btn btn-primary btn-big"
            onClick={() => resumeGame('free')}
          >
            {t('freecellName')}
            <span className="btn-note">{t('resume')}</span>
          </button>
        ) : null}

        <button
          type="button"
          className={`btn ${freeGame ? 'btn-secondary' : 'btn-primary'} btn-big`}
          onClick={() => (freeGame ? setConfirmNew(true) : startFree())}
        >
          {t('fcNewDeal')}
          {stats.bestMoves !== null ? (
            <span className="btn-note">
              {t('fcBestMoves')} {stats.bestMoves}
            </span>
          ) : null}
        </button>

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

        <nav className="home-chips">
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
        open={confirmNew}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => {
          setConfirmNew(false);
          startFree();
        }}
      />
    </div>
  );
}
