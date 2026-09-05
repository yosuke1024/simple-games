/**
 * Home (docs/MINESWEEPER_RULES.md §8): three boards and the daily, and nothing
 * between the player and either of them. There is no level list — Minesweeper
 * has no progression to walk through, and inventing 999 of them would be
 * padding (§8, §13).
 *
 * The difficulty slot holds one game, so picking a different difficulty
 * replaces it. That is the one thing here worth asking about first (§8).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeActions } from '@/ui/components/GameHomeActions';
import { IconBack, IconCalendar, IconChart, IconCheck } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { formatDuration } from '@/ui/format';
import { DIFFICULTIES, localDateString, PRESETS, type Difficulty } from '../../game';
import { useMinesweeper } from '../../state/GameContext';

export function MinesHomeScreen() {
  const {
    navigate,
    sessions,
    stats,
    dailyDoneToday,
    startDifficulty,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useMinesweeper();
  const { t } = useSettings();
  const [pending, setPending] = useState<Difficulty | null>(null);

  const current = sessions.difficulty?.status === 'playing' ? sessions.difficulty : null;
  const dailyGame = sessions.daily?.status === 'playing' ? sessions.daily : null;
  const today = localDateString(new Date());
  const dailyIsToday = dailyGame?.dailyDate === today;

  const choose = (difficulty: Difficulty) => {
    if (current && current.difficulty === difficulty) {
      resumeGame('difficulty');
      return;
    }
    // Replacing a game in progress is the one thing worth a question (§8).
    if (current) setPending(difficulty);
    else startDifficulty(difficulty);
  };

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
        <GameHomeActions gameId="minesweeper" />
      </header>

      <div className="home-hero">
        {/* The series mark: a tile holding the game's whole shape — one mine. */}
        <div className="home-logo" aria-hidden="true">
          ✸
        </div>
        <h1 className="home-title">{t('minesName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <p className="mines-choose-label">{t('minesChooseBoard')}</p>

        {DIFFICULTIES.map((difficulty: Difficulty) => {
          const preset = PRESETS[difficulty];
          const best = stats[difficulty].bestSeconds;
          const isCurrent = current?.difficulty === difficulty;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`minesDifficulty_${difficulty}`)}
              <span className="btn-note">
                {isCurrent
                  ? t('resume')
                  : t('minesBoardNote', {
                      width: preset.width,
                      height: preset.height,
                      mines: preset.mines,
                    })}
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

        <nav className="home-chips mines-chips">
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
        title={t('minesConfirmSwitchTitle')}
        body={
          pending === null || current === null
            ? undefined
            : t('minesConfirmSwitchBody', {
                current: t(`minesDifficulty_${current.difficulty}`),
                next: t(`minesDifficulty_${pending}`),
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
