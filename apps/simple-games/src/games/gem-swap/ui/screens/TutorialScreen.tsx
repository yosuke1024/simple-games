/**
 * Quick Rules (docs/GEM_SWAP_RULES.md §8): three steps, one sentence each,
 * each a title, a picture and its sentence — leading straight into play
 * (docs/PRODUCT_PRINCIPLES.md「初回体験の原則」). The pictures are drawn with
 * the board's own gems and bar (components/TutorialFigure.tsx). Nothing here
 * says what an invalid swap does: trying shows it, and saying it would teach
 * "failure" where there is none (§8).
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends on a fresh board at the
 * preferred gem count (or, when a suspended round outlived the flag, back on
 * that round), one tap from playing, and hardware Back marks it seen on the
 * way out (state/GameContext.tsx). There is no Learn More until the game has
 * a guide page (ui/landing.ts); the button only appears when one exists.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useGemSwap } from '../../state/GameContext';
import { TutorialFigure, type FigureKind } from '../components/TutorialFigure';

export function GemSwapTutorialScreen() {
  const { tutorialCompleted, canResume, completeTutorial, startNewRound, resumeRound, goHome } =
    useGemSwap();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('gem-swap', locale);
  const [step, setStep] = useState(0);

  const steps: { title: string; body: string; figure: FigureKind; alt: string }[] = [
    {
      title: t('gemSwapStep1Title'),
      body: t('gemSwapStep1Body'),
      figure: 'swap',
      alt: t('gemSwapFigureSwap'),
    },
    {
      title: t('gemSwapStep2Title'),
      body: t('gemSwapStep2Body'),
      figure: 'clear',
      alt: t('gemSwapFigureClear'),
    },
    {
      title: t('gemSwapStep3Title'),
      body: t('gemSwapStep3Body'),
      figure: 'round',
      alt: t('gemSwapFigureRound'),
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  /* The first pass ends on a board (§8). Normally a fresh one — but a
     suspended round can outlive the flag that says these steps were seen
     (`gs.flags` lost or unreadable while `gs.saveGame` is intact), and a new
     board would throw that round away without the question the home asks
     first (§7). Then the steps lead back onto that round. */
  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      if (canResume) resumeRound();
      else startNewRound();
    } else {
      goHome();
    }
  };

  return (
    <div className="screen tutorial-screen gs-tutorial">
      <header className="screen-header">
        <h1>{t('howToPlay')}</h1>
        {tutorialCompleted ? (
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={goHome}>
            <IconClose />
          </button>
        ) : null}
      </header>

      {/* The early-release note (docs/WEB_VERSION.md「保存データ」): a first
          visit opens here, and the last step's button writes the first save,
          so the note is read before any step — on every step, in one place. */}
      <WebBetaNotice gameId="gem-swap" />

      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {steps.map((_, index) => (
            <span key={index} className={`dot ${index === step ? 'dot-active' : ''}`} />
          ))}
        </div>
        <h2 className="tutorial-title">{current.title}</h2>
        <div className="gs-figure" role="img" aria-label={current.alt}>
          <TutorialFigure kind={current.figure} />
        </div>
        <p className="tutorial-body">{current.body}</p>
      </div>

      <div className="tutorial-actions">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
            {t('back')}
          </button>
        ) : (
          <span />
        )}
        {lastStep ? (
          <button type="button" className="btn btn-primary" onClick={finish}>
            {tutorialCompleted ? t('close') : t('startPlaying')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
            {t('next')}
          </button>
        )}
      </div>

      {learnMoreUrl ? (
        <div className="home-links">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => openExternal(learnMoreUrl)}
          >
            {t('learnMore')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
