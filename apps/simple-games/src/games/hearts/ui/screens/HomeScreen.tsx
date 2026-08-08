/**
 * Home: three opponents, and nothing between the player and the deal. There is
 * no level list — the game has no progression to walk through; every match
 * starts nil-all-all-all.
 *
 * There is no seat to choose either. You sit at the bottom of the table and
 * the three CPU seats are to your left, across and to your right; nothing
 * about Hearts makes one of those a better chair than another, and who leads
 * the first trick is decided by the two of clubs rather than by a coin toss
 * (game/engine.ts).
 *
 * The match slot holds one match, and a match runs to a hundred points across
 * many hands — so replacing one is the one thing here worth asking about
 * first.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconChart } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { DIFFICULTIES, type Difficulty } from '../../game';
import { useHearts } from '../../state/GameContext';

export function HeartsHomeScreen() {
  const {
    navigate,
    session,
    stats,
    canResume,
    difficulty,
    startNewGame,
    resumeGame,
    exitToCollection,
  } = useHearts();
  const { t } = useSettings();
  const [pending, setPending] = useState<Difficulty | null>(null);

  const current = canResume && session ? session : null;

  const choose = (next: Difficulty) => {
    if (current && current.difficulty === next) {
      resumeGame();
      return;
    }
    // Replacing a match in progress is the one thing worth a question.
    if (current) setPending(next);
    else startNewGame(next);
  };

  return (
    <div className="screen home-screen">
      {/* Web build only — the shared PixApps header (docs/WEB_VERSION.md
          「サイトクローム」). Renders nothing on the native app. This game's
          table and result screens deliberately have none. */}
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
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): arriving here should look like the tile that was
            tapped, not like a second mark for the same game. Outlined rather
            than filled — the filled suits belong to the one-player patience
            shelf, the outlined ones to the games played against somebody. */}
        <div className="home-logo" aria-hidden="true">
          ♡
        </div>
        <h1 className="home-title">{t('heartsName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <p className="ht-choose-label">{t('heartsChooseOpponent')}</p>

        {DIFFICULTIES.map((level) => {
          const record = stats[level];
          const isCurrent = current?.difficulty === level;
          // The record so far, stated once and quietly — never a target.
          // Absent until there is one.
          const note = isCurrent
            ? t('resume')
            : record.wins + record.losses + record.draws > 0
              ? t('heartsRecordNote', {
                  wins: record.wins,
                  losses: record.losses,
                  draws: record.draws,
                })
              : null;
          // The match in progress leads; with none, the opponents last played
          // against do, so coming back lands on the usual game.
          const leads = current ? isCurrent : difficulty === level;
          return (
            <button
              key={level}
              type="button"
              className={`btn ${leads ? 'btn-primary' : 'btn-secondary'} btn-big`}
              onClick={() => choose(level)}
            >
              {t(`heartsDifficulty_${level}`)}
              {note ? <span className="btn-note">{note}</span> : null}
            </button>
          );
        })}

        <nav className="home-chips">
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
        title={t('heartsConfirmSwitchTitle')}
        body={
          pending
            ? t('heartsConfirmSwitchBody', {
                current: t(`heartsDifficulty_${current?.difficulty ?? pending}`),
                next: t(`heartsDifficulty_${pending}`),
              })
            : ''
        }
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const next = pending;
          setPending(null);
          if (next) startNewGame(next);
        }}
      />
    </div>
  );
}
