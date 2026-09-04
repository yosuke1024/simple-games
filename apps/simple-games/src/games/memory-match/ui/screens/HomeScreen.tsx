/**
 * Home (docs/MEMORY_MATCH_RULES.md §6): three boards and the daily, and
 * nothing between the player and either of them. There is no level list —
 * memory has no progression to walk through, and inventing 999 stops would be
 * padding (§6).
 *
 * The difficulty slot holds one game, so picking a different board replaces
 * it. That is the one thing here worth asking about first (§6).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { FavoriteAction } from '@/ui/components/FavoriteAction';
import { IconBack, IconCalendar, IconChart, IconCheck } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { DIFFICULTIES, LAYOUTS, localDateString, type Difficulty } from '../../game';
import { useMemoryMatch } from '../../state/GameContext';

export function MemoryHomeScreen() {
  const {
    navigate,
    sessions,
    stats,
    dailyDoneToday,
    startDifficulty,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useMemoryMatch();
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
    // Replacing a game in progress is the one thing worth a question (§6).
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
        <FavoriteAction gameId="memory-match" />
      </header>

      <div className="home-hero">
        {/* The series mark: two cards overlapping — a pair. */}
        <div className="home-logo" aria-hidden="true">
          ⧉
        </div>
        <h1 className="home-title">{t('memoryMatchName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <p className="mm-choose-label">{t('memoryChooseBoard')}</p>

        {DIFFICULTIES.map((difficulty: Difficulty) => {
          const layout = LAYOUTS[difficulty];
          const best = stats[difficulty].bestMoves;
          const isCurrent = current?.difficulty === difficulty;
          return (
            <button
              key={difficulty}
              type="button"
              className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(difficulty)}
            >
              {t(`memoryDifficulty_${difficulty}`)}
              <span className="btn-note">
                {isCurrent
                  ? t('resume')
                  : t('memoryBoardNote', {
                      cols: layout.cols,
                      rows: layout.rows,
                      pairs: layout.pairs,
                    })}
                {/* The record to beat, stated once and quietly — never a target. */}
                {!isCurrent && best !== null ? ` · ${t('memoryBestMoves')} ${best}` : ''}
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

        <nav className="home-chips mm-chips">
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
        title={t('memoryConfirmSwitchTitle')}
        body={
          pending === null || current === null
            ? undefined
            : t('memoryConfirmSwitchBody', {
                current: t(`memoryDifficulty_${current.difficulty}`),
                next: t(`memoryDifficulty_${pending}`),
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
