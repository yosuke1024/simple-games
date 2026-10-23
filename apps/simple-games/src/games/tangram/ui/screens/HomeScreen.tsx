/**
 * Home (docs/TANGRAM_RULES.md §6): the three tiers and today's daily, and
 * nothing between the player and either. There is no figure list and no
 * gallery — every figure is reached by "next figure" (§6, §12) — and nothing
 * here counts what is left undone.
 *
 * - With a Free Play figure in progress, the main button resumes it, named by
 *   its tier and number. Each tier button starts that tier's next figure, and
 *   while a figure is in progress any of them asks first — the slot holds one
 *   figure, and the question names the one replaced and the one replacing it
 *   (§6). The same tier's button replaces too: it is the one way to move on
 *   from a figure without finishing it.
 * - With none in progress, the tier last chosen leads (`tn.prefs`).
 * - The daily button resumes today's daily when it is in progress (no
 *   question — it is a slot of its own), and otherwise starts today's figure.
 *
 * The header is the shell's (`GameHomeHeader`), and so is the early-release
 * notice under the tagline (docs/WEB_VERSION.md「先行公開(ベータ)」): it says,
 * before anything is saved, that this game's saves may be reset while it is
 * in early release.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { IconChart, IconCheck } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { figureNumber, localDateString, TIERS, type Tier } from '../../game';
import { useTangram } from '../../state/GameContext';
import { figureName } from '../labels';

export function TangramHomeScreen() {
  const {
    navigate,
    sessions,
    prefs,
    dailyDoneToday,
    nextFigureOf,
    startTier,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useTangram();
  const { t } = useSettings();
  const [pending, setPending] = useState<Tier | null>(null);

  const current = sessions.free?.status === 'playing' ? sessions.free : null;
  const today = localDateString(new Date());
  // Today's figure or nothing: a daily from another day is not the one this
  // button names (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」).
  const dailyGame =
    sessions.daily?.status === 'playing' && sessions.daily.dailyDate === today
      ? sessions.daily
      : null;
  const currentName =
    current === null ? null : figureName(t, current.figure.tier, figureNumber(current.figure));

  const choose = (tier: Tier) => {
    // Replacing a figure in progress is the one thing here worth a question (§6).
    if (current) setPending(tier);
    else startTier(tier);
  };

  const pendingFigure = pending === null ? null : nextFigureOf(pending);

  return (
    <div className="screen home-screen illustrated-game-home">
      <GameHomeHeader gameId="tangram" onBack={exitToCollection} />

      <div className="home-hero">
        <span className="game-home-artwork" aria-hidden="true">
          <GameArtwork id="tangram" />
        </span>
        <h1 className="home-title">{t('tangramName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="tangram" />
      </div>

      <div className="home-actions">
        {current !== null ? (
          <button
            type="button"
            className="btn btn-primary btn-big"
            onClick={() => resumeGame('free')}
          >
            {t('resume')}
            <span className="btn-note">{currentName}</span>
          </button>
        ) : null}

        {TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            className={`btn ${current === null && tier === prefs.tier ? 'btn-primary' : 'btn-secondary'} btn-big`}
            onClick={() => choose(tier)}
          >
            {t(`tangramTier_${tier}`)}
          </button>
        ))}

        <button
          type="button"
          className="btn btn-secondary btn-big"
          onClick={() => (dailyGame ? resumeGame('daily') : startDaily())}
        >
          {t('dailyChallenge')}
          {dailyGame ? (
            <span className="btn-note">{t('resume')}</span>
          ) : dailyDoneToday ? (
            <span className="btn-note">
              <IconCheck className="badge-icon" /> {t('dailyDoneBadge')}
            </span>
          ) : null}
        </button>

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
        title={t('tangramConfirmReplaceTitle')}
        body={
          pendingFigure === null || currentName === null
            ? undefined
            : t('tangramConfirmReplaceBody', {
                current: currentName,
                next: figureName(t, pendingFigure.tier, figureNumber(pendingFigure)),
              })
        }
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const next = pending;
          setPending(null);
          if (next) startTier(next);
        }}
      />
    </div>
  );
}
