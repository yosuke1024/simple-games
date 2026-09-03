import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconCalendar, IconChart, IconCheck, IconGrid } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, localDateString, MAX_LEVEL } from '../../game';
import { useSudoku } from '../../state/GameContext';
import { solvedLevelCount } from '../../state/statsLogic';

/**
 * Each mode has its own entry point and its own suspended game, so nothing
 * here can cost the player a game in progress — the one exception is asking
 * for a *new* free board while one is suspended, which asks first (§9).
 */
export function SudokuHomeScreen() {
  const {
    navigate,
    sessions,
    progress,
    dailyDoneToday,
    startLevel,
    startDaily,
    startFree,
    freeDifficulty,
    setFreeDifficulty,
    resumeGame,
    exitToCollection,
  } = useSudoku();
  const { t } = useSettings();
  const [confirmNewFree, setConfirmNewFree] = useState(false);

  const levelGame = sessions.level?.status === 'playing' ? sessions.level : null;
  const dailyGame = sessions.daily?.status === 'playing' ? sessions.daily : null;
  const freeGame = sessions.free?.status === 'playing' ? sessions.free : null;
  const today = localDateString(new Date());
  const dailyIsToday = dailyGame?.dailyDate === today;
  const frontierBest = progress.bestTimes[String(progress.highestUnlocked)];

  return (
    <div className="screen home-screen">
      {/* Web build only — the shared PixApps header (docs/WEB_VERSION.md
          「サイトクローム」). Renders nothing on the native app. This game's
          board and result screens deliberately have none. */}
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
        <span className="icon-btn-placeholder" />
      </header>

      <div className="home-hero">
        {/* The series mark: a tile holding the game's whole shape — a 3x3 box. */}
        <div className="home-logo" aria-hidden="true">
          ⌗
        </div>
        <h1 className="home-title">{t('sudokuName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <button
          type="button"
          className="btn btn-primary btn-big"
          onClick={() => (levelGame ? resumeGame('level') : startLevel(progress.highestUnlocked))}
        >
          {t('modeLevel', { n: levelGame?.level ?? progress.highestUnlocked })}
          {levelGame ? (
            <span className="btn-note">{t('resume')}</span>
          ) : frontierBest !== undefined ? (
            <span className="btn-note">
              {t('bestTime')} {formatDuration(frontierBest)}
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

        {/* Free Play (§9「フリープレイ」): a fresh board at the tier below,
            beside the climb and the daily rather than instead of them. A
            suspended free board resumes from the same button; a new one while
            it is suspended is a separate, confirmed ask. */}
        <button
          type="button"
          className="btn btn-secondary btn-big"
          onClick={() => (freeGame ? resumeGame('free') : startFree())}
        >
          {t('freePlay')}
          <span className="btn-note">
            {freeGame
              ? `${t('resume')} · ${t(`sudokuTier_${freeGame.difficulty}`)}`
              : t(`sudokuTier_${freeDifficulty}`)}
          </span>
        </button>
        {freeGame ? (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmNewFree(true)}>
            {t('newGame')}
          </button>
        ) : null}
        <div className="segmented free-play-toggle" role="group" aria-label={t('difficulty')}>
          {DIFFICULTIES.map((difficulty) => (
            <button
              key={difficulty}
              type="button"
              className={`segment ${difficulty === freeDifficulty ? 'segment-active' : ''}`}
              aria-pressed={difficulty === freeDifficulty}
              onClick={() => setFreeDifficulty(difficulty)}
            >
              {t(`sudokuTier_${difficulty}`)}
            </button>
          ))}
        </div>
        <p className="free-play-note">{t('freePlayNote')}</p>

        <nav className="home-chips">
          <button type="button" className="home-chip" onClick={() => navigate('levels')}>
            <IconGrid className="home-chip-icon" />
            <span>{t('levelsTitle')}</span>
            {/* How far up the hundred: a fraction with an end, said once. */}
            <span className="home-chip-count">
              {solvedLevelCount(progress)}/{MAX_LEVEL}
            </span>
          </button>
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
        open={confirmNewFree}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmNewFree(false)}
        onConfirm={() => {
          setConfirmNewFree(false);
          startFree();
        }}
      />
    </div>
  );
}
