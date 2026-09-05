/**
 * Home (docs/SOLITAIRE_RULES.md §4, §5): a new deal, the daily, and the draw
 * setting — nothing between the player and the cards. The draw toggle
 * applies from the next deal (§4), so flipping it never touches a game in
 * progress; starting a new deal over one is the one thing worth a question.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconCalendar, IconChart, IconCheck } from '@/ui/components/icons';
import { localDateString } from '../../game';
import { useSolitaire } from '../../state/GameContext';

export function SolitaireHomeScreen() {
  const {
    navigate,
    sessions,
    stats,
    drawThree,
    setDrawThree,
    dailyDoneToday,
    startFree,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useSolitaire();
  const { t } = useSettings();
  const [confirmNew, setConfirmNew] = useState(false);

  const freeGame = sessions.free?.status === 'playing' ? sessions.free : null;
  const dailyGame = sessions.daily?.status === 'playing' ? sessions.daily : null;
  const today = localDateString(new Date());
  const dailyIsToday = dailyGame?.dailyDate === today;

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="solitaire" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The series mark: the spade — the deck in one glyph. */}
        <div className="home-logo" aria-hidden="true">
          ♠
        </div>
        <h1 className="home-title">{t('solitaireName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        {freeGame ? (
          <button
            type="button"
            className="btn btn-primary btn-big"
            onClick={() => resumeGame('free')}
          >
            {t('solitaireName')}
            <span className="btn-note">{t('resume')}</span>
          </button>
        ) : null}

        <button
          type="button"
          className={`btn ${freeGame ? 'btn-secondary' : 'btn-primary'} btn-big`}
          onClick={() => (freeGame ? setConfirmNew(true) : startFree())}
        >
          {t('solNewDeal')}
          {stats.bestMoves !== null ? (
            <span className="btn-note">
              {t('solBestMoves')} {stats.bestMoves}
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

        {/* Draw 1 / Draw 3 — applies from the next deal (§4). */}
        <div className="segmented sol-draw-toggle" role="group" aria-label={t('solDrawSetting')}>
          <button
            type="button"
            className={`segment ${drawThree ? '' : 'segment-active'}`}
            aria-pressed={!drawThree}
            onClick={() => setDrawThree(false)}
          >
            {t('solDrawOne')}
          </button>
          <button
            type="button"
            className={`segment ${drawThree ? 'segment-active' : ''}`}
            aria-pressed={drawThree}
            onClick={() => setDrawThree(true)}
          >
            {t('solDrawThree')}
          </button>
        </div>
        <p className="sol-draw-note">{t('solDrawNote')}</p>

        <nav className="home-chips sol-chips">
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
