/**
 * Gem Swap's home (docs/GEM_SWAP_RULES.md §2, §5, §7): the shared header, the
 * hero, the early-release notice, one way into a round, the gem count, and
 * the three numbers the statistics keep.
 *
 * Free Play only — no levels, no daily. A suspended round is offered back
 * first ("Resume", with its score and gem count); replacing it with a new
 * round is the one thing here worth asking about, and the question is the
 * same one every game asks. With nothing suspended, New Game opens a fresh
 * board at once.
 *
 * The gem count is a choice that can be left alone: six (Normal) until
 * somebody picks, remembered once picked (`gs.prefs`), and it only reaches
 * new rounds — a suspended round keeps the count it began with (§2). Nothing
 * has to be chosen before playing.
 *
 * The early-release notice under the tagline is the shell's
 * (docs/WEB_VERSION.md「先行公開(ベータ)」): it says, before anything is saved,
 * that this game's saves may be reset while it is in early release.
 */
import { useState } from 'react';
import type { MessageKey } from '@/i18n';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { bestFor, COLOR_COUNTS, type ColorCount } from '../../game';
import { useGemSwap } from '../../state/GameContext';

/** The segmented control's labels — literal keys, so every one is greppable. */
const KINDS_KEYS: Readonly<Record<ColorCount, MessageKey>> = {
  5: 'gemSwapKinds_5',
  6: 'gemSwapKinds_6',
};

export function GemSwapHomeScreen() {
  const {
    session,
    stats,
    colors,
    canResume,
    setColors,
    navigate,
    startNewRound,
    resumeRound,
    exitToCollection,
  } = useGemSwap();
  const { t } = useSettings();
  const [confirmNew, setConfirmNew] = useState(false);
  const best = bestFor(stats, colors);

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="gem-swap" onBack={exitToCollection} />

      <div className="home-hero">
        {/* Matches the tile glyph in app/registry.ts. */}
        <div className="home-logo" aria-hidden="true">
          {'❖'}
        </div>
        <h1 className="home-title">{t('gemSwapName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="gem-swap" />
      </div>

      <div className="home-actions">
        {canResume && session ? (
          <>
            <button type="button" className="btn btn-primary btn-big" onClick={resumeRound}>
              {t('resume')}
              <span className="btn-note">
                {t('gemSwapResumeNote', {
                  score: session.round.score,
                  kinds: t('gemSwapKindsCount', { count: session.round.colors }),
                })}
              </span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-big"
              onClick={() => setConfirmNew(true)}
            >
              {t('newGame')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-big" onClick={startNewRound}>
            {t('newGame')}
            {/* The best for this gem count, stated once and quietly — never a target. */}
            {best > 0 ? (
              <span className="btn-note">{t('gemSwapBestNote', { score: best })}</span>
            ) : null}
          </button>
        )}

        <div className="gs-kinds">
          <span className="gs-kinds-label" id="gs-kinds-label">
            {t('gemSwapKinds')}
          </span>
          <div className="segmented gs-kinds-toggle" role="group" aria-labelledby="gs-kinds-label">
            {COLOR_COUNTS.map((option) => (
              <button
                key={option}
                type="button"
                className={`segment ${option === colors ? 'segment-active' : ''}`}
                aria-pressed={option === colors}
                onClick={() => setColors(option)}
              >
                {t(KINDS_KEYS[option])}
              </button>
            ))}
          </div>
        </div>

        {/* The statistics, all three (§7): no streak, no totals beyond these. */}
        <dl className="gs-home-stats">
          <div>
            <dt>{t('played')}</dt>
            <dd>{stats.played}</dd>
          </div>
          {COLOR_COUNTS.map((option) => {
            const value = bestFor(stats, option);
            return (
              <div key={option}>
                <dt>{t('gemSwapBestFor', { kinds: t('gemSwapKindsCount', { count: option }) })}</dt>
                <dd>{value > 0 ? value : '—'}</dd>
              </div>
            );
          })}
        </dl>

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
          startNewRound();
        }}
      />
    </div>
  );
}
