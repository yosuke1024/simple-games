/**
 * Home (docs/YACHT_RULES.md §6, §7): one game, one button, and nothing
 * between the player and the dice. There is no level list and no mode — every
 * game is the same twelve boxes.
 *
 * The slot holds one sheet, so starting a new one while a sheet is in
 * progress replaces it. That is the one thing here worth asking about first;
 * resuming is the button that leads.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { CATEGORY_COUNT, totalOf, turnsPlayed } from '../../game';
import { useYacht } from '../../state/GameContext';

export function YachtHomeScreen() {
  const { navigate, session, stats, canResume, startNewGame, resumeGame, exitToCollection } =
    useYacht();
  const { t } = useSettings();
  const [confirmReplace, setConfirmReplace] = useState(false);

  const current = canResume && session ? session : null;
  const turn = current ? turnsPlayed(current) + 1 : 0;

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="yacht" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): arriving here should look like the tile that
            was tapped, not like a second mark for the same game. */}
        <div className="home-logo" aria-hidden="true">
          ⚄
        </div>
        <h1 className="home-title">{t('yachtName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="yacht" />
      </div>

      <div className="home-actions">
        {current ? (
          <>
            <button type="button" className="btn btn-primary btn-big" onClick={resumeGame}>
              {t('resume')}
              <span className="btn-note">
                {t('yachtResumeNote', {
                  turn,
                  count: CATEGORY_COUNT,
                  total: totalOf(current),
                })}
              </span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-big"
              onClick={() => setConfirmReplace(true)}
            >
              {t('newGame')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-big" onClick={startNewGame}>
            {t('newGame')}
            {/* The best so far, stated once and quietly — never a target. */}
            {stats.bestScore !== null ? (
              <span className="btn-note">{t('yachtBestNote', { score: stats.bestScore })}</span>
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
        open={confirmReplace}
        title={t('yachtConfirmReplaceTitle')}
        body={t('yachtConfirmReplaceBody', { turn, count: CATEGORY_COUNT })}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => {
          setConfirmReplace(false);
          startNewGame();
        }}
      />
    </div>
  );
}
