/**
 * Home (docs/SPIDER_SOLITAIRE_RULES.md §4, §5, § difficulty): a new deal, the
 * daily, and the suit count — nothing between the player and the cards.
 *
 * The suit toggle applies from the next deal, so flipping it never touches a
 * game in progress; starting a new deal over one is the one thing worth a
 * question.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeActions } from '@/ui/components/GameHomeActions';
import { IconBack, IconCalendar, IconChart, IconCheck } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { localDateString, SUIT_COUNTS, type SuitCount } from '../../game';
import { useSpider } from '../../state/GameContext';
import { statsFor } from '../../state/statsLogic';

export function SpiderHomeScreen() {
  const {
    navigate,
    sessions,
    stats,
    suitCount,
    setSuitCount,
    dailyDoneToday,
    startFree,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useSpider();
  const { t } = useSettings();
  const [confirmNew, setConfirmNew] = useState(false);

  const freeGame = sessions.free?.status === 'playing' ? sessions.free : null;
  const dailyGame = sessions.daily?.status === 'playing' ? sessions.daily : null;
  const today = localDateString(new Date());
  const dailyIsToday = dailyGame?.dailyDate === today;
  const best = statsFor(stats, suitCount).bestMoves;

  const label = (n: SuitCount): string =>
    n === 1 ? t('spiderOneSuit') : n === 2 ? t('spiderTwoSuits') : t('spiderFourSuits');

  return (
    <div className="screen home-screen">
      {/* Web build only — the shared PixApps header (docs/WEB_VERSION.md
          「サイトクローム」). Renders nothing on the native app. */}
      <WebChromeSlot />

      <header className="screen-header">
        <button
          type="button"
          className="icon-btn"
          aria-label={t('backToGames')}
          onClick={exitToCollection}
        >
          <IconBack />
        </button>
        <GameHomeActions gameId="spider-solitaire" />
      </header>

      <div className="home-hero">
        {/* The series mark: the club. Klondike wears the spade and FreeCell the
            heart — one deck, three games, three suits. */}
        <div className="home-logo" aria-hidden="true">
          ♣
        </div>
        <h1 className="home-title">{t('spiderName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        {freeGame ? (
          <button
            type="button"
            className="btn btn-primary btn-big"
            onClick={() => resumeGame('free')}
          >
            {t('spiderName')}
            <span className="btn-note">{t('resume')}</span>
          </button>
        ) : null}

        <button
          type="button"
          className={`btn ${freeGame ? 'btn-secondary' : 'btn-primary'} btn-big`}
          onClick={() => (freeGame ? setConfirmNew(true) : startFree())}
        >
          {t('spiderNewDeal')}
          {best !== null ? (
            <span className="btn-note">
              {t('spiderBestMoves')} {best}
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

        {/* One / two / four suits — applies from the next deal. */}
        <div className="segmented sp-suit-toggle" role="group" aria-label={t('spiderDifficulty')}>
          {SUIT_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`segment ${suitCount === n ? 'segment-active' : ''}`}
              aria-pressed={suitCount === n}
              onClick={() => setSuitCount(n)}
            >
              {label(n)}
            </button>
          ))}
        </div>
        <p className="sp-suit-note">{t('spiderDifficultyNote')}</p>

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
