/**
 * Home (docs/YACHT_RULES.md §1, §7, §8, §13): the primary action starts or
 * resumes the CPU match. The optional nearby entry hands control to the shell
 * without starting, replacing, or resuming that match.
 *
 * The slot holds one match, so starting a new one while a match is in
 * progress replaces it. That is the one thing here worth asking about first;
 * resuming is the button that leads.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { IconChart } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { PlayTogetherButton } from '@/ui/components/PlayTogetherButton';
import { CATEGORY_COUNT, cpuTotalOf, totalOf, turnsPlayed } from '../../game';
import { useYacht } from '../../state/GameContext';

export function YachtHomeScreen({
  onPlayTogether,
  playTogetherActive = false,
}: {
  onPlayTogether?: () => void;
  playTogetherActive?: boolean;
} = {}) {
  const { navigate, session, stats, canResume, startNewGame, resumeGame, exitToCollection } =
    useYacht();
  const { t } = useSettings();
  const [confirmReplace, setConfirmReplace] = useState(false);

  const current = canResume && session ? session : null;
  const turn = current ? turnsPlayed(current) + 1 : 0;
  const played = stats.wins + stats.losses + stats.draws;

  return (
    <div className="screen home-screen illustrated-game-home">
      <GameHomeHeader gameId="yacht" onBack={exitToCollection} />

      <div className="home-hero">
        <span className="game-home-artwork" aria-hidden="true">
          <GameArtwork id="yacht" />
        </span>
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
                  cpuTotal: cpuTotalOf(current),
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
            {/* The standing record, stated once and quietly — never a target
                or a streak (§7). A record with no result yet (migrated from
                the solo days, before the CPU) shows only the best. */}
            {played > 0 ? (
              <span className="btn-note">
                {t('yachtRecordNote', {
                  wins: stats.wins,
                  losses: stats.losses,
                  best: stats.bestScore ?? 0,
                })}
              </span>
            ) : stats.bestScore !== null ? (
              <span className="btn-note">{t('yachtBestNote', { score: stats.bestScore })}</span>
            ) : null}
          </button>
        )}

        <PlayTogetherButton
          onPlayTogether={onPlayTogether}
          playTogetherActive={playTogetherActive}
        />

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
