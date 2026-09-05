/**
 * Home (docs/GAME_2048_RULES.md §13): one board size, one game at a time, and
 * nothing between the player and it. There is no level list and no daily —
 * every board is generated from a fresh seed, so there is nothing to walk
 * through and nothing to come back for at a particular hour.
 *
 * A game in progress is offered back before a new one, and replacing it is the
 * one thing here worth asking about first.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeActions } from '@/ui/components/GameHomeActions';
import { IconBack, IconChart } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { useGame2048 } from '../../state/GameContext';

export function Game2048HomeScreen() {
  const { navigate, session, stats, canResume, startNewGame, resumeGame, exitToCollection } =
    useGame2048();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);

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
        <GameHomeActions gameId="2048" />
      </header>

      <div className="home-hero">
        {/* The series mark: two tiles pushed together — a merge. */}
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): arriving here should look like the tile that
            was tapped, not like a second mark for the same game. */}
        <div className="home-logo" aria-hidden="true">
          ⊞
        </div>
        <h1 className="home-title">{t('mergeName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        {canResume && session ? (
          <>
            <button type="button" className="btn btn-primary btn-big" onClick={resumeGame}>
              {t('resume')}
              <span className="btn-note">
                {t('score')} {session.score}
              </span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-big"
              onClick={() => setConfirmNewGame(true)}
            >
              {t('newGame')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-big" onClick={startNewGame}>
            {t('newGame')}
            {/* The record to beat, stated once and quietly — never a target. */}
            {stats.bestScore > 0 ? (
              <span className="btn-note">
                {t('mergeBestScore')} {stats.bestScore}
              </span>
            ) : null}
          </button>
        )}

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
        open={confirmNewGame}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmNewGame(false)}
        onConfirm={() => {
          setConfirmNewGame(false);
          startNewGame();
        }}
      />
    </div>
  );
}
